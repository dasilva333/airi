<script setup lang="ts">
import type { Message } from '@xsai/shared-chat'

import { needleClient } from '@proj-airi/stage-ui/libs/inference'
import { BoundedCategoryClassifier } from '@proj-airi/stage-ui/libs/pacing/category-classifier'
import { getThinkingAudio } from '@proj-airi/stage-ui/libs/pacing/pacing-cache'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useSystemOneStore } from '@proj-airi/stage-ui/stores/modules/system-one'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { DEFAULT_PACING_FILLERS } from '@proj-airi/stage-ui/types/pacing'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  pacingEnabled?: boolean
  selectedSpeechProvider?: string
  selectedSpeechModel?: string
  selectedSpeechVoiceId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'navigateToPacing'): void
  (e: 'applyPreset', presetId: 'snappy' | 'balanced' | 'deep_cot'): void
}>()

const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const speechStore = useSpeechStore()
const systemOneStore = useSystemOneStore()

// --- Top-Right Brain Picker ---
const activeBrainProvider = ref<string>(consciousnessStore.activeProvider || '')
const activeBrainModel = ref<string>(consciousnessStore.activeModel || '')

// Available Chat Providers
const availableChatProviders = computed(() => {
  return providersStore.allProvidersMetadata.filter((m) => {
    return m.category === 'chat' || m.tasks?.includes('chat')
  })
})

// Models for selected provider
const availableModels = computed(() => {
  if (!activeBrainProvider.value)
    return []
  return providersStore.getModelsForProvider(activeBrainProvider.value) || []
})

// Sync when consciousnessStore updates if local is empty
watch(() => consciousnessStore.activeProvider, (p) => {
  if (p && !activeBrainProvider.value) {
    activeBrainProvider.value = p
  }
}, { immediate: true })

watch(() => consciousnessStore.activeModel, (m) => {
  if (m && !activeBrainModel.value) {
    activeBrainModel.value = m
  }
}, { immediate: true })

watch(activeBrainProvider, async (newProv) => {
  if (newProv) {
    await providersStore.fetchModelsForProvider(newProv)
    const models = providersStore.getModelsForProvider(newProv)
    if (models && models.length > 0 && (!activeBrainModel.value || !models.some(m => m.id === activeBrainModel.value))) {
      activeBrainModel.value = models[0].id
    }
  }
})

// --- Scenario Presets ---
interface ScenarioPreset {
  id: string
  title: string
  icon: string
  prompt: string
}

const scenarioPresets: ScenarioPreset[] = [
  {
    id: 'space-physics',
    title: '🚀 Relativistic Spacecraft',
    icon: 'i-solar:rocket-bold-duotone',
    prompt: 'If a spacecraft accelerates at a constant 1g proper acceleration from Earth to Alpha Centauri (4.37 light-years away), calculate the journey duration in Earth coordinate time vs the crew\'s proper time. Then analyze how relativistic interstellar dust impact drag alters the required antimatter fuel fraction.',
  },
  {
    id: 'chess-endgame',
    title: '♟️ Chess Endgame',
    icon: 'i-solar:gamepad-bold-duotone',
    prompt: 'Analyze the Lucena position versus the Philidor defense in a Rook and Pawn versus Rook endgame. Trace out the exact critical triangulation moves and king shelter maneuvers required to build a bridge and force promotion.',
  },
  {
    id: 'kernel-deadlock',
    title: '💻 Kernel Deadlock',
    icon: 'i-solar:laptop-bold-duotone',
    prompt: 'Explain the mechanism of priority inversion in real-time Linux mutexes. How does the Priority Inheritance Protocol prevent unbounded deadlock when a low-priority thread holds a lock needed by a high-priority thread while a medium-priority thread runs continuously?',
  },
  {
    id: 'riemann-hypothesis',
    title: '📐 Riemann Hypothesis',
    icon: 'i-solar:calculator-bold-duotone',
    prompt: 'Walk through the analytic continuation of the Riemann zeta function to the critical strip 0 < Re(s) < 1. Detail why the non-trivial zeros are intimately tied to the distribution of prime numbers via the explicit formula and Euler product.',
  },
]

const scenarioPrompt = ref(scenarioPresets[0].prompt)

function selectScenario(preset: ScenarioPreset) {
  scenarioPrompt.value = preset.prompt
}

// --- Quick Personality / Pacing Presets ---
function applyPreset(presetId: 'snappy' | 'balanced' | 'deep_cot') {
  emit('applyPreset', presetId)
  if (presetId === 'snappy') {
    testCadenceSec.value = 3
    initialFillerBypass.value = false
    maxAsideWords.value = 6
  }
  else if (presetId === 'balanced') {
    testCadenceSec.value = 5
    initialFillerBypass.value = false
    maxAsideWords.value = 8
  }
  else if (presetId === 'deep_cot') {
    testCadenceSec.value = 10
    initialFillerBypass.value = false
    maxAsideWords.value = 12
  }
  appendLog('CONFIG', `Applied pacing preset: "${presetId}" (Cadence: ${testCadenceSec.value}s, Max Words: ${maxAsideWords.value})`, 'info')
}

// --- Knobs & Configuration ---
const initialFillerBypass = ref(false)
const dynamicAsidesEnabled = ref(true)
const testCadenceSec = ref<number>(5)
const maxAsideWords = ref<number>(8)
const minConfidenceThreshold = ref<number>(75)
const abortAfterFillers = ref<number>(2)
const abortOnAnswerStart = ref<boolean>(true)
const isEarlyExit = ref<boolean>(false)

// --- 5-Stage Color Pipeline State ---
export type SpanStage = 'white' | 'orange' | 'yellow' | 'green' | 'purple'

export interface ReasoningSpan {
  id: string
  text: string
  stage: SpanStage
  asideText?: string
  confidence?: number
  category?: string
}

const reasoningSpans = ref<ReasoningSpan[]>([])
const directAnswerText = ref('')
const isDirectAnswerModel = ref(false)
const isStreaming = ref(false)
const liveStatus = ref<'IDLE' | 'ARMED' | 'STREAMING' | 'EVALUATING' | 'PLAYING_FILLER' | 'COMPLETED' | 'ABORTED'>('IDLE')

// Active audio playback visualizer
const currentPlayingPhrase = ref<string | null>(null)
const isAudioPlaying = ref(false)
let currentAudioElement: HTMLAudioElement | null = null

// Telemetry & Metrics
const ttftMs = ref<number | null>(null)
const reasoningTokenCount = ref(0)
const totalWordsEvaluated = ref(0)
const strideEvaluationsCount = ref(0)
const fillersSpokenCount = ref(0)
const lastSystemOneLatencyMs = ref<number | null>(null)
const lastNeedleLatencyMs = ref<number | null>(null)

// Chronological State Log
export interface LedgerEntry {
  id: string
  time: string
  phase: string
  message: string
  type: 'info' | 'arm' | 'stride' | 'pivot' | 'audio' | 'warn'
}

const stateLedger = ref<LedgerEntry[]>([])

let startTime = 0
let abortController: AbortController | null = null
let initialDeadlineTimer: ReturnType<typeof setTimeout> | null = null
let cadenceIntervalTimer: ReturnType<typeof setInterval> | null = null
const reasoningViewportRef = ref<HTMLElement | null>(null)

function getElapsedTimeStr(): string {
  if (!startTime)
    return '00:00.0'
  const elapsed = Math.max(0, Date.now() - startTime)
  const totalSec = Math.floor(elapsed / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const tenths = Math.floor((elapsed % 1000) / 100)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`
}

function appendLog(phase: string, message: string, type: LedgerEntry['type'] = 'info') {
  stateLedger.value.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: getElapsedTimeStr(),
    phase,
    message,
    type,
  })
}

// Scroll to bottom of reasoning stream
function scrollToBottom() {
  nextTick(() => {
    if (reasoningViewportRef.value) {
      reasoningViewportRef.value.scrollTop = reasoningViewportRef.value.scrollHeight
    }
  })
}

// Early exit trigger: stops background LLM stream to conserve tokens while preserving spoken audio
function triggerEarlyExit(reason: string) {
  if (isEarlyExit.value || !isStreaming.value)
    return
  isEarlyExit.value = true
  appendLog('EARLY-EXIT', `Early exit triggered: ${reason} (Halting LLM stream)`, 'info')
  if (abortController) {
    abortController.abort()
  }
}

// --- Audio Playback Engine ---
async function playAudioPhrase(text: string) {
  if (!text || !text.trim())
    return
  currentPlayingPhrase.value = text
  isAudioPlaying.value = true
  fillersSpokenCount.value++
  appendLog('AUDIO', `🎙️ Speaking filler: "${text}"`, 'audio')

  // Early Exit Check: Reached target filler count
  if (abortAfterFillers.value > 0 && fillersSpokenCount.value >= abortAfterFillers.value) {
    triggerEarlyExit(`Reached filler target (${fillersSpokenCount.value}/${abortAfterFillers.value})`)
  }

  // Check cache or synthesize
  try {
    const cached = await getThinkingAudio({
      provider: props.selectedSpeechProvider || 'browser-speech',
      model: props.selectedSpeechModel || 'default',
      voiceId: props.selectedSpeechVoiceId || 'default',
      text: text.trim(),
    })

    if (cached?.audio) {
      const blob = new Blob([cached.audio], { type: 'audio/mp3' })
      const url = URL.createObjectURL(blob)
      if (currentAudioElement) {
        currentAudioElement.pause()
        currentAudioElement = null
      }
      const audio = new Audio(url)
      currentAudioElement = audio
      audio.onended = () => {
        isAudioPlaying.value = false
        currentPlayingPhrase.value = null
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        isAudioPlaying.value = false
        currentPlayingPhrase.value = null
        URL.revokeObjectURL(url)
      }
      await audio.play()
      return
    }

    const speechProv = props.selectedSpeechProvider || speechStore.activeSpeechProvider
    if (speechProv) {
      const providerInstance = await providersStore.getProviderInstance(speechProv)
      if (providerInstance) {
        const model = props.selectedSpeechModel || speechStore.activeSpeechModel || ''
        const voiceId = props.selectedSpeechVoiceId || speechStore.activeSpeechVoiceId || ''
        const buf = await speechStore.speech(providerInstance as any, model, text, voiceId)
        if (buf && buf.byteLength > 0) {
          const blob = new Blob([buf], { type: 'audio/wav' })
          const url = URL.createObjectURL(blob)
          if (currentAudioElement) {
            currentAudioElement.pause()
            currentAudioElement = null
          }
          const audio = new Audio(url)
          currentAudioElement = audio
          audio.onended = () => {
            isAudioPlaying.value = false
            currentPlayingPhrase.value = null
            URL.revokeObjectURL(url)
          }
          audio.onerror = () => {
            isAudioPlaying.value = false
            currentPlayingPhrase.value = null
            URL.revokeObjectURL(url)
          }
          await audio.play()
          return
        }
      }
    }
  }
  catch (err) {
    console.warn('[PacingPlayground] Cache lookup/playback error:', err)
  }

  // Fallback: Web Speech API synthesis if available
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.05
      utterance.onend = () => {
        isAudioPlaying.value = false
        currentPlayingPhrase.value = null
      }
      utterance.onerror = () => {
        isAudioPlaying.value = false
        currentPlayingPhrase.value = null
      }
      window.speechSynthesis.speak(utterance)
      return
    }
    catch (err) {
      console.warn('[PacingPlayground] SpeechSynthesis error:', err)
    }
  }

  // Simulation timeout if no audio hardware
  setTimeout(() => {
    isAudioPlaying.value = false
    currentPlayingPhrase.value = null
  }, 1400)
}

// --- Stride Evaluation Engine (System 1 + Needle / Regex) ---
const classifier = new BoundedCategoryClassifier({ categoryThreshold: 1 })
let pendingStrideBuffer = ''
let isEvaluatingStride = false

// Conversational Pacing Invariants & Rate-Limiting State
const MAX_FILLERS_PER_TURN = 3
let lastFillerSpokenAtMs = 0
const recentlySpokenPhrases = new Set<string>()

async function evaluateCurrentStride(isFinal = false) {
  if (!dynamicAsidesEnabled.value || isEvaluatingStride || !pendingStrideBuffer.trim() || isEarlyExit.value)
    return

  const strideSnippet = pendingStrideBuffer
  pendingStrideBuffer = ''
  isEvaluatingStride = true

  // Stage 2: Turn current active span to orange pulsing
  const strideSpan: ReasoningSpan = {
    id: `span-${Date.now()}`,
    text: strideSnippet,
    stage: 'orange',
  }
  reasoningSpans.value.push(strideSpan)
  scrollToBottom()

  const words = strideSnippet.trim().split(/\s+/).length
  totalWordsEvaluated.value += words
  strideEvaluationsCount.value++
  liveStatus.value = 'EVALUATING'

  const snippetPreview = strideSnippet.trim().replace(/\s+/g, ' ').slice(0, 48)
  appendLog('STRIDE', `Evaluating Stride #${strideEvaluationsCount.value} (${words}w): "${snippetPreview}..."`, 'stride')

  const t0 = performance.now()
  let isSalient = false
  let confidence = 0
  let category = 'analytical'

  try {
    // 1. System 1 High-Salience Cognitive Gating (Jev / Laya ONNX or Lexical Classifier fallback)
    if (systemOneStore.activeProvider) {
      try {
        const salience = await systemOneStore.evaluateReasoningSalience(strideSnippet)
        isSalient = salience.isSalient
        confidence = Math.round((salience.confidence ?? 0.8) * 100)
        category = isSalient ? 'uncertain' : 'analytical'
      }
      catch {
        // Fall back to BoundedCategoryClassifier
        const res = classifier.consume(strideSnippet)
        category = res?.category || 'generic'
        isSalient = category !== 'generic'
        confidence = Math.round((res?.confidence ?? 0.8) * 100)
      }
    }
    else {
      const res = classifier.consume(strideSnippet)
      category = res?.category || 'generic'
      isSalient = category !== 'generic'
      confidence = Math.round((res?.confidence ?? 0.8) * 100)
    }
  }
  catch {
    isSalient = false
    confidence = 0
  }

  const durationMs = Math.round(performance.now() - t0)
  lastSystemOneLatencyMs.value = durationMs

  // Strict eligibility: System 1 must mark it salient AND meet the user-configured confidence floor
  const isPivotEligible = isSalient && confidence >= minConfidenceThreshold.value

  if (isPivotEligible) {
    // Stage 4: Threshold reached ➔ Green
    strideSpan.stage = 'green'
    strideSpan.category = category
    strideSpan.confidence = confidence

    appendLog('DECISION', `System 1 flagged Salient Event (${confidence}% conf, ${durationMs}ms) ➔ Eligible Aside!`, 'pivot')

    // Pacing Guard A: Turn ceiling limit
    if (fillersSpokenCount.value >= MAX_FILLERS_PER_TURN) {
      appendLog('PACING', `Turn ceiling reached (max ${MAX_FILLERS_PER_TURN} fillers spoken) ➔ Audio playback suppressed`, 'info')
      isEvaluatingStride = false
      if (isStreaming.value)
        liveStatus.value = 'STREAMING'
      return
    }

    // Pacing Guard B: Cadence cooldown interval (must respect testCadenceSec)
    const cadenceMs = testCadenceSec.value * 1000
    const now = Date.now()
    const timeSinceLastFiller = now - lastFillerSpokenAtMs
    if (lastFillerSpokenAtMs > 0 && timeSinceLastFiller < cadenceMs) {
      const remainingSec = ((cadenceMs - timeSinceLastFiller) / 1000).toFixed(1)
      appendLog('CADENCE', `Cadence cooldown active (next eligible in ${remainingSec}s) ➔ Audio playback locked`, 'info')
      isEvaluatingStride = false
      if (isStreaming.value)
        liveStatus.value = 'STREAMING'
      return
    }

    // Pacing Guard C: Never overlap voice
    if (isAudioPlaying.value) {
      appendLog('PACING', `Audio already speaking ➔ Overlapping filler prevented`, 'info')
      isEvaluatingStride = false
      if (isStreaming.value)
        liveStatus.value = 'STREAMING'
      return
    }

    // Stage 5: Needle 2 WASM Span Extraction (Tier 2)
    const n0 = performance.now()
    let pivotSpanText: string | null = null
    let extractionSource: 'Needle 2 (Tier 2)' | 'Curated Pacing Filler' = 'Needle 2 (Tier 2)'

    try {
      pivotSpanText = await needleClient.probeCotPivot(strideSnippet, 1500)
    }
    catch {
      pivotSpanText = null
    }

    // In Tier 2: If Needle finds an attention span, use it.
    // If Needle returns null (e.g. no turning phrase found in the snippet), use a clean natural curated conversational filler.
    // ZERO INLINE REGEX: We do not allow brittle regex acrobatics in the Tier 2 pipeline.
    if (!pivotSpanText) {
      extractionSource = 'Curated Pacing Filler'
      const eligibleFillers = DEFAULT_PACING_FILLERS.filter(f => !recentlySpokenPhrases.has(f.text))
      const filler = eligibleFillers[Math.floor(Math.random() * eligibleFillers.length)]
        || DEFAULT_PACING_FILLERS[0]
      pivotSpanText = filler.text
    }

    const needleMs = Math.round(performance.now() - n0)
    lastNeedleLatencyMs.value = needleMs

    if (pivotSpanText) {
      recentlySpokenPhrases.add(pivotSpanText)
      lastFillerSpokenAtMs = Date.now()
      // Highlight the extracted aside in purple
      strideSpan.asideText = pivotSpanText
      strideSpan.stage = 'purple'
      appendLog('PIVOT', `${extractionSource} extracted aside (${needleMs}ms): "${pivotSpanText}"`, 'pivot')
      void playAudioPhrase(pivotSpanText)
    }
  }
  else {
    // Stage 3: Evaluated, non-salient / sub-threshold flow ➔ Yellow
    strideSpan.stage = 'yellow'
    strideSpan.category = category
    strideSpan.confidence = confidence
    appendLog('STRIDE', `Stride #${strideEvaluationsCount.value} evaluated: non-salient (${confidence}% conf, ${durationMs}ms)`, 'info')
  }

  isEvaluatingStride = false
  if (isStreaming.value) {
    liveStatus.value = 'STREAMING'
  }
}

// --- Main Execution Handler: Try It Now ---
async function startLabTurn() {
  if (isStreaming.value)
    return

  // Reset state
  reasoningSpans.value = []
  directAnswerText.value = ''
  isDirectAnswerModel.value = false
  isEarlyExit.value = false
  stateLedger.value = []
  pendingStrideBuffer = ''
  ttftMs.value = null
  reasoningTokenCount.value = 0
  totalWordsEvaluated.value = 0
  strideEvaluationsCount.value = 0
  fillersSpokenCount.value = 0
  lastSystemOneLatencyMs.value = null
  lastNeedleLatencyMs.value = null
  lastFillerSpokenAtMs = 0
  recentlySpokenPhrases.clear()
  classifier.reset()

  startTime = Date.now()
  isStreaming.value = true
  liveStatus.value = 'ARMED'
  abortController = new AbortController()

  appendLog('START', `Turn initiated with model "${activeBrainModel.value || 'default'}" via provider "${activeBrainProvider.value || 'default'}"`, 'info')

  // Step 1: Arm initial TTFT generic filler deadline (if not bypassed)
  if (!initialFillerBypass.value) {
    const deadlineMs = 1500
    appendLog('ARM', `Staged initial TTFT deadline (${deadlineMs}ms)`, 'arm')
    initialDeadlineTimer = setTimeout(() => {
      if (isStreaming.value && ttftMs.value === null && fillersSpokenCount.value < MAX_FILLERS_PER_TURN) {
        const initialPhrase = 'Hmm, let me think about this...'
        recentlySpokenPhrases.add(initialPhrase)
        lastFillerSpokenAtMs = Date.now()
        appendLog('DEADLINE', `TTFT deadline elapsed (>${deadlineMs}ms) ➔ Triggering initial generic filler`, 'arm')
        void playAudioPhrase(initialPhrase)
      }
    }, deadlineMs)
  }
  else {
    appendLog('CONFIG', 'Initial TTFT filler bypassed by user setting. Testing strictly dynamic asides.', 'info')
  }

  // Step 2: Cadence timer for multi-hop CoT evaluation
  const cadenceMs = testCadenceSec.value * 1000
  cadenceIntervalTimer = setInterval(() => {
    if (isStreaming.value && pendingStrideBuffer.trim().length > 20) {
      void evaluateCurrentStride()
    }
  }, cadenceMs)

  try {
    // Fetch provider instance & stream via LLM store
    const providerInstance = await providersStore.getProviderInstance(activeBrainProvider.value) as any
    if (!providerInstance) {
      throw new Error(`Provider "${activeBrainProvider.value}" is not configured or unavailable. Please check settings.`)
    }

    const { useLLM } = await import('@proj-airi/stage-ui/stores/llm')
    const llm = useLLM()

    const messages: Message[] = [
      {
        role: 'user',
        content: scenarioPrompt.value,
      },
    ]

    let receivedFirstToken = false
    let currentWhiteSpan: ReasoningSpan | null = null

    await llm.stream(
      activeBrainModel.value,
      providerInstance,
      messages,
      {
        abortSignal: abortController.signal,
        onStreamEvent: async (event) => {
          if (!receivedFirstToken) {
            receivedFirstToken = true
            ttftMs.value = Date.now() - startTime
            appendLog('TTFT', `First token received at ${ttftMs.value}ms`, 'info')
            if (initialDeadlineTimer) {
              clearTimeout(initialDeadlineTimer)
              initialDeadlineTimer = null
            }
          }

          if (event.type === 'reasoning-delta') {
            // Cancel any false direct-answer detection caused by leading empty chunks
            if (isDirectAnswerModel.value) {
              isDirectAnswerModel.value = false
              directAnswerText.value = ''
            }

            liveStatus.value = 'STREAMING'
            reasoningTokenCount.value++
            const text = event.text
            pendingStrideBuffer += text

            // Append to current white span
            if (!currentWhiteSpan || currentWhiteSpan.stage !== 'white') {
              currentWhiteSpan = {
                id: `span-white-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                text,
                stage: 'white',
              }
              reasoningSpans.value.push(currentWhiteSpan)
            }
            else {
              currentWhiteSpan.text += text
            }
            scrollToBottom()

            // Trigger stride evaluation when word buffer exceeds stride length (~40 words)
            const wordCount = pendingStrideBuffer.trim().split(/\s+/).length
            if (wordCount >= 40 && !isEvaluatingStride) {
              currentWhiteSpan = null
              void evaluateCurrentStride()
            }
          }
          else if (event.type === 'text-delta') {
            // Direct-Answer model tokens (or final answer after reasoning)
            if (reasoningTokenCount.value > 0) {
              directAnswerText.value += event.text
              if (abortOnAnswerStart.value && isStreaming.value && !isEarlyExit.value) {
                triggerEarlyExit('Reasoning finished and answer stream started')
              }
            }
            else if (event.text && event.text.trim().length > 0) {
              if (!isDirectAnswerModel.value) {
                isDirectAnswerModel.value = true
                appendLog('INFO', 'Direct-answer token stream detected (no reasoning deltas). TTFT deadline mode active.', 'info')
              }
              directAnswerText.value += event.text
              if (abortOnAnswerStart.value && fillersSpokenCount.value > 0 && isStreaming.value && !isEarlyExit.value) {
                triggerEarlyExit('Direct answer arrived after initial filler')
              }
            }
          }
          else if (event.type === 'finish') {
            appendLog('FINISH', 'LLM stream completed naturally.', 'info')
          }
        },
      },
    )

    // Flush any remaining pending reasoning buffer
    if (pendingStrideBuffer.trim().length > 0) {
      await evaluateCurrentStride(true)
    }

    liveStatus.value = 'COMPLETED'
    appendLog('DONE', `Turn completed. Total reasoning tokens: ${reasoningTokenCount.value}, Spoken fillers: ${fillersSpokenCount.value}`, 'info')
  }
  catch (err: any) {
    if (isEarlyExit.value) {
      liveStatus.value = 'COMPLETED'
      appendLog('DONE', `Turn completed via early exit. Reasoning tokens: ${reasoningTokenCount.value}, Spoken fillers: ${fillersSpokenCount.value}`, 'info')
    }
    else if (err?.name === 'AbortError' || abortController?.signal.aborted) {
      liveStatus.value = 'ABORTED'
      appendLog('ABORT', 'Turn aborted by user.', 'warn')
    }
    else {
      liveStatus.value = 'ABORTED'
      appendLog('ERROR', `Inference error: ${err?.message || String(err)}`, 'warn')
    }
  }
  finally {
    isStreaming.value = false
    if (initialDeadlineTimer) {
      clearTimeout(initialDeadlineTimer)
      initialDeadlineTimer = null
    }
    if (cadenceIntervalTimer) {
      clearInterval(cadenceIntervalTimer)
      cadenceIntervalTimer = null
    }
  }
}

function abortLabTurn() {
  isEarlyExit.value = false
  if (abortController) {
    abortController.abort()
  }
  if (currentAudioElement) {
    currentAudioElement.pause()
    currentAudioElement = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  isAudioPlaying.value = false
  currentPlayingPhrase.value = null
  isStreaming.value = false
  liveStatus.value = 'ABORTED'
}

onBeforeUnmount(() => {
  abortLabTurn()
})

onMounted(() => {
  needleClient.prepare().catch(() => {})
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Top Action & Navigation Bar -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
      <div class="flex flex-wrap items-center gap-2">
        <!-- Anchor Jump to Pacing Tab -->
        <button
          type="button"
          class="flex items-center gap-1.5 border border-primary-500/40 rounded-lg bg-primary-50/60 px-3 py-1.5 text-xs text-primary-700 font-medium transition-all dark:bg-primary-950/40 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900/60"
          title="Jump to the card Pacing & Fillers settings"
          @click="emit('navigateToPacing')"
        >
          <span class="i-solar:settings-bold-duotone text-sm" />
          <span>Card Pacing Settings</span>
        </button>

        <!-- Quick Presets -->
        <div class="flex items-center gap-1 border-l border-neutral-200 pl-2 dark:border-neutral-800">
          <span class="text-[11px] text-neutral-400">Presets:</span>
          <button
            type="button"
            class="rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
            @click="applyPreset('snappy')"
          >
            ⚡ Snappy
          </button>
          <button
            type="button"
            class="rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
            @click="applyPreset('balanced')"
          >
            ⚖️ Balanced
          </button>
          <button
            type="button"
            class="rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
            @click="applyPreset('deep_cot')"
          >
            🧘 Deep CoT
          </button>
        </div>
      </div>

      <!-- Top-Right Brain Picker -->
      <div class="flex items-center gap-2 rounded-xl bg-neutral-100/80 p-1.5 text-xs dark:bg-neutral-900/80">
        <div class="flex items-center gap-1.5 pl-1.5 text-neutral-500 font-medium dark:text-neutral-400">
          <span class="i-solar:brain-bold-duotone text-sm text-primary-500" />
          <span>Brain:</span>
        </div>

        <!-- Provider Dropdown -->
        <select
          v-model="activeBrainProvider"
          class="border border-neutral-300 rounded-lg bg-white px-2 py-1 text-xs text-neutral-700 outline-none transition-colors dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <option value="" disabled>
            Select Provider
          </option>
          <option
            v-for="prov in availableChatProviders"
            :key="prov.id"
            :value="prov.id"
          >
            {{ prov.name }}
          </option>
        </select>

        <!-- Model Dropdown -->
        <select
          v-model="activeBrainModel"
          class="max-w-[200px] truncate border border-neutral-300 rounded-lg bg-white px-2 py-1 text-xs text-neutral-700 outline-none transition-colors dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <option value="" disabled>
            Select Model
          </option>
          <option
            v-for="model in availableModels"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name || model.id }}
          </option>
        </select>
      </div>
    </div>

    <!-- Scenario Prompt Section -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <label class="flex items-center gap-1.5 text-xs text-neutral-700 font-semibold dark:text-neutral-200">
          <span class="i-solar:document-text-bold-duotone text-primary-500" />
          <span>Reasoning Scenario Prompt</span>
        </label>
        <span class="text-[11px] text-neutral-400">
          Complex questions trigger deeper multi-stride reasoning chains
        </span>
      </div>

      <textarea
        v-model="scenarioPrompt"
        rows="3"
        class="w-full resize-none border border-neutral-200 rounded-xl bg-white p-3 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-700/80 focus:border-primary-500 dark:bg-neutral-950/60 dark:text-neutral-200"
        placeholder="Enter a complex problem requiring multi-hop reasoning..."
      />

      <!-- Scenario Quick Chips -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] text-neutral-400">Quick Scenarios:</span>
        <button
          v-for="preset in scenarioPresets"
          :key="preset.id"
          type="button"
          :class="[
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors border',
            scenarioPrompt === preset.prompt
              ? 'border-primary-500 bg-primary-50 text-primary-800 dark:bg-primary-950/40 dark:text-primary-300 font-medium'
              : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400 dark:hover:bg-neutral-800',
          ]"
          @click="selectScenario(preset)"
        >
          <span>{{ preset.title }}</span>
        </button>
      </div>
    </div>

    <!-- Controls & Knobs Strip -->
    <div class="flex flex-wrap items-center justify-between gap-4 border border-neutral-200/80 rounded-xl bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="flex flex-wrap items-center gap-5">
        <!-- Try It Now / Abort Buttons -->
        <div class="flex items-center gap-2">
          <button
            v-if="!isStreaming"
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs text-white font-medium shadow-sm transition-all active:scale-98 hover:bg-primary-700"
            @click="startLabTurn"
          >
            <span class="i-solar:play-bold text-sm" />
            <span>Try It Now</span>
          </button>
          <button
            v-else
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs text-white font-medium shadow-sm transition-all active:scale-98 hover:bg-rose-700"
            @click="abortLabTurn"
          >
            <span class="i-solar:stop-bold text-sm" />
            <span>Abort Stream</span>
          </button>
        </div>

        <!-- Initial Filler Bypass Toggle -->
        <label class="flex cursor-pointer select-none items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
          <input
            v-model="initialFillerBypass"
            type="checkbox"
            class="accent-primary-600"
          >
          <span>Bypass Initial Generic Filler</span>
        </label>

        <!-- Dynamic Asides Toggle -->
        <label class="flex cursor-pointer select-none items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
          <input
            v-model="dynamicAsidesEnabled"
            type="checkbox"
            class="accent-primary-600"
          >
          <span>Dynamic Spoken Asides</span>
        </label>

        <!-- Test Cadence -->
        <div class="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <span>Cadence:</span>
          <select
            v-model="testCadenceSec"
            class="border border-neutral-200 rounded-md bg-white px-2 py-0.5 text-xs text-neutral-700 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option :value="3">
              3s (Ultra Rapid)
            </option>
            <option :value="5">
              5s (Rapid Lab)
            </option>
            <option :value="10">
              10s (Moderate)
            </option>
            <option :value="15">
              15s (Normal Production)
            </option>
          </select>
        </div>

        <!-- Max Aside Words -->
        <div class="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <span>Max Aside Words:</span>
          <select
            v-model="maxAsideWords"
            class="border border-neutral-200 rounded-md bg-white px-2 py-0.5 text-xs text-neutral-700 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option :value="4">
              4 words
            </option>
            <option :value="6">
              6 words
            </option>
            <option :value="8">
              8 words
            </option>
            <option :value="10">
              10 words
            </option>
            <option :value="12">
              12 words
            </option>
          </select>
        </div>

        <!-- Min Confidence Threshold -->
        <div class="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <span>Min Confidence:</span>
          <select
            v-model="minConfidenceThreshold"
            class="border border-neutral-200 rounded-md bg-white px-2 py-0.5 text-xs text-neutral-700 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option :value="50">
              50% (Loose)
            </option>
            <option :value="65">
              65% (Balanced)
            </option>
            <option :value="75">
              75% (High / Default)
            </option>
            <option :value="85">
              85% (Strict)
            </option>
          </select>
        </div>

        <!-- Early Exit: Abort After N Fillers -->
        <div class="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <span>Abort After:</span>
          <select
            v-model="abortAfterFillers"
            class="border border-neutral-200 rounded-md bg-white px-2 py-0.5 text-xs text-neutral-700 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option :value="1">
              1 Filler
            </option>
            <option :value="2">
              2 Fillers (Default)
            </option>
            <option :value="3">
              3 Fillers (Max)
            </option>
            <option :value="0">
              Never (Full Sim)
            </option>
          </select>
        </div>

        <!-- Early Exit: Stop On Answer Start -->
        <label
          class="flex cursor-pointer select-none items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300"
          title="Abort generation when reasoning ends and answer tokens begin streaming"
        >
          <input
            v-model="abortOnAnswerStart"
            type="checkbox"
            class="accent-primary-600"
          >
          <span>Stop On Answer Start</span>
        </label>
      </div>

      <!-- Live Audio Playing Indicator Badge -->
      <div v-if="isAudioPlaying" class="flex animate-pulse items-center gap-2 border border-primary-500/40 rounded-full bg-primary-500/10 px-3 py-1 text-xs text-primary-600 font-medium dark:text-primary-400">
        <span class="i-solar:soundwave-bold-duotone text-sm" />
        <span>Playing: "{{ currentPlayingPhrase }}"</span>
      </div>
    </div>

    <!-- 5-Stage Live Reasoning Viewport -->
    <div class="border border-neutral-800 rounded-xl bg-neutral-950 p-4 shadow-inner">
      <div class="mb-3 flex items-center justify-between border-b border-neutral-800/80 pb-2">
        <div class="flex items-center gap-2">
          <span class="i-solar:radar-2-bold-duotone text-primary-400" />
          <span class="text-xs text-neutral-200 font-medium">Live Reasoning Stream</span>
          <span
            :class="[
              'rounded-full px-2 py-0.5 text-[10px] font-mono font-medium',
              liveStatus === 'IDLE' ? 'bg-neutral-800 text-neutral-400' : '',
              liveStatus === 'ARMED' ? 'bg-amber-500/20 text-amber-300' : '',
              liveStatus === 'STREAMING' ? 'bg-emerald-500/20 text-emerald-300' : '',
              liveStatus === 'EVALUATING' ? 'bg-amber-500/30 text-amber-200 animate-pulse' : '',
              liveStatus === 'PLAYING_FILLER' ? 'bg-fuchsia-500/20 text-fuchsia-300' : '',
              liveStatus === 'COMPLETED' ? (isEarlyExit ? 'bg-indigo-500/20 text-indigo-300' : 'bg-sky-500/20 text-sky-300') : '',
              liveStatus === 'ABORTED' ? 'bg-rose-500/20 text-rose-300' : '',
            ]"
          >
            {{ isEarlyExit && liveStatus === 'COMPLETED' ? 'EARLY EXIT (DONE)' : liveStatus }}
          </span>
        </div>

        <!-- 5-Stage Legend -->
        <div class="items-center gap-3 text-[10px] hidden sm:flex">
          <span class="flex items-center gap-1 text-zinc-300">
            <span class="h-2 w-2 rounded-full bg-zinc-300" /> Stream
          </span>
          <span class="flex items-center gap-1 text-amber-400">
            <span class="h-2 w-2 animate-pulse rounded-full bg-amber-400" /> Evaluating
          </span>
          <span class="flex items-center gap-1 text-yellow-300">
            <span class="h-2 w-2 rounded-full bg-yellow-400" /> Evaluated
          </span>
          <span class="flex items-center gap-1 text-emerald-400">
            <span class="h-2 w-2 rounded-full bg-emerald-400" /> Pivot Threshold
          </span>
          <span class="flex items-center gap-1 text-fuchsia-300 font-semibold">
            <span class="h-2 w-2 rounded-full bg-fuchsia-400" /> Extracted Aside
          </span>
        </div>
      </div>

      <!-- Live Stream Viewport Container -->
      <div
        ref="reasoningViewportRef"
        class="h-64 overflow-y-auto text-xs leading-relaxed font-mono"
      >
        <!-- Direct Answer Notice if non-reasoning model -->
        <div v-if="isDirectAnswerModel && reasoningSpans.length === 0" class="mb-3 border border-sky-800/60 rounded-lg bg-sky-950/40 p-2.5 text-[11px] text-sky-200">
          <div class="flex items-center gap-1.5 text-sky-300 font-semibold">
            <span class="i-solar:info-circle-bold text-sm" />
            <span>Direct-Answer Model Stream (No hidden reasoning tokens)</span>
          </div>
          <p class="mt-0.5 text-sky-300/80">
            The selected model returned answer tokens directly. Operating in TTFT deadline mode.
          </p>
        </div>

        <!-- Empty state placeholder -->
        <div v-if="reasoningSpans.length === 0 && !directAnswerText" class="h-full flex flex-col items-center justify-center text-neutral-500 italic">
          <span class="i-solar:test-tube-minimalistic-bold-duotone mb-2 text-2xl text-neutral-600" />
          <span>Click "Try It Now" to begin streaming live reasoning & watching pacing decisions...</span>
        </div>

        <!-- Rendered Reasoning Spans (5-Stage Color Pipeline) -->
        <div v-else class="flex flex-wrap items-baseline gap-1 break-words">
          <template v-for="span in reasoningSpans" :key="span.id">
            <!-- Stage 1: White streaming tokens -->
            <span
              v-if="span.stage === 'white'"
              class="text-zinc-200"
            >
              {{ span.text }}
            </span>

            <!-- Stage 2: Orange pulsing in-flight evaluation -->
            <span
              v-else-if="span.stage === 'orange'"
              class="animate-pulse border border-amber-500/40 rounded bg-amber-500/20 px-1 py-0.5 text-amber-300"
              title="Stride evaluating in-flight with System 1"
            >
              {{ span.text }}
            </span>

            <!-- Stage 3: Yellow evaluated non-pivot -->
            <span
              v-else-if="span.stage === 'yellow'"
              class="rounded bg-yellow-500/10 px-1 py-0.5 text-yellow-200/80"
              :title="`Evaluated: ${span.category || 'generic'}`"
            >
              {{ span.text }}
            </span>

            <!-- Stage 4: Green threshold reached -->
            <span
              v-else-if="span.stage === 'green'"
              class="border border-emerald-500/40 rounded bg-emerald-500/20 px-1 py-0.5 text-emerald-300 font-medium"
              :title="`Pivot threshold reached! Category: ${span.category}`"
            >
              {{ span.text }}
            </span>

            <!-- Stage 5: Purple / Electric Blue Extracted Aside -->
            <span
              v-else-if="span.stage === 'purple'"
              class="border border-fuchsia-500/40 rounded bg-fuchsia-500/10 px-1 py-0.5 text-fuchsia-200"
              :title="`Salient Pivot Stride. Extracted Aside: &quot;${span.asideText}&quot;`"
            >
              {{ span.text }}
              <span
                v-if="span.asideText"
                class="ml-1 inline-flex items-center gap-1 border border-fuchsia-400/60 rounded bg-fuchsia-500/30 px-1.5 py-0.2 text-[11px] text-fuchsia-100 font-bold shadow-fuchsia-500/20 shadow-sm"
              >
                <span>🎙️</span>
                <span>{{ span.asideText }}</span>
              </span>
            </span>
          </template>

          <!-- Direct answer stream if present -->
          <div v-if="directAnswerText" class="mt-3 w-full border-t border-neutral-800 pt-2 text-zinc-300">
            <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">Answer Output:</span>
            <p class="mt-1 text-xs leading-normal font-sans">
              {{ directAnswerText }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Real-Time State Ledger & Telemetry Strip -->
    <div class="border border-neutral-200/80 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
      <!-- Metrics Strip -->
      <div class="grid grid-cols-2 mb-4 gap-3 border-b border-neutral-100 pb-4 sm:grid-cols-6 dark:border-neutral-800">
        <div class="flex flex-col">
          <span class="text-[10px] text-neutral-400 font-semibold uppercase">TTFT</span>
          <span class="text-sm font-bold font-mono dark:text-neutral-100">
            {{ ttftMs !== null ? `${ttftMs}ms` : '--' }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-neutral-400 font-semibold uppercase">Reasoning Tokens</span>
          <span class="text-sm font-bold font-mono dark:text-neutral-100">
            {{ reasoningTokenCount }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-neutral-400 font-semibold uppercase">Words Evaluated</span>
          <span class="text-sm font-bold font-mono dark:text-neutral-100">
            {{ totalWordsEvaluated }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-neutral-400 font-semibold uppercase">Strides</span>
          <span class="text-sm font-bold font-mono dark:text-neutral-100">
            {{ strideEvaluationsCount }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-neutral-400 font-semibold uppercase">System 1 Latency</span>
          <span class="text-sm font-bold font-mono dark:text-neutral-100">
            {{ lastSystemOneLatencyMs !== null ? `${lastSystemOneLatencyMs}ms` : '--' }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-neutral-400 font-semibold uppercase">Fillers Spoken</span>
          <span class="text-sm text-primary-600 font-bold font-mono dark:text-primary-400">
            {{ fillersSpokenCount }}
          </span>
        </div>
      </div>

      <!-- Chronological Event Ledger -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">
            Chronological Decision Ledger
          </span>
          <span class="text-[10px] text-neutral-400 font-mono">
            {{ stateLedger.length }} events
          </span>
        </div>

        <div class="max-h-48 flex flex-col gap-1.5 overflow-y-auto">
          <div
            v-if="stateLedger.length === 0"
            class="py-4 text-center text-xs text-neutral-400 italic"
          >
            No events recorded yet. Run a scenario to view pacing decisions.
          </div>

          <div
            v-for="entry in stateLedger"
            :key="entry.id"
            :class="[
              'flex items-start gap-2 rounded-lg p-2 text-xs font-mono transition-colors',
              entry.type === 'arm' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : '',
              entry.type === 'stride' ? 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300' : '',
              entry.type === 'pivot' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium' : '',
              entry.type === 'audio' ? 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 font-bold' : '',
              entry.type === 'warn' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : '',
              entry.type === 'info' ? 'bg-neutral-50 dark:bg-neutral-900/40 text-neutral-600 dark:text-neutral-400' : '',
            ]"
          >
            <span class="shrink-0 text-neutral-400">[{{ entry.time }}]</span>
            <span class="shrink-0 rounded bg-black/10 px-1 py-0.2 text-[10px] font-semibold uppercase dark:bg-white/10">
              {{ entry.phase }}
            </span>
            <span class="flex-1 break-all">{{ entry.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

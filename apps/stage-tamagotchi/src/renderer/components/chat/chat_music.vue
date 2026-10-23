<script setup lang="ts">
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { describeMusicProvisionFailure, ensureMusicToolProvisioned, readMusicMcpEndpoint } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

interface MusicTrack {
  id: string
  title: string
  model: string
  prompt: string
  lyrics?: string
  duration: number
  audioUrl: string
  createdAt: string
  abcScore?: string
}

interface StudioChatMessage {
  id: string
  sender: 'character' | 'user'
  authorName: string
  text: string
  timestamp: string
  emotion?: 'neutral' | 'inspired' | 'excited' | 'thinking' | 'chill'
  trackAttachment?: MusicTrack
}

interface StylePreset {
  id: string
  title: string
  model: string
  bpm: number
  prompt: string
  lyrics: string
  cot: 'full' | 'melody' | 'off'
}

const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'synthwave-128',
    title: '80s Synthwave',
    model: 'yue-2',
    bpm: 128,
    prompt: '80s synthwave, analog synthesizers, punchy 808 drums, driving bassline, retro arpeggio, 128 bpm',
    lyrics: '[Intro]\n\n[Verse]\nNeon reflections on the rain-slick street\nChasing the digital horizon line\nEchoes of circuits under racing feet\nFrozen in analog and out of time\n\n[Chorus]\nSynthetic dreams in midnight skies\nWe ride until the morning light\nThrough binary stars our spirit flies\nElectric pulse into the night',
    cot: 'full',
  },
  {
    id: 'lofi-chill',
    title: 'Lo-Fi Chill Hop',
    model: 'yue-2',
    bpm: 84,
    prompt: 'lo-fi hip hop, warm rhodes electric piano, vinyl crackle, smooth upright bass, dusty boom-bap drums, 84 bpm',
    lyrics: '[Verse]\nSteam rising from a warm ceramic cup\nKeys clicking in the quiet afternoon\nWatching the shadows gently winding up\nDrifting away to a mellow tune\n\n[Chorus]\nJust easy thoughts and peaceful space\nWindow raindrops tracing down\nA cozy sanctuary in this place\nFar from the noise of the busy town',
    cot: 'melody',
  },
  {
    id: 'festival-dubstep',
    title: 'Festival Dubstep',
    model: 'yue-2',
    bpm: 140,
    prompt: 'heavy festival dubstep, aggressive metallic growls, devastating sub-bass, punchy snare, laser synths, 140 bpm',
    lyrics: '[Intro]\nWarning: system overload detected\nFrequency modulation critical\n\n[Build]\nPrepare for impact in three, two, one...\n\n[Drop]\nDrop the bass!\n\n[Verse]\nShockwaves radiating through the floor\nPower surges asking for more',
    cot: 'full',
  },
  {
    id: 'cyberpunk-darksynth',
    title: 'Cyberpunk Darksynth',
    model: 'yue-2',
    bpm: 130,
    prompt: 'cyberpunk industrial darksynth, distorted reese bass, glitchy percussion, sirens, dystopian atmosphere, 130 bpm',
    lyrics: '[Verse]\nHigh tech, low life in the glowing grid\nShadows flickering against the chrome\nSecrets that the mega-corporations hid\nSearching the dark web for a home\n\n[Chorus]\nBreak the firewall, shatter the cage\nRewrite the code on every page',
    cot: 'full',
  },
  {
    id: 'city-pop',
    title: 'Japanese City Pop',
    model: 'yue-2',
    bpm: 118,
    prompt: '1980s japanese city pop, funky slap bass, sparkling brass section, nostalgic chorus, lush disco groove, 118 bpm',
    lyrics: '[Verse]\nDriving along the highway coast at dusk\nCity lights blinking in the ocean breeze\nNeon billboards in a golden glow\nLost in familiar reveries\n\n[Chorus]\nStay with me on this midnight ride\nSweet summer memories by our side',
    cot: 'full',
  },
  {
    id: 'acoustic-folk',
    title: 'Acoustic Folk',
    model: 'yue-2',
    bpm: 92,
    prompt: 'warm acoustic guitar, gentle fingerpicking, delicate vocal harmonies, wooden percussion, soothing campfire, 92 bpm',
    lyrics: '[Verse]\nFootsteps on the winding forest trail\nPine needles under an autumn sky\nWhispering winds tell an ancient tale\nWatching the swallows wander high\n\n[Chorus]\nCarry me home where the river bends\nWhere the sunset gently ends',
    cot: 'melody',
  },
]

// --- Store Bindings ---
const providersStore = useProvidersStore()
const chatOrchestrator = useChatOrchestratorStore()
const chatStream = useChatStreamStore()
const chatSession = useChatSessionStore()
const consciousnessStore = useConsciousnessStore()
const airiCard = useAiriCardStore()

const { activeCard, activeCardId } = storeToRefs(airiCard)

// --- Server Connection State ---
const isCheckingServer = ref(false)
const serverStatus = ref<'checking' | 'online' | 'offline'>('checking')
const serverStatusMessage = ref('Connecting to AIRI Audio Server...')
const serverBaseUrl = computed(() => {
  const custom = (providersStore.providers['airi-audio-server']?.baseUrl as string)?.trim()
  if (custom) {
    return custom.endsWith('/') ? custom : `${custom}/`
  }
  return 'http://127.0.0.1:8095/v1/'
})

async function checkServerHealth() {
  isCheckingServer.value = true
  serverStatusMessage.value = 'Pinging audio server...'
  try {
    const rootUrl = serverBaseUrl.value.replace(/\/v1\/?$/, '')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)

    // Probe either /health, /v1/models, or /v1/capabilities
    const response = await fetch(`${serverBaseUrl.value}models`, {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => {
      return fetch(`${rootUrl}/health`, { method: 'GET', signal: controller.signal })
    })

    clearTimeout(timer)
    if (response && (response.ok || response.status === 200 || response.status === 404)) {
      // If endpoint responds at all, the port is live
      serverStatus.value = 'online'
      serverStatusMessage.value = `Online · ${new URL(serverBaseUrl.value).host}`
    }
    else {
      serverStatus.value = 'offline'
      serverStatusMessage.value = 'Offline (No response)'
    }
  }
  catch {
    serverStatus.value = 'offline'
    serverStatusMessage.value = 'Offline (Check port 8095)'
  }
  finally {
    isCheckingServer.value = false
  }
}

// --- AI Music Tools (MCP) ---
// Enabling writes the `music` ACL token onto the active card. Provisioning is
// gated on the audio server advertising an MCP endpoint, so the toggle is
// genuinely blocking rather than optimistic.

const musicProvisioning = ref(false)
const musicToolError = ref('')
const musicEndpoint = ref('')

const musicToolsEnabled = computed(() => {
  const tools = activeCard.value?.extensions?.airi?.generation?.known?.allowedTools
  return !!tools && (tools.includes('music') || tools.includes('mcp_music'))
})

function patchMusicAllowedTool(enabled: boolean) {
  const card = activeCard.value
  const cardId = activeCardId.value
  if (!card || !cardId)
    return

  const current = card.extensions?.airi?.generation?.known?.allowedTools ?? ['text_journal', 'image_journal']
  const nextAllowedTools = enabled
    ? (current.includes('music') ? current : [...current, 'music'])
    : current.filter(tool => tool !== 'music' && tool !== 'mcp_music')

  airiCard.updateCard(cardId, {
    extensions: {
      ...card.extensions,
      airi: {
        ...card.extensions?.airi,
        generation: {
          ...card.extensions?.airi?.generation,
          known: {
            ...card.extensions?.airi?.generation?.known,
            allowedTools: nextAllowedTools,
          },
        },
      },
    },
  } as any)
}

async function toggleMusicTools() {
  if (musicProvisioning.value)
    return

  // Disabling never needs the server: drop the token, keep the mcp.json entry.
  if (musicToolsEnabled.value) {
    patchMusicAllowedTool(false)
    musicToolError.value = ''
    return
  }

  musicProvisioning.value = true
  musicToolError.value = ''
  try {
    const outcome = await ensureMusicToolProvisioned({
      providerBaseUrl: providersStore.getProviderConfig('airi-audio-server')?.baseUrl as string | undefined,
    })
    if (!outcome.ok) {
      musicToolError.value = describeMusicProvisionFailure(outcome.reason)
      return
    }
    musicEndpoint.value = outcome.url ?? ''
    patchMusicAllowedTool(true)
  }
  finally {
    musicProvisioning.value = false
  }
}

// --- Generator Parameters ---
const selectedModel = ref<'yue-2' | 'minimax-music-3'>('yue-2')
const stylePrompt = ref(STYLE_PRESETS[0].prompt)
const lyricsText = ref(STYLE_PRESETS[0].lyrics)
const isInstrumental = ref(false)
const durationSeconds = ref<number>(60)
const cotMode = ref<'full' | 'melody' | 'off'>('full')
const temperature = ref<number>(0.8)
const trackTitle = ref('Neon Horizon')

// Advanced parameters drawer
const isAdvancedOpen = ref(false)

function applyPreset(preset: StylePreset) {
  stylePrompt.value = preset.prompt
  lyricsText.value = preset.lyrics
  durationSeconds.value = 60
  cotMode.value = preset.cot
  trackTitle.value = preset.title
  triggerReactiveReaction(
    `Loaded the "${preset.title}" preset! The ${preset.prompt.split(',')[0]} vibe sounds great. Ready when you are!`,
    'inspired',
  )
}

function insertStructureTag(tag: string) {
  lyricsText.value = `${lyricsText.value.trim()}\n\n[${tag}]\n`
}

// --- Generation Lifecycle ---
const isGenerating = ref(false)
const elapsedSeconds = ref(0)
let timerInterval: any = null
const generationError = ref('')
const activeAbortController = ref<AbortController | null>(null)

// Current & Recent Tracks
const activeTrack = ref<MusicTrack | null>(null)
const recentTracks = ref<MusicTrack[]>([])

// --- Audio Playback Engine ---
const audioElementRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const totalDuration = ref(0)
const audioVolume = ref(0.85)

function togglePlay() {
  if (!audioElementRef.value)
    return
  if (audioElementRef.value.paused) {
    audioElementRef.value.play().catch(err => console.warn('[SoundStudio] Play failed:', err))
  }
  else {
    audioElementRef.value.pause()
  }
}

function handleTimeUpdate() {
  if (audioElementRef.value) {
    currentTime.value = audioElementRef.value.currentTime
    totalDuration.value = audioElementRef.value.duration || durationSeconds.value
  }
}

function handleSeek(e: Event) {
  const target = e.target as HTMLInputElement
  const seekTime = Number.parseFloat(target.value)
  if (audioElementRef.value && !Number.isNaN(seekTime)) {
    audioElementRef.value.currentTime = seekTime
    currentTime.value = seekTime
  }
}

function handleVolumeChange(e: Event) {
  const target = e.target as HTMLInputElement
  const vol = Number.parseFloat(target.value)
  audioVolume.value = vol
  if (audioElementRef.value) {
    audioElementRef.value.volume = vol
  }
}

function formatTime(sec: number): string {
  if (!sec || Number.isNaN(sec))
    return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function downloadActiveTrack() {
  if (!activeTrack.value?.audioUrl)
    return
  const a = document.createElement('a')
  a.href = activeTrack.value.audioUrl
  const safeTitle = (activeTrack.value.title || 'sound_studio_track').toLowerCase().replace(/[^a-z0-9]+/g, '_')
  a.download = `${safeTitle}.wav`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// --- Generation Request ---
async function handleGenerateTrack() {
  if (isGenerating.value)
    return
  generationError.value = ''
  isGenerating.value = true
  elapsedSeconds.value = 0
  timerInterval = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)

  const controller = new AbortController()
  activeAbortController.value = controller

  // In-character reaction to generation kickoff
  triggerReactiveReaction(
    `Starting neural synthesis for "${trackTitle.value}" via ${selectedModel.value.toUpperCase()}... I'll listen along while it renders!`,
    'excited',
  )

  try {
    const payload = {
      model: selectedModel.value,
      prompt: stylePrompt.value.trim(),
      lyrics: isInstrumental.value ? '[Instrumental]' : lyricsText.value.trim(),
      duration_seconds: durationSeconds.value,
      temperature: temperature.value,
      cot: cotMode.value,
      title: trackTitle.value.trim() || 'Untitled Track',
    }

    const endpoint = `${serverBaseUrl.value}audio/music`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch(async (err) => {
      // Fallback try to root /music if /v1/audio/music returned connection issue
      if (err.name === 'AbortError')
        throw err
      return fetch(`${serverBaseUrl.value}music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    })

    if (!response || !response.ok) {
      const errorDetail = await response?.text().catch(() => '')
      throw new Error(`Server returned HTTP ${response?.status || 500}: ${errorDetail || 'Unknown error'}`)
    }

    const contentType = response.headers.get('content-type') || ''
    let audioUrl = ''
    let parsedAbc = ''

    if (contentType.includes('application/json')) {
      const data = await response.json()
      if (data.audio_url || data.url) {
        audioUrl = data.audio_url || data.url
      }
      else if (data.data) {
        audioUrl = `data:audio/wav;base64,${data.data}`
      }
      if (data.abc_score || data.abc) {
        parsedAbc = data.abc_score || data.abc
      }
    }
    else {
      // Raw binary audio/wav or audio/mpeg stream
      const blob = await response.blob()
      audioUrl = URL.createObjectURL(blob)
    }

    if (!audioUrl) {
      throw new Error('No audio URL or binary payload found in server response.')
    }

    const track: MusicTrack = {
      id: `track-${Date.now()}`,
      title: trackTitle.value.trim() || 'Untitled Track',
      model: selectedModel.value,
      prompt: stylePrompt.value,
      lyrics: lyricsText.value,
      duration: durationSeconds.value,
      audioUrl,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      abcScore: parsedAbc,
    }

    activeTrack.value = track
    recentTracks.value.unshift(track)

    // Auto load audio element
    void nextTick(() => {
      if (audioElementRef.value) {
        audioElementRef.value.src = audioUrl
        audioElementRef.value.load()
        audioElementRef.value.play().then(() => {
          isPlaying.value = true
        }).catch(() => {
          isPlaying.value = false
        })
      }
    })

    // Notify character chat
    triggerReactiveReaction(
      `"${track.title}" is ready! Listen to those harmonies—what do you think? We can tweak the tempo or lyrics if you want another take!`,
      'inspired',
      track,
    )
  }
  catch (err: any) {
    if (err.name === 'AbortError') {
      generationError.value = 'Generation was cancelled.'
    }
    else {
      console.error('[SoundStudio] Generation failed:', err)
      generationError.value = err.message || 'Failed to generate music track. Is airi-audio-server running?'
      triggerReactiveReaction(
        `Looks like the synthesis ran into an issue (${err.message || 'connection failed'}). Make sure the audio server is running with the music engine loaded!`,
        'thinking',
      )
    }
  }
  finally {
    isGenerating.value = false
    activeAbortController.value = null
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }
}

function handleCancelGeneration() {
  if (activeAbortController.value) {
    activeAbortController.value.abort()
  }
}

function selectTrack(track: MusicTrack) {
  activeTrack.value = track
  void nextTick(() => {
    if (audioElementRef.value) {
      audioElementRef.value.src = track.audioUrl
      audioElementRef.value.load()
      audioElementRef.value.play().then(() => {
        isPlaying.value = true
      }).catch(() => {
        isPlaying.value = false
      })
    }
  })
}

// --- Co-Creation Chat Stream ---
const chatTranscript = ref<StudioChatMessage[]>([
  {
    id: 'msg-welcome',
    sender: 'character',
    authorName: activeCard.value?.name || 'AIRI',
    text: 'Welcome to the Sound Studio! What kind of soundscape or groove should we make today? Pick a genre preset or describe any style and we\'ll build it together!',
    timestamp: 'Just now',
    emotion: 'inspired',
  },
])

const userInputText = ref('')
const transcriptContainerRef = ref<HTMLDivElement | null>(null)
const activeLlmReplyId = ref<string | null>(null)

// Watch AI streaming text into transcript
watch(() => chatStream.streamingMessage.content, (newContent) => {
  if (activeLlmReplyId.value && newContent) {
    const target = chatTranscript.value.find(m => m.id === activeLlmReplyId.value)
    if (target) {
      target.text = typeof newContent === 'string'
        ? newContent
        : Array.isArray(newContent)
          ? newContent.map(part => 'text' in part ? part.text : '').join('')
          : String(newContent || '')
      target.emotion = 'inspired'
      scrollToChatBottom()
    }
  }
})

watch(() => chatOrchestrator.sending, (isSending, wasSending) => {
  if (wasSending && !isSending && activeLlmReplyId.value) {
    activeLlmReplyId.value = null
  }
})

function scrollToChatBottom() {
  void nextTick(() => {
    if (transcriptContainerRef.value) {
      transcriptContainerRef.value.scrollTop = transcriptContainerRef.value.scrollHeight
    }
  })
}

function triggerReactiveReaction(
  text: string,
  emotion: StudioChatMessage['emotion'] = 'neutral',
  trackAttachment?: MusicTrack,
) {
  chatTranscript.value.push({
    id: `react-${Date.now()}`,
    sender: 'character',
    authorName: activeCard.value?.name || 'AIRI',
    text,
    timestamp: 'Just now',
    emotion,
    trackAttachment,
  })
  scrollToChatBottom()
}

async function handleSendMessage(presetText?: string) {
  const content = presetText || userInputText.value.trim()
  if (!content)
    return

  userInputText.value = ''

  // Add User Message
  chatTranscript.value.push({
    id: `user-${Date.now()}`,
    sender: 'user',
    authorName: 'You',
    text: content,
    timestamp: 'Just now',
  })
  scrollToChatBottom()

  // Attempt LLM dispatch
  let sentToLlm = false
  try {
    const providerId = consciousnessStore.activeProvider
    const modelId = consciousnessStore.activeModel

    if (providerId && modelId && chatSession.activeSessionId) {
      const providerConfig = providersStore.getProviderConfig(providerId)
      sentToLlm = true

      const replyMsgId = `react-${Date.now()}`
      activeLlmReplyId.value = replyMsgId
      chatTranscript.value.push({
        id: replyMsgId,
        sender: 'character',
        authorName: activeCard.value?.name || 'AIRI',
        text: 'Jamming on track ideas...',
        timestamp: 'Just now',
        emotion: 'thinking',
      })
      scrollToChatBottom()

      const systemPrefix = `[Sound Studio Co-Creation Session: You are AIRI collaborating in real time with the user on musical composition and lyric writing. Active Model: ${selectedModel.value.toUpperCase()}. Active Track Title: "${trackTitle.value}". Current Prompt: "${stylePrompt.value}". Be enthusiastic, musically insightful, and suggest creative rhymes, arrangements, or chord dynamics in 1-3 sentences.] `

      await chatOrchestrator.ingest(`${systemPrefix}${content}`, {
        model: modelId,
        chatProvider: providerId,
        providerConfig,
      }, chatSession.activeSessionId)
    }
  }
  catch (err) {
    console.warn('[SoundStudio] LLM dispatch failed, falling back to studio banter:', err)
    sentToLlm = false
    activeLlmReplyId.value = null
  }

  if (!sentToLlm) {
    setTimeout(() => {
      const studioReplies = [
        { text: 'I love that idea! Adding a rhythmic synth syncopation right before the drop would give it incredible energy.', emotion: 'inspired' as const },
        { text: 'What if we transpose the chorus to a minor key for that nostalgic 80s feeling? The chords would hit much deeper.', emotion: 'thinking' as const },
        { text: 'Ooh, driving bassline with heavy punchy drums! That\'s definitely going on the playlist.', emotion: 'excited' as const },
        { text: 'Got it! Let\'s update the lyrics with those themes and hit generate whenever you\'re ready.', emotion: 'chill' as const },
      ]
      const pick = studioReplies[Math.floor(Math.random() * studioReplies.length)]
      triggerReactiveReaction(pick.text, pick.emotion)
    }, 600)
  }
}

function sendTrackToChat(track: MusicTrack) {
  chatTranscript.value.push({
    id: `track-share-${Date.now()}`,
    sender: 'user',
    authorName: 'You',
    text: `Shared "${track.title}" (${track.model.toUpperCase()}) to studio session!`,
    timestamp: 'Just now',
    trackAttachment: track,
  })
  scrollToChatBottom()
  triggerReactiveReaction(
    `Got it queued! That ${track.model} rendition sounds super crisp. Want to try another variation with different tempo?`,
    'inspired',
  )
}

onMounted(() => {
  void checkServerHealth()

  // Read the endpoint already recorded in mcp.json. This deliberately does not
  // probe the server, so it resolves even when the audio server is stopped.
  void readMusicMcpEndpoint().then((url) => {
    musicEndpoint.value = url ?? ''
  })
})

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  if (activeAbortController.value) {
    activeAbortController.value.abort()
  }
})
</script>

<template>
  <div class="h-full w-full flex overflow-hidden bg-neutral-100/60 dark:bg-neutral-950/40">
    <!-- Hidden Audio Element -->
    <audio
      ref="audioElementRef"
      class="hidden"
      @timeupdate="handleTimeUpdate"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="isPlaying = false"
    />

    <!-- 1. LEFT PANE: Music Studio & Playground (flex-1) -->
    <div class="relative h-full flex flex-1 flex-col overflow-y-auto border-r border-neutral-200/50 p-4 space-y-4 dark:border-neutral-800/50">
      <!-- Studio Header Bar -->
      <div class="flex items-center justify-between border border-neutral-200/40 rounded-xl bg-white/70 px-4 py-3 shadow-sm backdrop-blur-md dark:border-neutral-800/40 dark:bg-neutral-900/60">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 flex items-center justify-center rounded-xl bg-primary-500/10 text-primary-500 shadow-inner">
            <div class="i-solar:music-notes-bold-duotone text-xl" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
                Sound Studio
              </h2>
              <span class="border border-primary-500/30 rounded-md bg-primary-500/10 px-1.5 py-0.5 text-[10px] text-primary-600 font-bold dark:text-primary-400">
                Phase 1 Generative
              </span>
            </div>
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
              Score-First Neural Music &amp; Tri-Model Generation Playground
            </p>
          </div>
        </div>

        <!-- Right: Server Ping Pill & Model Toggle -->
        <div class="flex items-center gap-2.5">
          <!-- Server Ping Indicator -->
          <button
            class="flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-95"
            :class="[
              serverStatus === 'online'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : serverStatus === 'checking'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
            ]"
            title="Click to re-check audio server status"
            @click="checkServerHealth"
          >
            <div
              class="h-2 w-2 rounded-full"
              :class="[
                serverStatus === 'online'
                  ? 'bg-emerald-500'
                  : serverStatus === 'checking'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500',
              ]"
            />
            <span class="text-[11px] font-semibold">{{ serverStatusMessage }}</span>
            <div v-if="isCheckingServer" class="i-solar:restart-bold animate-spin text-[10px]" />
          </button>

          <!-- Model Selector Dropdown -->
          <select
            v-model="selectedModel"
            class="border border-neutral-200/80 rounded-lg bg-neutral-50 px-2.5 py-1 text-xs text-neutral-800 font-bold outline-none transition-colors dark:border-neutral-700/80 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="yue-2">
              YuE 2 (Score-First 48kHz)
            </option>
            <option value="minimax-music-3">
              MiniMax Music 3.0
            </option>
          </select>
        </div>
      </div>

      <!-- AI Music Tools (MCP): lets the character compose from chat -->
      <div
        class="flex items-center justify-between gap-3 border rounded-xl px-3 py-2 transition-colors"
        :class="musicToolsEnabled
          ? 'border-fuchsia-500/30 bg-fuchsia-500/10'
          : 'border-neutral-200/60 bg-white/50 dark:border-neutral-800/60 dark:bg-neutral-900/40'"
      >
        <div class="min-w-0 flex items-center gap-2.5">
          <div
            class="h-7 w-7 flex shrink-0 items-center justify-center rounded-lg"
            :class="musicToolsEnabled ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400' : 'bg-neutral-500/10 text-neutral-400'"
          >
            <div class="i-solar:magic-stick-3-bold-duotone text-sm" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] text-neutral-700 font-bold dark:text-neutral-200">AI Music Tools</span>
              <span
                class="rounded px-1 py-0.2 text-[8px] font-semibold uppercase"
                :class="musicToolsEnabled
                  ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400'
                  : 'bg-neutral-500/10 text-neutral-400'"
              >
                {{ musicToolsEnabled ? 'MCP connected' : 'Off' }}
              </span>
            </div>
            <p class="truncate text-[10px] text-neutral-400" :title="musicEndpoint">
              {{ musicToolsEnabled
                ? (musicEndpoint || 'Endpoint recorded in mcp.json')
                : 'Let the character plan &amp; render tracks from chat' }}
            </p>
          </div>
        </div>

        <button
          type="button"
          :disabled="musicProvisioning"
          :class="musicToolsEnabled ? 'bg-fuchsia-500' : 'bg-neutral-300 dark:bg-neutral-700'"
          class="relative h-5 w-9 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out disabled:op-50"
          :title="musicToolsEnabled ? 'Disable autonomous music tools' : 'Enable autonomous music tools'"
          @click="toggleMusicTools"
        >
          <span
            :class="musicProvisioning ? 'animate-pulse' : (musicToolsEnabled ? 'translate-x-4.5' : 'translate-x-0.5')"
            class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
          />
        </button>
      </div>

      <p v-if="musicToolError" class="text-[10px] text-rose-500 leading-snug -mt-2">
        {{ musicToolError }}
      </p>

      <!-- Quick Genre Presets Row -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-[11px] text-neutral-500 font-semibold dark:text-neutral-400">
          <span>Quick Inspiration Presets</span>
          <span class="text-[10px] opacity-70">Click to load prompts &amp; lyrics</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="preset in STYLE_PRESETS"
            :key="preset.id"
            class="shadow-2xs flex items-center gap-1.5 border border-neutral-200/70 rounded-lg bg-white/80 px-2.5 py-1 text-xs text-neutral-700 font-medium transition-all active:scale-95 dark:border-neutral-800 hover:border-primary-500/40 dark:bg-neutral-900/80 dark:text-neutral-200 hover:text-primary-600 dark:hover:text-primary-400"
            @click="applyPreset(preset)"
          >
            <div class="i-solar:music-note-bold text-[11px] text-primary-500" />
            <span>{{ preset.title }}</span>
            <span class="rounded bg-neutral-100 px-1 py-0.2 text-[9px] text-neutral-400 font-mono dark:bg-neutral-800">{{ preset.bpm }} BPM</span>
          </button>
        </div>
      </div>

      <!-- Main Input Grid: Track Title, Style & Lyrics -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- Left Column: Style & Conditioning -->
        <div class="flex flex-col border border-neutral-200/50 rounded-xl bg-white/70 p-3.5 shadow-sm backdrop-blur-md space-y-3 dark:border-neutral-800/50 dark:bg-neutral-900/50">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-1.5 text-xs text-neutral-700 font-bold dark:text-neutral-200">
              <div class="i-solar:tuning-square-2-bold-duotone text-sm text-primary-500" />
              <span>Style &amp; Acoustic Prompt</span>
            </label>
            <input
              v-model="trackTitle"
              type="text"
              placeholder="Track Title"
              class="border border-neutral-200/70 rounded-md bg-neutral-50/70 px-2 py-0.5 text-xs text-neutral-800 font-bold outline-none dark:border-neutral-700/70 dark:bg-neutral-800/70 dark:text-neutral-100"
            >
          </div>

          <textarea
            v-model="stylePrompt"
            rows="5"
            placeholder="Describe genre, instruments, tempo, BPM, and mood (e.g. 80s synthwave, analog synths, driving bassline, 128 bpm)..."
            class="w-full resize-none border border-neutral-200/70 rounded-lg bg-neutral-50/50 p-2.5 text-xs text-neutral-800 leading-relaxed outline-none transition-colors dark:border-neutral-800 focus:border-primary-500/60 dark:bg-neutral-950/40 dark:text-neutral-100"
          />

          <!-- Quick Tags Row -->
          <div class="flex flex-wrap items-center gap-1 text-[10px]">
            <span class="text-neutral-400 font-semibold">Add tags:</span>
            <button
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="stylePrompt = `${stylePrompt.trim()}, 128 bpm`"
            >
              + 128 BPM
            </button>
            <button
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="stylePrompt = `${stylePrompt.trim()}, 48kHz stereo`"
            >
              + 48kHz Stereo
            </button>
            <button
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="stylePrompt = `${stylePrompt.trim()}, driving analog bass`"
            >
              + Driving Bass
            </button>
            <button
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="stylePrompt = `${stylePrompt.trim()}, atmospheric pads`"
            >
              + Lush Pads
            </button>
          </div>
        </div>

        <!-- Right Column: Lyrics & Song Structure -->
        <div class="flex flex-col border border-neutral-200/50 rounded-xl bg-white/70 p-3.5 shadow-sm backdrop-blur-md space-y-3 dark:border-neutral-800/50 dark:bg-neutral-900/50">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-1.5 text-xs text-neutral-700 font-bold dark:text-neutral-200">
              <div class="i-solar:document-text-bold-duotone text-sm text-primary-500" />
              <span>Lyrics &amp; Structural Tags</span>
            </label>

            <!-- Instrumental toggle -->
            <label class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <input
                v-model="isInstrumental"
                type="checkbox"
                class="accent-primary-500"
              >
              <span class="text-[11px] font-medium">Instrumental Only</span>
            </label>
          </div>

          <textarea
            v-model="lyricsText"
            :disabled="isInstrumental"
            rows="5"
            placeholder="[Intro]&#10;[Verse]&#10;Words go here...&#10;[Chorus]&#10;Main hook goes here..."
            class="w-full resize-none border border-neutral-200/70 rounded-lg bg-neutral-50/50 p-2.5 text-xs text-neutral-800 leading-relaxed font-mono outline-none transition-colors dark:border-neutral-800 focus:border-primary-500/60 dark:bg-neutral-950/40 dark:text-neutral-100 disabled:opacity-40"
          />

          <!-- Structure Tag Insert Buttons -->
          <div class="flex flex-wrap items-center gap-1 text-[10px]">
            <span class="text-neutral-400 font-semibold">Insert tags:</span>
            <button
              :disabled="isInstrumental"
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 disabled:opacity-30 dark:hover:bg-neutral-800"
              @click="insertStructureTag('Intro')"
            >
              [Intro]
            </button>
            <button
              :disabled="isInstrumental"
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 disabled:opacity-30 dark:hover:bg-neutral-800"
              @click="insertStructureTag('Verse')"
            >
              [Verse]
            </button>
            <button
              :disabled="isInstrumental"
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 disabled:opacity-30 dark:hover:bg-neutral-800"
              @click="insertStructureTag('Chorus')"
            >
              [Chorus]
            </button>
            <button
              :disabled="isInstrumental"
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 disabled:opacity-30 dark:hover:bg-neutral-800"
              @click="insertStructureTag('Drop')"
            >
              [Drop]
            </button>
            <button
              :disabled="isInstrumental"
              class="border border-neutral-200/60 rounded px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 disabled:opacity-30 dark:hover:bg-neutral-800"
              @click="insertStructureTag('Outro')"
            >
              [Outro]
            </button>
          </div>
        </div>
      </div>

      <!-- Controls & Parameters Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3 border border-neutral-200/40 rounded-xl bg-white/70 p-3 shadow-sm backdrop-blur-md dark:border-neutral-800/40 dark:bg-neutral-900/60">
        <!-- Duration & CoT Chips -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- Duration Selector -->
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-neutral-500 font-bold dark:text-neutral-400">Duration:</span>
            <div class="flex border border-neutral-200/80 rounded-lg p-0.5 dark:border-neutral-700/80 dark:bg-neutral-800">
              <button
                v-for="d in [15, 30, 60, 120]"
                :key="d"
                class="rounded px-2 py-0.5 text-[11px] font-semibold transition-all"
                :class="durationSeconds === d ? 'bg-primary-500 text-white shadow-2xs' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50'"
                @click="durationSeconds = d"
              >
                {{ d }}s
              </button>
            </div>
          </div>

          <!-- CoT Mode Selector (YuE 2 only) -->
          <div v-if="selectedModel === 'yue-2'" class="flex items-center gap-1.5">
            <span class="text-[11px] text-neutral-500 font-bold dark:text-neutral-400">ABC CoT:</span>
            <div class="flex border border-neutral-200/80 rounded-lg p-0.5 dark:border-neutral-700/80 dark:bg-neutral-800">
              <button
                v-for="c in [
                  { id: 'full', label: 'Full Score' },
                  { id: 'melody', label: 'Melody' },
                  { id: 'off', label: 'Direct' },
                ]"
                :key="c.id"
                class="rounded px-2 py-0.5 text-[11px] font-semibold transition-all"
                :class="cotMode === c.id ? 'bg-primary-500 text-white shadow-2xs' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50'"
                @click="cotMode = (c.id as any)"
              >
                {{ c.label }}
              </button>
            </div>
          </div>

          <!-- Advanced Toggle -->
          <button
            class="text-[11px] text-primary-600 font-semibold dark:text-primary-400 hover:underline"
            @click="isAdvancedOpen = !isAdvancedOpen"
          >
            {{ isAdvancedOpen ? 'Hide Parameters' : 'More Options...' }}
          </button>
        </div>

        <!-- Primary Generate Action Button -->
        <div class="flex items-center gap-2">
          <button
            v-if="isGenerating"
            type="button"
            class="border border-rose-500/40 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-600 font-bold transition-all active:scale-95 hover:bg-rose-500/20 dark:text-rose-400"
            @click="handleCancelGeneration"
          >
            Cancel ({{ elapsedSeconds }}s)
          </button>

          <button
            type="button"
            class="flex items-center gap-2 rounded-lg from-primary-500 to-indigo-600 bg-gradient-to-r px-4 py-2 text-xs text-white font-bold shadow-md transition-all active:scale-95 hover:from-primary-600 hover:to-indigo-700 disabled:opacity-50"
            :disabled="isGenerating || !stylePrompt.trim()"
            @click="handleGenerateTrack"
          >
            <div :class="isGenerating ? 'i-solar:restart-bold animate-spin' : 'i-solar:play-bold'" class="text-sm" />
            <span>{{ isGenerating ? `Rendering Score (${elapsedSeconds}s)...` : 'Generate Music Track' }}</span>
          </button>
        </div>
      </div>

      <!-- Collapsible Advanced Drawer -->
      <div
        v-if="isAdvancedOpen"
        class="border border-neutral-200/50 rounded-xl bg-white/60 p-3 shadow-inner space-y-3 dark:border-neutral-800/50 dark:bg-neutral-900/40"
      >
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div class="flex justify-between text-xs text-neutral-600 dark:text-neutral-300">
              <span class="font-bold">Temperature: {{ temperature }}</span>
              <span class="text-neutral-400">Higher = more wild / varied</span>
            </div>
            <input
              v-model.number="temperature"
              type="range"
              min="0.3"
              max="1.3"
              step="0.05"
              class="mt-1.5 w-full accent-primary-500"
            >
          </div>
          <div>
            <div class="text-xs text-neutral-600 font-bold dark:text-neutral-300">
              Audio Server Target URL
            </div>
            <div class="mt-1 text-xs text-neutral-500 font-mono dark:text-neutral-400">
              {{ serverBaseUrl }}audio/music
            </div>
          </div>
        </div>
      </div>

      <!-- Generation Error Banner -->
      <div
        v-if="generationError"
        class="flex items-center justify-between border border-rose-500/30 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300"
      >
        <div class="flex items-center gap-2">
          <div class="i-solar:danger-triangle-bold text-base text-rose-500" />
          <span>{{ generationError }}</span>
        </div>
        <button
          class="text-xs font-bold underline hover:opacity-80"
          @click="generationError = ''"
        >
          Dismiss
        </button>
      </div>

      <!-- Active Track Showcase Player -->
      <div
        v-if="activeTrack"
        class="border border-primary-500/30 rounded-2xl from-primary-500/5 via-white/80 to-indigo-500/5 bg-gradient-to-br p-4 shadow-sm backdrop-blur-md space-y-3 dark:border-primary-500/30 dark:from-primary-950/20 dark:via-neutral-900/80 dark:to-indigo-950/20"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              class="h-12 w-12 flex items-center justify-center rounded-xl from-primary-500 to-indigo-600 bg-gradient-to-br text-white shadow-md transition-all active:scale-95 hover:from-primary-600 hover:to-indigo-700"
              @click="togglePlay"
            >
              <div :class="isPlaying ? 'i-solar:pause-bold' : 'i-solar:play-bold'" class="text-xl" />
            </button>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
                  {{ activeTrack.title }}
                </h3>
                <span class="rounded bg-primary-500/15 px-1.5 py-0.2 text-[9px] text-primary-600 font-bold uppercase dark:text-primary-400">
                  {{ activeTrack.model }}
                </span>
                <span class="rounded bg-neutral-200/70 px-1.5 py-0.2 text-[9px] text-neutral-600 font-mono dark:bg-neutral-800 dark:text-neutral-300">
                  48kHz Stereo
                </span>
              </div>
              <p class="max-w-md truncate text-xs text-neutral-500 dark:text-neutral-400">
                {{ activeTrack.prompt }}
              </p>
            </div>
          </div>

          <!-- Player Utility Actions -->
          <div class="flex items-center gap-2">
            <!-- Volume Control -->
            <div class="flex items-center gap-1.5 border border-neutral-200/70 rounded-lg bg-white px-2 py-1 text-neutral-500 dark:border-neutral-700/70 dark:bg-neutral-800 dark:text-neutral-400">
              <div class="i-solar:volume-loud-bold text-xs text-primary-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="audioVolume"
                class="w-14 cursor-pointer accent-primary-500"
                title="Volume"
                @input="handleVolumeChange"
              >
            </div>

            <button
              class="flex items-center gap-1.5 border border-neutral-200/70 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-700 font-medium transition-all dark:border-neutral-700/70 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200"
              title="Share track into studio chat"
              @click="sendTrackToChat(activeTrack)"
            >
              <div class="i-solar:chat-line-linear text-xs text-primary-500" />
              <span>Send to Chat</span>
            </button>

            <button
              class="flex items-center gap-1.5 border border-neutral-200/70 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-700 font-medium transition-all dark:border-neutral-700/70 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200"
              title="Download generated WAV file"
              @click="downloadActiveTrack"
            >
              <div class="i-solar:download-linear text-xs" />
              <span>Download WAV</span>
            </button>
          </div>
        </div>

        <!-- Waveform Scrub Bar -->
        <div class="space-y-1">
          <input
            type="range"
            min="0"
            :max="totalDuration || 60"
            step="0.1"
            :value="currentTime"
            class="w-full cursor-pointer accent-primary-500"
            @input="handleSeek"
          >
          <div class="flex justify-between text-[10px] text-neutral-400 font-mono">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ formatTime(totalDuration || durationSeconds) }}</span>
          </div>
        </div>
      </div>

      <!-- Recent Tracks Strip -->
      <div v-if="recentTracks.length > 1" class="space-y-2">
        <h4 class="text-xs text-neutral-500 font-bold dark:text-neutral-400">
          Recent Studio Takes ({{ recentTracks.length }})
        </h4>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="track in recentTracks"
            :key="track.id"
            class="shadow-2xs flex items-center gap-2 border rounded-xl bg-white/70 px-3 py-2 text-left transition-all active:scale-95 dark:bg-neutral-900/70"
            :class="activeTrack?.id === track.id ? 'border-primary-500/60 bg-primary-500/10' : 'border-neutral-200/60 dark:border-neutral-800 hover:border-neutral-300'"
            @click="selectTrack(track)"
          >
            <div class="i-solar:play-circle-bold text-lg text-primary-500" />
            <div>
              <div class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                {{ track.title }}
              </div>
              <div class="text-[10px] text-neutral-400">
                {{ track.model.toUpperCase() }} &bull; {{ track.duration }}s &bull; {{ track.createdAt }}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 2. RIGHT PANE: Studio Co-Creation Chat Stream (w-88 to w-96) -->
    <div class="w-88 flex shrink-0 flex-col bg-white/40 backdrop-blur-md dark:bg-neutral-950/20">
      <!-- Chat Header -->
      <div class="flex items-center justify-between border-b border-neutral-200/40 p-3.5 dark:border-neutral-800/40">
        <div class="flex items-center gap-2.5">
          <div class="h-7 w-7 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
            <div class="i-solar:clapperboard-text-bold-duotone text-base" />
          </div>
          <div>
            <h4 class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
              {{ activeCard?.name || 'Airi' }}'s Studio Notes
            </h4>
            <span class="text-[10px] text-emerald-500 font-semibold">● In Session: Sound Studio</span>
          </div>
        </div>
      </div>

      <!-- Transcript Feed -->
      <div
        ref="transcriptContainerRef"
        class="flex-1 overflow-y-auto p-4 space-y-3"
      >
        <template v-for="msg in chatTranscript" :key="msg.id">
          <!-- Character Dialogue Bubble -->
          <div v-if="msg.sender === 'character'" class="flex flex-col items-start gap-1">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-neutral-400 font-bold">{{ msg.authorName }}</span>
              <span
                v-if="msg.emotion && msg.emotion !== 'neutral'"
                class="rounded-full px-1.5 py-0.2 text-[8px] font-bold tracking-wider uppercase"
                :class="msg.emotion === 'inspired'
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300'
                  : msg.emotion === 'excited'
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                    : msg.emotion === 'chill'
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'"
              >
                {{ msg.emotion }}
              </span>
            </div>
            <div class="shadow-xs max-w-[90%] rounded-2xl rounded-tl-none bg-white p-3 text-xs text-neutral-800 leading-relaxed dark:bg-neutral-800/80 dark:text-neutral-200">
              <div>{{ msg.text }}</div>

              <!-- Track Attachment Inside Bubble -->
              <div
                v-if="msg.trackAttachment"
                class="mt-2.5 border border-primary-500/30 rounded-xl bg-primary-500/5 p-2.5 space-y-1.5 dark:bg-primary-950/20"
              >
                <div class="flex items-center justify-between text-xs text-primary-700 font-bold dark:text-primary-300">
                  <div class="flex items-center gap-1.5">
                    <div class="i-solar:music-note-bold text-sm text-primary-500" />
                    <span>🎵 {{ msg.trackAttachment.title }}</span>
                  </div>
                  <button
                    class="rounded bg-primary-500 px-2 py-0.5 text-[10px] text-white font-bold transition-all active:scale-95"
                    @click="selectTrack(msg.trackAttachment)"
                  >
                    Play
                  </button>
                </div>
                <div class="truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                  {{ msg.trackAttachment.prompt }}
                </div>
              </div>
            </div>
          </div>

          <!-- User Chat Bubble -->
          <div v-else class="flex flex-col items-end gap-1">
            <span class="text-[10px] text-neutral-400 font-bold">You</span>
            <div class="shadow-xs max-w-[90%] rounded-2xl rounded-tr-none bg-primary-500 p-3 text-xs text-white leading-relaxed">
              <div>{{ msg.text }}</div>
              <!-- Track Attachment from User -->
              <div
                v-if="msg.trackAttachment"
                class="mt-2 border border-white/30 rounded-lg bg-black/20 p-2 text-[11px]"
              >
                🎵 Attached Track: {{ msg.trackAttachment.title }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Quick Co-Creation Prompts -->
      <div class="border-t border-neutral-200/30 p-2.5 space-y-1 dark:border-neutral-800/30">
        <div class="flex flex-wrap gap-1">
          <button
            class="border border-neutral-200/60 rounded-lg bg-white/70 px-2 py-1 text-[10px] text-neutral-600 font-medium transition-all active:scale-95 dark:border-neutral-700 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:text-neutral-300"
            @click="handleSendMessage('What style or tempo do you suggest for this track?')"
          >
            💡 Suggest tempo/vibe
          </button>
          <button
            class="border border-neutral-200/60 rounded-lg bg-white/70 px-2 py-1 text-[10px] text-neutral-600 font-medium transition-all active:scale-95 dark:border-neutral-700 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:text-neutral-300"
            @click="handleSendMessage('Can you write a catchy 4-line verse for these lyrics?')"
          >
            ✍️ Brainstorm verse
          </button>
        </div>
      </div>

      <!-- Chat Composer -->
      <div class="border-t border-neutral-200/40 p-3 dark:border-neutral-800/40">
        <form class="flex items-center gap-2" @submit.prevent="handleSendMessage()">
          <input
            v-model="userInputText"
            type="text"
            placeholder="Jam or discuss track ideas..."
            class="flex-1 border border-neutral-200/80 rounded-xl bg-neutral-50/80 px-3 py-2 text-xs text-neutral-800 outline-none transition-colors dark:border-neutral-700/80 focus:border-primary-500/60 dark:bg-neutral-800/80 dark:text-neutral-100"
          >
          <button
            type="submit"
            class="shadow-xs h-8 w-8 flex items-center justify-center rounded-xl bg-primary-500 text-white transition-all active:scale-95 hover:bg-primary-600 disabled:opacity-40"
            :disabled="!userInputText.trim()"
          >
            <div class="i-solar:plain-bold text-sm" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

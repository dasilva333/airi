<script setup lang="ts">
import type { SerializableDesktopCapturerSource } from '@proj-airi/electron-screen-capture'
import type { MirageAnalysisResult, MirageBoundingBox } from '@proj-airi/stage-ui/libs/inference'
import type { SourcesOptions } from 'electron'

import { useElectronScreenCapture } from '@proj-airi/electron-screen-capture/vue'
import { getElectronEventaContext } from '@proj-airi/electron-vueuse'
import { getMirageClient } from '@proj-airi/stage-ui/libs/inference'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, FieldCheckbox, FieldInput, FieldSelect, Select, SelectTab } from '@proj-airi/ui'
import { useClipboard } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { createWorker } from 'tesseract.js'
import { computed, onUnmounted, ref } from 'vue'

interface ScreenCaptureSource extends SerializableDesktopCapturerSource {
  appIconURL?: string
  thumbnailURL?: string
}

type SourceCategory = 'applications' | 'displays'

const visionStore = useVisionStore()
const mirageClient = getMirageClient()
const { copy, copied } = useClipboard()

const airiCardStore = useAiriCardStore()
const { activeCard } = storeToRefs(airiCardStore)
const consciousnessStore = useConsciousnessStore()
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const llmStore = useLLM()

// Step 3: Character Consciousness & Reaction State
const characterName = computed(() => activeCard.value?.name || 'AIRI')
const activeCompanionAvatar = computed(() => {
  return (activeCard.value?.extensions as any)?.airi?.avatar
    || (activeCard.value as any)?.avatar
    || ''
})

const isGeneratingStep3 = ref(false)
const step3Error = ref<string | null>(null)
const step3LatencyMs = ref(0)
const step3Commentary = ref<string | null>(null)
const step3RawPrompt = ref<string | null>(null)
const step3EmittedNoReply = ref(false)
const showPromptInspector = ref(false)
const isSpeakingCommentary = ref(false)

const customCommentaryInstruction = ref(
  'Give a brief, natural, in-character reaction or comment (1-2 sentences) about what the user is doing or looking at based on these visual cues. Speak authentically in character. Do not announce that you are analyzing the screen or state robotic observations. If nothing warrants dialogue, emit NO_REPLY.',
)

// Sources selection
const sources = ref<ScreenCaptureSource[]>([])
const isRefetching = ref(false)
const hasFetchedOnce = ref(false)
const sourceCategory = ref<SourceCategory>('applications')
const selectedSourceId = ref('')

const sourcesOptions = ref<SourcesOptions>({
  types: ['screen', 'window'],
  fetchWindowIcons: true,
})

const { getSources } = useElectronScreenCapture(getElectronEventaContext(), sourcesOptions)

const isWindowSource = (source: ScreenCaptureSource) => source.id.startsWith('window:')
const isDisplaySource = (source: ScreenCaptureSource) => source.id.startsWith('screen:')

const filteredSources = computed(() => {
  if (sourceCategory.value === 'applications')
    return sources.value.filter(isWindowSource)
  return sources.value.filter(isDisplaySource)
})

const sourceCounts = computed(() => ({
  applications: sources.value.filter(isWindowSource).length,
  displays: sources.value.filter(isDisplaySource).length,
}))

const categoryOptions = [
  { label: 'Applications', value: 'applications', icon: 'i-solar:window-frame-line-duotone' },
  { label: 'Displays', value: 'displays', icon: 'i-solar:screencast-2-line-duotone' },
]

// Step 1: Capture & Resolution state
const resolutionMode = ref<'native' | '1536' | '768' | '384'>('native')
const resolutionOptions = [
  { label: 'Native (100% Unscaled - Recommended)', value: 'native' },
  { label: '1536×1536 (4x Scaled)', value: '1536' },
  { label: '768×768 (2x Scaled)', value: '768' },
  { label: '384×384 (1x Scaled)', value: '384' },
]

const isProcessing = ref(false)
const captureError = ref<string | null>(null)
const snapshotDataUrl = ref<string | null>(null)
const snapshotWidth = ref<number>(0)
const snapshotHeight = ref<number>(0)

// Mirage Analysis output
const analysisResult = ref<MirageAnalysisResult | null>(null)
const activeBox = ref<MirageBoundingBox | null>(null)
const hoveredBox = ref<MirageBoundingBox | null>(null)
const showRawJson = ref(false)

// Bounding box visual filters
const filterShowWindows = ref(true)
const filterShowObjects = ref(true)
const filterShowText = ref(true)
const filterDimBackground = ref(false)
const filterShowLabels = ref(false)

function onImageLoad(event: Event) {
  const img = event.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) {
    snapshotWidth.value = img.naturalWidth
    snapshotHeight.value = img.naturalHeight
  }
}

const formattedRawJson = computed(() => {
  if (analysisResult.value?.rawJson) {
    try {
      return JSON.stringify(JSON.parse(analysisResult.value.rawJson), null, 2)
    }
    catch {
      return analysisResult.value.rawJson
    }
  }
  if (analysisResult.value?.parsed) {
    try {
      return JSON.stringify(analysisResult.value.parsed, null, 2)
    }
    catch {
      return String(analysisResult.value.parsed)
    }
  }
  return 'No raw JSON available'
})

const refetchLabel = computed(() => (isRefetching.value ? 'Refetching...' : 'Refetch'))
const refetchIcon = computed(() => (isRefetching.value ? 'i-svg-spinners:ring-resize' : 'i-solar:refresh-line-duotone'))

async function refetchSources() {
  isRefetching.value = true
  try {
    sources.value = (await getSources()) as unknown as ScreenCaptureSource[]
    hasFetchedOnce.value = true
    if (!selectedSourceId.value && sources.value.length > 0)
      selectedSourceId.value = sources.value[0].id
  }
  catch (err: any) {
    captureError.value = `Failed to fetch sources: ${err?.message || err}`
  }
  finally {
    isRefetching.value = false
  }
}

// Bounding box classifications
const objectBoxes = computed(() => {
  if (!analysisResult.value?.boxes)
    return []
  return analysisResult.value.boxes.filter(b => b.type === 'object')
})

const windowBoxes = computed(() => {
  return objectBoxes.value.filter(b => b.label?.toLowerCase().includes('window') || b.label?.toLowerCase().includes('screen'))
})

const generalObjectBoxes = computed(() => {
  return objectBoxes.value.filter(b => !b.label?.toLowerCase().includes('window') && !b.label?.toLowerCase().includes('screen'))
})

const textBoxes = computed(() => {
  if (!analysisResult.value?.boxes)
    return []
  return analysisResult.value.boxes.filter(b => b.type === 'text')
})

export interface SpatialCandidate {
  id: string
  label: string
  category: 'macro_window' | 'sub_panel' | 'action_control' | 'text_banner' | 'control_pill'
  zone: string
  bbox: [number, number, number, number] // [xmin, ymin, xmax, ymax] normalized 0..1000
  width: number
  height: number
  areaPercent: number
  confidence: number
  color?: string
  textSnippet?: string
  tags: string[]
  box: MirageBoundingBox
}

function computeZone(x1: number, y1: number, x2: number, y2: number): string {
  const width = x2 - x1
  const height = y2 - y1
  if (width >= 800 && height >= 800)
    return 'Full Screen'

  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  if (cy <= 130) {
    if (cx <= 320)
      return 'Top-Left Titlebar'
    if (cx >= 680)
      return 'Top-Right Toolbar'
    return 'Top Header'
  }
  if (cy >= 870) {
    if (cx <= 320)
      return 'Bottom-Left'
    if (cx >= 680)
      return 'Bottom-Right'
    return 'Bottom Dock / Footer'
  }
  if (cx <= 260)
    return 'Left Sidebar'
  if (cx >= 740)
    return 'Right Panel'
  if (cy <= 400)
    return 'Upper Canvas'
  if (cy >= 650)
    return 'Lower Canvas'
  return 'Center Canvas'
}

function computeIoU(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number],
): number {
  const [ax1, ay1, ax2, ay2] = boxA
  const [bx1, by1, bx2, by2] = boxB

  const ix1 = Math.max(ax1, bx1)
  const iy1 = Math.max(ay1, by1)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)

  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const intersectionArea = iw * ih

  if (intersectionArea <= 0)
    return 0

  const areaA = Math.max(1, (ax2 - ax1) * (ay2 - ay1))
  const areaB = Math.max(1, (bx2 - bx1) * (by2 - by1))
  const unionArea = areaA + areaB - intersectionArea

  return unionArea > 0 ? intersectionArea / unionArea : 0
}

function computeOverlapRatio(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number],
): number {
  const [ax1, ay1, ax2, ay2] = boxA
  const [bx1, by1, bx2, by2] = boxB

  const ix1 = Math.max(ax1, bx1)
  const iy1 = Math.max(ay1, by1)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)

  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const intersectionArea = iw * ih

  if (intersectionArea <= 0)
    return 0

  const areaA = Math.max(1, (ax2 - ax1) * (ay2 - ay1))
  const areaB = Math.max(1, (bx2 - bx1) * (by2 - by1))
  const minArea = Math.min(areaA, areaB)

  return minArea > 0 ? intersectionArea / minArea : 0
}

function deduplicateCandidates(items: SpatialCandidate[]): SpatialCandidate[] {
  const result: SpatialCandidate[] = []

  for (const item of items) {
    const existingIndex = result.findIndex((existing) => {
      // Never merge a macro window with a small child control
      const existingIsMacro = existing.category === 'macro_window'
      const itemIsMacro = item.category === 'macro_window'
      if (existingIsMacro !== itemIsMacro)
        return false

      const iou = computeIoU(existing.bbox, item.bbox)
      if (iou >= 0.40)
        return true

      const overlap = computeOverlapRatio(existing.bbox, item.bbox)
      const areaA = Math.max(1, existing.width * existing.height)
      const areaB = Math.max(1, item.width * item.height)
      const areaRatio = Math.min(areaA, areaB) / Math.max(areaA, areaB)

      return overlap >= 0.70 && areaRatio >= 0.35
    })

    if (existingIndex === -1) {
      result.push({ ...item })
    }
    else {
      const existing = result[existingIndex]
      existing.tags = Array.from(new Set([...existing.tags, ...item.tags]))

      if (!existing.textSnippet && item.textSnippet) {
        existing.textSnippet = item.textSnippet
      }
      else if (existing.textSnippet && item.textSnippet && !existing.textSnippet.includes(item.textSnippet)) {
        if (item.textSnippet.length > existing.textSnippet.length) {
          existing.textSnippet = item.textSnippet
        }
      }

      if (existing.category === 'text_banner' && (item.category === 'action_control' || item.category === 'control_pill')) {
        existing.category = item.category
        existing.label = item.label
      }

      existing.confidence = Math.max(existing.confidence, item.confidence)
    }
  }

  return result
}

const candidates = computed<SpatialCandidate[]>(() => {
  if (!analysisResult.value)
    return []

  const parsed = analysisResult.value.parsed || {}
  const rawObjects: any[] = Array.isArray(parsed.objects) ? parsed.objects : []
  const rawText: any[] = Array.isArray(parsed.text) ? parsed.text : []
  const boxes = analysisResult.value.boxes || []

  const rawList: SpatialCandidate[] = []

  // 1. Process Objects
  rawObjects.forEach((obj: any, idx: number) => {
    const [x1, y1, x2, y2] = Array.isArray(obj.bbox) ? obj.bbox : [0, 0, 1000, 1000]
    const width = Math.max(1, x2 - x1)
    const height = Math.max(1, y2 - y1)
    const areaPercent = Number(((width * height) / 10000).toFixed(2))
    const zone = computeZone(x1, y1, x2, y2)
    const name = String(obj.name || obj.label || 'object').toLowerCase()
    const color = obj.description?.color || undefined
    const score = typeof obj.score === 'number' ? obj.score : 0.85

    // Associate overlapping / inside text
    const matchingText = rawText
      .filter((t: any) => {
        if (!Array.isArray(t.bbox))
          return false
        const [tx1, ty1, tx2, ty2] = t.bbox
        const tcx = (tx1 + tx2) / 2
        const tcy = (ty1 + ty2) / 2
        return tcx >= x1 - 15 && tcx <= x2 + 15 && tcy >= y1 - 15 && tcy <= y2 + 15
      })
      .map((t: any) => typeof t === 'string' ? t : (t.string || t.text || ''))
      .filter(Boolean)
      .join(' ')

    let category: SpatialCandidate['category'] = 'control_pill'
    let label = obj.name || 'UI Element'
    const tags: string[] = []

    if (color)
      tags.push(`#${color}`)

    if (name.includes('window') || (width >= 600 && height >= 600) || areaPercent >= 20) {
      category = 'macro_window'
      label = 'Software Window'
      tags.push('#macro_window', '#app_root')
    }
    else if (name.includes('sidebar') || name.includes('menu') || (height >= 400 && width >= 180) || areaPercent >= 8) {
      category = 'sub_panel'
      label = 'Sidebar Navigation'
      tags.push('#container', '#sidebar', '#navigation')
    }
    else if (name.includes('text') || name.includes('label')) {
      category = 'text_banner'
      label = matchingText ? 'Text Section' : 'Text Label'
      tags.push('#heading', '#label')
    }
    else if (name.includes('button')) {
      if (width >= 150 || areaPercent >= 1.0) {
        category = 'action_control'
        label = 'Primary Action'
        tags.push('#action_button', '#clickable')
      }
      else {
        category = 'control_pill'
        label = 'Button Control'
        tags.push('#button', '#control')
      }
    }
    else {
      tags.push('#element')
    }

    if (matchingText)
      tags.push('#has_text')

    const matchingBox = boxes.find(b =>
      b.type === 'object'
      && Math.abs(b.left * 1000 - x1) < 2
      && Math.abs(b.top * 1000 - y1) < 2,
    ) || {
      top: y1 / 1000,
      left: x1 / 1000,
      bottom: y2 / 1000,
      right: x2 / 1000,
      label,
      confidence: score,
      type: 'object' as const,
      text: matchingText || undefined,
    }

    rawList.push({
      id: `C${idx + 1}`,
      label,
      category,
      zone,
      bbox: [x1, y1, x2, y2],
      width,
      height,
      areaPercent,
      confidence: score,
      color,
      textSnippet: matchingText || undefined,
      tags,
      box: matchingBox,
    })
  })

  // 2. Incorporate standalone text blocks that weren't captured inside an object
  rawText.forEach((t: any, tidx: number) => {
    const textStr = typeof t === 'string' ? t : (t.string || t.text || '')
    if (!textStr || textStr.trim().length < 3)
      return
    const [tx1, ty1, tx2, ty2] = Array.isArray(t.bbox) ? t.bbox : [0, 0, 0, 0]

    const alreadyCovered = rawList.some(c =>
      c.textSnippet?.includes(textStr)
      || (tx1 >= c.bbox[0] - 10 && tx2 <= c.bbox[2] + 10 && ty1 >= c.bbox[1] - 10 && ty2 <= c.bbox[3] + 10),
    )
    if (alreadyCovered)
      return

    const width = Math.max(1, tx2 - tx1)
    const height = Math.max(1, ty2 - ty1)
    const areaPercent = Number(((width * height) / 10000).toFixed(2))
    const zone = computeZone(tx1, ty1, tx2, ty2)
    const score = typeof t.score === 'number' ? t.score : 0.75

    const matchingBox = boxes.find(b =>
      b.type === 'text'
      && Math.abs(b.left * 1000 - tx1) < 2
      && Math.abs(b.top * 1000 - ty1) < 2,
    ) || {
      top: ty1 / 1000,
      left: tx1 / 1000,
      bottom: ty2 / 1000,
      right: tx2 / 1000,
      label: 'text',
      confidence: score,
      type: 'text' as const,
      text: textStr,
    }

    rawList.push({
      id: `T${tidx + 1}`,
      label: width >= 180 ? 'Header Text' : 'Text Block',
      category: 'text_banner',
      zone,
      bbox: [tx1, ty1, tx2, ty2],
      width,
      height,
      areaPercent,
      confidence: score,
      textSnippet: textStr,
      tags: ['#text', '#extracted', width >= 180 ? '#headline' : '#body_text'],
      box: matchingBox,
    })
  })

  // Deduplicate overlapping multi-class boxes (Pascal VOC IoU >= 0.40)
  const deduplicated = deduplicateCandidates(rawList)

  const priorityOrder: Record<SpatialCandidate['category'], number> = {
    macro_window: 1,
    sub_panel: 2,
    action_control: 3,
    text_banner: 4,
    control_pill: 5,
  }

  const sorted = deduplicated.sort((a, b) => {
    const pDiff = (priorityOrder[a.category] || 99) - (priorityOrder[b.category] || 99)
    if (pDiff !== 0)
      return pDiff
    return b.areaPercent - a.areaPercent
  })

  return sorted.map((cand, idx) => ({
    ...cand,
    id: `C${idx + 1}`,
  }))
})

export interface VerifiedCandidate {
  id: string
  sourceCandidateId: string
  label: string
  category: SpatialCandidate['category']
  zone: string
  bbox: [number, number, number, number]
  width: number
  height: number
  areaPercent: number
  confidence: number
  color?: string
  rawSnippet?: string
  ocrText: string
  ocrConfidence: number
  ocrLatencyMs: number
  cropThumbnailUrl?: string
  tags: string[]
  isTripwireMatch: boolean
  matchedTripwire?: string
  box: MirageBoundingBox
}

// State for Targeted Candidate OCR (with user-selectable budget)
const ocrBudgetOptions = [
  { label: '500ms (Fast)', value: '500' },
  { label: '1000ms (Balanced - Recommended)', value: '1000' },
  { label: '2000ms (Thorough)', value: '2000' },
  { label: '3000ms (Deep)', value: '3000' },
  { label: '5000ms (Full Scan)', value: '5000' },
]
const selectedOcrBudget = ref<'500' | '1000' | '2000' | '3000' | '5000'>('1000')

const isRunningOcr = ref(false)
const ocrProgressText = ref('')
const ocrTotalMs = ref(0)
const ocrExitReason = ref('')
const ocrError = ref<string | null>(null)
const finalVerifiedCandidates = ref<VerifiedCandidate[]>([])

let ocrWorkerInstance: any = null
let isOcrWorkerWarmedUp = false

async function getOcrWorker() {
  if (!ocrWorkerInstance) {
    ocrProgressText.value = 'Initializing Tesseract.js WASM engine...'
    ocrWorkerInstance = await createWorker('eng', 1)
  }
  if (!isOcrWorkerWarmedUp && ocrWorkerInstance) {
    try {
      ocrProgressText.value = 'Warming up WASM LSTM model...'
      const dummyCanvas = document.createElement('canvas')
      dummyCanvas.width = 32
      dummyCanvas.height = 32
      await ocrWorkerInstance.recognize(dummyCanvas)
      isOcrWorkerWarmedUp = true
    }
    catch {
      isOcrWorkerWarmedUp = true
    }
  }
  return ocrWorkerInstance
}

onUnmounted(async () => {
  if (ocrWorkerInstance) {
    try {
      await ocrWorkerInstance.terminate()
    }
    catch {}
    ocrWorkerInstance = null
    isOcrWorkerWarmedUp = false
  }
})

const INTEREST_KEYWORDS = [
  'youtube',
  'discord',
  'terminal',
  'error',
  'failed',
  'exception',
  'settings',
  'attention',
  'airi',
  'tamagotchi',
  'chrome',
  'safari',
  'video',
  'music',
  'play',
  'subscribe',
]

async function cropCandidateCanvas(
  cand: SpatialCandidate,
  sourceImg: HTMLImageElement,
): Promise<{ dataUrl: string, blob: Blob | null, cropWidth: number, cropHeight: number } | null> {
  const natW = sourceImg.naturalWidth || snapshotWidth.value
  const natH = sourceImg.naturalHeight || snapshotHeight.value
  if (!natW || !natH)
    return null

  const [x1, y1, x2, y2] = cand.bbox
  const pxX = Math.max(0, Math.round((x1 / 1000) * natW))
  const pxY = Math.max(0, Math.round((y1 / 1000) * natH))
  let pxW = Math.max(8, Math.round(((x2 - x1) / 1000) * natW))
  let pxH = Math.max(8, Math.round(((y2 - y1) / 1000) * natH))

  // OCR glyph safety: clamp max dimensions so Tesseract WASM is never choked on giant containers
  // Small text crops execute in ~30-60ms; giant bitmaps take >1000ms.
  if (pxW > 600)
    pxW = 600
  if (pxH > 140)
    pxH = 140

  if (pxX + pxW > natW)
    pxW = Math.max(8, natW - pxX)
  if (pxY + pxH > natH)
    pxH = Math.max(8, natH - pxY)

  // Upscale small crops so Tesseract gets enough glyph pixels
  const scale = pxH < 36 ? Math.min(2.5, Math.max(1.5, Math.round(54 / pxH))) : 1
  const targetW = Math.round(pxW * scale)
  const targetH = Math.round(pxH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null

  ctx.imageSmoothingEnabled = scale > 1
  if (scale > 1) {
    ;(ctx as any).imageSmoothingQuality = 'high'
  }

  ctx.drawImage(sourceImg, pxX, pxY, pxW, pxH, 0, 0, targetW, targetH)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))

  return { dataUrl, blob, cropWidth: pxW, cropHeight: pxH }
}

async function runTargetedOcr() {
  if (isRunningOcr.value || candidates.value.length === 0 || !snapshotDataUrl.value)
    return

  isRunningOcr.value = true
  ocrError.value = null
  ocrExitReason.value = ''
  ocrProgressText.value = 'Preparing snapshot canvas...'

  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load snapshot into canvas'))
      img.src = snapshotDataUrl.value!
    })

    const worker = await getOcrWorker()
    const budgetMs = Number.parseInt(selectedOcrBudget.value, 10) || 1000
    const perCropTimeoutMs = Math.max(600, Math.round(budgetMs * 0.4))
    const startTime = performance.now()
    let exitReason = 'Budget Complete'

    // Sort candidates for OCR:
    // 1. Prioritize candidates that already have text or are text banners
    // 2. Prioritize action controls and buttons (compact interactive controls)
    // 3. Deprioritize macro windows and giant panels (areaPercent > 10)
    const sortedForOcr = [...candidates.value].sort((a, b) => {
      // Big containers go last
      const aIsContainer = a.category === 'macro_window' || a.category === 'sub_panel' || a.areaPercent > 10
      const bIsContainer = b.category === 'macro_window' || b.category === 'sub_panel' || b.areaPercent > 10
      if (aIsContainer && !bIsContainer)
        return 1
      if (!aIsContainer && bIsContainer)
        return -1

      // Has text or is text banner comes first
      const aHasText = a.category === 'text_banner' || !!a.textSnippet || a.tags.includes('#has_text')
      const bHasText = b.category === 'text_banner' || !!b.textSnippet || b.tags.includes('#has_text')
      if (aHasText && !bHasText)
        return -1
      if (!aHasText && bHasText)
        return 1

      // Higher confidence first
      if (Math.abs(b.confidence - a.confidence) > 0.05)
        return b.confidence - a.confidence

      // Smaller area (more focused glyph) first
      return a.areaPercent - b.areaPercent
    })

    const results: VerifiedCandidate[] = []

    for (let i = 0; i < sortedForOcr.length; i++) {
      const cand = sortedForOcr[i]
      const elapsed = performance.now() - startTime

      // Hard check against the user-selected wall-clock budget
      if (elapsed >= budgetMs) {
        exitReason = `${budgetMs}ms budget reached (${Math.round(elapsed)}ms elapsed, verified ${results.length}/${sortedForOcr.length})`
        break
      }

      ocrProgressText.value = `Verifying #${i + 1}/${sortedForOcr.length} (${cand.label}) · ${Math.round(elapsed)}ms elapsed...`

      const cropStart = performance.now()
      const cropRes = await cropCandidateCanvas(cand, img)
      if (!cropRes || !cropRes.blob)
        continue

      try {
        const ocrPromise = worker.recognize(cropRes.blob)
        const timeoutPromise = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('Per-crop OCR timeout')), perCropTimeoutMs),
        )
        const recRes: any = await Promise.race([ocrPromise, timeoutPromise])

        const cropMs = Math.round(performance.now() - cropStart)
        const rawOcrText = String(recRes?.data?.text || '').trim().replace(/[\r\n]+/g, ' ')
        const cleanOcrText = rawOcrText.replace(/[^\w\s.,!?:;@#\-/]/g, '').trim()
        const ocrConfidence = typeof recRes?.data?.confidence === 'number' ? Math.round(recRes.data.confidence) : 80

        const lowerOcr = cleanOcrText.toLowerCase()
        let matchedKeyword: string | undefined
        for (const kw of INTEREST_KEYWORDS) {
          if (lowerOcr.includes(kw)) {
            matchedKeyword = kw
            break
          }
        }

        const verifiedTags = [...cand.tags]
        if (cleanOcrText.length > 0)
          verifiedTags.push('#verified_text')
        if (matchedKeyword)
          verifiedTags.push(`#tripwire:${matchedKeyword}`)

        results.push({
          id: `V${results.length + 1}`,
          sourceCandidateId: cand.id,
          label: cand.label,
          category: cand.category,
          zone: cand.zone,
          bbox: cand.bbox,
          width: cand.width,
          height: cand.height,
          areaPercent: cand.areaPercent,
          confidence: cand.confidence,
          color: cand.color,
          rawSnippet: cand.textSnippet,
          ocrText: cleanOcrText || cand.textSnippet || '(No text detected)',
          ocrConfidence,
          ocrLatencyMs: cropMs,
          cropThumbnailUrl: cropRes.dataUrl,
          tags: Array.from(new Set(verifiedTags)),
          isTripwireMatch: !!matchedKeyword,
          matchedTripwire: matchedKeyword,
          box: cand.box,
        })

        if (matchedKeyword === 'youtube') {
          exitReason = `Found Tripwire Target (#youtube) in ${Math.round(performance.now() - startTime)}ms`
        }
      }
      catch (cropErr) {
        console.warn(`[Attention Lab] Crop OCR error on candidate ${cand.id}:`, cropErr)
      }
    }

    results.sort((a, b) => {
      if (a.isTripwireMatch && !b.isTripwireMatch)
        return -1
      if (!a.isTripwireMatch && b.isTripwireMatch)
        return 1
      return b.ocrConfidence - a.ocrConfidence
    })

    finalVerifiedCandidates.value = results
    ocrTotalMs.value = Math.round(performance.now() - startTime)
    ocrExitReason.value = exitReason
    ocrProgressText.value = `Verified ${results.length} candidates in ${ocrTotalMs.value}ms (${exitReason})`
  }
  catch (err: any) {
    ocrError.value = `Targeted OCR failed: ${err?.message || err}`
    ocrProgressText.value = ''
  }
  finally {
    isRunningOcr.value = false
  }
}

const visibleBoxes = computed(() => {
  const result: MirageBoundingBox[] = []
  if (filterShowWindows.value)
    result.push(...windowBoxes.value)
  if (filterShowObjects.value)
    result.push(...generalObjectBoxes.value)
  if (filterShowText.value)
    result.push(...textBoxes.value)
  return result
})

function getBoxStroke(box: MirageBoundingBox): string {
  if (winningCandidate.value?.box === box)
    return '#06b6d4' // Neon Cyan spotlight for Step 2 winner
  if (box.type === 'text')
    return '#f59e0b' // Amber/Orange
  if (box.label?.toLowerCase().includes('window') || box.label?.toLowerCase().includes('screen'))
    return '#8b5cf6' // Violet/Purple
  return '#10b981' // Emerald/Green
}

function getBoxFill(box: MirageBoundingBox): string {
  if (winningCandidate.value?.box === box)
    return 'rgba(6, 182, 212, 0.35)' // Neon Cyan fill for winner
  if (activeBox.value === box)
    return 'rgba(239, 68, 68, 0.35)' // Neon red active highlight
  if (hoveredBox.value === box)
    return 'rgba(255, 255, 255, 0.25)'
  if (box.type === 'text')
    return 'rgba(245, 158, 11, 0.12)'
  if (box.label?.toLowerCase().includes('window') || box.label?.toLowerCase().includes('screen'))
    return 'rgba(139, 92, 246, 0.08)'
  return 'rgba(16, 185, 129, 0.15)'
}

// STEP 2: System-1 Candidate Selection & Foveal Zoom
export interface CandidateScoreResult {
  candidate: SpatialCandidate | VerifiedCandidate
  score: number // 0..100
  passed: boolean
  rationale: string
  isWinner: boolean
}

export interface FinalPayloadBundle {
  title: string
  focalTarget: string
  zone: string
  bbox: [number, number, number, number]
  pixelBBox: [number, number, number, number]
  verbatimText: string
  visualSceneContext: string
  triggeredTripwire: string
  confidence: number
  threshold: number
  decision: 'PROMOTE' | 'IGNORE'
  latencyMs: {
    systemOneMs: number
    fovealMirageMs: number
    totalMs: number
  }
  formattedObservationText: string
  fovealCropUrl?: string
}

const tripwirePresets = [
  {
    label: 'Video / Stream Watching',
    question: 'Did the user start watching a notable video, live stream, or music release?',
    sensitivity: 70,
  },
  {
    label: 'Compiler / Build Error',
    question: 'Did the user encounter a compiler error, broken build, failing test run, or terminal exception?',
    sensitivity: 80,
  },
  {
    label: 'Direct Messaging / Chat',
    question: 'Is the user messaging, chatting, or collaborating with a friend or colleague?',
    sensitivity: 75,
  },
  {
    label: 'Novelty & Social Events',
    question: 'Did a notable, unexpected, or socially meaningful event occur on screen that warrants conversation?',
    sensitivity: 75,
  },
]

const activeTripwirePresetIndex = ref(0)
const customTripwireQuestion = ref('')
const tripwireSensitivity = ref(70)

const fovealPaddingOptions = [
  { label: '150px (Tight Local Context)', value: '150' },
  { label: '300px (Balanced Field - Recommended)', value: '300' },
  { label: '384px (Mirage Native 1:1 Ingestion)', value: '384' },
  { label: '500px (Wide Desktop Context)', value: '500' },
]
const selectedFovealPadding = ref<'150' | '300' | '384' | '500'>('300')

const isEvaluatingStep2 = ref(false)
const step2Error = ref<string | null>(null)
const step2ProgressText = ref('')
const candidateScores = ref<CandidateScoreResult[]>([])
const winningCandidate = ref<(SpatialCandidate | VerifiedCandidate) | null>(null)
const fovealCropDataUrl = ref<string | null>(null)
const fovealCropDimensions = ref<{ width: number, height: number } | null>(null)
const fovealMirageDescription = ref<string | null>(null)
const fovealMirageResult = ref<MirageAnalysisResult | null>(null)
const finalPayload = ref<FinalPayloadBundle | null>(null)

function computeLocalTripwireScore(text: string, question: string, tags: string[]): number {
  const t = text.toLowerCase()
  const q = question.toLowerCase()
  let score = 15

  // Video / streaming / music
  if (q.includes('video') || q.includes('stream') || q.includes('music') || q.includes('watch')) {
    if (t.includes('youtube') || tags.includes('#tripwire:youtube') || t.includes('video') || t.includes('watch') || t.includes('subscribe'))
      score = 96
    else if (t.includes('gemini') || t.includes('carbon') || t.includes('insane') || t.includes('podcast'))
      score = 92
    else if (t.includes('play') || t.includes('audio') || t.includes('song'))
      score = 85
    else if (t.includes('entire screen') || t.includes('tue nov'))
      score = 8
  }
  // Compiler / build / exception
  else if (q.includes('error') || q.includes('compiler') || q.includes('build') || q.includes('fail') || q.includes('exception')) {
    if (t.includes('error') || t.includes('fail') || t.includes('exception') || t.includes('fatal') || t.includes('syntaxerror'))
      score = 98
    else if (t.includes('terminal') || t.includes('warn') || t.includes('panic'))
      score = 85
    else
      score = 10
  }
  // Chat / messaging
  else if (q.includes('message') || q.includes('chat') || q.includes('collaborat')) {
    if (t.includes('discord') || t.includes('slack') || t.includes('telegram') || t.includes('chat') || t.includes('message'))
      score = 95
    else if (t.includes('reply') || t.includes('typing') || t.includes('send'))
      score = 85
    else
      score = 12
  }
  // Novelty / Social
  else {
    if (t.length > 25)
      score = 78
    else if (t.length > 5)
      score = 65
  }

  return score
}

async function runSystemOneTriage() {
  const candidatePool = finalVerifiedCandidates.value.length > 0
    ? finalVerifiedCandidates.value
    : candidates.value

  if (candidatePool.length === 0) {
    step2Error.value = 'No candidates available. Please run Step 1 capture and candidate verification first.'
    return
  }

  isEvaluatingStep2.value = true
  step2Error.value = null
  step2ProgressText.value = 'Evaluating candidates against active sentinel tripwire...'
  const t0 = performance.now()

  try {
    const activeQuestion = customTripwireQuestion.value.trim()
      || tripwirePresets[activeTripwirePresetIndex.value]?.question
      || 'Did a notable, unexpected, or socially meaningful event occur on screen?'

    const scores: CandidateScoreResult[] = []

    for (const cand of candidatePool) {
      const text = ('ocrText' in cand ? cand.ocrText : cand.textSnippet) || cand.label
      const score = computeLocalTripwireScore(text, activeQuestion, cand.tags)
      const passed = score >= tripwireSensitivity.value

      scores.push({
        candidate: cand,
        score,
        passed,
        rationale: passed
          ? `Matched tripwire interest pattern (${score}% >= ${tripwireSensitivity.value}%)`
          : `Below sensitivity threshold (${score}% < ${tripwireSensitivity.value}%)`,
        isWinner: false,
      })
    }

    scores.sort((a, b) => b.score - a.score)

    if (scores.length > 0) {
      scores[0].isWinner = true
      winningCandidate.value = scores[0].candidate
      activeBox.value = scores[0].candidate.box
    }
    candidateScores.value = scores
    const triageMs = Math.round(performance.now() - t0)

    const winner = scores[0]
    if (!winner || !winner.candidate) {
      throw new Error('No candidate scored.')
    }

    // 2. Foveal Context Region Extraction
    step2ProgressText.value = `Extracting ${selectedFovealPadding.value}px foveal context region around winning candidate...`

    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load snapshot for foveal crop'))
      img.src = snapshotDataUrl.value!
    })

    const natW = img.naturalWidth || snapshotWidth.value
    const natH = img.naturalHeight || snapshotHeight.value
    const [x1, y1, x2, y2] = winner.candidate.bbox

    const pxX1 = Math.round((x1 / 1000) * natW)
    const pxY1 = Math.round((y1 / 1000) * natH)
    const pxX2 = Math.round((x2 / 1000) * natW)
    const pxY2 = Math.round((y2 / 1000) * natH)

    const pad = Number(selectedFovealPadding.value) || 300
    const fovX1 = Math.max(0, pxX1 - pad)
    const fovY1 = Math.max(0, pxY1 - pad)
    const fovX2 = Math.min(natW, pxX2 + pad)
    const fovY2 = Math.min(natH, pxY2 + pad)
    const fovW = Math.max(32, fovX2 - fovX1)
    const fovH = Math.max(32, fovY2 - fovY1)

    const fovCanvas = document.createElement('canvas')
    fovCanvas.width = fovW
    fovCanvas.height = fovH
    const ctx = fovCanvas.getContext('2d')
    if (!ctx)
      throw new Error('Canvas 2D context unavailable')

    ctx.drawImage(img, fovX1, fovY1, fovW, fovH, 0, 0, fovW, fovH)
    const fovDataUrl = fovCanvas.toDataURL('image/png')
    fovealCropDataUrl.value = fovDataUrl
    fovealCropDimensions.value = { width: fovW, height: fovH }

    // 3. Run Mirage describe on the Foveal Crop
    step2ProgressText.value = 'Running Cactus Mirage describe on foveal patch...'
    const mirageFovStart = performance.now()
    const fovAnalysis = await mirageClient.analyzeFrame(fovDataUrl, {
      prompt: 'Describe the primary visual subject, media player, and activity in this focused region.',
    })
    const fovMirageMs = Math.round(performance.now() - mirageFovStart)
    fovealMirageResult.value = fovAnalysis

    let sceneDesc = fovAnalysis.sceneDescription
    if (!sceneDesc && fovAnalysis.parsed?.scene) {
      const s = fovAnalysis.parsed.scene
      sceneDesc = `${s.setting || 'computer interface'} with ${s.style || 'visual media'}`
      if (fovAnalysis.parsed.reasoning) {
        sceneDesc += ` — ${fovAnalysis.parsed.reasoning}`
      }
    }
    if (!sceneDesc) {
      sceneDesc = 'Focused visual media player and interactive content interface'
    }
    fovealMirageDescription.value = sceneDesc

    // 4. Assemble Final Structured Payload
    const textEvidence = ('ocrText' in winner.candidate ? winner.candidate.ocrText : winner.candidate.textSnippet)
      || winner.candidate.label

    const formattedMarkdown = `[REAL-TIME SCREEN OBSERVATION]
• Focal Target: ${winner.candidate.label} (${winner.candidate.category.replace('_', ' ')})
• Spatial Anchor: 📍 ${winner.candidate.zone}
• Verbatim Text Evidence: "${textEvidence}"
• Visual Scene Context: ${sceneDesc}
• Triggered Tripwire: "${activeQuestion}" (Confidence: ${winner.score}% >= ${tripwireSensitivity.value}%)
• Decision: ${winner.passed ? 'PROMOTE' : 'IGNORE'}`

    finalPayload.value = {
      title: winner.candidate.label,
      focalTarget: `${winner.candidate.label} (${winner.candidate.category.replace('_', ' ')})`,
      zone: winner.candidate.zone,
      bbox: winner.candidate.bbox,
      pixelBBox: [fovX1, fovY1, fovX2, fovY2],
      verbatimText: textEvidence,
      visualSceneContext: sceneDesc,
      triggeredTripwire: activeQuestion,
      confidence: winner.score,
      threshold: tripwireSensitivity.value,
      decision: winner.passed ? 'PROMOTE' : 'IGNORE',
      latencyMs: {
        systemOneMs: triageMs,
        fovealMirageMs: fovMirageMs,
        totalMs: triageMs + fovMirageMs,
      },
      formattedObservationText: formattedMarkdown,
      fovealCropUrl: fovDataUrl,
    }

    step2ProgressText.value = `Step 2 Complete in ${triageMs + fovMirageMs}ms (${winner.passed ? 'PROMOTED' : 'IGNORED'})`
  }
  catch (err: any) {
    step2Error.value = `Step 2 evaluation failed: ${err?.message || err}`
    step2ProgressText.value = ''
  }
  finally {
    isEvaluatingStep2.value = false
  }
}

async function generateCharacterReaction() {
  if (isGeneratingStep3.value || !finalPayload.value)
    return

  isGeneratingStep3.value = true
  step3Error.value = null
  step3Commentary.value = null
  step3EmittedNoReply.value = false
  const t0 = performance.now()

  try {
    const activeProviderId = consciousnessStore.activeProvider
    const activeModel = consciousnessStore.activeModel

    if (!activeProviderId || !activeModel) {
      throw new Error('No active LLM provider or model configured. Please select a model in System Settings → Intelligence → Inference Providers.')
    }

    const activeProvider = await providersStore.getProviderInstance(activeProviderId) as any
    if (!activeProvider) {
      throw new Error(`Failed to initialize LLM provider instance for "${activeProviderId}".`)
    }

    const systemPrompt = activeCard.value?.description
      || (activeCard.value as any)?.data?.description
      || (activeCard.value as any)?.systemPrompt
      || `You are ${characterName.value}, an attentive AI desktop companion. Stay in character.`

    const userMessage = `${finalPayload.value.formattedObservationText}\n\n${customCommentaryInstruction.value.trim()}`

    step3RawPrompt.value = `[SYSTEM PROMPT]\n${systemPrompt}\n\n[USER MESSAGE]\n${userMessage}`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ]

    console.log(`[Attention Lab] Dispatched Step 3 character reaction to ${activeProviderId}/${activeModel}...`)
    const response = await llmStore.generate(activeModel, activeProvider, messages, {})
    step3LatencyMs.value = Math.round(performance.now() - t0)

    const rawReply = String(response?.text || '').trim()
    if (!rawReply || rawReply === 'NO_REPLY' || rawReply.includes('NO_REPLY')) {
      step3EmittedNoReply.value = true
      step3Commentary.value = 'NO_REPLY'
      return
    }

    // Clean up ACT tags or asterisks for pristine speech bubble display
    const cleanReply = rawReply
      .replace(/<\|ACT:[^>]*\|>/g, '')
      .replace(/<\|[^>]*\|>/g, '')
      .replace(/^"(.*)"$/, '$1')
      .trim()

    step3Commentary.value = cleanReply || rawReply
  }
  catch (err: any) {
    step3Error.value = `Failed to generate commentary: ${err?.message || err}`
  }
  finally {
    isGeneratingStep3.value = false
  }
}

let currentAudioElement: HTMLAudioElement | null = null

async function speakCommentary() {
  if (isSpeakingCommentary.value || !step3Commentary.value || step3EmittedNoReply.value)
    return

  const speechProv = speechStore.activeSpeechProvider
  if (!speechProv) {
    console.warn('[Attention Lab] No active speech provider configured.')
    return
  }

  isSpeakingCommentary.value = true
  try {
    const providerInstance = await providersStore.getProviderInstance(speechProv)
    if (!providerInstance) {
      isSpeakingCommentary.value = false
      return
    }

    const model = speechStore.activeSpeechModel || ''
    const voiceId = speechStore.activeSpeechVoiceId || ''
    const buf = await speechStore.speech(providerInstance as any, model, step3Commentary.value, voiceId)
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
        isSpeakingCommentary.value = false
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        isSpeakingCommentary.value = false
        URL.revokeObjectURL(url)
      }
      await audio.play()
    }
    else {
      isSpeakingCommentary.value = false
    }
  }
  catch (err) {
    console.warn('[Attention Lab] Speech playback failed:', err)
    isSpeakingCommentary.value = false
  }
}

async function captureAndAnalyze() {
  if (isProcessing.value)
    return
  isProcessing.value = true
  captureError.value = null

  try {
    const isNative = resolutionMode.value === 'native'
    let reqWidth: number | undefined
    let reqHeight: number | undefined
    let maxDim: number | undefined

    if (!isNative) {
      const dim = Number.parseInt(resolutionMode.value, 10) || 384
      reqWidth = dim
      reqHeight = dim
      maxDim = dim
    }

    const sourceId = selectedSourceId.value || undefined
    const isWindow = sourceId?.startsWith('window:')

    // 1. Capture snapshot via Electron IPC
    const snap = await visionStore.captureSnapshot({
      sourceId,
      type: isWindow ? 'window' : 'screen',
      native: isNative,
      width: reqWidth,
      height: reqHeight,
    })

    if (!snap?.dataUrl) {
      throw new Error(snap?.error === 'permission_denied'
        ? 'Screen capture permission denied by OS.'
        : 'Screen capture returned an empty frame.')
    }

    snapshotDataUrl.value = snap.dataUrl
    snapshotWidth.value = snap.width || 0
    snapshotHeight.value = snap.height || 0

    // 2. Execute Mirage WASM spatial extraction
    const mirageRes = await mirageClient.analyzeFrame(snap.dataUrl, {
      nativeResolution: isNative,
      maxDimension: maxDim,
    })

    analysisResult.value = mirageRes
    activeBox.value = null
    finalVerifiedCandidates.value = []
    ocrTotalMs.value = 0
    ocrExitReason.value = ''
    ocrProgressText.value = ''
    ocrError.value = null
    candidateScores.value = []
    winningCandidate.value = null
    fovealCropDataUrl.value = null
    fovealCropDimensions.value = null
    fovealMirageDescription.value = null
    fovealMirageResult.value = null
    finalPayload.value = null
    step2Error.value = null
    step2ProgressText.value = ''
  }
  catch (err: any) {
    captureError.value = err?.message || String(err)
  }
  finally {
    isProcessing.value = false
  }
}

void refetchSources()
</script>

<template>
  <div
    :class="[
      'mx-auto max-w-6xl flex flex-col gap-8 p-6',
      'text-neutral-900 dark:text-neutral-100',
    ]"
  >
    <!-- Page Header & Stepper -->
    <header class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center rounded-lg bg-primary-500/15 p-2 text-primary-500">
          <span class="i-solar:layers-bold-duotone text-2xl" />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight">
            Attention Ecology & Spatial BBox Lab
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Interactive 3-stage workbench for zero-timer screen perception, spatial bounding box decomposition, and System-1 triage.
          </p>
        </div>
      </div>

      <!-- 3-Step Progress Indicators -->
      <div
        :class="[
          'grid grid-cols-1 md:grid-cols-3 gap-3 p-1.5 mt-2',
          'rounded-xl border border-neutral-200/60 dark:border-neutral-800/60',
          'bg-neutral-100/50 dark:bg-neutral-900/50 backdrop-blur-sm',
        ]"
      >
        <div
          :class="[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all',
            candidates.length > 0
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'bg-primary-500 text-white shadow-sm',
          ]"
        >
          <span
            :class="[
              'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
              candidates.length > 0 ? 'bg-emerald-500 text-white' : 'bg-white/20',
            ]"
          >
            {{ candidates.length > 0 ? '✓' : '1' }}
          </span>
          <span>Spatial Decomposition & BBoxes</span>
        </div>

        <div
          :class="[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
            finalPayload
              ? 'bg-emerald-500 text-white shadow-sm font-semibold'
              : (candidates.length > 0
                ? 'bg-primary-500 text-white shadow-sm font-semibold'
                : 'text-neutral-400 dark:text-neutral-500 bg-neutral-200/30 dark:bg-neutral-800/30'),
          ]"
        >
          <span
            :class="[
              'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
              finalPayload ? 'bg-white/20' : (candidates.length > 0 ? 'bg-white/20' : 'bg-neutral-400/20'),
            ]"
          >
            {{ finalPayload ? '✓' : '2' }}
          </span>
          <span>System-1 Candidate Selection</span>
        </div>

        <div
          :class="[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
            step3Commentary
              ? 'bg-emerald-500 text-white shadow-sm font-semibold'
              : (finalPayload
                ? 'bg-primary-500 text-white shadow-sm font-semibold'
                : 'text-neutral-400 dark:text-neutral-500 bg-neutral-200/30 dark:bg-neutral-800/30'),
          ]"
        >
          <span
            :class="[
              'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
              step3Commentary ? 'bg-white/20' : (finalPayload ? 'bg-white/20' : 'bg-neutral-400/20'),
            ]"
          >
            {{ step3Commentary ? '✓' : '3' }}
          </span>
          <span>Character LLM Reaction</span>
        </div>
      </div>
    </header>

    <!-- STEP 1: Spatial Decomposition & BBox Extraction -->
    <section
      :class="[
        'flex flex-col gap-6 p-5 rounded-2xl',
        'border border-neutral-200/80 dark:border-neutral-800/80',
        'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm',
      ]"
    >
      <div class="flex items-center justify-between border-b border-neutral-200/60 pb-3 dark:border-neutral-800/60">
        <div class="flex items-center gap-2">
          <span class="h-6 w-6 flex items-center justify-center rounded-full bg-primary-500/20 text-xs text-primary-500 font-bold">
            1
          </span>
          <h2 class="text-sm text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
            Manual Snapshot & Spatial Decomposition
          </h2>
        </div>
        <span class="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-600 font-medium dark:text-emerald-400">
          Zero-Timer Manual Execution
        </span>
      </div>

      <!-- Controls & Source Picker -->
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <SelectTab v-model="sourceCategory" :options="categoryOptions" />
          <Button
            :label="refetchLabel"
            :icon="refetchIcon"
            variant="ghost"
            size="sm"
            @click="refetchSources"
          />
        </div>

        <!-- Sources selection grid -->
        <div class="grid grid-cols-2 max-h-48 gap-2 overflow-y-auto pr-1 md:grid-cols-4 sm:grid-cols-3">
          <button
            v-for="source in filteredSources"
            :key="source.id"
            type="button"
            :class="[
              'flex flex-col gap-1.5 p-2 rounded-xl text-left text-xs transition-all border border-solid',
              selectedSourceId === source.id
                ? 'border-primary-500 bg-primary-500/10 shadow-sm ring-1 ring-primary-500/30'
                : 'border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50',
            ]"
            @click="selectedSourceId = source.id"
          >
            <div class="aspect-video w-full flex items-center justify-center overflow-hidden rounded-lg bg-neutral-200/50 dark:bg-neutral-800/50">
              <img
                v-if="source.thumbnailURL"
                :src="source.thumbnailURL"
                alt=""
                class="h-full w-full object-cover"
              >
              <span v-else class="i-solar:gallery-bold-duotone text-lg text-neutral-400" />
            </div>
            <span class="truncate font-medium">{{ source.name }}</span>
          </button>
          <div
            v-if="filteredSources.length === 0"
            class="col-span-full py-8 text-center text-xs text-neutral-400"
          >
            No sources discovered. Verify macOS Screen Recording permissions.
          </div>
        </div>

        <!-- Resolution & Action Strip -->
        <div class="flex flex-wrap items-end justify-between gap-4 pt-2">
          <div class="w-full sm:w-80">
            <FieldSelect
              v-model="resolutionMode"
              label="Evaluation Resolution"
              layout="vertical"
              :options="resolutionOptions"
            />
          </div>

          <Button
            :label="isProcessing ? 'Analyzing Frame...' : 'Capture & Decompose Frame'"
            :icon="isProcessing ? 'i-svg-spinners:ring-resize' : 'i-solar:camera-bold-duotone'"
            :disabled="isProcessing"
            class="px-6 py-2.5 font-semibold"
            @click="captureAndAnalyze"
          />
        </div>

        <div
          v-if="captureError"
          :class="[
            'p-3 rounded-xl text-xs flex items-center gap-2',
            'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400',
          ]"
        >
          <span class="i-solar:danger-triangle-bold-duotone shrink-0 text-base" />
          <span>{{ captureError }}</span>
        </div>
      </div>

      <!-- Viewport & Annotations -->
      <div v-if="snapshotDataUrl" class="flex flex-col gap-4 pt-2">
        <!-- BBox Filter Toggles & Visual Controls -->
        <div
          :class="[
            'flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl text-xs',
            'bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/60',
          ]"
        >
          <div class="flex flex-wrap items-center gap-4">
            <span class="text-neutral-600 font-semibold dark:text-neutral-400">Filters:</span>
            <FieldCheckbox
              v-model="filterShowWindows"
              :label="`Windows (${windowBoxes.length})`"
            />
            <FieldCheckbox
              v-model="filterShowObjects"
              :label="`Objects (${generalObjectBoxes.length})`"
            />
            <FieldCheckbox
              v-model="filterShowText"
              :label="`Text Blocks (${textBoxes.length})`"
            />
          </div>

          <div class="flex items-center gap-4">
            <FieldCheckbox
              v-model="filterShowLabels"
              label="Show Text Badges"
            />
            <FieldCheckbox
              v-model="filterDimBackground"
              label="Dim Image"
            />
          </div>
        </div>

        <!-- Main Annotated Viewport Container -->
        <div
          :class="[
            'relative overflow-hidden rounded-xl border border-neutral-200/80 dark:border-neutral-800/80',
            'bg-neutral-950 flex items-center justify-center p-3 select-none',
          ]"
        >
          <div class="relative max-h-[580px] max-w-full flex items-center justify-center">
            <!-- Natural Image wrapper - shrinks exactly to image bounds to ensure pixel-perfect SVG alignment -->
            <div class="relative inline-block max-h-[580px] max-w-full overflow-hidden rounded-lg leading-none">
              <!-- Raw Captured Snapshot -->
              <img
                :src="snapshotDataUrl"
                alt="Screen Snapshot"
                :class="[
                  'block max-h-[580px] w-auto max-w-full object-contain select-none transition-opacity duration-200',
                  filterDimBackground ? 'opacity-30' : 'opacity-100',
                ]"
                @load="onImageLoad"
              >

              <!-- SVG Bounding Box Overlay Layer (Normalized to 1000x1000) -->
              <svg
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                class="pointer-events-auto absolute inset-0 h-full w-full select-none"
              >
                <g
                  v-for="(box, idx) in visibleBoxes"
                  :key="idx"
                  class="cursor-pointer transition-all duration-150"
                  @mouseenter="hoveredBox = box"
                  @mouseleave="hoveredBox = null"
                  @click="activeBox = box"
                >
                  <!-- Bounding Box Rectangle -->
                  <rect
                    :x="box.left * 1000"
                    :y="box.top * 1000"
                    :width="Math.max(4, (box.right - box.left) * 1000)"
                    :height="Math.max(4, (box.bottom - box.top) * 1000)"
                    :stroke="getBoxStroke(box)"
                    :stroke-width="activeBox === box ? 3 : (hoveredBox === box ? 2.5 : 1.5)"
                    vector-effect="non-scaling-stroke"
                    :fill="getBoxFill(box)"
                    rx="2"
                  />
                </g>
              </svg>

              <!-- HTML Micro-Badges Overlay Layer (Rendered only if filterShowLabels is ON, or for active/hovered box) -->
              <div class="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                  v-for="(box, idx) in visibleBoxes"
                  v-show="filterShowLabels || activeBox === box || hoveredBox === box"
                  :key="`badge-${idx}`"
                  :style="{
                    top: `${Math.max(0, box.top * 100)}%`,
                    left: `${Math.max(0, box.left * 100)}%`,
                    borderColor: getBoxStroke(box),
                  }"
                  :class="[
                    'absolute pointer-events-auto cursor-pointer',
                    box.top > 0.05 ? '-translate-y-full -mt-0.5' : 'translate-y-0.5',
                    'px-1.5 py-0.5 rounded text-[10px] font-mono font-medium leading-none whitespace-nowrap shadow-md',
                    'bg-neutral-900/90 text-white border backdrop-blur-sm transition-transform duration-100',
                    activeBox === box
                      ? 'ring-2 ring-red-500 z-30 font-bold opacity-100 scale-105'
                      : (hoveredBox === box ? 'z-20 opacity-100 scale-105' : 'z-10 opacity-80'),
                  ]"
                  @mouseenter="hoveredBox = box"
                  @mouseleave="hoveredBox = null"
                  @click="activeBox = box"
                >
                  <span :style="{ color: getBoxStroke(box) }" class="mr-1 font-bold">
                    {{ box.type === 'text' ? 'TEXT' : (box.label || 'OBJ').toUpperCase() }}
                  </span>
                  <span v-if="box.text" class="text-neutral-200">
                    "{{ box.text.length > 22 ? `${box.text.slice(0, 22)}…` : box.text }}"
                  </span>
                  <span v-else-if="box.confidence" class="text-neutral-400">
                    {{ (box.confidence * 100).toFixed(0) }}%
                  </span>
                </div>
              </div>

              <!-- Live HUD Pill on Hover (Bottom Left) -->
              <div
                v-if="hoveredBox"
                class="pointer-events-none absolute bottom-2.5 left-2.5 z-30 flex items-center gap-2 border border-neutral-700/80 rounded-lg bg-black/85 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-md"
              >
                <span
                  class="h-2 w-2 rounded-full"
                  :style="{ backgroundColor: getBoxStroke(hoveredBox) }"
                />
                <span class="text-neutral-300 font-semibold">
                  {{ hoveredBox.type === 'text' ? 'Text Block' : (hoveredBox.label || 'Object') }}
                </span>
                <span v-if="hoveredBox.confidence" class="text-neutral-400 font-mono">
                  {{ (hoveredBox.confidence * 100).toFixed(0) }}%
                </span>
                <span v-if="hoveredBox.text" class="max-w-sm truncate text-amber-300 font-mono">
                  "{{ hoveredBox.text }}"
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Telemetry & Extraction Metrics Strip -->
        <div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div
            :class="[
              'flex flex-col gap-1 p-3 rounded-xl',
              'bg-neutral-100/70 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60',
            ]"
          >
            <span class="text-[11px] text-neutral-500 font-medium">Capture Resolution</span>
            <span class="text-sm font-bold font-mono">{{ snapshotWidth }} × {{ snapshotHeight }}</span>
          </div>

          <div
            :class="[
              'flex flex-col gap-1 p-3 rounded-xl',
              'bg-neutral-100/70 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60',
            ]"
          >
            <span class="text-[11px] text-neutral-500 font-medium">WASM Mirage Latency</span>
            <span class="text-sm text-primary-500 font-bold font-mono">{{ analysisResult?.latencyMs ?? 0 }}ms</span>
          </div>

          <div
            :class="[
              'flex flex-col gap-1 p-3 rounded-xl',
              'bg-neutral-100/70 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60',
            ]"
          >
            <span class="text-[11px] text-neutral-500 font-medium">Objects & Windows</span>
            <span class="text-sm text-emerald-500 font-bold font-mono">{{ objectBoxes.length }}</span>
          </div>

          <div
            :class="[
              'flex flex-col gap-1 p-3 rounded-xl',
              'bg-neutral-100/70 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60',
            ]"
          >
            <span class="text-[11px] text-neutral-500 font-medium">Extracted Text Blocks</span>
            <span class="text-sm text-amber-500 font-bold font-mono">{{ textBoxes.length }}</span>
          </div>
        </div>

        <!-- Selected BBox Inspector Card -->
        <div
          v-if="activeBox"
          :class="[
            'p-4 rounded-xl flex flex-col gap-2 border',
            'bg-primary-500/5 border-primary-500/30 text-xs',
          ]"
        >
          <div class="flex items-center justify-between">
            <span class="text-primary-500 font-bold tracking-wide uppercase">
              Selected Bounding Box Inspector
            </span>
            <button
              type="button"
              class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              @click="activeBox = null"
            >
              ✕ Close
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1 font-mono sm:grid-cols-4">
            <div><span class="text-neutral-500">Type:</span> {{ activeBox.type }}</div>
            <div><span class="text-neutral-500">Label:</span> {{ activeBox.label }}</div>
            <div><span class="text-neutral-500">Confidence:</span> {{ (activeBox.confidence || 0).toFixed(2) }}</div>
            <div>
              <span class="text-neutral-500">BBox (xyxy):</span>
              [{{ (activeBox.left * 1000).toFixed(0) }}, {{ (activeBox.top * 1000).toFixed(0) }}, {{ (activeBox.right * 1000).toFixed(0) }}, {{ (activeBox.bottom * 1000).toFixed(0) }}]
            </div>
          </div>

          <div v-if="activeBox.text" class="mt-1 rounded bg-black/10 p-2 font-mono dark:bg-black/30">
            <span class="text-neutral-500">String Snippet:</span> "{{ activeBox.text }}"
          </div>
        </div>

        <!-- Raw JSON Inspector Drawer -->
        <div
          :class="[
            'flex flex-col gap-2 p-4 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60',
            'bg-neutral-50/50 dark:bg-neutral-900/40',
          ]"
        >
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="flex items-center gap-2 text-xs font-semibold hover:text-primary-500"
              @click="showRawJson = !showRawJson"
            >
              <span :class="showRawJson ? 'i-solar:alt-arrow-down-bold' : 'i-solar:alt-arrow-right-bold'" />
              <span>Raw Mirage Spatial JSON Output</span>
            </button>
            <Button
              v-if="analysisResult?.rawJson || analysisResult?.parsed"
              :label="copied ? 'Copied!' : 'Copy JSON'"
              :icon="copied ? 'i-solar:check-circle-bold-duotone' : 'i-solar:copy-bold-duotone'"
              size="sm"
              variant="ghost"
              @click="copy(formattedRawJson)"
            />
          </div>

          <pre
            v-if="showRawJson"
            :class="[
              'p-3 rounded-lg text-[11px] font-mono overflow-auto max-h-72',
              'bg-neutral-100 dark:bg-black/40 text-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800',
            ]"
          >{{ formattedRawJson }}</pre>
        </div>

        <!-- Spatial Candidates Section -->
        <div
          v-if="candidates.length > 0"
          :class="[
            'flex flex-col gap-3 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800/80',
            'bg-neutral-50/70 dark:bg-neutral-900/60 backdrop-blur-sm shadow-sm',
          ]"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/60 pb-3 dark:border-neutral-800/60">
            <div class="flex items-center gap-2">
              <span class="h-5.5 w-5.5 flex items-center justify-center rounded-lg bg-primary-500 text-xs text-white font-bold shadow-sm">
                {{ candidates.length }}
              </span>
              <div>
                <h3 class="text-xs text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
                  Extracted Spatial Candidates for System-1 Triage
                </h3>
                <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Synthesized from Mirage layout graph, text association, and normalized geometric zones.
                </p>
              </div>
            </div>
            <span class="text-[11px] text-neutral-400 font-medium">
              Hover or click a candidate to spotlight in the viewport above
            </span>
          </div>

          <!-- Candidates Grid / List -->
          <div class="max-h-[460px] flex flex-col gap-2 overflow-y-auto pr-1">
            <div
              v-for="(cand, idx) in candidates"
              :key="cand.id"
              :class="[
                'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border text-xs transition-all duration-150 cursor-pointer',
                activeBox === cand.box
                  ? 'border-primary-500 bg-primary-500/10 shadow-sm ring-1 ring-primary-500/40'
                  : (hoveredBox === cand.box
                    ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/80'
                    : 'border-neutral-200/70 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-neutral-700'),
              ]"
              @mouseenter="hoveredBox = cand.box"
              @mouseleave="hoveredBox = null"
              @click="activeBox = cand.box"
            >
              <!-- Left: Index + Type Badge + Label + Text Snippet -->
              <div class="min-w-0 flex flex-1 items-center gap-3">
                <span class="w-6 shrink-0 text-[11px] text-neutral-400 font-bold font-mono">
                  #{{ idx + 1 }}
                </span>

                <span
                  :class="[
                    'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 border',
                    cand.category === 'macro_window' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
                    : cand.category === 'sub_panel' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                      : cand.category === 'action_control' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : cand.category === 'text_banner' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30',
                  ]"
                >
                  {{ cand.category.replace('_', ' ') }}
                </span>

                <div class="min-w-0 flex flex-1 flex-col">
                  <span class="truncate text-neutral-900 font-bold dark:text-neutral-100">
                    {{ cand.label }}
                  </span>
                  <span
                    v-if="cand.textSnippet"
                    class="truncate text-[11px] text-amber-600 font-mono dark:text-amber-300"
                  >
                    "{{ cand.textSnippet }}"
                  </span>
                </div>
              </div>

              <!-- Right: Screen Zone + Dimensions + Area + Tags -->
              <div class="flex shrink-0 items-center justify-end gap-2">
                <!-- Screen Zone Pill -->
                <span class="rounded bg-neutral-200/60 px-2 py-0.5 text-[11px] text-neutral-700 font-mono dark:bg-neutral-800/80 dark:text-neutral-300">
                  📍 {{ cand.zone }}
                </span>

                <!-- Dimensions & Area -->
                <span class="text-[11px] text-neutral-500 font-mono dark:text-neutral-400">
                  {{ cand.width }}×{{ cand.height }} ({{ cand.areaPercent }}%)
                </span>

                <!-- Confidence -->
                <span class="text-[11px] text-neutral-400 font-mono">
                  {{ (cand.confidence * 100).toFixed(0) }}%
                </span>

                <!-- Tags list -->
                <div class="items-center gap-1 hidden sm:flex">
                  <span
                    v-for="tag in cand.tags.slice(0, 3)"
                    :key="tag"
                    class="rounded bg-neutral-200/40 px-1.5 py-0.5 text-[10px] text-neutral-500 font-mono dark:bg-neutral-800/40 dark:text-neutral-400"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Targeted OCR Trigger Strip -->
        <div
          v-if="candidates.length > 0"
          :class="[
            'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border',
            'bg-primary-500/10 border-primary-500/30 dark:bg-primary-500/5 backdrop-blur-sm',
          ]"
        >
          <div class="min-w-0 flex items-center gap-3">
            <div class="h-9 w-9 flex shrink-0 items-center justify-center rounded-lg bg-primary-500/20 text-primary-500">
              <span class="i-solar:magic-stick-3-bold-duotone text-lg" />
            </div>
            <div class="min-w-0 flex flex-col">
              <div class="flex items-center gap-2">
                <h4 class="truncate text-xs text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
                  Targeted Candidate OCR
                </h4>
                <span class="shrink-0 rounded bg-primary-500/20 px-1.5 py-0.5 text-[10px] text-primary-500 font-bold font-mono">
                  ⏱️ {{ selectedOcrBudget }}ms Limit
                </span>
              </div>
              <p class="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ ocrProgressText || 'Crops candidate regions to extract verbatim text via Tesseract WASM with tripwire detection.' }}
              </p>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <div class="w-44">
              <Select
                v-model="selectedOcrBudget"
                :options="ocrBudgetOptions"
              />
            </div>
            <Button
              size="sm"
              :label="isRunningOcr ? 'Verifying...' : '⚡ Run Targeted OCR'"
              :icon="isRunningOcr ? 'i-svg-spinners:ring-resize' : 'i-solar:bolt-bold-duotone'"
              :disabled="isRunningOcr"
              class="shrink-0 px-3 py-1.5 text-xs font-semibold"
              @click="runTargetedOcr"
            />
          </div>
        </div>

        <div
          v-if="ocrError"
          :class="[
            'p-3 rounded-xl text-xs flex items-center gap-2',
            'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400',
          ]"
        >
          <span class="i-solar:danger-triangle-bold-duotone shrink-0 text-base" />
          <span>{{ ocrError }}</span>
        </div>

        <!-- Final Verified Candidates Section (Ready for System-1) -->
        <div
          v-if="finalVerifiedCandidates.length > 0"
          :class="[
            'flex flex-col gap-3 p-4 rounded-xl border border-emerald-500/40 dark:border-emerald-500/30',
            'bg-emerald-500/5 dark:bg-emerald-950/15 backdrop-blur-sm shadow-sm',
          ]"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="h-6 w-6 flex items-center justify-center rounded-lg bg-emerald-500 text-xs text-white font-bold shadow-sm">
                {{ finalVerifiedCandidates.length }}
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-xs text-emerald-600 font-bold tracking-wider uppercase dark:text-emerald-400">
                    Final Verified Candidates (OCR Refined)
                  </h3>
                  <span class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-600 font-bold font-mono dark:text-emerald-300">
                    Ready for System-1
                  </span>
                </div>
                <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Cleaned, deduplicated candidates enriched with verbatim Tesseract text evidence and tripwire detection.
                </p>
              </div>
            </div>

            <!-- Telemetry badges -->
            <div class="flex items-center gap-2 text-[11px] font-mono">
              <span class="rounded bg-neutral-200/60 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-300">
                ⏱️ {{ ocrTotalMs }}ms / {{ selectedOcrBudget }}ms
              </span>
              <span class="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-600 font-semibold dark:text-emerald-400">
                {{ ocrExitReason }}
              </span>
            </div>
          </div>

          <!-- Verified Candidates List -->
          <div class="max-h-[500px] flex flex-col gap-2 overflow-y-auto pr-1">
            <div
              v-for="(cand, idx) in finalVerifiedCandidates"
              :key="cand.id"
              :class="[
                'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border text-xs transition-all duration-150 cursor-pointer',
                cand.isTripwireMatch
                  ? 'border-emerald-500 bg-emerald-500/15 shadow-md ring-1 ring-emerald-500/50'
                  : (activeBox === cand.box
                    ? 'border-primary-500 bg-primary-500/10 shadow-sm ring-1 ring-primary-500/40'
                    : (hoveredBox === cand.box
                      ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/80'
                      : 'border-neutral-200/70 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-neutral-700')),
              ]"
              @mouseenter="hoveredBox = cand.box"
              @mouseleave="hoveredBox = null"
              @click="activeBox = cand.box"
            >
              <!-- Left: Index + Crop Thumbnail + Category + Label + Verbatim OCR Text -->
              <div class="min-w-0 flex flex-1 items-center gap-3">
                <span class="w-6 shrink-0 text-[11px] text-neutral-400 font-bold font-mono">
                  #{{ idx + 1 }}
                </span>

                <!-- Crop Thumbnail Preview -->
                <div
                  v-if="cand.cropThumbnailUrl"
                  class="h-8 w-14 flex shrink-0 items-center justify-center overflow-hidden border border-neutral-300 rounded bg-black dark:border-neutral-700"
                >
                  <img
                    :src="cand.cropThumbnailUrl"
                    alt="Crop"
                    class="h-full w-full object-contain"
                  >
                </div>

                <span
                  :class="[
                    'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 border',
                    cand.category === 'macro_window' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
                    : cand.category === 'sub_panel' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                      : cand.category === 'action_control' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : cand.category === 'text_banner' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30',
                  ]"
                >
                  {{ cand.category.replace('_', ' ') }}
                </span>

                <div class="min-w-0 flex flex-1 flex-col">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-neutral-900 font-bold dark:text-neutral-100">
                      {{ cand.label }}
                    </span>
                    <span
                      v-if="cand.isTripwireMatch"
                      class="shrink-0 border border-emerald-500/30 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-600 font-bold font-mono dark:text-emerald-300"
                    >
                      🎯 Tripwire: {{ cand.matchedTripwire }}
                    </span>
                  </div>

                  <!-- Verbatim OCR Text Highlight -->
                  <div class="mt-0.5 min-w-0 flex items-center gap-2">
                    <span
                      :class="[
                        'text-[11px] font-mono px-1.5 py-0.5 rounded border truncate',
                        cand.isTripwireMatch
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-200 font-bold'
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300',
                      ]"
                    >
                      OCR: "{{ cand.ocrText }}"
                    </span>
                    <span
                      v-if="cand.rawSnippet && cand.rawSnippet !== cand.ocrText"
                      class="truncate text-[10px] text-neutral-400 font-mono line-through hidden sm:inline"
                      :title="`Raw Mirage Phonetic: ${cand.rawSnippet}`"
                    >
                      "{{ cand.rawSnippet }}"
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right: Screen Zone + Dimensions + Latency + Confidence + Tags -->
              <div class="flex shrink-0 items-center justify-end gap-2">
                <!-- Zone -->
                <span class="rounded bg-neutral-200/60 px-2 py-0.5 text-[11px] text-neutral-700 font-mono dark:bg-neutral-800/80 dark:text-neutral-300">
                  📍 {{ cand.zone }}
                </span>

                <!-- Dimensions -->
                <span class="text-[11px] text-neutral-500 font-mono dark:text-neutral-400">
                  {{ cand.width }}×{{ cand.height }}
                </span>

                <!-- OCR Confidence & Latency -->
                <span class="rounded bg-neutral-200/50 px-1.5 py-0.5 text-[10px] text-neutral-500 font-mono dark:bg-neutral-800/50 dark:text-neutral-400">
                  {{ cand.ocrConfidence }}% ({{ cand.ocrLatencyMs }}ms)
                </span>

                <!-- Tags -->
                <div class="items-center gap-1 hidden md:flex">
                  <span
                    v-for="tag in cand.tags.slice(0, 3)"
                    :key="tag"
                    :class="[
                      'rounded px-1.5 py-0.5 text-[10px] font-mono',
                      tag.startsWith('#tripwire')
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold'
                        : 'bg-neutral-200/40 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400',
                    ]"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- STEP 2: System-1 Candidate Selection & Foveal Zoom -->
    <section
      :class="[
        'flex flex-col gap-6 p-5 rounded-2xl transition-all duration-300',
        'border border-neutral-200/80 dark:border-neutral-800/80',
        'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm',
      ]"
    >
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/60 pb-3 dark:border-neutral-800/60">
        <div class="flex items-center gap-2">
          <span class="h-6 w-6 flex items-center justify-center rounded-full bg-primary-500/20 text-xs text-primary-500 font-bold">
            2
          </span>
          <h2 class="text-sm text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
            System-1 Candidate Selection & Foveal Zoom
          </h2>
        </div>
        <span class="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] text-purple-600 font-medium dark:text-purple-400">
          Cognitive Gating & Foveal Vision
        </span>
      </div>

      <!-- Empty state if Step 1 hasn't extracted candidates yet -->
      <div
        v-if="candidates.length === 0"
        class="flex flex-col items-center gap-2 py-8 text-center text-xs text-neutral-400"
      >
        <span class="i-solar:radar-bold-duotone text-3xl text-neutral-300 dark:text-neutral-600" />
        <span>Capture a frame and verify candidates in Step 1 above to enable System-1 triage.</span>
      </div>

      <!-- Step 2 Controls & Tripwire Configuration -->
      <div v-else class="flex flex-col gap-5">
        <!-- Tripwire Question Preset Selector -->
        <div class="flex flex-col gap-2">
          <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
            Active Sentinel Tripwire (Natural Language Question)
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(preset, pidx) in tripwirePresets"
              :key="pidx"
              type="button"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-left',
                activeTripwirePresetIndex === pidx && !customTripwireQuestion
                  ? 'border-primary-500 bg-primary-500/15 text-primary-600 dark:text-primary-300 shadow-sm ring-1 ring-primary-500/30'
                  : 'border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400',
              ]"
              @click="activeTripwirePresetIndex = pidx; customTripwireQuestion = ''"
            >
              {{ preset.label }}
            </button>
          </div>

          <FieldInput
            v-model="customTripwireQuestion"
            label="Or Custom Sentinel Question"
            placeholder="e.g. Is the user watching a YouTube video or music release?"
            layout="vertical"
          />
        </div>

        <!-- Padding & Sensitivity & Action Bar -->
        <div class="grid grid-cols-1 items-end gap-4 pt-1 sm:grid-cols-3">
          <div>
            <FieldSelect
              v-model="selectedFovealPadding"
              label="Foveal Context Padding"
              layout="vertical"
              :options="fovealPaddingOptions"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-neutral-600 font-medium dark:text-neutral-400">Trigger Sensitivity</span>
              <span class="text-primary-500 font-bold font-mono">{{ tripwireSensitivity }}%</span>
            </div>
            <input
              v-model.number="tripwireSensitivity"
              type="range"
              min="50"
              max="95"
              step="5"
              class="w-full cursor-pointer accent-primary-500"
            >
          </div>

          <Button
            :label="isEvaluatingStep2 ? 'Triaging...' : '🎯 Run System-1 Triage & Foveal Zoom'"
            :icon="isEvaluatingStep2 ? 'i-svg-spinners:ring-resize' : 'i-solar:radar-2-bold-duotone'"
            :disabled="isEvaluatingStep2"
            class="px-5 py-2.5 font-semibold"
            @click="runSystemOneTriage"
          />
        </div>

        <!-- Error & Progress message -->
        <div
          v-if="step2Error"
          :class="[
            'p-3 rounded-xl text-xs flex items-center gap-2',
            'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400',
          ]"
        >
          <span class="i-solar:danger-triangle-bold-duotone shrink-0 text-base" />
          <span>{{ step2Error }}</span>
        </div>

        <div
          v-if="step2ProgressText && isEvaluatingStep2"
          class="flex animate-pulse items-center gap-2 text-xs text-primary-500 font-mono"
        >
          <span class="i-svg-spinners:ring-resize text-base" />
          <span>{{ step2ProgressText }}</span>
        </div>

        <!-- System-1 Candidate Scoring Leaderboard -->
        <div
          v-if="candidateScores.length > 0"
          :class="[
            'flex flex-col gap-3 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800/80',
            'bg-neutral-50/70 dark:bg-neutral-900/60 backdrop-blur-sm',
          ]"
        >
          <div class="flex items-center justify-between border-b border-neutral-200/60 pb-2 dark:border-neutral-800/60">
            <h4 class="text-xs text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
              Tripwire Scoring Leaderboard
            </h4>
            <span class="text-[11px] text-neutral-400 font-mono">
              Threshold: {{ tripwireSensitivity }}%
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 lg:grid-cols-3 sm:grid-cols-2">
            <div
              v-for="(item, sidx) in candidateScores"
              :key="sidx"
              :class="[
                'flex flex-col gap-1 p-2.5 rounded-lg border text-xs transition-all',
                item.isWinner
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-sm ring-1 ring-cyan-500/40'
                  : (item.passed
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/50 dark:bg-neutral-800/30 opacity-70'),
              ]"
            >
              <div class="flex items-center justify-between">
                <span class="truncate text-neutral-900 font-bold dark:text-neutral-100">
                  {{ item.candidate.label }}
                </span>
                <span
                  :class="[
                    'font-mono text-[11px] font-bold px-1.5 py-0.2 rounded',
                    item.isWinner
                      ? 'bg-cyan-500 text-white'
                      : (item.passed ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'),
                  ]"
                >
                  {{ item.score }}%
                </span>
              </div>
              <span class="truncate text-[10px] text-neutral-500 font-mono dark:text-neutral-400">
                "{{ ('ocrText' in item.candidate ? item.candidate.ocrText : item.candidate.textSnippet) || item.candidate.label }}"
              </span>
              <div class="flex items-center justify-between border-t border-neutral-200/40 pt-1 text-[10px] dark:border-neutral-800/40">
                <span class="text-neutral-400">📍 {{ item.candidate.zone }}</span>
                <span v-if="item.isWinner" class="text-cyan-600 font-bold tracking-wide uppercase dark:text-cyan-400">
                  🏆 Winner (Focal Box)
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Foveal Context Region & Local Mirage Description -->
        <div
          v-if="fovealCropDataUrl"
          :class="[
            'grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-cyan-500/30',
            'bg-cyan-500/5 dark:bg-cyan-950/20 backdrop-blur-sm shadow-sm',
          ]"
        >
          <!-- Left: Foveal Image Preview -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-cyan-600 font-bold tracking-wider uppercase dark:text-cyan-400">
                Foveal Zoom Region ({{ selectedFovealPadding }}px Field)
              </span>
              <span v-if="fovealCropDimensions" class="text-[11px] text-neutral-400 font-mono">
                {{ fovealCropDimensions.width }} × {{ fovealCropDimensions.height }} px
              </span>
            </div>

            <div class="relative max-h-64 flex items-center justify-center overflow-hidden border border-neutral-300 rounded-lg bg-black p-2 dark:border-neutral-700">
              <img
                :src="fovealCropDataUrl"
                alt="Foveal Context Crop"
                class="max-h-60 max-w-full w-auto rounded object-contain"
              >
            </div>
          </div>

          <!-- Right: Cactus Mirage Foveal Analysis -->
          <div class="flex flex-col justify-between gap-2">
            <div class="flex flex-col gap-2">
              <span class="text-xs text-cyan-600 font-bold tracking-wider uppercase dark:text-cyan-400">
                Cactus Mirage Focal Scene Description
              </span>

              <div class="border border-neutral-200/80 rounded-lg bg-white/70 p-3 text-xs dark:border-neutral-800/80 dark:bg-neutral-900/70">
                <p class="text-neutral-800 leading-relaxed font-sans dark:text-neutral-200">
                  {{ fovealMirageDescription }}
                </p>
              </div>

              <!-- Local detected tags from focal patch -->
              <div v-if="fovealMirageResult?.parsed?.scene" class="flex flex-wrap gap-1.5 pt-1">
                <span class="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-600 font-mono dark:text-cyan-300">
                  Setting: {{ fovealMirageResult.parsed.scene.setting }}
                </span>
                <span class="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-600 font-mono dark:text-cyan-300">
                  Style: {{ fovealMirageResult.parsed.scene.style }}
                </span>
                <span v-if="fovealMirageResult.latencyMs" class="rounded bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-500 font-mono dark:bg-neutral-800/60">
                  ⚡ {{ fovealMirageResult.latencyMs }}ms
                </span>
              </div>
            </div>

            <span class="text-[11px] text-neutral-500 italic dark:text-neutral-400">
              Mirage 1:1 foveal pass provides the visual context without downscaling loss.
            </span>
          </div>
        </div>

        <!-- The Final Structured Payload (Ready for Step 3 LLM) -->
        <div
          v-if="finalPayload"
          :class="[
            'flex flex-col gap-3 p-5 rounded-xl border border-emerald-500/50 dark:border-emerald-500/40',
            'bg-emerald-500/5 dark:bg-emerald-950/20 backdrop-blur-md shadow-md ring-1 ring-emerald-500/20',
          ]"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/30 pb-3">
            <div class="flex items-center gap-2">
              <span class="h-6 w-6 flex items-center justify-center rounded-lg bg-emerald-500 text-xs text-white font-bold shadow-sm">
                ✓
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-xs text-emerald-600 font-bold tracking-wider uppercase dark:text-emerald-400">
                    Final Structured Observation Payload
                  </h3>
                  <span class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-600 font-bold font-mono dark:text-emerald-300">
                    Step 2 Complete · Ready for Step 3
                  </span>
                </div>
                <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  This exact payload bundle will be injected into the Character LLM prompt in Step 3.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="rounded bg-neutral-200/60 px-2 py-0.5 text-[11px] text-neutral-600 font-mono dark:bg-neutral-800/80 dark:text-neutral-300">
                ⚡ Latency: {{ finalPayload.latencyMs.totalMs }}ms (Triage: {{ finalPayload.latencyMs.systemOneMs }}ms · Mirage: {{ finalPayload.latencyMs.fovealMirageMs }}ms)
              </span>

              <Button
                :label="copied ? 'Copied!' : 'Copy Payload'"
                :icon="copied ? 'i-solar:check-circle-bold-duotone' : 'i-solar:copy-bold-duotone'"
                size="sm"
                variant="ghost"
                @click="copy(finalPayload.formattedObservationText)"
              />
            </div>
          </div>

          <!-- Payload Monospace Display -->
          <pre
            :class="[
              'p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed',
              'bg-neutral-950 text-emerald-400 border border-emerald-500/30 shadow-inner',
            ]"
          >{{ finalPayload.formattedObservationText }}</pre>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- STEP 3: CHARACTER CONSCIOUSNESS & REACTION -->
    <!-- ========================================== -->
    <section
      v-if="finalPayload"
      :class="[
        'flex flex-col gap-4 p-5 rounded-2xl border transition-all duration-300',
        step3Commentary
          ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/15 ring-1 ring-emerald-500/20'
          : 'border-primary-500/40 bg-primary-500/5 dark:bg-primary-950/15 ring-1 ring-primary-500/20',
      ]"
    >
      <!-- Step 3 Header -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/60 pb-3 dark:border-neutral-800/60">
        <div class="flex items-center gap-3">
          <div
            :class="[
              'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold shadow-sm',
              step3Commentary ? 'bg-emerald-500 text-white' : 'bg-primary-500 text-white',
            ]"
          >
            {{ step3Commentary ? '✓' : '3' }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-xs text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
                Character Consciousness & LLM Reaction
              </h3>
              <span
                :class="[
                  'rounded-full px-2 py-0.5 text-[10px] font-bold font-mono',
                  step3Commentary
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                    : 'bg-primary-500/20 text-primary-600 dark:text-primary-300',
                ]"
              >
                {{ step3Commentary ? 'Reaction Generated' : 'Ready for Dialogue Reaction' }}
              </span>
            </div>
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
              Evaluates the assembled [REAL-TIME SCREEN OBSERVATION] payload through the character's active identity DNA to produce authentic dialogue commentary.
            </p>
          </div>
        </div>

        <!-- Companion & Model Badges -->
        <div class="flex items-center gap-2 text-xs">
          <div class="flex items-center gap-1.5 rounded-lg bg-neutral-200/50 px-2.5 py-1 text-neutral-700 font-medium dark:bg-neutral-800/70 dark:text-neutral-300">
            <span class="i-solar:user-bold-duotone text-sm text-primary-500" />
            <span>{{ characterName }}</span>
          </div>

          <div
            v-if="consciousnessStore.activeModel"
            class="flex items-center gap-1.5 rounded-lg bg-neutral-200/50 px-2.5 py-1 text-[11px] text-neutral-700 font-mono dark:bg-neutral-800/70 dark:text-neutral-300"
          >
            <span class="i-solar:cpu-bolt-bold-duotone text-sm text-emerald-500" />
            <span>{{ consciousnessStore.activeProvider }}/{{ consciousnessStore.activeModel }}</span>
          </div>
          <div
            v-else
            class="flex items-center gap-1.5 border border-amber-500/30 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-600 dark:text-amber-400"
          >
            <span class="i-solar:danger-triangle-bold-duotone text-sm" />
            <span>No LLM Model Selected</span>
          </div>
        </div>
      </div>

      <!-- Prompt Customization & Trigger Bar -->
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-1.5 text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              <span class="i-solar:notes-bold-duotone text-sm text-primary-500" />
              <span>In-Character Reaction Directive</span>
            </label>
            <button
              type="button"
              class="cursor-pointer text-[11px] text-primary-500 font-medium transition-colors hover:text-primary-600 dark:hover:text-primary-400"
              @click="showPromptInspector = !showPromptInspector"
            >
              {{ showPromptInspector ? 'Hide Prompt Inspector' : '🔍 Inspect Full LLM Prompt' }}
            </button>
          </div>

          <FieldInput
            v-model="customCommentaryInstruction"
            placeholder="Directive passed to the character LLM alongside the visual event..."
          />
        </div>

        <!-- Collapsible Full Prompt Inspector -->
        <div
          v-if="showPromptInspector && step3RawPrompt"
          class="flex flex-col gap-1.5 border border-neutral-800 rounded-xl bg-black/40 p-3 text-[11px] font-mono"
        >
          <div class="flex items-center justify-between border-b border-neutral-800 pb-1.5 text-neutral-400">
            <span>FULL DISPATCHED PROMPT PREVIEW</span>
            <button
              type="button"
              class="cursor-pointer hover:text-white"
              @click="copy(step3RawPrompt)"
            >
              Copy Prompt
            </button>
          </div>
          <pre class="max-h-48 overflow-x-auto whitespace-pre-wrap text-neutral-300 leading-relaxed">{{ step3RawPrompt }}</pre>
        </div>

        <!-- Action Row -->
        <div class="flex items-center justify-between pt-1">
          <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
            Clicking will query the active character model with the structured observation context above.
          </span>

          <Button
            size="md"
            :label="isGeneratingStep3 ? 'Synthesizing Authentic Dialogue...' : '💬 Generate Character Commentary'"
            :icon="isGeneratingStep3 ? 'i-svg-spinners:ring-resize' : 'i-solar:chat-round-line-bold-duotone'"
            :disabled="isGeneratingStep3 || !consciousnessStore.activeModel"
            class="px-5 py-2 font-semibold shadow-md"
            @click="generateCharacterReaction"
          />
        </div>
      </div>

      <!-- Error Notification -->
      <div
        v-if="step3Error"
        class="flex items-center gap-2 border border-red-500/30 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
      >
        <span class="i-solar:danger-triangle-bold-duotone shrink-0 text-base" />
        <span>{{ step3Error }}</span>
      </div>

      <!-- Character Dialogue Bubble Display -->
      <div
        v-if="step3Commentary"
        class="mt-2 flex flex-col gap-3"
      >
        <!-- Case 1: Silent Decision (NO_REPLY) -->
        <div
          v-if="step3EmittedNoReply"
          class="flex items-center gap-3 border border-neutral-300 rounded-xl bg-neutral-100/60 p-4 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-400"
        >
          <div class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 dark:bg-neutral-700">
            <span class="i-solar:bell-off-bold-duotone text-lg" />
          </div>
          <div class="flex flex-col">
            <span class="text-neutral-800 font-bold dark:text-neutral-200">
              Companion Remained Silent (NO_REPLY)
            </span>
            <p class="text-[11px]">
              The character observed the screen event, but evaluated that an interruption is unnecessary or out-of-character.
            </p>
          </div>
          <span class="ml-auto text-[10px] text-neutral-400 font-mono">
            ⏱️ {{ step3LatencyMs }}ms
          </span>
        </div>

        <!-- Case 2: Active Dialogue Reaction -->
        <div
          v-else
          class="flex items-start gap-3.5 border border-emerald-500/30 rounded-2xl bg-white/80 p-4 shadow-md backdrop-blur-sm dark:bg-neutral-900/80"
        >
          <!-- Companion Avatar -->
          <div class="relative shrink-0">
            <img
              v-if="activeCompanionAvatar"
              :src="activeCompanionAvatar"
              :alt="characterName"
              class="h-11 w-11 rounded-full object-cover shadow-sm ring-2 ring-emerald-500/40"
            >
            <div
              v-else
              class="h-11 w-11 flex items-center justify-center rounded-full bg-emerald-500/20 text-base text-emerald-600 font-bold shadow-sm ring-2 ring-emerald-500/40 dark:text-emerald-400"
            >
              {{ characterName.charAt(0) }}
            </div>
            <div class="absolute h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white -bottom-0.5 -right-0.5 dark:ring-neutral-900" />
          </div>

          <!-- Dialogue Content -->
          <div class="min-w-0 flex flex-1 flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">
                  {{ characterName }}
                </span>
                <span class="rounded bg-emerald-500/15 px-1.5 py-0.2 text-[10px] text-emerald-600 font-semibold font-mono dark:text-emerald-400">
                  Spoken Reaction
                </span>
              </div>

              <div class="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                <span>⏱️ {{ step3LatencyMs }}ms</span>
                <Button
                  :label="copied ? 'Copied' : 'Copy'"
                  :icon="copied ? 'i-solar:check-circle-bold-duotone' : 'i-solar:copy-bold-duotone'"
                  size="sm"
                  variant="ghost"
                  @click="copy(step3Commentary!)"
                />
              </div>
            </div>

            <!-- Speech Bubble Body -->
            <div class="relative border border-neutral-200/80 rounded-2xl rounded-tl-sm bg-neutral-100 p-3.5 text-sm text-neutral-800 leading-relaxed font-sans shadow-inner dark:border-neutral-700/60 dark:bg-neutral-800/90 dark:text-neutral-100">
              <p class="italic">
                "{{ step3Commentary }}"
              </p>
            </div>

            <!-- Speech Audio Button -->
            <div class="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                :label="isSpeakingCommentary ? 'Speaking...' : '🔊 Play Voice Synthesis'"
                :icon="isSpeakingCommentary ? 'i-svg-spinners:bars-scale-middle' : 'i-solar:volume-loud-bold-duotone'"
                :disabled="isSpeakingCommentary || !step3Commentary"
                class="text-xs"
                @click="speakCommentary"
              />
              <span class="text-[10px] text-neutral-500 italic">
                Uses active TTS engine: {{ speechStore.activeSpeechProvider || 'Default' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  title: Attention Ecology & Spatial BBox Lab
  subtitleKey: tamagotchi.settings.devtools.title
</route>

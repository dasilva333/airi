import type { ScreenCaptureOptions, VisionDisplaySource } from '@proj-airi/stage-shared'
import type { CommonContentPart, Tool } from '@xsai/shared-chat'

import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { resolveScreenWatchingSource } from '@proj-airi/stage-ui/stores/modules/screen-watcher'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { tool } from '@xsai/tool'
import { z } from 'zod'

const takeScreenshotParams = z.object({
  window: z.string().optional().describe('Part of the title of the application window to capture (e.g. \'Chrome\', \'Visual Studio Code\'). Leave `window` and `display` empty to capture the screen or window chosen in the Screen Watching settings.'),
  display: z.string().optional().describe('Which whole display (monitor) to capture: its number counted left to right (e.g. \'2\'), \'primary\', or part of its name. Ignored when `window` is set. An unknown value returns the list of available displays.'),
  focus: z.string().optional().describe('What to pay attention to on the screen (e.g. \'the error in the terminal\'). Leave empty for a general description.'),
}).strict()

// NOTICE: a tool loop allows up to 10 steps per reply; the cooldown stops the model from
// re-capturing the same screen repeatedly within one turn.
const SCREENSHOT_COOLDOWN_MS = 10_000
let lastScreenshotAt = 0

function describeDisplay(display: VisionDisplaySource): string {
  const size = display.width && display.height ? `, ${display.width}x${display.height}` : ''
  return `display ${display.index} "${display.name}"${display.primary ? ' (primary)' : ''}${size}`
}

function matchDisplay(displays: VisionDisplaySource[], query: string): VisionDisplaySource | undefined {
  const normalized = query.trim().toLowerCase()
  if (normalized === 'primary' || normalized === 'main')
    return displays.find(display => display.primary)

  // Accept "2" as well as "display 2" / "monitor 2" / "screen 2".
  const number = normalized.replace(/^(?:display|monitor|screen)\s*/, '')
  if (/^\d+$/.test(number))
    return displays.find(display => display.index === Number(number))

  return displays.find(display => display.name.toLowerCase().includes(normalized))
}

// Mirrors the Screen Watching capture settings so the agent sees the same source at the same resolution.
async function resolveCaptureOptions(windowTitle: string | undefined, displayQuery: string | undefined): Promise<{ options: ScreenCaptureOptions, label: string } | { error: string }> {
  const config = useAiriCardStore().activeCard?.extensions?.airi?.screenWatching
  const downscale = config?.downscalePercent || 100
  const resolution: ScreenCaptureOptions = downscale >= 100 ? { native: true } : { downscalePercent: downscale }

  if (windowTitle)
    return { options: { ...resolution, type: 'window', windowTitle }, label: `window "${windowTitle}"` }

  if (displayQuery) {
    const displays = await useVisionStore().listDisplays()
    const display = matchDisplay(displays, displayQuery)
    if (!display) {
      const available = displays.length ? displays.map(describeDisplay).join('; ') : 'none found'
      return { error: `Error: No display matches "${displayQuery}". Available displays: ${available}.` }
    }
    return { options: { ...resolution, type: 'screen', sourceId: display.id }, label: describeDisplay(display) }
  }

  let activeWindowTitle: string | undefined
  if (config?.sourceType === 'auto_focused') {
    const proactivityStore = useProactivityStore()
    await proactivityStore.updateSensors()
    activeWindowTitle = proactivityStore.activeWinStr
  }

  const source = resolveScreenWatchingSource(config, activeWindowTitle)
  const label = source.windowTitle
    ? `the active window "${source.windowTitle}"`
    : source.type === 'window'
      ? 'the window selected in Screen Watching'
      : source.sourceId
        ? 'the display selected in Screen Watching'
        : 'the screen'

  return { options: { ...resolution, ...source }, label }
}

async function toJpegDataUrl(dataUrl: string): Promise<string> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  canvas.getContext('2d')?.drawImage(image, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.85)
}

function latestUserText(messages: unknown): string | undefined {
  if (!Array.isArray(messages))
    return undefined
  const message = [...messages].reverse().find((m: any) => m?.role === 'user')
  if (!message)
    return undefined
  if (typeof message.content === 'string')
    return message.content
  if (Array.isArray(message.content))
    return message.content.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join(' ')
  return undefined
}

async function describeWithVisionModel(imageUrl: string, focus: string | undefined, userText: string | undefined): Promise<string> {
  const visionStore = useVisionStore()
  const providersStore = useProvidersStore()
  const vlmProvider = await providersStore.getProviderInstance(visionStore.activeProvider) as any

  const prompt = [
    visionStore.promptShimForward || 'Describe the image.',
    userText ? `The user's latest message: ${userText}` : '',
    focus ? `Pay particular attention to: ${focus}` : '',
  ].filter(Boolean).join('\n\n')

  const response = await useLLM().generate(
    visionStore.activeModel,
    vlmProvider,
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    { vision: true },
  )
  useLiveSessionStore().recordInferenceUsage(response.usage)
  return response.text?.trim() ?? ''
}

async function executeTakeScreenshot(params: { window?: string, display?: string, focus?: string }, messages: unknown): Promise<string | CommonContentPart[]> {
  const now = Date.now()
  if (now - lastScreenshotAt < SCREENSHOT_COOLDOWN_MS)
    return 'Error: A screenshot was taken a few seconds ago. Use that one instead of taking another.'

  const visionStore = useVisionStore()
  // NOTICE: mirrors the Image Description Strategy. "direct" (1-hop) hands the image to the
  // current model itself; "forward" (2-hop) asks the Vision settings model for a description.
  const isDirect = visionStore.strategy === 'direct'
  if (!isDirect && (!visionStore.activeProvider || !visionStore.activeModel))
    return 'Error: No vision model is configured in Vision settings, so the screen cannot be described.'

  const resolved = await resolveCaptureOptions(params.window?.trim() || undefined, params.display?.trim() || undefined)
  if ('error' in resolved)
    return resolved.error
  const { options, label } = resolved
  const capture = await visionStore.captureSnapshot(options)
  if (!capture || 'error' in capture || !capture.dataUrl) {
    if (options.type === 'window') {
      const windows = await visionStore.listWindows()
      const titles = windows.map(w => w.name).filter(Boolean).slice(0, 30)
      return `Error: Could not capture ${label}. It may not exist or may be minimized. Open windows: ${titles.length ? titles.map(t => `"${t}"`).join(', ') : 'none found'}.`
    }
    return 'Error: Failed to capture the screen. Screen capture permission may be missing.'
  }

  lastScreenshotAt = now

  try {
    const imageUrl = await toJpegDataUrl(capture.dataUrl)
    let header = `Screenshot of ${label} taken at ${new Date(now).toLocaleTimeString()}.`
    // Tell the model which other monitors exist so it can ask for a specific one next time.
    if (options.type !== 'window') {
      const displays = await visionStore.listDisplays()
      if (displays.length > 1)
        header += ` Available displays: ${displays.map(describeDisplay).join('; ')}.`
    }

    if (isDirect) {
      return [
        { type: 'text', text: `${header} The image is attached.` },
        { type: 'image_url', image_url: { url: imageUrl } },
      ]
    }

    const description = await describeWithVisionModel(imageUrl, params.focus?.trim() || undefined, latestUserText(messages))
    if (!description)
      return 'Error: The vision model returned an empty description of the screen.'

    return [
      { type: 'text', text: `${header} Description: ${description}` },
      { type: 'image_url', image_url: { url: imageUrl }, display_only: true } as CommonContentPart,
    ]
  }
  catch (err: any) {
    console.error('take_screenshot failed:', err)
    return `Error: Failed to process the screenshot: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function screenshotTools(): Promise<Tool[]> {
  return Promise.all([
    tool({
      name: 'take_screenshot',
      description: 'Takes a screenshot of the user\'s screen, of a specific display (monitor), or of a specific application window. Returns the screenshot image, or a detailed description of it, as this tool\'s result. Use it when you need to see what the user is doing or looking at, or to read content (text, images) shown in an application such as a web browser.',
      parameters: takeScreenshotParams,
      execute: (params, { messages }) => executeTakeScreenshot(params as { window?: string, display?: string, focus?: string }, messages),
    }),
  ])
}

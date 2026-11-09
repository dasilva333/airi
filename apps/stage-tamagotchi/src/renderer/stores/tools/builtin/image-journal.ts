import type { ResolvedArtistryConfig } from '@proj-airi/stage-ui/stores'
import type { Tool } from '@xsai/shared-chat'

import z from 'zod'

import { defineInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import {
  resolveArtistryConfigFromStore,
  stageArtistryIntrusion,
  useAiriCardStore,
  useArtistryStore,
  useBackgroundStore,
  useChatSessionStore,
} from '@proj-airi/stage-ui/stores'
import { tool } from '@xsai/tool'

import { artistryGenerateHeadless, widgetsAdd } from '../../../../shared/eventa'
import { getIpcRenderer } from '../../../utils/electron'

export function getArtistryConfig(): ResolvedArtistryConfig {
  try {
    return resolveArtistryConfigFromStore(useArtistryStore())
  }
  catch {
    return {}
  }
}

const { context } = createContext(getIpcRenderer())
const generateHeadless = defineInvoke(context, artistryGenerateHeadless)
const addWidget = defineInvoke(context, widgetsAdd)

export const imageJournalParams = z.object({
  action: z.enum(['create', 'apply']).nullish().describe('Choose "create" to generate a new image, or "apply" to use an existing one. Defaults to "create".'),
  prompt: z.string().nullish().describe('Visual description of the image to generate (required when creating).'),
  description: z.string().nullish().describe('Alias for prompt.'),
  text: z.string().nullish().describe('Alias for prompt.'),
  content: z.string().nullish().describe('Alias for prompt.'),
  query: z.string().nullish().describe('Search term when applying an existing image, or prompt when creating.'),
  title: z.string().nullish().describe('Label or title for the image entry (optional).'),
  mode: z.enum(['inline', 'widget', 'bg', 'bg_widget']).nullish().describe('Display mode: "inline" (in chat), "widget" (overlay), "bg" (environment), or "bg_widget" (both). Defaults to character preference.'),
  width: z.number().int().positive().nullish().describe('Output width in pixels. Set with height to override saved dimensions, including retries. OpenAI requires positive multiples of 16. Null uses defaults.'),
  height: z.number().int().positive().nullish().describe('Output height in pixels. Set with width to override saved dimensions, including retries. OpenAI requires positive multiples of 16. Null uses defaults.'),
})

function tryGetLastUserMessage(): string | undefined {
  try {
    const chatSession = useChatSessionStore()
    const currentSessionId = chatSession.activeSessionId
    if (!currentSessionId)
      return undefined
    const messages = chatSession.getSessionMessages(currentSessionId) || []
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === 'user') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((p: any) => p?.text || '').join(' ')
            : ''
        const cleaned = text.trim()
        if (cleaned)
          return cleaned
      }
    }
  }
  catch {
    return undefined
  }
  return undefined
}

export async function executeCreateImageJournalEntry(params: {
  prompt?: string
  title?: string
  mode?: 'inline' | 'widget' | 'bg' | 'bg_widget'
  width?: number | null
  height?: number | null
}) {
  try {
    let prompt = params.prompt?.trim()
    if (!prompt) {
      const fallback = tryGetLastUserMessage()
      if (fallback) {
        console.warn('[ImageJournalTool] prompt was missing in tool call, falling back to last user message:', fallback)
        prompt = fallback
      }
    }

    if (!prompt)
      return 'Error: prompt is required for image_journal.create. Please provide a description of the image.'

    if ((params.width != null) !== (params.height != null))
      throw new Error('Set both width and height to override the image size, or leave both empty to use defaults.')

    const backgroundStore = useBackgroundStore()
    const cardStore = useAiriCardStore()
    const activeCard = cardStore.activeCard
    const globalArtistryConfig = getArtistryConfig()

    const cardArtistry = activeCard?.extensions?.airi?.artistry
    const artistryConfig = {
      provider: cardArtistry?.provider || globalArtistryConfig.provider,
      model: cardArtistry?.model || globalArtistryConfig.model,
      promptPrefix: cardArtistry?.promptPrefix || globalArtistryConfig.promptPrefix,
      options: cardArtistry?.options || globalArtistryConfig.options,
      Globals: globalArtistryConfig.Globals,
    }

    const title = params.title || `Generation ${new Date().toLocaleString()}`

    // Resolve mode: explicit param > character fallback > global default (inline)
    const spawnMode = activeCard?.extensions?.airi?.artistry?.spawnMode
    const mode = params.mode || spawnMode || 'inline'

    const optionsToUse = {
      ...artistryConfig.options,
      ...(params.width != null && params.height != null ? { width: params.width, height: params.height } : {}),
    }

    const artistryResult = await generateHeadless({
      prompt: artistryConfig.promptPrefix ? `${artistryConfig.promptPrefix} ${prompt}` : prompt,
      model: artistryConfig.model as string,
      provider: artistryConfig.provider as string,
      options: JSON.parse(JSON.stringify(optionsToUse)),
      globals: JSON.parse(JSON.stringify(artistryConfig.Globals || {})),
    })

    if (artistryResult.error || (!artistryResult.base64 && !artistryResult.imageUrl)) {
      throw new Error(`Failed to generate image: ${artistryResult.error || 'No output received'}`)
    }

    let blob: Blob
    if (artistryResult.base64) {
      const dataUrl = artistryResult.base64.includes(',')
        ? artistryResult.base64
        : `data:image/png;base64,${artistryResult.base64}`
      const response = await fetch(dataUrl)
      blob = await response.blob()
    }
    else {
      const response = await fetch(artistryResult.imageUrl!)
      blob = await response.blob()
    }

    const entryId = await backgroundStore.addBackground('journal', blob, title, prompt, cardStore.activeCardId)

    // Handle Application Logic based on Mode
    if (mode === 'bg' || mode === 'bg_widget') {
      const cardId = cardStore.activeCardId
      if (cardId) {
        const card = cardStore.cards.get(cardId)
        if (card) {
          const extension = JSON.parse(JSON.stringify(card.extensions || {}))
          if (!extension.airi)
            extension.airi = {}
          if (!extension.airi.modules)
            extension.airi.modules = {}
          extension.airi.modules.activeBackgroundId = entryId
          cardStore.updateCard(cardId, { ...card, extensions: extension })
        }
      }
      backgroundStore.setActiveBackground(entryId)
    }

    if (mode === 'widget' || mode === 'bg_widget') {
      try {
        await addWidget({
          componentName: 'artistry',
          componentProps: {
            status: 'done',
            entryId,
            imageUrl: artistryResult.imageUrl || artistryResult.base64,
            prompt,
            title,
            _skipIngestion: true,
          },
          size: 'm',
          ttlMs: 0,
        })
      }
      catch {
        console.warn('[ImageJournalTool] Failed to spawn Result widget')
      }
    }

    // Stage the generated image prompt for Artistry Intrusion
    try {
      stageArtistryIntrusion({
        prompt,
        timestamp: Date.now(),
      })
    }
    catch (e) {
      console.warn('[ImageJournalTool] Failed to stage artistry intrusion:', e)
    }

    // The gallery owns image bytes. Tool results carry only metadata for the model and UI.
    return JSON.stringify({
      message: `Image created in ${mode} mode${mode === 'bg' ? ' and set as background' : ''}.`,
      entryId,
      title,
      prompt,
      mode,
    })
  }
  catch (e) {
    console.error('[ImageJournalTool] Failed to create entry', e)
    return `Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

export async function executeSetAsBackground(params: { query?: string, prompt?: string, title?: string }) {
  const query = (params.query?.trim() || params.prompt?.trim() || params.title?.trim() || '').toLowerCase()
  if (!query)
    return 'Error: query is required for image_journal.apply. Provide a title or ID to search for.'

  const backgroundStore = useBackgroundStore()
  const cardStore = useAiriCardStore()
  const cardId = cardStore.activeCardId

  const entries = Array.from(backgroundStore.entries.values())
    .filter(e => e.characterId === null || e.characterId === cardId)

  let entry = entries.find(e => e.type === 'journal' && (e.id === query || e.id.toLowerCase().includes(query)))
  if (!entry)
    entry = entries.find(e => e.type === 'journal' && e.title.toLowerCase().includes(query))
  if (!entry)
    entry = entries.find(e => e.type !== 'journal' && e.title.toLowerCase().includes(query))

  if (entry) {
    try {
      if (cardId) {
        const card = cardStore.cards.get(cardId)
        if (card) {
          const extension = JSON.parse(JSON.stringify(card.extensions || {}))
          if (!extension.airi)
            extension.airi = {}
          if (!extension.airi.modules)
            extension.airi.modules = {}
          extension.airi.modules.activeBackgroundId = entry.id
          cardStore.updateCard(cardId, { ...card, extensions: extension })
        }
      }
      backgroundStore.setActiveBackground(entry.id)
      return `Background set to "${entry.title}".`
    }
    catch (e) {
      return `Error applying "${entry.title}": ${e instanceof Error ? e.message : String(e)}`
    }
  }

  const available = entries.filter(e => e.type === 'journal').map(e => e.title).slice(0, 10)
  return `No match for "${query}".${available.length > 0 ? ` Try: ${available.join(', ')}` : ''}`
}

export async function executeImageJournalAction(params: any) {
  const rawParams = params || {}
  const action = rawParams.action
    ? String(rawParams.action).toLowerCase().trim()
    : undefined

  // Defensive fallback for prompt across all possible keys
  const promptCandidate = (
    rawParams.prompt
    ?? rawParams.description
    ?? rawParams.text
    ?? rawParams.content
    ?? rawParams.image_prompt
    ?? rawParams.caption
    ?? rawParams.input
    // If action is create or undefined, query can be used as prompt
    ?? (action !== 'apply' && action !== 'set_as_background' ? rawParams.query : undefined)
    ?? rawParams.title
  )

  const resolvedPrompt = typeof promptCandidate === 'string'
    ? promptCandidate.trim()
    : (promptCandidate ? String(promptCandidate).trim() : '')

  const resolvedQuery = typeof rawParams.query === 'string'
    ? rawParams.query.trim()
    : typeof rawParams.prompt === 'string'
      ? rawParams.prompt.trim()
      : typeof rawParams.title === 'string'
        ? rawParams.title.trim()
        : ''

  // Determine effective action: if not specified or unrecognized, default to 'create' if prompt exists, or 'apply' if query exists
  let effectiveAction = action
  if (!effectiveAction || (effectiveAction !== 'create' && effectiveAction !== 'apply' && effectiveAction !== 'set_as_background')) {
    if (resolvedPrompt)
      effectiveAction = 'create'
    else if (resolvedQuery)
      effectiveAction = 'apply'
    else
      effectiveAction = 'create'
  }

  const normalizedParams = {
    ...rawParams,
    action: effectiveAction,
    prompt: resolvedPrompt || undefined,
    title: rawParams.title ? String(rawParams.title).trim() : undefined,
    query: resolvedQuery || undefined,
    mode: rawParams.mode ?? undefined,
    width: rawParams.width != null ? Number(rawParams.width) : undefined,
    height: rawParams.height != null ? Number(rawParams.height) : undefined,
  }

  if (normalizedParams.action === 'create')
    return await executeCreateImageJournalEntry(normalizedParams)
  if (normalizedParams.action === 'apply' || normalizedParams.action === 'set_as_background')
    return await executeSetAsBackground(normalizedParams)
  return 'No action performed.'
}

const tools: Promise<Tool>[] = [
  tool({
    name: 'image_journal',
    description: 'Manage AI-generated images. Use "create" to generate and display images. An optional "mode" (inline, widget, bg, bg_widget) can override the default character routing preference. Use "apply" to switch to an existing image from the journal.',
    execute: params => executeImageJournalAction(params),
    parameters: imageJournalParams,
  }),
]

export const imageJournalTools = async () => Promise.all(tools)

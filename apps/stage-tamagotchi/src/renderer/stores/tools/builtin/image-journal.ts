import type { ResolvedArtistryConfig } from '@proj-airi/stage-ui/stores'
import type { Tool } from '@xsai/shared-chat'

import { defineInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import {
  resolveArtistryConfigFromStore,
  stageArtistryIntrusion,
  useAiriCardStore,
  useArtistryStore,
  useBackgroundStore,
} from '@proj-airi/stage-ui/stores'
import { tool } from '@xsai/tool'
import { z } from 'zod'

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

const imageJournalParams = z.object({
  action: z.enum(['create', 'apply']).describe('Choose "create" to generate a new image, or "apply" to use an existing one.'),
  prompt: z.string().nullable().describe('Description for the image (required for "create").'),
  title: z.string().nullable().describe('Label for the entry (optional).'),
  query: z.string().nullable().describe('Search term for existing images (required for "apply").'),
  mode: z.enum(['inline', 'widget', 'bg', 'bg_widget']).nullable().describe('Display mode: "inline" (in chat), "widget" (overlay), "bg" (environment), or "bg_widget" (both). Defaults to character preference.'),
})

async function executeCreateImageJournalEntry(params: { prompt?: string, title?: string, mode?: 'inline' | 'widget' | 'bg' | 'bg_widget' }) {
  if (!params.prompt?.trim())
    throw new Error('prompt is required for image_journal.create')

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

  try {
    const artistryResult = await generateHeadless({
      prompt: artistryConfig.promptPrefix ? `${artistryConfig.promptPrefix} ${params.prompt}` : params.prompt as string,
      model: artistryConfig.model as string,
      provider: artistryConfig.provider as string,
      options: JSON.parse(JSON.stringify(artistryConfig.options || {})),
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

    const entryId = await backgroundStore.addBackground('journal', blob, title, params.prompt, cardStore.activeCardId)

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
            prompt: params.prompt as string,
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
        prompt: params.prompt as string,
        timestamp: Date.now(),
      })
    }
    catch (e) {
      console.warn('[ImageJournalTool] Failed to stage artistry intrusion:', e)
    }

    // Return structured result for UI rendering
    return JSON.stringify({
      message: `Image created in ${mode} mode${mode === 'bg' ? ' and set as background' : ''}.`,
      entryId,
      imageUrl: artistryResult.imageUrl || artistryResult.base64,
      title,
      prompt: params.prompt,
      mode,
    })
  }
  catch (e) {
    console.error('[ImageJournalTool] Failed to create entry', e)
    return `Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

async function executeSetAsBackground(params: { query?: string }) {
  if (!params.query?.trim())
    return 'Error: query is required for image_journal.apply. Provide a title or ID to search for.'

  const backgroundStore = useBackgroundStore()
  const cardStore = useAiriCardStore()
  const cardId = cardStore.activeCardId
  const query = params.query.toLowerCase().trim()

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
  return `No match for "${params.query}".${available.length > 0 ? ` Try: ${available.join(', ')}` : ''}`
}

async function executeImageJournalAction(params: any) {
  const normalizedParams = {
    ...params,
    prompt: params.prompt ?? undefined,
    title: params.title ?? undefined,
    query: params.query ?? undefined,
    mode: params.mode ?? undefined,
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

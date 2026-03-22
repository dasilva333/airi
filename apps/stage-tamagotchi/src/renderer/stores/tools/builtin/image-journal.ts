import type { Tool } from '@xsai/shared-chat'

import { defineInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { useAiriCardStore, useArtistryStore, useBackgroundStore } from '@proj-airi/stage-ui/stores'
import { tool } from '@xsai/tool'
import { z } from 'zod'

import { artistryGenerateHeadless, widgetsAdd } from '../../../../shared/eventa'

function getArtistryConfig() {
  try {
    const store = useArtistryStore()
    return {
      provider: store.activeProvider,
      model: store.activeModel,
      promptPrefix: store.defaultPromptPrefix,
      options: store.providerOptions,
      Globals: {
        comfyuiWslBackendPath: store.comfyuiWslBackendPath,
        comfyuiWslNodePath: store.comfyuiWslNodePath,
        comfyuiHostUrl: store.comfyuiHostUrl,
        comfyuiDefaultCheckpoint: store.comfyuiDefaultCheckpoint,
        comfyuiDefaultRemixId: store.comfyuiDefaultRemixId,
        replicateApiKey: store.replicateApiKey,
        replicateDefaultModel: store.replicateDefaultModel,
        replicateAspectRatio: store.replicateAspectRatio,
        replicateInferenceSteps: store.replicateInferenceSteps,
      },
    }
  }
  catch {
    return {}
  }
}

const { context } = createContext(window.electron.ipcRenderer)
const generateHeadless = defineInvoke(context, artistryGenerateHeadless)
const addWidget = defineInvoke(context, widgetsAdd)

const imageJournalParams = z.object({
  action: z.enum(['create', 'set_as_background']).describe('Choose one: create or set_as_background.'),
  prompt: z.string().optional().describe('Text description used to generate the image (required for create).'),
  title: z.string().optional().describe('Short label for the journal entry (optional for create).'),
  query: z.string().optional().describe('Title or ID to fuzzy match for setting background (required for set_as_background).'),
  set_as_background: z.boolean().optional().describe('If true, also sets the newly created image as the active background (only for create).'),
})

async function executeCreateImageJournalEntry(params: { prompt?: string, title?: string, set_as_background?: boolean }) {
  if (!params.prompt?.trim())
    throw new Error('prompt is required for image_journal.create')

  const backgroundStore = useBackgroundStore()
  const cardStore = useAiriCardStore()
  const activeCard = cardStore.activeCard
  const globalArtistryConfig = getArtistryConfig()

  // Prioritize active card artistry config if available
  const cardArtistry = activeCard?.extensions?.airi?.artistry
  const artistryConfig = {
    provider: cardArtistry?.provider || globalArtistryConfig.provider,
    model: cardArtistry?.model || globalArtistryConfig.model,
    promptPrefix: cardArtistry?.promptPrefix || globalArtistryConfig.promptPrefix,
    options: cardArtistry?.options || globalArtistryConfig.options,
    Globals: globalArtistryConfig.Globals, // Globals should probably remain global or merged
  }

  const title = params.title || `Generation ${new Date().toLocaleString()}`

  try {
    const artistryResult = await generateHeadless({
      prompt: artistryConfig.promptPrefix ? `${artistryConfig.promptPrefix} ${params.prompt}` : params.prompt as string,
      model: artistryConfig.model as string,
      provider: artistryConfig.provider as string,
      options: JSON.parse(JSON.stringify(artistryConfig.options || {})),
      globals: JSON.parse(JSON.stringify(artistryConfig.Globals || {})),
    })

    if (artistryResult.error) {
      console.error('[ImageJournalTool] Headless generation failed:', artistryResult.error)
      throw new Error(`Failed to generate image: ${artistryResult.error}`)
    }

    if (!artistryResult.base64 && !artistryResult.imageUrl)
      throw new Error('Failed to generate image: No output received.')

    let blob: Blob
    if (artistryResult.base64) {
      // Convert base64 to blob
      const parts = artistryResult.base64.split(',')
      const contentType = parts[0].split(':')[1].split(';')[0]
      const byteCharacters = atob(parts[1])
      const byteNumbers = Array.from(
        { length: byteCharacters.length },
        (_, i) => byteCharacters.charCodeAt(i),
      )
      const byteArray = new Uint8Array(byteNumbers)
      blob = new Blob([byteArray], { type: contentType })
    }
    else {
      // Fallback to fetch if base64 is missing for some reason
      const response = await fetch(artistryResult.imageUrl!)
      blob = await response.blob()
    }

    const entryId = await backgroundStore.addBackground(
      'journal',
      blob,
      title,
      params.prompt,
      cardStore.activeCardId,
      artistryConfig.Globals?.comfyuiDefaultRemixId as string,
    )

    // Optionally spawn a widget to show the result (best effort)
    if (!params.set_as_background) {
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
      catch (e) {
        console.warn('[ImageJournalTool] Failed to spawn result widget', e)
      }
    }

    // If set_as_background is true, also apply as background
    if (params.set_as_background) {
      try {
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

        return `Image saved as "${title}" (ID: ${entryId}) and set as background.`
      }
      catch (bgErr) {
        console.warn('[ImageJournalTool] Image saved but failed to set as background', bgErr)
        return `Image saved as "${title}" (ID: ${entryId}), but failed to set as background.`
      }
    }

    return `Image saved as "${title}" (ID: ${entryId}).`
  }
  catch (e) {
    console.error('[ImageJournalTool] Failed to create entry', e)
    const errorMsg = e instanceof Error ? e.message : String(e)
    return `Failed to generate image. Error: ${errorMsg}`
  }
}

async function executeSetAsBackground(params: { query?: string }) {
  if (!params.query?.trim())
    return 'Error: query is required for image_journal.set_as_background. Provide a title or ID to search for.'

  const backgroundStore = useBackgroundStore()
  const cardStore = useAiriCardStore()
  const cardId = cardStore.activeCardId

  const query = params.query.toLowerCase().trim()

  const entries = Array.from(backgroundStore.entries.values())
    .filter(e => e.characterId === null || e.characterId === cardId)

  // Search character's journal store first, then scene store
  let entry = entries.find(e => e.type === 'journal' && (e.id === query || e.id.toLowerCase().includes(query)))
  if (!entry) {
    entry = entries.find(e => e.type === 'journal' && e.title.toLowerCase().includes(query))
  }
  if (!entry) {
    entry = entries.find(e => e.type !== 'journal' && e.title.toLowerCase().includes(query))
  }

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

      return `Successfully set background to entry "${entry.title}".`
    }
    catch (e) {
      console.error('[ImageJournalTool] Failed to set background', e)
      return `Found entry "${entry.title}" but failed to apply it as background: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  // List available entries to help the LLM retry
  const available = entries.filter(e => e.type === 'journal').map(e => e.title).slice(0, 10)
  const hint = available.length > 0
    ? ` Available journal entries: ${available.map(t => `"${t}"`).join(', ')}.`
    : ' The journal is currently empty for this character.'

  return `Could not find any background matching "${params.query}".${hint}`
}

async function executeImageJournalAction(params: any) {
  if (params.action === 'create')
    return await executeCreateImageJournalEntry(params)

  if (params.action === 'set_as_background')
    return await executeSetAsBackground(params)

  return 'No image journal action performed.'
}

const tools: Promise<Tool>[] = [
  tool({
    name: 'image_journal',
    description: 'Create or manage AI-generated images for the active character. Use "create" to generate an image and add it to the journal (optionally setting it as background). Use "set_as_background" with a query to apply an existing image as the active background.',
    execute: params => executeImageJournalAction(params),
    parameters: imageJournalParams,
  }),
]

export const imageJournalTools = async () => Promise.all(tools)

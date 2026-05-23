import type { Message } from '@xsai/shared-chat'

import type { DirectorNote } from '../../types/director'

import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { artistryGenerateHeadless } from '@proj-airi/stage-shared'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, toRaw, watch } from 'vue'
import { toast } from 'vue-sonner'

import { directorNotesRepo } from '../../database/repos/director-notes.repo'
import { useBackgroundStore } from '../background'
import { useChatSessionStore } from '../chat/session-store'
import { useLLM } from '../llm'
import { useProvidersStore } from '../providers'
import { useAiriCardStore } from './airi-card'
import { useArtistryStore } from './artistry'
import { useConsciousnessStore } from './consciousness'
import { useSpeechStore } from './speech'

const artistLog = import.meta.env.DEV ? console.log.bind(console, '[AutonomousArtist]') : () => {}

export const useAutonomousArtistryStore = defineStore('artistry-autonomous', () => {
  const llmStore = useLLM()
  const cardStore = useAiriCardStore()
  const backgroundStore = useBackgroundStore()
  const artistryStore = useArtistryStore()
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  const chatSessionStore = useChatSessionStore()
  const speechStore = useSpeechStore()

  const isProcessing = ref(false)
  const directorNotes = ref<DirectorNote[]>([])

  type DirectorNotesSyncEvent
    = | { type: 'director-note-added', sessionId: string, note: DirectorNote }
      | { type: 'director-note-updated', sessionId: string, noteId: string, updates: Partial<DirectorNote> }
      | { type: 'director-notes-archived', sessionId: string }
      | { type: 'director-notes-refreshed', sessionId: string }

  const { post: broadcastDirectorEvent, data: incomingDirectorEvent } = useBroadcastChannel<DirectorNotesSyncEvent, DirectorNotesSyncEvent>({ name: 'airi:director-notes-sync' })

  watch(incomingDirectorEvent, (event) => {
    if (!event)
      return
    const { type, sessionId } = event
    if (sessionId !== chatSessionStore.activeSessionId)
      return

    if (type === 'director-note-added') {
      const { note } = event
      if (!directorNotes.value.some(n => n.id === note.id)) {
        directorNotes.value.push(note)
      }
    }
    else if (type === 'director-note-updated') {
      const { noteId, updates } = event
      const note = directorNotes.value.find(n => n.id === noteId)
      if (note) {
        Object.assign(note, updates)
      }
    }
    else if (type === 'director-notes-archived') {
      directorNotes.value.forEach((note) => {
        if (note.sessionId === sessionId) {
          note.isArchived = true
        }
      })
    }
    else if (type === 'director-notes-refreshed') {
      void loadDirectorNotes(sessionId)
    }
  })

  async function loadDirectorNotes(sessionId: string) {
    directorNotes.value = await directorNotesRepo.getNotes(sessionId)
  }

  async function recordDirectorDecision(note: DirectorNote) {
    directorNotes.value.push(note)
    await directorNotesRepo.saveNotes(note.sessionId, directorNotes.value)
    broadcastDirectorEvent({ type: 'director-note-added', sessionId: note.sessionId, note: toRaw(note) })
  }

  async function updateDirectorDecision(noteId: string, updates: Partial<DirectorNote>) {
    const note = directorNotes.value.find(n => n.id === noteId)
    if (note) {
      Object.assign(note, updates)
      await directorNotesRepo.saveNotes(note.sessionId, directorNotes.value)
      broadcastDirectorEvent({ type: 'director-note-updated', sessionId: note.sessionId, noteId, updates: toRaw(updates) })
    }
  }

  async function archiveSessionNotes(sessionId: string) {
    directorNotes.value.forEach((note) => {
      if (note.sessionId === sessionId) {
        note.isArchived = true
      }
    })
    await directorNotesRepo.saveNotes(sessionId, directorNotes.value)
    broadcastDirectorEvent({ type: 'director-notes-archived', sessionId })
  }

  // Auto-load notes when session changes
  watch(() => chatSessionStore.activeSessionId, (newId) => {
    if (newId) {
      void loadDirectorNotes(newId)
    }
    else {
      directorNotes.value = []
    }
  }, { immediate: true })

  /**
   * Resolve the next concept stack based on the Director's new selections.
   * Implements the "Keep Base, Refresh Modifiers" rule:
   * - If the Director selects a new Base concept, the stack is wiped and rebuilt.
   * - If the Director selects only Layer concepts, the current Base is preserved
   *   and all other modifiers are replaced by the Director's new choices.
   */
  function resolveConceptStack(
    currentStack: string[],
    directorPicks: string[],
    visualAssets: Record<string, any>,
  ): string[] {
    const isVisual = (asset: any) => asset?.prompt?.trim() || (asset?.artistry?.provider && !['none', 'inherit'].includes(asset.artistry.provider))

    const validPicks = directorPicks.filter(id => !!visualAssets[id])
    if (validPicks.length === 0)
      return currentStack

    // Identify non-visual concepts that the Director shouldn't be managing (Identity layers, etc)
    const nonVisualLayers = currentStack.filter(id => !isVisual(visualAssets[id]))

    // Separate Director's picks into bases and layers
    const newBases = validPicks.filter(id => visualAssets[id]?.isBase)
    const newLayers = validPicks.filter(id => !visualAssets[id]?.isBase)

    if (newBases.length > 0) {
      // Director picked a new Base: wipe visual stack, preserve non-visual identity layers
      const primaryBase = newBases[newBases.length - 1]
      artistLog('Stack Resolve: New Base detected, preserving identity layers.', { primaryBase, identity: nonVisualLayers, layers: newLayers })
      return [primaryBase, ...nonVisualLayers, ...newLayers]
    }

    // Director picked only Layers: preserve existing Base and non-visual identity layers, clear old modifiers
    const currentBase = currentStack.find(id => visualAssets[id]?.isBase)
    const nextStack = currentBase ? [currentBase] : []
    nextStack.push(...nonVisualLayers)
    nextStack.push(...newLayers)
    artistLog('Stack Resolve: Refreshing modifiers, keeping base and identity.', { currentBase, identity: nonVisualLayers, layers: newLayers })
    return nextStack
  }

  /**
   * Fold the active concept stack into resolved artistry and manifestation values.
   * Iterates from bottom to top; each layer can override the one below it.
   * - Prompts are concatenated.
   * - Artistry (provider/model/options) and Manifestation (modelId/mood) use "last defined wins".
   */
  function foldConceptStack(
    stack: string[],
    visualAssets: Record<string, any>,
    defaults: {
      provider: string
      model: string
      options: any
      speechProvider?: string
      speechModel?: string
      speechVoiceId?: string
    },
  ) {
    let resolvedProvider = defaults.provider
    let resolvedModel = defaults.model
    let resolvedOptions = defaults.options
    let resolvedModelId: string | undefined
    let resolvedMood: string | undefined
    let resolvedSpeechProvider = defaults.speechProvider
    let resolvedSpeechModel = defaults.speechModel
    let resolvedSpeechVoiceId = defaults.speechVoiceId
    let resolvedExpressions: Record<string, number> = {}
    let resolvedBackgroundId: string | undefined
    let accumulatedPrompt = ''

    for (const conceptId of stack) {
      const asset = visualAssets[conceptId]
      if (!asset)
        continue

      // Prompt: concatenate all snippets
      if (asset.prompt) {
        accumulatedPrompt += asset.prompt
      }

      // Artistry: last override wins
      if (asset.artistry?.provider && asset.artistry.provider !== 'none' && asset.artistry.provider !== 'inherit') {
        resolvedProvider = asset.artistry.provider
        resolvedModel = asset.artistry.model || resolvedModel
        resolvedOptions = asset.artistry.options || resolvedOptions
      }

      // Manifestation: last override wins
      if (asset.manifestation?.modelId && asset.manifestation.modelId !== 'inherit') {
        resolvedModelId = asset.manifestation.modelId
      }
      if (asset.manifestation?.mood) {
        resolvedMood = asset.manifestation.mood
      }
      if (asset.manifestation?.backgroundId && asset.manifestation.backgroundId !== 'inherit') {
        resolvedBackgroundId = asset.manifestation.backgroundId
      }

      // Speech: last override wins
      if (asset.speech?.provider && asset.speech.provider !== 'none' && asset.speech.provider !== 'inherit') {
        resolvedSpeechProvider = asset.speech.provider
        resolvedSpeechModel = asset.speech.model || resolvedSpeechModel
        resolvedSpeechVoiceId = asset.speech.voice_id || resolvedSpeechVoiceId
      }

      if (asset.manifestation?.active_expressions) {
        resolvedExpressions = {
          ...resolvedExpressions,
          ...asset.manifestation.active_expressions,
        }
      }
    }

    return {
      provider: resolvedProvider,
      model: resolvedModel,
      options: resolvedOptions,
      modelId: resolvedModelId,
      mood: resolvedMood,
      speechProvider: resolvedSpeechProvider,
      speechModel: resolvedSpeechModel,
      speechVoiceId: resolvedSpeechVoiceId,
      activeExpressions: resolvedExpressions,
      backgroundId: resolvedBackgroundId,
      promptSnippets: accumulatedPrompt,
    }
  }

  /**
   * Browser-safe ComfyUI generator fallback
   */
  async function generateComfyUIWeb(params: {
    prompt: string
    model?: string
    provider?: string
    options?: Record<string, any>
    globals?: any
  }): Promise<{ imageUrl?: string, base64?: string, error?: string }> {
    const serverUrl = (params.globals?.comfyuiServerUrl || 'http://localhost:8188').replace(/\/+$/, '')
    const savedWorkflows = params.globals?.comfyuiSavedWorkflows || []
    const activeWorkflowId = params.globals?.comfyuiActiveWorkflow || ''

    const templateId = params.model || activeWorkflowId
    const template = savedWorkflows.find((w: any) => w.id === templateId)

    if (!template) {
      return { error: 'No ComfyUI workflow template found.' }
    }

    try {
      // 1. Prepare Workflow (standard injection)
      const prompt = JSON.parse(JSON.stringify(template.workflow))
      const overrides: Record<string, any> = {}

      // Inject prompt into first exposed text field
      for (const [nodeTitle, fields] of Object.entries(template.exposedFields as Record<string, string[]>)) {
        if (fields.includes('text')) {
          overrides[nodeTitle] = { text: params.prompt }
          break
        }
      }

      // Apply overrides
      for (const nodeId in prompt) {
        const node = prompt[nodeId]
        const title = node._meta?.title
        if (title && overrides[title]) {
          for (const [field, value] of Object.entries(overrides[title])) {
            if ((template.exposedFields as any)[title]?.includes(field)) {
              node.inputs[field] = value
            }
          }
        }
        // Randomize seed
        if (node.inputs && 'seed' in node.inputs && (template.exposedFields as any)[title]?.includes('seed')) {
          node.inputs.seed = Math.floor(Math.random() * 1e15)
        }
      }

      // 2. Queue Prompt
      const queueResp = await fetch(`${serverUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!queueResp.ok)
        throw new Error(`ComfyUI Error: ${await queueResp.text()}`)

      const { prompt_id } = await queueResp.json()

      // 3. Poll for result
      const start = Date.now()
      while (Date.now() - start < 1000 * 60 * 5) { // 5 min timeout
        await new Promise(r => setTimeout(r, 3000))
        const histResp = await fetch(`${serverUrl}/history/${prompt_id}`)
        if (!histResp.ok)
          continue

        const histData = await histResp.json()
        if (histData[prompt_id]) {
          const outputs = histData[prompt_id].outputs
          for (const nodeId in outputs) {
            const nodeOutput = outputs[nodeId]
            if (nodeOutput.images && nodeOutput.images.length > 0) {
              const img = nodeOutput.images[0]
              const imageUrl = `${serverUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${encodeURIComponent(img.type || 'output')}`

              // Download as base64 for the journal
              const imgResp = await fetch(imageUrl)
              const blob = await imgResp.blob()
              const reader = new FileReader()
              const base64Promise = new Promise<string>((resolve) => {
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
              })
              const base64 = await base64Promise

              return { imageUrl, base64 }
            }
          }
          break
        }
      }
      throw new Error('Timeout waiting for ComfyUI result.')
    }
    catch (err: any) {
      return { error: err.message }
    }
  }

  /**
   * Safe IPC Invoker for headless generation
   */
  const widgetsAdd = defineInvokeEventa<string | undefined, any>('eventa:invoke:electron:windows:widgets:add')
  const electronShowToast = defineInvokeEventa<void, { message: string, description?: string, duration?: number }>('eventa:invoke:electron:show-toast')

  const getGenerateHeadless = () => {
    const win = window as any
    if (typeof window !== 'undefined' && win.electron?.ipcRenderer) {
      const { context } = createContext(win.electron.ipcRenderer as any)
      return {
        generate: defineInvoke(context, artistryGenerateHeadless),
        addWidget: defineInvoke(context, widgetsAdd),
        showToast: defineInvoke(context, electronShowToast),
      }
    }

    // Web Fallback
    return {
      generate: async (payload: any) => {
        if (payload.provider === 'comfyui') {
          artistLog('Using Web Fallback for ComfyUI generation...')
          return await generateComfyUIWeb(payload)
        }
        return { error: `Web generation not supported for ${payload.provider}. Please use Electron for Replicate/OpenAI.` }
      },
      addWidget: async (payload: any) => {
        artistLog('Widget spawning is disabled in Web environment.', payload)
        toast.info('Scene generated! Check your Gallery.')
      },
      showToast: async (payload: any) => {
        toast(payload.message, {
          description: payload.description,
          duration: payload.duration || 4000,
        })
      },
    }
  }

  /**
   * Analyzes the context in parallel and triggers a visual if threshold is met.
   */
  async function runArtistTask(inputText: string, history: Message[] = [], targetOverride?: 'user' | 'assistant') {
    const { activeCard } = cardStore
    const artistry = activeCard?.extensions?.airi?.artistry
    const autonomousEnabled = artistry?.autonomousEnabled ?? false
    const target = targetOverride || artistry?.autonomousTarget || 'user'

    artistLog('Triggered runArtistTask. State:', {
      cardId: cardStore.activeCardId,
      cardName: activeCard?.name,
      autonomousEnabled,
      target,
    })

    if (!activeCard || !artistry || !autonomousEnabled) {
      return
    }

    const threshold = artistry.autonomousThreshold ?? 70
    const cardId = cardStore.activeCardId

    isProcessing.value = true
    artistLog('Starting analysis task...', { threshold, cardId, target })

    try {
      // 0. Guard: If the text is empty, skip analysis (Director cannot analyze silence)
      if (!inputText || inputText.trim() === '') {
        artistLog('Skipping analysis: Input text is empty.')
        return
      }

      // 1. Compose the "Director" prompt based on target
      const airiExt = activeCard.extensions?.airi as any
      artistLog('DEBUG: Full airi extension:', JSON.stringify(airiExt, null, 2))
      const visualAssets = airiExt?.visual_assets || {}
      const isVisual = (asset: any) => asset?.prompt?.trim() || (asset?.artistry?.provider && !['none', 'inherit'].includes(asset.artistry.provider))

      // Heuristic: Director only sees/picks from concepts that have a visual prompt or a specific provider
      const filteredVisualAssets = Object.fromEntries(
        Object.entries(visualAssets as Record<string, any>).filter(([_, asset]) => isVisual(asset)),
      )

      artistLog('DEBUG: visual_assets filtered for Director:', Object.keys(filteredVisualAssets))
      const hasConcepts = Object.keys(filteredVisualAssets).length > 0
      const availableConceptsText = hasConcepts
        ? Object.entries(filteredVisualAssets)
            .map(([id, asset]: [string, any]) => `- "${id}": ${asset.description}`)
            .join('\n')
        : ''

      const conceptsInstruction = hasConcepts
        ? `\nAVAILABLE CONCEPTS:\n${availableConceptsText}\n`
        : ''

      const conceptsSchema = hasConcepts
        ? ',\n  "selected_concepts": ["Array of zero or more concept IDs chosen from the Available Concepts list"]'
        : ''

      const commonInstructions = `
A high grade (warranted) should be given for:
- Descriptions of beautiful scenery or environment changes
- Expressive emotional reactions or body language from the character
- Direct mentions of food, items, or gifts in the narrative
- Narrative actions that would look stunning as a manga/anime scene
- Changes in the character's clothing or appearance

Character Personality: ${activeCard.personality}
${conceptsInstruction}
Output EXACTLY this JSON format and nothing else:
{
  "reasoning": "Quick explanation of why this scene is visually interesting or boring",
  "intensity": 1-100,
  "prompt": "Highly detailed, illustrative prompt for the image generator capturing the character's reaction and scene. Use Mori's style (masterpiece, high quality, manga style, intricate details)",
  "title": "Short descriptive title for the scene"${conceptsSchema}
}`

      const systemPrompt = target === 'assistant'
        ? `You are the Cinematic Director for AIRI. 
Your job is to ALWAYS generate a visual manifestation (a generative image) summarizing the current scene, and then grade how interesting the resulting scene is from 1 to 100.
You should draw inspiration from the entire context history provided. If the latest response is mundane, use your artistic freedom to craft an image that captures the broader narrative arc or the environment established in the recent turns.
${commonInstructions}`
        : `You are the Cinematic Director for AIRI. 
Your job is to ALWAYS generate a visual manifestation (a generative image) summarizing the current scene, and then grade how interesting the resulting scene is from 1 to 100.
You should draw inspiration from the entire context history provided. If the latest input is mundane, use your artistic freedom to craft an image that captures the broader narrative arc or the environment established in the recent turns.
${commonInstructions}`

      // 2. Rollup history and text into a single prompt to help the LLM "see" the full context
      const historyDepth = (artistry as any).autonomousHistoryDepth ?? 3
      const recentHistory = history.slice(-historyDepth)
      const historyText = recentHistory.map(m => `[${m.role === 'assistant' ? 'Companion' : 'User'}]: ${m.content}`).join('\n\n')

      const analysisPrompt = `Consider the recent history between the user and the character for context and inspiration, then analyze the latest ${target === 'assistant' ? 'response from the companion' : 'input from the user'} to decide if a visual manifestation is needed.

---
CURRENTLY ACTIVE CONCEPTS:
${(() => {
  const active = airiExt?.active_concepts || []
  const filtered = active.filter((id: string) => isVisual(visualAssets[id]))
  return filtered.length > 0 ? filtered.join(', ') : '(None)'
})()}

The list above indicates the visual concepts that were active in the previous turn. 

CRITICAL DIRECTIVE FOR CONTINUITY: 
To maintain visual and narrative continuity, you should default to keeping these concepts active unless the conversation or context explicitly implies a change in the environment, clothing, or situation. 

If you wish to carry a state forward, you MUST include its ID again in your "selected_concepts" output. Only remove or change concepts when the dialogue or story progression calls for it.

--- 
CONTEXT HISTORY:
${historyText || '(No previous history)'}

---
LATEST ${target === 'assistant' ? 'COMPANION RESPONSE' : 'USER INPUT'}:
"${inputText}"`

      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ]

      const modelId = consciousnessStore.activeModel
      const providerId = consciousnessStore.activeProvider

      artistLog('Sending rolled-up prompt to Director LLM...', {
        model: modelId,
        provider: providerId,
        historyCount: recentHistory.length,
        textSubstring: inputText.substring(0, 50),
        target,
      })

      if (!modelId || !providerId) {
        throw new Error(`Missing LLM configuration (Model: ${modelId}, Provider: ${providerId})`)
      }

      const chatProvider = await providersStore.getProviderInstance(providerId) as any
      if (!chatProvider) {
        throw new Error(`Failed to resolve chat provider instance for: ${providerId}`)
      }

      // NOTICE: Artificial 10s delay for USER target to avoid race conditions/429s.
      // Skipped for ASSISTANT target as the main response is already finalized.
      if (target === 'user') {
        artistLog('User target detected. Applying 10s safety delay...')
        await new Promise(resolve => setTimeout(resolve, 10000))
      }

      // 2. Call LLM (Non-streaming for structured data)
      const response = await llmStore.generate(modelId, chatProvider, messages)

      const rawContent = (response.text || '').trim()
      artistLog('Received raw response from Director LLM:', rawContent)

      // 3. Parse and analyze
      // Handle potential markdown fences: ```json ... ```
      let jsonContent = rawContent
      const fenceMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (fenceMatch) {
        jsonContent = fenceMatch[1].trim()
        artistLog('Extracted JSON from fences:', jsonContent)
      }

      if (!jsonContent) {
        throw new Error('LLM returned empty content')
      }

      const analysis = JSON.parse(jsonContent)
      const selectedConcepts: string[] = Array.isArray(analysis.selected_concepts) ? analysis.selected_concepts : []
      artistLog('Parsed Analysis Result:', {
        intensity: analysis.intensity,
        reasoning: analysis.reasoning,
        title: analysis.title,
        prompt: analysis.prompt,
        selected_concepts: selectedConcepts,
      })

      // 3.5 Stack Folding: Resolve the next concept stack and fold into final values
      // First, resolve what the stack SHOULD look like after the Director's decision
      const currentConceptIds = airiExt?.active_concepts || []
      const nextConceptStack = resolveConceptStack(currentConceptIds, selectedConcepts, visualAssets)
      artistLog('Stack Folding: Resolved next stack:', nextConceptStack)

      // Fold the resolved stack to get final prompt, artistry, and manifestation values
      const folded = foldConceptStack(
        nextConceptStack,
        visualAssets,
        {
          provider: artistry.provider || artistryStore.activeProvider,
          model: artistry.model || artistryStore.activeModel,
          options: artistry.options || artistryStore.providerOptions,
          speechProvider: airiExt?.modules?.speech?.provider || speechStore.activeSpeechProvider,
          speechModel: airiExt?.modules?.speech?.model || speechStore.activeSpeechModel,
          speechVoiceId: airiExt?.modules?.speech?.voice_id || speechStore.activeSpeechVoiceId,
        },
      )

      // Build the final prompt from the Director's base prompt + folded concept snippets
      const finalPrompt = analysis.prompt + folded.promptSnippets
      artistLog('Stack Folding: Final resolved values:', {
        provider: folded.provider,
        model: folded.model,
        modelId: folded.modelId,
        mood: folded.mood,
        promptSnippets: folded.promptSnippets,
      })

      const thresholdMet = (analysis.intensity ?? 0) >= threshold

      let notificationDescription = `${thresholdMet ? '✅' : '❌'} Grade: ${analysis.intensity}/${threshold}\nReason: ${analysis.reasoning?.substring(0, 130)}${analysis.reasoning?.length > 130 ? '...' : ''}`
      if (selectedConcepts.length > 0) {
        notificationDescription += `\n🎯 Concepts: ${selectedConcepts.join(', ')}`
      }

      const invoker = getGenerateHeadless()
      invoker.showToast({
        message: 'Director\'s Decision',
        description: notificationDescription,
        duration: 7000,
      })

      const sessionId = chatSessionStore.activeSessionId
      const noteId = Date.now().toString()
      const noteState = thresholdMet ? 'pending' : 'done'

      await recordDirectorDecision({
        id: noteId,
        sessionId,
        type: 'director-note',
        content: analysis.reasoning,
        intensity: analysis.intensity,
        title: analysis.title,
        prompt: finalPrompt,
        target,
        state: noteState,
        selected_concepts: selectedConcepts,
        createdAt: Date.now(),
      })

      // 3. Evaluate Threshold
      if (analysis.intensity >= threshold) {
        artistLog(`Threshold met (${analysis.intensity} >= ${threshold}). Triggering generation...`)

        const invoker = getGenerateHeadless()
        if (!invoker) {
          artistLog('IPC Invoker not available (non-electron environment). Skipping generation.')
          return
        }

        // 3.7 Artistry Bridge: Use folded stack values for generation resolution
        const resolvedProvider = folded.provider
        const resolvedModel = folded.model
        const resolvedOptions = folded.options

        const artistryGlobals = artistryStore.artistryGlobals
        const generationPayload = {
          prompt: artistry.promptPrefix ? `${artistry.promptPrefix} ${finalPrompt}` : finalPrompt,
          model: resolvedModel,
          provider: resolvedProvider,
          options: resolvedOptions,
          globals: artistryGlobals,
        }

        artistLog('Triggering Headless Generation with payload:', generationPayload)

        const invokers = getGenerateHeadless()
        if (!invokers) {
          throw new Error('IPC invokers not available')
        }

        // Safety: ensure payload is a plain object for IPC serialization
        const plainPayload = JSON.parse(JSON.stringify(toRaw(generationPayload)))
        const result = await invokers.generate(plainPayload)

        if (result.error) {
          throw new Error(result.error)
        }

        artistLog('Headless Generation Success!', { hasUrl: !!result.imageUrl, hasBase64: !!result.base64 })

        // 4. Save to journal
        if (result.base64 || result.imageUrl) {
          let blob: Blob
          if (result.base64) {
            let data = result.base64
            let contentType = 'image/png'
            if (typeof data === 'string' && data.includes(',')) {
              const parts = data.split(',')
              contentType = parts[0].split(':')[1]?.split(';')[0] || contentType
              data = parts[1]
            }
            const byteCharacters = atob(data)
            blob = new Blob([new Uint8Array(Array.from({ length: byteCharacters.length }, (_, j) => byteCharacters.charCodeAt(j)))], { type: contentType })
          }
          else {
            const response = await fetch(result.imageUrl!)
            blob = await response.blob()
          }

          const entryId = await backgroundStore.addBackground('journal', blob, analysis.title || 'Autonomous Scene', analysis.prompt, cardId)
          artistLog('Generation complete and added to journal.', { entryId })

          await updateDirectorDecision(noteId, { state: 'done' })

          // 5. Route based on spawnMode
          const spawnMode = artistry.spawnMode || 'bg_widget'
          artistLog(`Routing image with mode: ${spawnMode}`)

          switch (spawnMode) {
            case 'bg': {
              // Update character's active background + concept stack + manifestation
              const bgModuleUpdates: Record<string, any> = {
                ...activeCard.extensions.airi.modules,
                activeBackgroundId: entryId,
                active_expressions: folded.activeExpressions,
              }
              if (folded.modelId) {
                bgModuleUpdates.displayModelId = folded.modelId
              }
              cardStore.updateCard(cardId, {
                extensions: {
                  ...activeCard.extensions,
                  airi: {
                    ...activeCard.extensions.airi,
                    active_concepts: nextConceptStack,
                    modules: bgModuleUpdates,
                  },
                },
              } as any)
              break
            }

            case 'inline': {
              const imageUrl = result.imageUrl || result.base64
              const content = `![${analysis.title || 'Generated Image'}](${imageUrl})`
              chatSessionStore.inscribeTurn({
                role: 'assistant',
                content,
                slices: [{ type: 'text', text: content }],
                tool_results: [],
                createdAt: Date.now(),
              })
              break
            }

            case 'widget':
              try {
                await invokers.addWidget({
                  componentName: 'artistry',
                  componentProps: {
                    status: 'done',
                    entryId,
                    imageUrl: result.imageUrl || result.base64,
                    prompt: analysis.prompt,
                    title: analysis.title || 'Autonomous Scene',
                    _skipIngestion: true,
                  },
                  size: 'm',
                  ttlMs: 0,
                })
              }
              catch (widgetErr) {
                console.warn('[AutonomousArtist] Failed to spawn Result widget', widgetErr)
              }
              break

            case 'bg_widget':
            default:
              // Both: Update background, stack, AND spawn widget
              {
                if (!activeCard || !activeCard.extensions?.airi) {
                  artistLog('Director Bridge: Aborting card update - active card or airi extension is missing.')
                  break
                }

                // 1. Use the pre-computed nextConceptStack from the Stack Folding phase
                artistLog('Director Bridge: Applying resolved concept stack:', nextConceptStack)

                // 2. Build the surgical update payload
                const moduleUpdates: Record<string, any> = {
                  ...activeCard.extensions.airi.modules,
                  activeBackgroundId: entryId,
                }

                // 3. Manifestation Bridge: If the stack fold resolved a new modelId, apply it
                if (folded.modelId) {
                  artistLog(`Manifestation Bridge: Updating displayModelId to "${folded.modelId}"`)
                  moduleUpdates.displayModelId = folded.modelId
                }

                // 4. Perform a SURGICAL update to avoid shredding the modules (TTS/Brain)
                cardStore.updateCard(cardId, {
                  extensions: {
                    ...activeCard.extensions,
                    airi: {
                      ...activeCard.extensions.airi,
                      active_concepts: nextConceptStack,
                      modules: moduleUpdates,
                    },
                  },
                } as any)

                artistLog('Director Bridge: Card updated successfully with new concept stack:', nextConceptStack)
              }

              try {
                await invokers.addWidget({
                  componentName: 'artistry',
                  componentProps: {
                    status: 'done',
                    entryId,
                    imageUrl: result.imageUrl || result.base64,
                    prompt: analysis.prompt,
                    title: analysis.title || 'Autonomous Scene',
                    _skipIngestion: true,
                  },
                  size: 'm',
                  ttlMs: 0,
                })
              }
              catch (widgetErr) {
                console.warn('[AutonomousArtist] Failed to spawn Result widget', widgetErr)
              }
              break
          }
        }
      }
      else {
        artistLog(`Intensity (${analysis.intensity}) below threshold (${threshold}). No action taken.`)
      }
    }
    catch (err) {
      artistLog('Task failed with error:', err)
    }
    finally {
      isProcessing.value = false
    }
  }

  /**
   * Manually trigger a synchronization of the current concept stack to physical manifestations.
   * Useful for immediate model swaps when a user toggles an outfit in the UI.
   */
  async function applyCurrentStackManifestations() {
    const { activeCard } = cardStore
    if (!activeCard || !activeCard.extensions?.airi)
      return

    const airiExt = activeCard.extensions.airi as any
    const visualAssets = airiExt.visual_assets || {}
    const currentStack = airiExt.active_concepts || []
    const artistry = airiExt.artistry || {}

    artistLog('Manual Sync: Folding current stack manifestations...', currentStack)

    const folded = foldConceptStack(
      currentStack,
      visualAssets,
      {
        provider: artistry.provider || artistryStore.activeProvider,
        model: artistry.model || artistryStore.activeModel,
        options: artistry.options || artistryStore.providerOptions,
      },
    )

    const moduleUpdates: Record<string, any> = {
      ...activeCard.extensions.airi.modules,
    }

    if (folded.modelId) {
      artistLog(`Manual Sync: Applying displayModelId "${folded.modelId}"`)
      moduleUpdates.displayModelId = folded.modelId
    }

    cardStore.updateCard(cardStore.activeCardId, {
      extensions: {
        ...activeCard.extensions,
        airi: {
          ...activeCard.extensions.airi,
          modules: moduleUpdates,
        },
      },
    } as any)
  }

  async function activateConcept(conceptId: string) {
    const { activeCard, activeCardId } = cardStore
    if (!activeCard || !activeCard.extensions?.airi) {
      artistLog('ActivateConcept: Aborting - active card or airi extension is missing.')
      return
    }

    const airiExt = activeCard.extensions.airi as any
    const visualAssets = airiExt.visual_assets || {}
    const currentStack = airiExt.active_concepts || []
    const artistry = airiExt.artistry || {}

    artistLog('ActivateConcept: Activating concept:', conceptId)

    // 1. Resolve the next concept stack (merging Base/Layer logic)
    const nextConceptStack = resolveConceptStack(currentStack, [conceptId], visualAssets)

    // 2. Fold the resolved stack to get final manifestation values (modelId, etc.)
    const folded = foldConceptStack(
      nextConceptStack,
      visualAssets,
      {
        provider: artistry.provider || artistryStore.activeProvider,
        model: artistry.model || artistryStore.activeModel,
        options: artistry.options || artistryStore.providerOptions,
        speechProvider: airiExt?.modules?.speech?.provider || speechStore.activeSpeechProvider,
        speechModel: airiExt?.modules?.speech?.model || speechStore.activeSpeechModel,
        speechVoiceId: airiExt?.modules?.speech?.voice_id || speechStore.activeSpeechVoiceId,
      },
    )

    // 3. Build the surgical update payload for the modules
    const moduleUpdates: Record<string, any> = {
      ...activeCard.extensions.airi.modules,
    }

    if (folded.modelId) {
      artistLog(`ActivateConcept: Applying manifestation modelId "${folded.modelId}"`)
      moduleUpdates.displayModelId = folded.modelId
    }

    if (folded.speechProvider && folded.speechProvider !== 'inherit') {
      artistLog(`ActivateConcept: Applying speech override to runtime:`, { provider: folded.speechProvider, voice: folded.speechVoiceId })
      speechStore.activeSpeechProvider = folded.speechProvider
      if (folded.speechModel)
        speechStore.activeSpeechModel = folded.speechModel
      if (folded.speechVoiceId)
        speechStore.activeSpeechVoiceId = folded.speechVoiceId

      moduleUpdates.speech = {
        ...moduleUpdates.speech,
        provider: folded.speechProvider,
        model: folded.speechModel,
        voice_id: folded.speechVoiceId,
      }
    }

    // Background: Only apply when Director is OFF (manual scene control)
    const autonomousEnabled = artistry.autonomousEnabled ?? false
    if (!autonomousEnabled && folded.backgroundId) {
      artistLog(`ActivateConcept: Applying background override "${folded.backgroundId}" (Director is OFF)`)
      moduleUpdates.activeBackgroundId = folded.backgroundId
    }

    // 4. Perform the update
    cardStore.updateCard(activeCardId, {
      extensions: {
        ...activeCard.extensions,
        airi: {
          ...activeCard.extensions.airi,
          active_concepts: nextConceptStack,
          modules: moduleUpdates,
        },
      },
    } as any)

    artistLog('ActivateConcept: Success.', { conceptId, nextConceptStack })
  }

  /**
   * Lightweight voice-only preload for TTS generation-time ACTOR swaps.
   * Updates ONLY the speech store (provider/model/voice) so the next TTS call
   * generates audio with the correct voice. Does NOT swap the model, background,
   * or concept stack — those visual changes are deferred to playback-time via
   * activateConcept() called from the playback manager's onEnd handler.
   */
  function preloadConceptVoice(conceptId: string) {
    const { activeCard } = cardStore
    if (!activeCard || !activeCard.extensions?.airi)
      return

    const airiExt = activeCard.extensions.airi as any
    const visualAssets = airiExt.visual_assets || {}
    const currentStack = airiExt.active_concepts || []
    const artistry = airiExt.artistry || {}

    // Resolve the stack as if this concept were activated
    const nextConceptStack = resolveConceptStack(currentStack, [conceptId], visualAssets)

    // Fold to get speech values
    const folded = foldConceptStack(
      nextConceptStack,
      visualAssets,
      {
        provider: artistry.provider || artistryStore.activeProvider,
        model: artistry.model || artistryStore.activeModel,
        options: artistry.options || artistryStore.providerOptions,
        speechProvider: airiExt?.modules?.speech?.provider || speechStore.activeSpeechProvider,
        speechModel: airiExt?.modules?.speech?.model || speechStore.activeSpeechModel,
        speechVoiceId: airiExt?.modules?.speech?.voice_id || speechStore.activeSpeechVoiceId,
      },
    )

    // Only update speech runtime — no model/background/card changes
    if (folded.speechProvider && folded.speechProvider !== 'inherit') {
      artistLog(`PreloadVoice: Applying speech override for upcoming TTS:`, { provider: folded.speechProvider, voice: folded.speechVoiceId })
      speechStore.activeSpeechProvider = folded.speechProvider
      if (folded.speechModel)
        speechStore.activeSpeechModel = folded.speechModel
      if (folded.speechVoiceId)
        speechStore.activeSpeechVoiceId = folded.speechVoiceId
    }
    else {
      artistLog(`PreloadVoice: No speech override for concept "${conceptId}", keeping current voice.`)
    }
  }

  function findNoteForImage(title?: string, prompt?: string) {
    if (!title && !prompt)
      return null
    return directorNotes.value.slice().reverse().find((n) => {
      // Direct match on title or prompt
      if (title && n.title === title)
        return true
      if (prompt && n.prompt === prompt)
        return true
      return false
    })
  }

  return {
    isProcessing,
    directorNotes,
    runArtistTask,
    loadDirectorNotes,
    archiveSessionNotes,
    activateConcept,
    preloadConceptVoice,
    applyCurrentStackManifestations,
    findNoteForImage,
  }
})

import type { Tool } from '@xsai/shared-chat'

import { useCustomVrmAnimationsStore } from '@proj-airi/stage-ui-three'
import { DisplayModelFormat, useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { buildVRMA, VRMA_SYSTEM_PROMPT, VRMAMotionSpecSchema } from '@proj-airi/stage-ui/utils'
import { tool } from '@xsai/tool'
import { storeToRefs } from 'pinia'
import { z } from 'zod'

const generateMotionParams = z.object({
  id: z.string().describe('A unique snake_case identifier for this motion (e.g. \'jumping_jacks\', \'happy_wave\').'),
  prompt: z.string().describe('A descriptive prompt detailing the exact motion sequence, bones to move, speed, and emotions (e.g. \'jumping jacks motion with happy expressions\').'),
  overwrite: z.boolean().optional().describe('If true, replaces an existing motion with the same id. Defaults to false.'),
}).strict()

/**
 * Resolve the DisplayModelFormat of the character card currently active in the stage.
 * Returns null if the active card has no display model assigned.
 */
async function resolveActiveModelFormat(): Promise<DisplayModelFormat | null> {
  const cardStore = useAiriCardStore()
  const displayModelsStore = useDisplayModelsStore()

  const activeCard = cardStore.activeCard
  if (!activeCard)
    return null

  const activeCardId = cardStore.activeCardId
  const displayModelId = cardStore.getCardDisplayModelId(activeCardId)
  if (!displayModelId)
    return null

  await displayModelsStore.loadDisplayModelsFromIndexedDB()
  const model = displayModelsStore.displayModels.find(m => m.id === displayModelId)
  return model?.format ?? null
}

async function executeGenerateMotion(params: { id: string, prompt: string, overwrite?: boolean }) {
  const cleanId = params.id.trim().replace(/\W/g, '_')
  const cleanPrompt = params.prompt.trim()
  const overwrite = params.overwrite ?? false

  if (!cleanId || !cleanPrompt)
    return 'Error: Both id and prompt parameters are required.'

  // --- Resolve model type and route to the right builder ---
  const format = await resolveActiveModelFormat()

  if (format === null) {
    return 'Error: No active character or display model is configured.'
  }

  // Stubs for formats not yet supported
  if (
    format === DisplayModelFormat.Live2dZip
    || format === DisplayModelFormat.Live2dDirectory
  ) {
    return 'Live2D motion generation is not yet supported. This feature is coming soon!'
  }

  if (
    format === DisplayModelFormat.PMXZip
    || format === DisplayModelFormat.PMXDirectory
    || format === DisplayModelFormat.PMD
  ) {
    return 'MMD/VMD motion generation is not yet supported. This feature is coming soon!'
  }

  if (format === DisplayModelFormat.SpineZip) {
    return 'Spine motion generation is not yet supported. This feature is coming soon!'
  }

  // VRM — use the VRMA builder pipeline
  if (format !== DisplayModelFormat.VRM) {
    return `Error: Active character model format "${format}" is unsupported for motion generation.`
  }

  // --- Existence check before compiling ---
  const customVrmAnimationsStore = useCustomVrmAnimationsStore()
  await customVrmAnimationsStore.loadCustomAnimations()

  const existingKey = `custom-vrma:${cleanId}`
  const alreadyExists = existingKey in customVrmAnimationsStore.customAnimations

  if (alreadyExists && !overwrite) {
    return `A motion called '${cleanId}' already exists. You can either pick a different name, or call generate_motion again with the same id and set overwrite to true if you want to replace it.`
  }

  if (alreadyExists && overwrite) {
    await customVrmAnimationsStore.removeCustomAnimation(cleanId)
  }

  // --- Resolve LLM provider ---
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  const llmStore = useLLM()

  const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
  const providerId = activeProvider.value
  const model = activeModel.value

  if (!providerId || !model)
    return 'Error: No active LLM provider or model is configured. Please select one in settings.'

  const provider = await providersStore.getProviderInstance(providerId)
  if (!provider)
    return `Error: Failed to resolve provider instance for "${providerId}".`

  // --- Generate VRMA spec and compile ---
  try {
    const messages = [
      { role: 'system' as const, content: VRMA_SYSTEM_PROMPT },
      { role: 'user' as const, content: `Create a motion animation for: ${cleanPrompt}` },
    ]

    const spec = await llmStore.generateObject(model, provider as any, {
      messages,
      schema: VRMAMotionSpecSchema,
      maxAttempts: 3,
    })

    const buffer = buildVRMA(spec)

    const fileName = `${cleanId}.vrma`
    const file = new File([buffer], fileName, { type: 'model/gltf-binary' })
    await customVrmAnimationsStore.addCustomAnimation(file)

    return `Success: You have successfully learned the new motion '${cleanId}'. You can now perform it by placing '<|ACT:motion="${cleanId}"|>' in your response. For example: '<|ACT:motion="${cleanId}"|> Look! I am doing the ${cleanId.replace(/_/g, ' ')}!'`
  }
  catch (err: any) {
    console.error('generate_motion failed:', err)
    return `Error: Failed to generate motion spec from prompt: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function generateMotionTools(): Promise<Tool[]> {
  return Promise.all([
    tool({
      name: 'generate_motion',
      description: 'Generates a custom character animation dynamically from a natural language motion description. Automatically detects the active character\'s model format (VRM, Live2D, MMD) and routes to the correct builder. Currently supports VRM humanoid models.',
      parameters: generateMotionParams,
      execute: params => executeGenerateMotion(params as { id: string, prompt: string, overwrite?: boolean }),
    }),
  ])
}

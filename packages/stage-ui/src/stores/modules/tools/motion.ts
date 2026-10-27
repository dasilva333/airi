import type { Tool } from '@xsai/shared-chat'

import z from 'zod'

import { useCustomVrmAnimationsStore } from '@proj-airi/stage-ui-three'
import { tool } from '@xsai/tool'

import { DisplayModelFormat, useDisplayModelsStore } from '../../display-models'
import { useAiriCardStore } from '../airi-card'
import { useTextToMotionStore } from '../text-to-motion'

export const generateMotionParams = z.object({
  id: z.string().describe('A unique snake_case identifier for this motion (e.g. \'jumping_jacks\', \'happy_wave\').'),
  prompt: z.string().describe('A descriptive prompt detailing the exact motion sequence, bones to move, speed, and emotions (e.g. \'jumping jacks motion with happy expressions\').'),
  overwrite: z.boolean().optional().describe('If true, replaces an existing motion with the same id. Defaults to false.'),
}).strict()

/**
 * Shared slug rule for ACT-first motion generation: free-text cue
 * `motion="jumping jacks"` maps to the library id `jumping_jacks`.
 * Second identical cue hits the saved entry instead of regenerating.
 */
export function slugifyMotionCue(cue: string): string {
  const slug = cue.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return slug || 'motion'
}

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

export async function executeGenerateMotion(params: { id: string, prompt: string, overwrite?: boolean }) {
  const cleanId = slugifyMotionCue(params.id)
  const cleanPrompt = params.prompt.trim()
  const overwrite = params.overwrite ?? false

  if (!cleanId || !cleanPrompt)
    return 'Error: Both id and prompt parameters are required.'

  const format = await resolveActiveModelFormat()

  if (format === null) {
    return 'Error: No active character or display model is configured.'
  }

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

  if (format !== DisplayModelFormat.VRM) {
    return `Error: Active character model format "${format}" is unsupported for motion generation.`
  }

  const customVrmAnimationsStore = useCustomVrmAnimationsStore()
  await customVrmAnimationsStore.loadCustomAnimations()

  const existingKey = `custom-vrma:${cleanId}`
  const alreadyExists = existingKey in customVrmAnimationsStore.customAnimations
    || customVrmAnimationsStore.animationOptions.some(opt => opt.label === cleanId)

  if (alreadyExists && !overwrite) {
    return `A motion called '${cleanId}' already exists. You can either pick a different name, or call generate_motion again with the same id and set overwrite to true if you want to replace it.`
  }

  if (alreadyExists && overwrite) {
    await customVrmAnimationsStore.removeCustomAnimation(cleanId)
  }

  try {
    const textToMotionStore = useTextToMotionStore()
    const result = await textToMotionStore.generateMotion(cleanPrompt, {
      format: 'vrma',
    })

    result.fileName = `${cleanId}.vrma`

    await textToMotionStore.saveResultToLibrary(
      result,
      file => customVrmAnimationsStore.addCustomAnimation(file),
    )

    return `Success: You have successfully learned the new motion '${cleanId}'. You can now perform it by placing '<|ACT:motion="${cleanId}"|>' in your response. For example: '<|ACT:motion="${cleanId}"|> Look! I am doing the ${cleanId.replace(/_/g, ' ')}!'`
  }
  catch (err: any) {
    console.error('generate_motion failed:', err)
    return `Error: Failed to generate motion spec from prompt: ${err instanceof Error ? err.message : String(err)}`
  }
}

export function createMotionTool(): Promise<Tool> {
  return tool({
    name: 'generate_motion',
    description: 'Generates a custom character animation dynamically from a natural language motion description. Automatically detects the active character\'s model format (VRM, Live2D, MMD) and routes to the correct builder. Currently supports VRM humanoid models.',
    parameters: generateMotionParams,
    execute: params => executeGenerateMotion(params as { id: string, prompt: string, overwrite?: boolean }),
  })
}

export async function generateMotionTools(): Promise<Tool[]> {
  return Promise.all([
    createMotionTool(),
  ])
}

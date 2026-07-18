import type { Tool } from '@xsai/shared-chat'

import { useCustomVrmAnimationsStore } from '@proj-airi/stage-ui-three'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { buildVRMA, VRMA_SYSTEM_PROMPT, VRMAMotionSpecSchema } from '@proj-airi/stage-ui/utils'
import { tool } from '@xsai/tool'
import { storeToRefs } from 'pinia'
import { z } from 'zod'

const generateVrmaParams = z.object({
  id: z.string().describe('A unique snake_case identifier for this motion (e.g. \'jumping_jacks\', \'happy_wave\').'),
  prompt: z.string().describe('A descriptive prompt detailing the exact motion sequence, bones to move, speed, and emotions (e.g. \'jumping jacks motion with happy expressions\').'),
}).strict()

async function executeGenerateVrma(params: { id: string, prompt: string }) {
  const cleanId = params.id.trim().replace(/\W/g, '_')
  const cleanPrompt = params.prompt.trim()

  if (!cleanId || !cleanPrompt) {
    return 'Error: Both id and prompt parameters are required.'
  }

  // Resolve stores
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  const llmStore = useLLM()
  const customVrmAnimationsStore = useCustomVrmAnimationsStore()

  const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
  const providerId = activeProvider.value
  const model = activeModel.value

  if (!providerId || !model) {
    return 'Error: No active LLM provider or model is configured. Please select one in settings.'
  }

  const provider = await providersStore.getProviderInstance(providerId)
  if (!provider) {
    return `Error: Failed to resolve provider instance for "${providerId}".`
  }

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
    console.error('[generate_vrma] failed:', err)
    return `Error: Failed to generate motion spec from prompt: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function generateVrmaTools(): Promise<Tool[]> {
  return Promise.all([
    tool({
      name: 'generate_vrma',
      description: 'Generates a custom VRM animation (.vrma) dynamically from a natural language motion description.',
      parameters: generateVrmaParams,
      execute: params => executeGenerateVrma(params as { id: string, prompt: string }),
    }),
  ])
}

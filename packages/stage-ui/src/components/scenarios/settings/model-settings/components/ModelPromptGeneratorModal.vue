<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { useLLM } from '../../../../../stores/llm'
import { useAiriCardStore } from '../../../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../../../stores/providers'

interface Props {
  modelValue: boolean
  cardId?: string
  // Visible capabilities gathered from the active model view
  activeEmotions: string[]
  activeMotions: string[]
  // Roster of all models/actors on set
  onSetModels: Array<{
    key: string
    name: string
    modelId: string
    avatarUrl: string
    isFallback: boolean
  }>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', value: string): void
}>()

const llmStore = useLLM()
const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()
const airiCardStore = useAiriCardStore()

// State Management
const history = ref<string[]>([])
const historyIndex = ref<number>(-1)
const customInstructions = ref<string>('')
const loading = ref<boolean>(false)
const errorMessage = ref<string>('')

// Current active value displayed in editor
const activeValue = computed({
  get: () => {
    if (historyIndex.value >= 0 && historyIndex.value < history.value.length) {
      return history.value[historyIndex.value]
    }
    return ''
  },
  set: (val: string) => {
    if (historyIndex.value >= 0 && historyIndex.value < history.value.length) {
      history.value[historyIndex.value] = val
    }
  },
})

// Auto-trigger generation on modal open
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    history.value = []
    historyIndex.value = -1
    customInstructions.value = ''
    errorMessage.value = ''

    // Initial value loaded from active card
    const currentPrompt = airiCardStore.activeCard?.extensions?.airi?.acting?.modelExpressionPrompt || ''
    if (currentPrompt) {
      history.value.push(currentPrompt)
      historyIndex.value = 0
    }
    void generateSuggestion()
  }
})

async function generateSuggestion(isRefining = false) {
  const providerId = consciousnessStore.activeProvider
  const modelId = consciousnessStore.activeModel

  if (!providerId || !modelId) {
    errorMessage.value = 'No active LLM provider or model configured in settings.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const activeProvider = await providersStore.getProviderInstance(providerId) as any
    if (!activeProvider) {
      throw new Error(`Failed to instantiate provider: ${providerId}`)
    }

    const isMultiModel = props.onSetModels.length > 1

    let systemInstruction = ''
    let contextDescription = ''

    if (isMultiModel) {
      systemInstruction = `You are an expert AI prompt engineer. Help the user write a structured multi-role acting system prompt instructions in markdown detailing cognitive boundaries, demeanor, and relationship rules for multiple distinct character concepts.
Your key directive is instructing the Actor (the dialogue scriptwriter) to prefix every turn of dialogue or action with the appropriate \`<|ACTOR:id|>\` tokens to switch identities.
You MUST instruct the Actor to intersperse physical emotion/motion tokens sparingly (1-2 per response) at natural emotional peaks.
Instruct using ONLY the exact available expressions and motions listed for each actor in the context below. Do not invent new ones.
End the instruction block with multiple concrete, realistic multi-role dialogue examples showing the identity switches and token placements.`

      const actorTokensInfo = props.onSetModels.map((m) => {
        return `- Actor Token: <|ACTOR:${m.key}|>\n  Name/Description: ${m.name}`
      }).join('\n\n')

      contextDescription = `Available Actors/Tokens:\n${actorTokensInfo}\n\nVisible Capabilities:\n- Available Emotions: [ ${props.activeEmotions.join(', ') || 'None'} ]\n- Available Motions: [ ${props.activeMotions.join(', ') || 'None'} ]`
    }
    else {
      systemInstruction = `You are an expert AI actor manager. Help the user write a detailed system prompt instruction in markdown teaching the character when and how to inject \`<|ACT:emotion="expression_name"|>\` and \`<|ACT:motion="action_cue"|>\` tokens into their responses.
- You MUST instruct the character to use only the exact expressions and motions listed in the context below.
- You MUST instruct the character to strictly use the official format with double quotes: \`<|ACT:emotion="expression_name"|>\` and \`<|ACT:motion="action_cue"|>\`.
- Instruct the character to place these tokens sparingly at natural emotional peaks or key actions in their response (insert only 1-2 per response).
- Always end the instruction block with a clear usage example showing where the tokens should be placed (e.g. "Hello! <|ACT:emotion=\\"happy\\"|> How are you today?").`

      contextDescription = `Active Actor Capabilities:\n- Available Emotions: [ ${props.activeEmotions.join(', ') || 'None'} ]\n- Available Motions: [ ${props.activeMotions.join(', ') || 'None'} ]`
    }

    const systemPromptContent = `${systemInstruction}\n\nCore Character/Model Context:\n${contextDescription}\n\nCharacter Name: ${airiCardStore.activeCard?.name || 'Companion'}`

    const messages: { role: 'system' | 'user', content: string }[] = [
      {
        role: 'system',
        content: systemPromptContent,
      },
    ]

    const existingText = activeValue.value
    if (existingText) {
      messages.push({
        role: 'user',
        content: `Here is the existing prompt instruction:\n${existingText}`,
      })
    }

    let userPrompt = isRefining && customInstructions.value.trim()
      ? `Please refine the previous output according to these additional instructions: "${customInstructions.value.trim()}".`
      : 'Generate optimized acting system instructions.'

    if (existingText && !isRefining) {
      userPrompt += '\n\nMake sure to keep the core of the existing instructions and build on them, but optimize formatting and tags compliance.'
    }
    userPrompt += '\n\nPlease output only the optimized raw text. Do not wrap in markdown code blocks. Do not include introductory or concluding conversational text.'

    messages.push({
      role: 'user',
      content: userPrompt,
    })

    const llmResponse = await llmStore.generate(modelId, activeProvider, messages)
    const resultText = llmResponse.text?.trim() || ''

    if (resultText) {
      customInstructions.value = ''
      history.value.push(resultText)
      historyIndex.value = history.value.length - 1
    }
    else {
      throw new Error('Empty response received from LLM.')
    }
  }
  catch (err: any) {
    errorMessage.value = err.message || 'An error occurred during prompt generation.'
    console.error('[ModelPromptGeneratorModal] Generation failed:', err)
  }
  finally {
    loading.value = false
  }
}

function handleSave() {
  if (activeValue.value) {
    emit('save', activeValue.value)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[101] max-h-[90vh] max-w-4xl w-[92vw] flex flex-col border border-neutral-200 rounded-xl bg-white p-5 shadow-xl -translate-x-1/2 -translate-y-1/2 dark:border-neutral-700 dark:bg-neutral-800">
        <DialogTitle class="text-lg text-neutral-800 font-bold dark:text-neutral-200">
          Generate Acting Instructions
        </DialogTitle>

        <p class="mt-1 text-xs text-neutral-500">
          AI will write instructions directing how your model triggers emotions/motions during chat responses, customized to the visible elements below.
        </p>

        <!-- Main Workspace -->
        <div class="mt-4 min-h-0 flex flex-1 flex-col gap-4 overflow-y-auto">
          <!-- Text Editor Area -->
          <div class="relative min-h-[220px] flex flex-1 flex-col border border-neutral-200 rounded-lg bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-950">
            <textarea
              v-model="activeValue"
              class="w-full flex-1 border-none bg-transparent p-1 text-xs font-mono dark:text-neutral-100 focus:outline-none focus:ring-0"
              placeholder="System instructions will generate here..."
              :disabled="loading"
            />
            <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-white/70 dark:bg-neutral-900/70">
              <div class="i-solar:spinner-bold animate-spin text-2xl text-primary-500" />
              <span class="mt-2 text-xs text-neutral-500">Generating prompt directives...</span>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="rounded bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
            {{ errorMessage }}
          </div>

          <!-- Refining / Refinement Controls -->
          <div class="flex gap-2">
            <input
              v-model="customInstructions"
              type="text"
              placeholder="e.g. Add more dramatic examples, make it shorter..."
              class="flex-1 border border-neutral-200 rounded-md bg-white px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              :disabled="loading"
              @keydown.enter="generateSuggestion(true)"
            >
            <Button
              variant="secondary"
              label="Refine"
              :disabled="loading || !customInstructions.trim()"
              @click="generateSuggestion(true)"
            />
          </div>
        </div>

        <!-- Footer / Action bar -->
        <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-700">
          <div class="flex gap-2">
            <Button
              variant="secondary"
              icon="i-solar:undo-left-bold-duotone"
              :disabled="loading || historyIndex <= 0"
              @click="historyIndex--"
            />
            <Button
              variant="secondary"
              icon="i-solar:undo-right-bold-duotone"
              :disabled="loading || historyIndex >= history.length - 1"
              @click="historyIndex++"
            />
          </div>

          <div class="flex gap-2">
            <Button
              variant="secondary"
              label="Cancel"
              @click="emit('update:modelValue', false)"
            />
            <Button
              variant="primary"
              label="Apply & Save"
              :disabled="loading || !activeValue"
              @click="handleSave"
            />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

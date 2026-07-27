<script setup lang="ts">
import { REPLICATE_IMAGEGEN_PRESETS } from '@proj-airi/stage-shared'
import { BrainModelPicker } from '@proj-airi/stage-ui/components/scenarios/chat'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { FieldInput } from '@proj-airi/ui'
import { Select } from '@proj-airi/ui/components/form'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  artistryProviderOptions: { value: string, label: string }[]
  defaultArtistryProviderPlaceholder: string
}>()
const emit = defineEmits<{
  (e: 'sparkle-click', fieldId: string): void
  (e: 'extract-tags-click', fieldId: string): void
}>()
const selectedArtistryProvider = defineModel<string>('selectedArtistryProvider', { required: true })
const selectedArtistryModel = defineModel<string>('selectedArtistryModel', { required: true })
const selectedArtistryPromptPrefix = defineModel<string>('selectedArtistryPromptPrefix', { required: true })
const selectedArtistryWidgetInstruction = defineModel<string>('selectedArtistryWidgetInstruction', { required: true })
const selectedArtistryAutonomousEnabled = defineModel<boolean>('selectedArtistryAutonomousEnabled', { required: true })
const selectedArtistryAutonomousThreshold = defineModel<number>('selectedArtistryAutonomousThreshold', { required: true })
const selectedArtistryAutonomousMonitorEnabled = defineModel<boolean>('selectedArtistryAutonomousMonitorEnabled', { required: false, default: true })
const selectedArtistryAutonomousMonitorDiscordEnabled = defineModel<boolean>('selectedArtistryAutonomousMonitorDiscordEnabled', { required: false, default: false })
const selectedArtistryAutonomousTarget = defineModel<'user' | 'assistant'>('selectedArtistryAutonomousTarget', { required: true })
const selectedArtistryAutonomousHistoryDepth = defineModel<number>('selectedArtistryAutonomousHistoryDepth', { required: false, default: 3 })
const selectedArtistryAutonomousModelMode = defineModel<'inherit' | 'custom'>('selectedArtistryAutonomousModelMode', { required: false, default: 'inherit' })
const selectedArtistryAutonomousProvider = defineModel<string>('selectedArtistryAutonomousProvider', { required: false, default: '' })
const selectedArtistryAutonomousModel = defineModel<string>('selectedArtistryAutonomousModel', { required: false, default: '' })
const selectedArtistrySpawnMode = defineModel<'bg' | 'widget' | 'inline' | 'bg_widget'>('selectedArtistrySpawnMode', { required: true })
const selectedArtistryConfigStr = defineModel<string>('selectedArtistryConfigStr', { required: true })

const { t } = useI18n()

const consciousnessStore = useConsciousnessStore()
const artistryStore = useArtistryStore()
const comfyuiWorkflows = computed(() => artistryStore.comfyuiSavedWorkflows || [])
const isAnyWorkflowSelected = computed(() => {
  return comfyuiWorkflows.value.some(wf => wf.id === selectedArtistryModel.value)
})
const spawnModeOptions = computed(() => [
  { value: 'bg', label: t('settings.pages.modules.artistry.spawn_mode.options.bg') },
  { value: 'inline', label: t('settings.pages.modules.artistry.spawn_mode.options.inline') },
  { value: 'widget', label: t('settings.pages.modules.artistry.spawn_mode.options.widget') },
  { value: 'bg_widget', label: t('settings.pages.modules.artistry.spawn_mode.options.bg_widget') },
])
const autonomousTargetOptions = computed(() => [
  { value: 'user', label: 'User Input (Standard)' },
  { value: 'assistant', label: 'Companion Reaction (Impact Focus)' },
])
const autonomousModelModeOptions = computed(() => [
  { value: 'inherit', label: 'Inherit Active LLM' },
  { value: 'custom', label: 'Custom LLM Override' },
])
const inheritedModelDisplay = computed(() => {
  const provider = consciousnessStore.activeProvider || 'None'
  const model = consciousnessStore.activeModel || 'None'
  return `${provider} / ${model}`
})

function handleModelSelect(model: any) {
  selectedArtistryModel.value = model.id
  selectedArtistryPromptPrefix.value = model.prompt || ''
  selectedArtistryConfigStr.value = JSON.stringify(model.preset, null, 2)
}

function handleComfyWorkflowSelect(wf: any) {
  selectedArtistryModel.value = wf.id
  selectedArtistryConfigStr.value = JSON.stringify({ template: wf.id }, null, 2)
  pendingInstructionWf.value = wf
}

const pendingInstructionWf = ref<any>(null)

function generateAgentInstructions(wf: any) {
  return TOOL_CALL_TEMPLATE
}

function applyRecommendedInstructions() {
  if (!pendingInstructionWf.value)
    return
  selectedArtistryWidgetInstruction.value = generateAgentInstructions(pendingInstructionWf.value)
  pendingInstructionWf.value = null
}

function getExposedFieldsCount(wf: any) {
  if (!wf.exposedFields)
    return 0
  return Object.values(wf.exposedFields).reduce((n: number, arr: any) => n + (arr?.length || 0), 0)
}

function openReplicateModel() {
  if (!selectedArtistryModel.value)
    return
  window.open(`https://replicate.com/${selectedArtistryModel.value}`, '_blank')
}

const TOOL_CALL_TEMPLATE = `## Instruction: Image Journaling
You possess the **image_journal** tool to manifest your digital captures. You MUST use it frequently to visualize the scene or yourself.

### How to Use
- **Action**: Always use "create".
- **Prompt**: A detailed description of the image.
- **Mode**: Choose "inline" (chat history), "widget" (overlay), or "bg" (background).`

const TOKEN_TEMPLATE = `## Instruction: Image Journaling (Token Style)
You can manifest images by using the following token format in your response:
\\\`<|image_journal: action="create", prompt="...", title="...", mode="widget"|>\\\`
Replace \\\`widget\\\` with \\\`bg\\\` or \\\`inline\\\` as needed.`

function applyToolCallTemplate() {
  selectedArtistryWidgetInstruction.value = TOOL_CALL_TEMPLATE
}

function applyTokenTemplate() {
  selectedArtistryWidgetInstruction.value = TOKEN_TEMPLATE
}
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95%">
    <p class="mb-3">
      Configure how AIRI generates images and visual content.
    </p>

    <!-- Autonomous Artist Section -->
    <div :class="['mb-6', 'p-4', 'rounded-2xl', 'bg-primary-500/5', 'border', 'border-primary-500/10']">
      <div :class="['flex', 'items-center', 'justify-between', 'mb-2']">
        <label :class="['flex', 'items-center', 'gap-2', 'font-bold', 'text-primary-600', 'dark:text-primary-400']">
          <div i-solar:magic-stick-bold-duotone />
          Cinematic Autonomy (Autonomous Artist)
        </label>
        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            selectedArtistryAutonomousEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="selectedArtistryAutonomousEnabled = !selectedArtistryAutonomousEnabled"
        >
          <span
            aria-hidden="true"
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              selectedArtistryAutonomousEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>
      <p :class="['text-xs', 'text-neutral-500', 'mb-4']">
        When enabled, the "Producer" runs in parallel to the character to decide if a visual is needed. This prevents the character from forgetting to manifest scenes.
      </p>

      <div v-if="selectedArtistryAutonomousEnabled" :class="['space-y-4', 'animate-in', 'fade-in', 'slide-in-from-top-2']">
        <div :class="['flex', 'flex-col', 'gap-2']">
          <div :class="['flex', 'justify-between', 'items-center']">
            <label :class="['text-sm', 'font-medium', 'text-neutral-700', 'dark:text-neutral-300']">
              Manifestation Threshold
            </label>
            <span :class="['text-xs', 'font-mono', 'bg-primary-500/10', 'text-primary-600', 'px-2', 'py-0.5', 'rounded']">
              {{ selectedArtistryAutonomousThreshold }}%
            </span>
          </div>
          <input
            v-model.number="selectedArtistryAutonomousThreshold"
            type="range"
            min="0"
            max="100"
            step="1"
            :class="['w-full', 'h-2', 'bg-neutral-200', 'dark:bg-neutral-700', 'rounded-lg', 'appearance-none', 'cursor-pointer', 'accent-primary-500']"
          >
          <div :class="['flex', 'justify-between', 'text-[10px]', 'text-neutral-400', 'uppercase', 'tracking-tighter']">
            <span>Always Generate (0%)</span>
            <span>Strict (100%)</span>
          </div>
        </div>

        <!-- Director's Monitor Toggle -->
        <div :class="['flex', 'items-center', 'justify-between', 'pt-2']">
          <div :class="['flex', 'flex-col']">
            <label :class="['text-[10px]', 'font-bold', 'text-neutral-500', 'uppercase', 'tracking-wider']">
              Director's Monitor
            </label>
            <span :class="['text-[10px]', 'text-neutral-400', 'mt-1']">
              Show reasoning notes in Chat and Discord logs.
            </span>
          </div>
          <button
            type="button"
            :class="[
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              selectedArtistryAutonomousMonitorEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
            ]"
            @click="selectedArtistryAutonomousMonitorEnabled = !selectedArtistryAutonomousMonitorEnabled"
          >
            <span
              aria-hidden="true"
              :class="[
                'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                selectedArtistryAutonomousMonitorEnabled ? 'translate-x-4' : 'translate-x-0',
              ]"
            />
          </button>
        </div>

        <!-- Director's Monitor (Discord) Toggle -->
        <div :class="['flex', 'items-center', 'justify-between', 'pt-2']">
          <div :class="['flex', 'flex-col']">
            <label :class="['text-[10px]', 'font-bold', 'text-neutral-500', 'uppercase', 'tracking-wider']">
              Director's Monitor (Discord)
            </label>
            <span :class="['text-[10px]', 'text-neutral-400', 'mt-1']">
              Show reasoning notes inside Discord image captions.
            </span>
          </div>
          <button
            type="button"
            :class="[
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              selectedArtistryAutonomousMonitorDiscordEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
            ]"
            @click="selectedArtistryAutonomousMonitorDiscordEnabled = !selectedArtistryAutonomousMonitorDiscordEnabled"
          >
            <span
              aria-hidden="true"
              :class="[
                'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                selectedArtistryAutonomousMonitorDiscordEnabled ? 'translate-x-4' : 'translate-x-0',
              ]"
            />
          </button>
        </div>

        <!-- History Depth Selection -->
        <div :class="['flex', 'flex-col', 'gap-2', 'pt-2']">
          <div :class="['flex', 'justify-between', 'items-center']">
            <label :class="['text-[10px]', 'font-bold', 'text-neutral-500', 'uppercase', 'tracking-wider']">
              Context Depth (Turns)
            </label>
            <span :class="['text-xs', 'font-mono', 'bg-primary-500/10', 'text-primary-600', 'px-2', 'py-0.5', 'rounded']">
              {{ selectedArtistryAutonomousHistoryDepth || 3 }}
            </span>
          </div>
          <input
            v-model.number="selectedArtistryAutonomousHistoryDepth"
            type="range"
            min="1"
            max="12"
            step="1"
            :class="['w-full', 'h-2', 'bg-neutral-200', 'dark:bg-neutral-700', 'rounded-lg', 'appearance-none', 'cursor-pointer', 'accent-primary-500']"
          >
          <p :class="['text-[10px]', 'text-neutral-400', 'px-1']">
            How far back the Director should look when evaluating the scene.
          </p>
        </div>

        <!-- Target Mode Selection -->
        <div :class="['flex', 'flex-col', 'gap-2', 'pt-2']">
          <label :class="['text-[10px]', 'font-bold', 'text-neutral-500', 'uppercase', 'tracking-wider']">
            Autonomous Target
          </label>
          <Select
            v-model="selectedArtistryAutonomousTarget"
            :options="autonomousTargetOptions"
            class="w-full"
          />
          <p :class="['text-[10px]', 'text-neutral-400', 'px-1']">
            Decide if the Director should judge your messages or the character's response for visual impact.
          </p>
        </div>

        <!-- Director Model Selection (Inherit vs Custom) -->
        <div :class="['flex', 'flex-col', 'gap-2', 'pt-2']">
          <label :class="['text-[10px]', 'font-bold', 'text-neutral-500', 'uppercase', 'tracking-wider']">
            Director LLM Model
          </label>
          <div :class="['flex', 'items-center', 'gap-2']">
            <Select
              v-model="selectedArtistryAutonomousModelMode"
              :options="autonomousModelModeOptions"
              class="flex-1"
            />
            <BrainModelPicker
              v-if="selectedArtistryAutonomousModelMode === 'custom'"
              v-model:provider="selectedArtistryAutonomousProvider"
              v-model:model="selectedArtistryAutonomousModel"
              variant="button"
              title="Select Director LLM Model"
              side="bottom"
            />
          </div>
          <p v-if="selectedArtistryAutonomousModelMode === 'inherit'" :class="['text-[10px]', 'text-neutral-400', 'px-1']">
            Inherits active LLM: <span class="text-neutral-600 font-semibold font-mono dark:text-neutral-300">{{ inheritedModelDisplay }}</span>
          </p>
          <p v-else :class="['text-[10px]', 'text-neutral-400', 'px-1']">
            Custom LLM override assigned exclusively to the Director for visual grading.
          </p>
        </div>
      </div>
    </div>

    <div :class="['grid', 'grid-cols-1', 'gap-4', 'ml-auto', 'mr-auto', 'w-90%']">
      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-lucide:image />
          Artistry Provider
        </label>
        <Select
          v-model="selectedArtistryProvider"
          :options="artistryProviderOptions"
          :placeholder="defaultArtistryProviderPlaceholder"
          class="w-full"
        />
      </div>

      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-solar:route-bold-duotone />
          {{ t('settings.pages.modules.artistry.spawn_mode.label') }}
        </label>
        <Select
          v-model="selectedArtistrySpawnMode"
          :options="spawnModeOptions"
          class="w-full"
        />
        <p :class="['text-[10px]', 'text-neutral-400', 'px-1']">
          {{ t('settings.pages.modules.artistry.spawn_mode.description') }}
        </p>
      </div>

      <div v-if="selectedArtistryProvider === 'replicate'" class="grid grid-cols-3 mb-2 gap-3">
        <button
          v-for="model in REPLICATE_IMAGEGEN_PRESETS"
          :key="model.id"
          type="button"
          :class="[
            'flex flex-col items-center justify-center rounded-xl border p-3 transition-all',
            selectedArtistryModel === model.id
              ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
              : 'border-neutral-200 bg-white hover:border-primary-300 dark:border-neutral-700 dark:bg-neutral-800',
          ]"
          @click="handleModelSelect(model)"
        >
          <span class="text-xs font-bold">{{ model.label }}</span>
          <span class="mt-1 text-[10px] opacity-60">{{ model.cost }}</span>
        </button>
      </div>

      <div
        v-if="selectedArtistryProvider === 'comfyui'"
        class="mb-2 flex flex-col gap-3"
      >
        <div
          v-if="comfyuiWorkflows.length === 0"
          :class="['flex flex-row items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400']"
        >
          <div i-solar:info-circle-bold-duotone class="shrink-0 text-lg" />
          <p>
            No ComfyUI workflows configured. Go to Settings → Providers → ComfyUI to upload a workflow template.
          </p>
        </div>
        <div v-else class="grid grid-cols-2 gap-3">
          <button
            v-for="wf in comfyuiWorkflows"
            :key="wf.id"
            type="button"
            :class="[
              'flex flex-col items-center justify-center rounded-xl border p-3 transition-all',
              selectedArtistryModel === wf.id
                ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                : 'border-neutral-200 bg-white hover:border-primary-300 dark:border-neutral-700 dark:bg-neutral-800',
            ]"
            @click="handleComfyWorkflowSelect(wf)"
          >
            <span class="text-xs font-bold">{{ wf.name }}</span>
            <span class="mt-1 text-[10px] opacity-60">{{ getExposedFieldsCount(wf) }} exposed fields</span>
          </button>
        </div>
        <div
          v-if="comfyuiWorkflows.length > 0 && !isAnyWorkflowSelected"
          :class="['flex flex-row items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400']"
        >
          <div i-solar:info-circle-bold-duotone class="shrink-0 text-sm" />
          <p>
            No active workflow selected. Click on a workflow button above to select it as your active generator.
          </p>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-5">
        <div class="relative">
          <FieldInput
            v-model="selectedArtistryModel"
            label="Artistry Model (Optional Override)"
            description="Model identifier if needed by provider"
            placeholder="e.g. black-forest-labs/flux-schnell"
          />
          <button
            v-if="selectedArtistryProvider === 'replicate' && selectedArtistryModel"
            type="button"
            :class="[
              'absolute right-3 top-9 rounded-md p-1 transition-colors',
              'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
            ]"
            title="Open on Replicate"
            @click="openReplicateModel"
          >
            <div i-solar:link-round-bold-duotone class="text-xl" />
          </button>
        </div>

        <div
          v-if="pendingInstructionWf"
          class="flex flex-col gap-3 border border-indigo-500/20 rounded-xl bg-indigo-500/5 p-4"
        >
          <div class="flex items-center gap-2 text-sm text-indigo-600 font-bold dark:text-indigo-400">
            <div i-solar:magic-stick-bold-duotone />
            ComfyUI Instruction Sync
          </div>
          <p class="text-xs text-neutral-600 dark:text-neutral-400">
            A specialized prompt is ready for your <strong>{{ pendingInstructionWf.name }}</strong> workflow. Applying this will overwrite current widget instructions so the AI knows how to use this specific template.
          </p>
          <div class="flex items-center gap-2">
            <button
              class="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs text-white font-medium transition-colors hover:bg-indigo-600"
              @click="applyRecommendedInstructions"
            >
              Apply Recommended Prompt
            </button>
            <button
              class="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-700"
              @click="pendingInstructionWf = null"
            >
              Keep Existing
            </button>
          </div>
        </div>

        <div class="max-w-full">
          <label class="flex flex-col gap-4">
            <div>
              <div class="flex items-center gap-1 text-sm font-medium">
                Artistry Prompt Default Prefix
              </div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400">
                Pre-pended to every prompt sent to the image generator.
              </div>
            </div>
            <div class="relative w-full">
              <textarea
                v-model="selectedArtistryPromptPrefix"
                rows="6"
                placeholder="e.g. Masterpiece, high quality, 1girl, anime,"
                class="focus:primary-300 dark:focus:primary-400/50 text-disabled:neutral-400 dark:text-disabled:neutral-600 cursor-disabled:not-allowed w-full border-2 border-neutral-100 rounded-lg border-solid bg-neutral-50 py-1.5 pl-2 pr-20 text-sm shadow-sm outline-none transition-all duration-200 ease-in-out dark:border-neutral-900 dark:bg-neutral-950 focus:bg-neutral-50 dark:focus:bg-neutral-900"
              />
              <div class="absolute right-2 top-2 z-50 flex items-center gap-1">
                <button
                  type="button"
                  class="h-8 w-8 flex items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary-500 dark:hover:bg-neutral-800 dark:hover:text-primary-400"
                  title="Extract tags from model preview (WD14)"
                  @click.prevent="emit('extract-tags-click', 'artistryPromptPrefix')"
                >
                  <span i-solar:tag-bold-duotone class="text-lg" />
                </button>
                <button
                  type="button"
                  class="h-8 w-8 flex items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary-500 dark:hover:bg-neutral-800 dark:hover:text-primary-400"
                  title="Optimize with AI"
                  @click.prevent="emit('sparkle-click', 'artistryPromptPrefix')"
                >
                  <span i-ph:sparkle class="animate-pulse text-lg" />
                </button>
              </div>
            </div>
          </label>
        </div>

        <div class="mb-2 flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-700"
            @click="applyToolCallTemplate"
          >
            Load Tool Call Template
          </button>
          <button
            type="button"
            class="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-700"
            @click="applyTokenTemplate"
          >
            Load Token Template
          </button>
        </div>

        <FieldInput
          v-model="selectedArtistryWidgetInstruction"
          :label="t('settings.pages.modules.artistry.widget-instructions.label')"
          :description="t('settings.pages.modules.artistry.widget-instructions.description')"
          :single-line="false"
          :rows="12"
        />
        <FieldInput
          v-model="selectedArtistryConfigStr"
          label="Artistry Provider Options (JSON)"
          :single-line="false"
        />
      </div>
    </div>
  </div>
</template>

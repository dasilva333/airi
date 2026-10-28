<script setup lang="ts">
import { FieldCheckbox } from '@proj-airi/ui'
import { computed, ref, watch } from 'vue'

import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../stores/providers'

export interface FavoriteModel {
  id: string
  name: string
  provider: string
  model: string
  serverWebSearch?: boolean
  options?: Record<string, unknown>
}

const props = defineProps<{
  open: boolean
  favorite?: FavoriteModel | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: {
    id?: string
    name: string
    provider: string
    model: string
    serverWebSearch?: boolean
    options?: Record<string, unknown>
  }): void
}>()

const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()

// Form fields
const label = ref('')
const provider = ref('')
const model = ref('')
const serverWebSearch = ref(false)
const optionsJson = ref('{}')
const showExampleDropdown = ref(false)

// Providers list & models discovery
const configuredProviderOptions = computed(() => providersStore.configuredChatProviderOptions)
const availableModels = ref<{ id: string, name?: string }[]>([])
const isLoadingModels = ref(false)
const isManualModel = ref(false)

// JSON validation status
const jsonError = ref<string | null>(null)
const parsedJson = computed(() => {
  const trimmed = optionsJson.value.trim()
  if (!trimmed)
    return {}
  try {
    const val = JSON.parse(trimmed)
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      return val
    }
    return null
  }
  catch {
    return null
  }
})

const isValidJson = computed(() => parsedJson.value !== null)

watch(optionsJson, (val) => {
  const trimmed = val.trim()
  if (!trimmed) {
    jsonError.value = null
    return
  }
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      jsonError.value = 'Options must be a JSON object'
    }
    else {
      jsonError.value = null
    }
  }
  catch (e: any) {
    jsonError.value = e?.message || 'Invalid JSON syntax'
  }
})

// Line numbers generation for code view
const lineNumbers = computed(() => {
  const lines = optionsJson.value.split('\n').length
  return Array.from({ length: Math.max(lines, 6) }, (_, i) => i + 1)
})

// Sync form on open / edit
watch(() => [props.open, props.favorite], ([isOpen]) => {
  if (isOpen) {
    showExampleDropdown.value = false
    if (props.favorite) {
      label.value = props.favorite.name || ''
      provider.value = props.favorite.provider || ''
      model.value = props.favorite.model || ''
      serverWebSearch.value = props.favorite.serverWebSearch ?? false
      optionsJson.value = props.favorite.options ? JSON.stringify(props.favorite.options, null, 2) : '{\n  \n}'
    }
    else {
      label.value = ''
      provider.value = configuredProviderOptions.value[0]?.value || ''
      model.value = ''
      serverWebSearch.value = false
      optionsJson.value = '{\n  \n}'
    }
  }
}, { immediate: true })

// Fetch discovered models when provider changes
watch(provider, async (prov) => {
  if (!prov) {
    availableModels.value = []
    isManualModel.value = false
    return
  }
  const currentSelectedModel = model.value
  isLoadingModels.value = true
  try {
    await consciousnessStore.loadModelsForProvider(prov)
    const raw = providersStore.getModelsForProvider(prov)
    availableModels.value = [...raw].sort((a, b) => {
      const nameA = (a.name || a.id.split('/').pop() || a.id).toLowerCase()
      const nameB = (b.name || b.id.split('/').pop() || b.id).toLowerCase()
      return nameA.localeCompare(nameB)
    })
    isManualModel.value = availableModels.value.length === 0
    // Restore model if it was already selected
    if (currentSelectedModel) {
      model.value = currentSelectedModel
    }
  }
  catch {
    availableModels.value = []
    isManualModel.value = true
  }
  finally {
    isLoadingModels.value = false
  }
}, { immediate: true })

// Presets (Including the 3 thinking presets from CardCreationTabGeneration)
interface PresetItem {
  title: string
  subtitle: string
  payload: Record<string, unknown>
}

const PRESET_GROUPS: { group: string, items: PresetItem[] }[] = [
  {
    group: 'THINKING · CONTRACT EXAMPLES',
    items: [
      {
        title: 'Disable thinking',
        subtitle: 'thinking.type: "disabled"',
        payload: {
          thinking: { type: 'disabled' },
        },
      },
      {
        title: 'Disable thinking (variants)',
        subtitle: 'variants.off.disabled: true',
        payload: {
          variants: {
            thinking: { reasoningEffort: 'high' },
            fast: { reasoningEffort: 'low' },
            off: { disabled: true },
          },
        },
      },
      {
        title: 'Lower reasoning effort',
        subtitle: 'reasoningEffort: "low"',
        payload: {
          reasoningEffort: 'low',
        },
      },
    ],
  },
  {
    group: 'SAMPLING',
    items: [
      {
        title: 'More focused · 0.7',
        subtitle: 'temperature: 0.7',
        payload: { temperature: 0.7 },
      },
      {
        title: 'More varied · 1.0',
        subtitle: 'temperature: 1.0',
        payload: { temperature: 1.0 },
      },
      {
        title: 'Narrower sampling · 0.9',
        subtitle: 'top_p: 0.9',
        payload: { top_p: 0.9 },
      },
    ],
  },
  {
    group: 'OUTPUT LIMIT',
    items: [
      {
        title: 'Shorter cap · 512 tokens',
        subtitle: 'max_tokens: 512',
        payload: { max_tokens: 512 },
      },
      {
        title: 'Larger cap · 2,048 tokens',
        subtitle: 'max_tokens: 2048',
        payload: { max_tokens: 2048 },
      },
    ],
  },
  {
    group: 'HOSTED TOOLS',
    items: [
      {
        title: 'OpenRouter Web Search',
        subtitle: 'tools: openrouter:web_search',
        payload: {
          tools: [{ type: 'openrouter:web_search' }],
        },
      },
      {
        title: 'OpenRouter Web Fetch',
        subtitle: 'tools: openrouter:web_fetch',
        payload: {
          tools: [{ type: 'openrouter:web_fetch' }],
        },
      },
      {
        title: 'Anthropic / OpenCode Web Search',
        subtitle: 'tools: web_search_20260209',
        payload: {
          tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        },
      },
    ],
  },
]

function insertPreset(payload: Record<string, unknown>) {
  showExampleDropdown.value = false
  try {
    const existing = parsedJson.value || {}
    const merged = { ...existing, ...payload }
    optionsJson.value = JSON.stringify(merged, null, 2)
  }
  catch {
    optionsJson.value = JSON.stringify(payload, null, 2)
  }
}

function formatJson() {
  if (parsedJson.value) {
    optionsJson.value = JSON.stringify(parsedJson.value, null, 2)
  }
}

function handleSave() {
  if (!model.value.trim() || !isValidJson.value)
    return
  const modelId = model.value.trim()
  const displayName = label.value.trim() || modelId.split('/').pop() || modelId

  emit('save', {
    id: props.favorite?.id,
    name: displayName,
    provider: provider.value,
    model: modelId,
    serverWebSearch: serverWebSearch.value,
    options: parsedJson.value && Object.keys(parsedJson.value).length > 0 ? parsedJson.value : undefined,
  })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        :class="[
          'fixed inset-0 z-[10020] p-4',
          'flex items-center justify-center',
          'bg-neutral-900/40 dark:bg-black/70 backdrop-blur-sm',
        ]"
        @click.self="$emit('close')"
      >
        <div
          :class="[
            'relative max-h-[90vh] max-w-xl w-full',
            'flex flex-col overflow-hidden',
            'rounded-2xl shadow-2xl backdrop-blur-xl',
            'border border-neutral-200/80 dark:border-neutral-800',
            'bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100',
          ]"
          @click="showExampleDropdown = false"
        >
          <!-- Header -->
          <div
            :class="[
              'flex items-start justify-between px-6 py-4.5',
              'border-b border-neutral-200/80 dark:border-neutral-800/80',
            ]"
          >
            <div class="flex flex-col">
              <h2 class="text-base text-neutral-900 font-bold dark:text-neutral-100">
                {{ favorite ? 'Edit favorite' : 'Add favorite' }}
              </h2>
              <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Save a model and its request options together.
              </p>
            </div>
            <button
              type="button"
              :class="[
                'cursor-pointer rounded-lg p-1 text-neutral-400 transition-colors',
                'hover:bg-neutral-100 hover:text-neutral-700',
                'dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
              ]"
              @click="$emit('close')"
            >
              <div class="i-solar:close-circle-bold size-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin space-y-4">
            <!-- Label -->
            <div class="space-y-1.5">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">Label</label>
              <input
                v-model="label"
                type="text"
                placeholder="e.g. maika · quick chat"
                :class="[
                  'w-full px-3 py-2 text-xs',
                  'rounded-xl outline-none transition-all',
                  'border border-neutral-300/80 dark:border-neutral-700/80',
                  'bg-neutral-50 dark:bg-neutral-800/60',
                  'text-neutral-900 dark:text-neutral-100',
                  'placeholder-neutral-400 dark:placeholder-neutral-500',
                  'focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20',
                ]"
              >
            </div>

            <!-- Provider & Model Dual Column -->
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <!-- Provider -->
              <div class="space-y-1.5">
                <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">Provider</label>
                <div class="relative">
                  <select
                    v-model="provider"
                    :class="[
                      'w-full appearance-none px-3 py-2 pr-8 text-xs',
                      'rounded-xl outline-none transition-all',
                      'border border-neutral-300/80 dark:border-neutral-700/80',
                      'bg-neutral-50 dark:bg-neutral-800/60',
                      'text-neutral-900 dark:text-neutral-100',
                      'focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20',
                    ]"
                  >
                    <option
                      v-for="prov in configuredProviderOptions"
                      :key="prov.value"
                      :value="prov.value"
                      class="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      {{ prov.label }}
                    </option>
                  </select>
                  <div class="i-solar:alt-arrow-down-linear pointer-events-none absolute right-3 top-1/2 size-3.5 text-neutral-400 -translate-y-1/2 dark:text-neutral-500" />
                </div>
              </div>

              <!-- Model -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">Model</label>
                  <button
                    v-if="availableModels.length > 0"
                    type="button"
                    :class="[
                      'cursor-pointer text-[10px] font-medium transition-colors hover:underline',
                      'text-primary-600 dark:text-primary-400',
                    ]"
                    @click="isManualModel = !isManualModel"
                  >
                    {{ isManualModel ? 'Choose from list' : 'Manual ID' }}
                  </button>
                </div>

                <div class="relative">
                  <div class="i-solar:magnifer-linear pointer-events-none absolute left-3 top-1/2 size-3.5 text-neutral-400 -translate-y-1/2 dark:text-neutral-500" />

                  <!-- Manual input -->
                  <input
                    v-if="isManualModel || (!isLoadingModels && availableModels.length === 0)"
                    v-model="model"
                    type="text"
                    placeholder="e.g. deepseek/deepseek-v4-flash"
                    :class="[
                      'w-full py-2 pl-8 pr-3 text-xs',
                      'rounded-xl outline-none transition-all',
                      'border border-neutral-300/80 dark:border-neutral-700/80',
                      'bg-neutral-50 dark:bg-neutral-800/60',
                      'text-neutral-900 dark:text-neutral-100',
                      'placeholder-neutral-400 dark:placeholder-neutral-500',
                      'focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20',
                    ]"
                  >

                  <!-- Discovered dropdown -->
                  <select
                    v-else
                    v-model="model"
                    :class="[
                      'w-full appearance-none py-2 pl-8 pr-8 text-xs',
                      'rounded-xl outline-none transition-all',
                      'border border-neutral-300/80 dark:border-neutral-700/80',
                      'bg-neutral-50 dark:bg-neutral-800/60',
                      'text-neutral-900 dark:text-neutral-100',
                      'focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20',
                    ]"
                    :disabled="isLoadingModels"
                  >
                    <option
                      v-if="!model"
                      value=""
                      disabled
                      class="bg-white text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500"
                    >
                      {{ isLoadingModels ? 'Loading models...' : 'Select a model' }}
                    </option>
                    <!-- If currently selected model is not in discovered list, preserve it as an option so it does not disappear -->
                    <option
                      v-if="model && !availableModels.some(m => m.id === model)"
                      :value="model"
                      class="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      {{ model }} (Current)
                    </option>
                    <option
                      v-for="m in availableModels"
                      :key="m.id"
                      :value="m.id"
                      class="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      {{ m.name || m.id.split('/').pop() || m.id }}
                    </option>
                  </select>
                  <div v-if="!isManualModel" class="i-solar:alt-arrow-down-linear pointer-events-none absolute right-3 top-1/2 size-3.5 text-neutral-400 -translate-y-1/2 dark:text-neutral-500" />
                </div>
              </div>
            </div>

            <!-- Hosted Server-Side Web Search Toggle -->
            <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/70 p-3 transition-colors dark:border-neutral-800/80 dark:bg-neutral-800/30">
              <FieldCheckbox
                v-model="serverWebSearch"
                label="Enable Hosted Web Search"
                description="Permits this brain preset to execute server-side web grounding directly on provider GPU infrastructure (OpenRouter / DeepSeek). Gated by character permissions."
              />
            </div>

            <!-- Request Options · JSON Section -->
            <div class="pt-2">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs text-neutral-900 font-bold dark:text-neutral-200">
                    Request options &bull; JSON
                  </h3>
                  <p class="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Start with an example or edit the JSON directly.
                  </p>
                </div>

                <!-- Insert Example Dropdown -->
                <div class="relative" @click.stop>
                  <button
                    type="button"
                    :class="[
                      'flex cursor-pointer items-center gap-1.5',
                      'border border-primary-500/30 rounded-lg bg-primary-500/10 px-2.5 py-1 text-xs',
                      'text-primary-600 font-medium transition-all hover:bg-primary-500/20 dark:text-primary-400',
                    ]"
                    @click="showExampleDropdown = !showExampleDropdown"
                  >
                    <span>Insert example</span>
                    <div class="i-solar:alt-arrow-down-linear size-3" />
                  </button>

                  <!-- Popover list -->
                  <div
                    v-if="showExampleDropdown"
                    :class="[
                      'absolute right-0 top-full z-50 mt-1.5',
                      'max-h-80 w-64 overflow-y-auto p-1.5 space-y-2',
                      'border border-neutral-200/90 rounded-xl shadow-2xl backdrop-blur-xl',
                      'bg-white/98 text-neutral-900 dark:border-neutral-700/80 dark:bg-neutral-900/98 dark:text-neutral-100',
                    ]"
                  >
                    <div v-for="grp in PRESET_GROUPS" :key="grp.group" class="space-y-0.5">
                      <div class="px-2 pt-1 text-[9px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
                        {{ grp.group }}
                      </div>
                      <button
                        v-for="item in grp.items"
                        :key="item.title"
                        type="button"
                        :class="[
                          'w-full flex flex-col cursor-pointer rounded-lg px-2 py-1.5 text-left transition-colors',
                          'hover:bg-primary-500/10 dark:hover:bg-primary-500/15',
                        ]"
                        @click="insertPreset(item.payload)"
                      >
                        <span class="text-xs text-neutral-800 font-medium dark:text-neutral-200">{{ item.title }}</span>
                        <span class="text-[10px] text-neutral-500 font-mono dark:text-neutral-400">{{ item.subtitle }}</span>
                      </button>
                    </div>

                    <div class="border-t border-neutral-200 px-2 pt-1 text-[9px] text-neutral-400 italic dark:border-neutral-800 dark:text-neutral-500">
                      Support and effects vary by model.
                    </div>
                  </div>
                </div>
              </div>

              <!-- JSON Editor Block -->
              <div
                :class="[
                  'relative mt-2 flex text-xs font-mono rounded-xl border transition-colors',
                  'border-neutral-300/80 bg-neutral-100/70',
                  'dark:border-neutral-700/80 dark:bg-neutral-950',
                ]"
              >
                <!-- Line Numbers -->
                <div class="select-none py-2.5 pl-3 pr-2 text-right text-neutral-400 leading-5 space-y-0 dark:text-neutral-600">
                  <div v-for="n in lineNumbers" :key="n" class="h-5">
                    {{ n }}
                  </div>
                </div>

                <!-- Textarea -->
                <textarea
                  v-model="optionsJson"
                  rows="7"
                  :class="[
                    'flex-1 resize-none bg-transparent py-2.5 pl-1 pr-3 leading-5 outline-none scrollbar-thin',
                    'text-neutral-900 placeholder-neutral-400',
                    'dark:text-neutral-200 dark:placeholder-neutral-600',
                  ]"
                  placeholder="{}"
                  spellcheck="false"
                />
              </div>

              <!-- JSON Status & Format Button -->
              <div class="mt-1.5 flex items-center justify-between text-[11px]">
                <div class="flex items-center gap-1.5">
                  <span
                    class="size-2 rounded-full"
                    :class="isValidJson ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'"
                  />
                  <span :class="isValidJson ? 'text-neutral-600 dark:text-neutral-300' : 'text-red-600 dark:text-red-400 font-medium'">
                    {{ isValidJson ? 'Valid JSON' : (jsonError || 'Invalid JSON') }}
                  </span>
                </div>

                <div class="flex items-center gap-3">
                  <span class="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Examples merge into your JSON.
                  </span>
                  <button
                    v-if="isValidJson"
                    type="button"
                    :class="[
                      'cursor-pointer text-primary-600 font-medium transition-colors hover:underline',
                      'dark:text-primary-400',
                    ]"
                    @click="formatJson"
                  >
                    Format JSON
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            :class="[
              'flex items-center justify-between px-6 py-3.5',
              'border-t border-neutral-200/80 bg-neutral-50/80',
              'dark:border-neutral-800/80 dark:bg-neutral-900/60',
            ]"
          >
            <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
              Saved with this favorite.
            </span>

            <div class="flex items-center gap-2">
              <button
                type="button"
                :class="[
                  'cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all',
                  'border border-neutral-300/80 text-neutral-700 hover:bg-neutral-100',
                  'dark:border-neutral-700/80 dark:text-neutral-300 dark:hover:bg-neutral-800',
                ]"
                @click="$emit('close')"
              >
                Cancel
              </button>
              <button
                type="button"
                :class="[
                  'cursor-pointer rounded-xl px-4 py-1.5 text-xs text-white font-semibold transition-all',
                  'bg-primary-500 hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-400',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                ]"
                :disabled="!model.trim() || !isValidJson"
                @click="handleSave"
              >
                Save favorite
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.scrollbar-thin {
  scrollbar-width: thin;
}
.scrollbar-thin::-webkit-scrollbar {
  width: 5px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.25);
  border-radius: 9999px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.45);
}
</style>

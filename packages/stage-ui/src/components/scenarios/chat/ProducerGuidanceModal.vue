<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { DEFAULT_SYSTEM_PROMPT_TEMPLATE } from '../../../composables/use-producer'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import { useAiriCardStore } from '../../../stores/modules/airi-card'

const props = defineProps<{
  modelValue: boolean
  characterName: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: { guidance: string, contextDepth: number, count: number, shortReplies: boolean }): void
  (e: 'openUserProfile'): void
}>()

const chatSessionStore = useChatSessionStore()
const airiCardStore = useAiriCardStore()

const guidance = ref('')
const contextDepth = useLocalStorage('airi:producer:context-depth', 6)
const autoSend = useLocalStorage('airi:producer:auto-send', true)
const autoPlayAll = useLocalStorage('airi:producer:auto-play-all', true)
const suggestionCount = useLocalStorage('airi:producer:suggestion-count', 2)
const shortReplies = useLocalStorage('airi:producer:short-replies', true)

const cacheAligned = useLocalStorage('airi:producer:cache-aligned', true)
const showPromptEditor = ref(false)
const customPromptTemplate = useLocalStorage(
  computed(() => `airi:producer:system-prompt-template:${airiCardStore.activeCardId || 'global'}`),
  () => {
    const legacy = localStorage.getItem('airi:producer:system-prompt-template')
    return legacy || DEFAULT_SYSTEM_PROMPT_TEMPLATE
  },
)

const boundaryMessage = computed(() => {
  const sessionId = chatSessionStore.activeSessionId
  if (!sessionId)
    return ''
  const messages = chatSessionStore.sessionMessages[sessionId]
  if (!messages || messages.length === 0)
    return ''
  const index = messages.length - contextDepth.value
  if (index < 0)
    return ''
  const msg = messages[index]
  const role = msg.role === 'user' ? 'You' : props.characterName || 'Assistant'
  const text = (typeof msg.content === 'string' ? msg.content.slice(0, 300) : '') || ''
  return `${role}: ${text}`
})

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    guidance.value = ''
    showPromptEditor.value = false
  }
})

function close() {
  emit('update:modelValue', false)
}

function handleOpenUserProfile() {
  close()
  emit('openUserProfile')
}

function handleGenerate() {
  emit('submit', {
    guidance: guidance.value.trim(),
    contextDepth: contextDepth.value,
    count: suggestionCount.value,
    shortReplies: shortReplies.value,
  })
  close()
}

function resetTemplate() {
  customPromptTemplate.value = DEFAULT_SYSTEM_PROMPT_TEMPLATE
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      style="z-index: 999999;"
      @click.self="close"
    >
      <div
        :class="[
          'relative max-w-md w-full overflow-hidden rounded-2xl border',
          'bg-white shadow-2xl dark:bg-neutral-900 border-neutral-200/50 dark:border-neutral-700/50',
        ]"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-neutral-200/50 px-5 py-4 dark:border-neutral-700/50">
          <div class="flex items-center gap-2 text-base text-neutral-800 font-bold dark:text-neutral-100">
            <div class="i-solar:magic-stick-3-bold-duotone text-lg text-primary-500" />
            <span>{{ showPromptEditor ? 'Edit System Prompt' : 'Prompt the Producer' }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="!showPromptEditor"
              class="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              title="Edit system prompt template"
              @click="showPromptEditor = true"
            >
              <div class="i-solar:document-text-bold-duotone text-lg" />
            </button>
            <button
              class="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="close"
            >
              <div class="i-solar:close-square-outline text-lg" />
            </button>
          </div>
        </div>

        <!-- Body -->
        <div v-if="!showPromptEditor" class="max-h-[60dvh] flex flex-col gap-4 overflow-y-auto p-5">
          <!-- Guidance Textarea -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
              Direction / Style (Optional)
            </label>
            <textarea
              v-model="guidance"
              rows="3"
              placeholder="e.g. 'something teasing', 'acknowledge her feelings', 'be vulnerable'..."
              class="w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-sm text-neutral-800 outline-none transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:text-neutral-100 dark:focus:border-primary-400"
              @keydown.enter.ctrl.prevent="handleGenerate"
            />
          </div>

          <!-- Context Depth Slider -->
          <div v-if="!cacheAligned" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                Context Depth
              </label>
              <span class="rounded bg-primary-500/10 px-2 py-0.5 text-xs text-primary-500 font-bold font-mono">
                <PopoverRoot>
                  <PopoverTrigger as-child>
                    <button class="flex items-center gap-1 outline-none">
                      {{ contextDepth }} messages
                      <span class="rounded bg-primary-500/20 px-1 text-[9px] text-primary-600 font-bold leading-relaxed uppercase dark:text-primary-400">Preview</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent
                      side="top"
                      align="center"
                      class="z-50 max-w-xs border border-neutral-200 rounded-xl bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <div class="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
                        Boundary Message
                      </div>
                      <p class="mt-1.5 max-h-24 overflow-y-auto text-xs text-neutral-700 leading-relaxed dark:text-neutral-300">
                        {{ boundaryMessage || 'No messages in current session' }}
                      </p>
                      <div class="mt-2 text-[9px] text-neutral-400 italic">
                        Message #{{ chatSessionStore.activeSessionId ? (chatSessionStore.sessionMessages[chatSessionStore.activeSessionId]?.length ?? 0) - contextDepth + 1 : '—' }} from the end — inclusive of the count
                      </div>
                    </PopoverContent>
                  </PopoverPortal>
                </PopoverRoot>
              </span>
            </div>
            <input
              v-model.number="contextDepth"
              type="range"
              min="5"
              max="30"
              step="1"
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-700"
            >
            <span class="text-[10px] text-neutral-400 dark:text-neutral-500">
              How many recent messages to include as context for the dialogue generation.
            </span>
          </div>

          <!-- Suggestion Count Slider -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                Suggestions Count
              </label>
              <span class="rounded bg-primary-500/10 px-2 py-0.5 text-xs text-primary-500 font-bold font-mono">
                {{ suggestionCount }} choices
              </span>
            </div>
            <input
              v-model.number="suggestionCount"
              type="range"
              min="2"
              max="6"
              step="1"
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-700"
            >
            <span class="text-[10px] text-neutral-400 dark:text-neutral-500">
              Number of response choices to generate.
            </span>
          </div>

          <!-- Generate short replies Checkbox -->
          <label class="flex cursor-pointer select-none items-center gap-2.5 py-1">
            <input
              v-model="shortReplies"
              type="checkbox"
              class="h-4 w-4 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
            >
            <div class="flex flex-col">
              <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">Generate short replies</span>
              <span class="text-[10px] text-neutral-400 dark:text-neutral-500">Keep generated options short (1-2 sentences)</span>
            </div>
          </label>

          <!-- Auto-Send Checkbox -->
          <label class="flex cursor-pointer select-none items-center gap-2.5 py-1">
            <input
              v-model="autoSend"
              type="checkbox"
              class="h-4 w-4 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
            >
            <div class="flex flex-col">
              <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">Auto-send on click</span>
              <span class="text-[10px] text-neutral-400 dark:text-neutral-500">Immediately send the choice upon clicking it</span>
            </div>
          </label>

          <!-- Automatically Play All Checkbox -->
          <label class="flex cursor-pointer select-none items-center gap-2.5 py-1">
            <input
              v-model="autoPlayAll"
              type="checkbox"
              class="h-4 w-4 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
            >
            <div class="flex flex-col">
              <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">Automatically play all suggestions</span>
              <span class="text-[10px] text-neutral-400 dark:text-neutral-500">Play voice previews for all choices sequentially when generated</span>
            </div>
          </label>

          <!-- Cache-Aligned Full-Context Toggle -->
          <label class="flex cursor-pointer select-none items-center gap-2.5 py-1">
            <input
              v-model="cacheAligned"
              type="checkbox"
              class="h-4 w-4 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
            >
            <div class="flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">Cache-Aligned (Full Context)</span>
                <span class="rounded bg-amber-500/20 px-1 py-0.5 text-[8px] text-amber-600 font-bold leading-none dark:text-amber-400">Experimental</span>
              </div>
              <span class="text-[10px] text-neutral-400 dark:text-neutral-500">Reuse active chat cache for higher accuracy with full history</span>
            </div>
          </label>
        </div>

        <!-- Prompt template editor view -->
        <div v-else class="max-h-[60dvh] flex flex-col gap-4 overflow-y-auto p-5">
          <!-- Custom System Prompt Textarea -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
              System Prompt Template
            </label>
            <textarea
              v-model="customPromptTemplate"
              rows="10"
              class="w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-xs text-neutral-800 font-mono outline-none transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:text-neutral-100 dark:focus:border-primary-400"
            />
          </div>

          <!-- Placeholders explanation -->
          <div class="border border-neutral-200/40 rounded-xl bg-neutral-50 p-3 text-[10px] text-neutral-500 leading-normal dark:border-neutral-800/40 dark:bg-neutral-900/50 dark:text-neutral-400">
            <span class="mb-1 block font-bold tracking-wider uppercase">Supported Placeholders</span>
            <ul class="flex flex-col list-disc list-inside gap-0.5">
              <li><code class="text-primary-500 dark:text-primary-400">{count}</code>: Suggested choice options count</li>
              <li><code class="text-primary-500 dark:text-primary-400">{characterName}</code>: Active character/companion name</li>
              <li><code class="text-primary-500 dark:text-primary-400">{guidance}</code>: Guidance style string input</li>
              <li><code class="text-primary-500 dark:text-primary-400">{lengthRule}</code>: Short/long reply configuration instruction</li>
            </ul>
          </div>
        </div>

        <!-- User Profile Tip -->
        <div v-if="!showPromptEditor" class="flex items-start gap-2 border-t border-neutral-200/50 px-5 py-3 dark:border-neutral-700/50">
          <div class="i-solar:info-circle-linear mt-0.5 shrink-0 text-sm text-neutral-400" />
          <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Tip: You can configure the narrator's voice by setting up your
            <button
              class="cursor-pointer text-primary-500 font-semibold underline underline-offset-2 transition-colors hover:text-primary-400"
              @click="handleOpenUserProfile"
            >
              user's setting
            </button>.
          </p>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 border-t border-neutral-200/50 bg-neutral-50/50 px-5 py-3.5 dark:border-neutral-700/50 dark:bg-neutral-900/30">
          <template v-if="!showPromptEditor">
            <button
              class="rounded-lg px-4 py-2 text-xs text-neutral-600 font-semibold transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="close"
            >
              Cancel
            </button>
            <button
              class="rounded-lg bg-primary-500 px-4 py-2 text-xs text-white font-semibold shadow-sm transition-colors hover:bg-primary-600"
              @click="handleGenerate"
            >
              Inspire me
            </button>
          </template>
          <template v-else>
            <button
              class="mr-auto border border-neutral-200 rounded-lg px-4 py-2 text-xs text-neutral-600 font-semibold transition-colors dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="resetTemplate"
            >
              Reset to Default
            </button>
            <button
              class="rounded-lg bg-primary-500 px-4 py-2 text-xs text-white font-semibold shadow-sm transition-colors hover:bg-primary-600"
              @click="showPromptEditor = false"
            >
              Done
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

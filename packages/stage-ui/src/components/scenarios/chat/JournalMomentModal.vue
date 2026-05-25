<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { computed, ref } from 'vue'

const props = defineProps<{
  open: boolean
  messageId?: string
  messages: any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: { scope: 'all' | 'turns'; turns?: number; instructions: string }): void
}>()

const scope = ref<'all' | 'turns'>('turns')
const turns = ref(15)
const instructions = ref('')

const clickedMessageIndex = computed(() => {
  if (!props.messageId) return -1
  return props.messages.findIndex((m) => m.id === props.messageId)
})

const nthTurnTime = computed(() => {
  if (clickedMessageIndex.value === -1) return 'unknown time'
  const targetIndex = clickedMessageIndex.value - turns.value + 1
  if (targetIndex < 0) return 'the start of the conversation'
  const targetMsg = props.messages[targetIndex]
  if (!targetMsg?.createdAt) return 'unknown time'
  return formatDistanceToNow(targetMsg.createdAt, { addSuffix: true })
})

function handleSubmit() {
  emit('submit', {
    instructions: instructions.value,
    scope: scope.value,
    turns: scope.value === 'turns' ? turns.value : undefined,
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="$emit('close')"
      >
        <div
          class="animate-scale-in relative mx-4 max-h-[80vh] max-w-md w-full overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900"
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/50">
            <div class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
              <div class="i-solar:notebook-bold-duotone text-lg text-primary-500" />
              <span>Journal Moment</span>
            </div>
            <button
              class="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="$emit('close')"
            >
              <div i-solar:close-circle-bold-duotone class="text-lg" />
            </button>
          </div>

          <!-- Content -->
          <div class="max-h-[60vh] overflow-y-auto px-4 py-4 space-y-4">
            <!-- Scope Toggle -->
            <div class="space-y-2">
              <label class="text-xs text-neutral-500 font-medium dark:text-neutral-400">Context Scope</label>
              <div class="flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                <button
                  class="flex-1 rounded-md py-1.5 text-xs font-medium transition-colors"
                  :class="scope === 'all' ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
                  @click="scope = 'all'"
                >
                  All
                </button>
                <button
                  class="flex-1 rounded-md py-1.5 text-xs font-medium transition-colors"
                  :class="scope === 'turns' ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
                  @click="scope = 'turns'"
                >
                  Last Turns
                </button>
              </div>
            </div>

            <!-- All Helper Text -->
            <div v-if="scope === 'all'" class="rounded-lg bg-primary-50/50 p-3 text-xs text-primary-600 dark:bg-primary-900/10 dark:text-primary-400">
              Will show the whole conversation to the character to generate a journal entry.
            </div>

            <!-- Last Turns Controls -->
            <div v-if="scope === 'turns'" class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-20">
                  <input
                    v-model="turns"
                    type="number"
                    min="1"
                    max="100"
                    class="w-full border border-neutral-200 rounded-lg bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  >
                </div>
                <span class="text-xs text-neutral-600 dark:text-neutral-400">
                  # of turns since the message clicked to include for writing a journal
                </span>
              </div>

              <!-- Cute Time Preview -->
              <div class="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
                <div class="i-solar:clock-circle-bold-duotone" />
                <span>The {{ turns }}th message was from <span class="text-neutral-600 font-medium dark:text-neutral-300">{{ nthTurnTime }}</span></span>
              </div>
            </div>

            <!-- Instructions -->
            <div class="space-y-2">
              <label class="text-xs text-neutral-500 font-medium dark:text-neutral-400">Optional Instructions</label>
              <textarea
                v-model="instructions"
                placeholder="Explain to put emphasis on the latest moments or explain the scope of what the entry should be about..."
                class="min-h-[100px] w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs leading-relaxed dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 border-t border-neutral-200/50 px-4 py-3 dark:border-neutral-700/50">
            <button
              class="rounded-lg px-3 py-1.5 text-xs text-neutral-600 font-medium transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              @click="$emit('close')"
            >
              Cancel
            </button>
            <button
              class="rounded-lg bg-primary-500 px-3 py-1.5 text-xs text-white font-medium transition-colors hover:bg-primary-600"
              @click="handleSubmit"
            >
              Journal Moment
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}

@keyframes scale-in {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>

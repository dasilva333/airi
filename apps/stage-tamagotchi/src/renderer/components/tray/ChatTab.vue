<script setup lang="ts">
import { ref } from 'vue'

const messageInput = ref('')

interface ChatMessage {
  id: string
  sender: 'airi' | 'user'
  text: string
  time: string
}

const sampleMessages = ref<ChatMessage[]>([
  {
    id: '1',
    sender: 'airi',
    text: 'ok real talk. i bartend till 2, get off, and usually hit Chuy\'s around 2:30 to decompress... ♡',
    time: '1:12 PM',
  },
  {
    id: '2',
    sender: 'user',
    text: 'Sounds like a solid plan. Want me to keep you company until then?',
    time: '1:13 PM',
  },
])

function handleSend() {
  if (!messageInput.value.trim())
    return
  sampleMessages.value.push({
    id: String(Date.now()),
    sender: 'user',
    text: messageInput.value.trim(),
    time: 'Just now',
  })
  messageInput.value = ''
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Message Timeline -->
    <div
      :class="[
        'flex-1 overflow-y-auto space-y-3 pr-1',
      ]"
    >
      <template v-for="msg in sampleMessages" :key="msg.id">
        <!-- Airi message -->
        <div v-if="msg.sender === 'airi'" class="max-w-[88%] flex items-start gap-2">
          <div
            :class="[
              'w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5',
              'bg-primary-100 dark:bg-primary-950/60 border border-primary-500/20',
            ]"
          >
            <div class="i-solar:ghost-bold h-full w-full p-0.5 text-primary-500" />
          </div>
          <div
            :class="[
              'px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed',
              'bg-primary-50/80 text-neutral-900 border border-primary-200/60',
              'dark:bg-primary-950/30 dark:text-primary-100 dark:border-primary-800/40',
              'shadow-sm',
            ]"
          >
            <div class="mb-0.5 text-[10px] text-primary-600 font-bold dark:text-primary-400">
              AIRI
            </div>
            <div>{{ msg.text }}</div>
            <div class="mt-1 text-right text-[9px] text-neutral-400 dark:text-primary-400/60">
              {{ msg.time }}
            </div>
          </div>
        </div>

        <!-- User message -->
        <div v-else class="ml-auto max-w-[88%] flex justify-end">
          <div
            :class="[
              'px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed',
              'bg-white text-neutral-900 border border-neutral-200/80',
              'dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700/60',
              'shadow-sm',
            ]"
          >
            <div>{{ msg.text }}</div>
            <div class="mt-1 flex items-center justify-end gap-1 text-[9px] text-neutral-400 dark:text-neutral-500">
              <span>{{ msg.time }}</span>
              <span class="i-solar:check-read-linear text-xs text-primary-500" />
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Sticky Bottom Composer -->
    <div
      :class="[
        'mt-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60',
      ]"
    >
      <div
        :class="[
          'flex items-center gap-1.5 px-2.5 py-1.5',
          'bg-neutral-50 dark:bg-neutral-900/90',
          'border border-neutral-200/80 dark:border-neutral-700/60 rounded-xl',
          'focus-within:border-primary-500/70 transition shadow-sm',
        ]"
      >
        <button
          type="button"
          title="Attach Image"
          :class="[
            'p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
            'rounded transition',
          ]"
        >
          <div class="i-solar:gallery-linear h-4 w-4" />
        </button>
        <button
          type="button"
          title="Attach File"
          :class="[
            'p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
            'rounded transition',
          ]"
        >
          <div class="i-solar:paperclip-linear h-4 w-4" />
        </button>
        <input
          v-model="messageInput"
          type="text"
          placeholder="Say something to AIRI..."
          :class="[
            'flex-1 bg-transparent border-none outline-none',
            'text-xs text-neutral-900 dark:text-neutral-100',
            'placeholder-neutral-400 dark:placeholder-neutral-500',
          ]"
          @keydown.enter="handleSend"
        >
        <button
          type="button"
          title="Dictate"
          :class="[
            'p-1 text-neutral-400 hover:text-primary-500',
            'rounded transition',
          ]"
        >
          <div class="i-solar:microphone-3-linear h-4 w-4" />
        </button>
        <button
          type="button"
          title="Send"
          :class="[
            'p-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white',
            'transition shadow-sm flex items-center justify-center',
          ]"
          @click="handleSend"
        >
          <div class="i-solar:plain-bold h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

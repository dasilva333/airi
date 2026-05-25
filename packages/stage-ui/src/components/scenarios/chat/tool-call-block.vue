<script setup lang="ts">
import { Collapsible } from '@proj-airi/ui'
import { computed } from 'vue'

import { useJournalPreviewStore } from '../../../stores/journal-preview'
import { MarkdownRenderer } from '../../markdown'

const props = defineProps<{
  toolName: string
  args: string
  state?: 'executing' | 'done' | 'error'
  result?: any
}>()

const journalPreviewStore = useJournalPreviewStore()
const { openImagePreview } = journalPreviewStore

interface TextJournalArgs {
  action?: string
  title?: string
  content?: string
  query?: string
}

interface ImageJournalArgs {
  action?: string
  prompt?: string
  title?: string
  mode?: 'inline' | 'widget' | 'bg'
}

const parsedArgs = computed<TextJournalArgs | any | null>(() => {
  try {
    return JSON.parse(props.args)
  } catch {
    return null
  }
})

const isTextJournalCreate = computed(() => {
  return (
    props.toolName === 'text_journal' && parsedArgs.value?.action === 'create' && !!parsedArgs.value?.content?.trim()
  )
})

const isTextJournalSearch = computed(() => {
  return props.toolName === 'text_journal' && parsedArgs.value?.action === 'search'
})

const isImageJournalCreate = computed(() => {
  return (
    props.toolName === 'image_journal' &&
    parsedArgs.value?.action === 'create' &&
    !!(parsedArgs.value as ImageJournalArgs)?.prompt?.trim()
  )
})

const textJournalMarkdown = computed(() => {
  if (!isTextJournalCreate.value) return ''

  const title = parsedArgs.value?.title?.trim() || 'Journal Entry'
  const content = parsedArgs.value?.content?.trim() || ''
  return `# ${title}\n\n${content}`
})

const imageJournalMarkdown = computed(() => {
  if (!isImageJournalCreate.value) return ''

  const args = parsedArgs.value as ImageJournalArgs
  const title = args?.title?.trim() || 'Untitled Image'
  const prompt = args?.prompt?.trim() || ''
  const mode = args?.mode || 'inline'

  let footer = ''
  if (mode === 'bg') footer = '\n\n> **Scene Shift**: Setting this as the active background...'
  else if (mode === 'widget') footer = '\n\n> **Canvas Created**: Spawning an artistry widget for you...'
  else footer = '\n\n> **Sharing**: Sending a quick sketch to our chat history...'

  return `### ${title}\n\n*${prompt}*${footer}`
})

const imageJournalResult = computed(() => {
  if (props.toolName !== 'image_journal' || !props.result) return null
  try {
    return typeof props.result === 'string' ? JSON.parse(props.result) : props.result
  } catch {
    return null
  }
})

const formattedArgs = computed(() => {
  try {
    const parsed = JSON.parse(props.args)
    return JSON.stringify(parsed, null, 2).trim()
  } catch {
    return props.args
  }
})
</script>

<template>
  <Collapsible
    :class="[
      'bg-primary-100/40 dark:bg-primary-900/60 rounded-lg px-2 pb-2 pt-2',
      'flex flex-col gap-2 items-start',
    ]"
  >
    <template #trigger="{ visible, setVisible }">
      <button
        :class="[
          'w-full text-start',
        ]"
        @click="setVisible(!visible)"
      >
        <div
          v-if="state === 'executing'"
          i-eos-icons:loading class="mr-1 inline-block translate-y-0.5 op-50"
        />
        <div
          v-else-if="state === 'error'"
          i-ph:warning-circle-duotone class="mr-1 inline-block translate-y-0.5 text-red-500"
        />
        <div
          v-else-if="state === 'done'"
          i-ph:check-circle-duotone class="mr-1 inline-block translate-y-0.5 text-emerald-500"
        />
        <div
          v-else
          i-solar:sledgehammer-bold-duotone class="mr-1 inline-block translate-y-1 op-50"
        />
        <code>{{ toolName }}</code>
        <span v-if="state === 'error' && result" class="ml-2 text-xs text-red-500 op-80">
          ({{ result }})
        </span>
      </button>
    </template>
    <div
      :class="[
        'rounded-md p-2 w-full',
        'bg-neutral-100/80 text-sm text-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-200',
      ]"
    >
      <template v-if="isTextJournalCreate">
        <div class="mb-2 flex items-center gap-2">
          <div class="i-solar:notebook-bookmark-bold-duotone text-base text-emerald-500" />
          <div class="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
            Saved to long-term memory
          </div>
        </div>
        <MarkdownRenderer :content="textJournalMarkdown" />
      </template>

      <template v-else-if="isTextJournalSearch">
        <div class="mb-2 flex items-center gap-2">
          <div class="i-solar:magnifer-bold-duotone text-base text-primary-500" />
          <div class="rounded-full bg-primary-500/12 px-2.5 py-1 text-xs text-primary-700 dark:text-primary-300">
            Semantic Search: "{{ parsedArgs?.query }}"
          </div>
        </div>

        <div v-if="state === 'executing'" class="flex items-center gap-2 py-2 op-50">
          <div i-eos-icons:loading class="text-xs" />
          <span class="text-xs italic">Probing memory layers...</span>
        </div>

        <div v-else-if="result && Array.isArray(result)" class="mt-2 flex flex-col gap-2">
          <div v-for="entry in result" :key="entry.id" class="border-l-2 border-primary-500/30 rounded-r-md bg-primary-500/5 px-2 py-1.5">
            <div class="mb-0.5 flex items-center justify-between">
              <span class="text-[10px] font-bold tracking-tight uppercase op-50">{{ entry.title || 'Memory' }}</span>
              <span v-if="entry.createdAt" class="text-[9px] op-40">{{ new Date(entry.createdAt).toLocaleDateString() }}</span>
            </div>
            <div class="line-clamp-3 text-[13px] leading-relaxed italic op-90">
              "{{ entry.content }}"
            </div>
          </div>
          <div v-if="result.length === 0" class="py-2 text-center text-xs italic op-40">
            No semantic matches found for this query.
          </div>
        </div>
      </template>

      <template v-else-if="isImageJournalCreate">
        <div class="mb-2 flex items-center gap-2">
          <div :class="[(parsedArgs as ImageJournalArgs)?.mode === 'bg' ? 'i-solar:gallery-wide-bold-duotone text-emerald-500' : 'i-solar:camera-bold-duotone text-violet-500']" class="text-base" />
          <div
            class="rounded-full px-2.5 py-1 text-xs"
            :class="[
              (parsedArgs as ImageJournalArgs)?.mode === 'bg'
                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                : 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
            ]"
          >
            {{ (parsedArgs as ImageJournalArgs)?.mode === 'bg' ? 'Updating Scene' : 'Generating image' }}
          </div>
        </div>
        <MarkdownRenderer :content="imageJournalMarkdown" />

        <!-- Result Rendering (for inline mode) -->
        <div v-if="imageJournalResult?.imageUrl" class="mt-4 overflow-hidden border border-primary-500/20 rounded-xl shadow-lg">
          <img
            :src="imageJournalResult.imageUrl"
            class="w-full cursor-pointer object-contain transition-all active:scale-[0.98] hover:ring-2 hover:ring-primary-500/50"
            @click="openImagePreview({ title: (parsedArgs as ImageJournalArgs)?.title || 'Generated Image', url: imageJournalResult.imageUrl })"
          >
        </div>
      </template>

      <div v-else class="whitespace-pre-wrap break-words text-[10px] font-mono op-80">
        {{ formattedArgs }}
      </div>
    </div>
  </Collapsible>
</template>

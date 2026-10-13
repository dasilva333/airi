<script setup lang="ts">
import { Collapsible } from '@proj-airi/ui'
import { computed } from 'vue'

import { useBackgroundStore } from '../../../stores/background'
import { useJournalPreviewStore } from '../../../stores/journal-preview'
import { MarkdownRenderer } from '../../markdown'
import { formatToolCallSummary } from './utils'

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
  }
  catch {
    return null
  }
})

const isTextJournalCreate = computed(() => {
  return props.toolName === 'text_journal'
    && parsedArgs.value?.action === 'create'
    && !!parsedArgs.value?.content?.trim()
})

const isTextJournalSearch = computed(() => {
  return props.toolName === 'text_journal'
    && parsedArgs.value?.action === 'search'
})

const isImageJournalCreate = computed(() => {
  return props.toolName === 'image_journal'
    && parsedArgs.value?.action === 'create'
    && !!(parsedArgs.value as ImageJournalArgs)?.prompt?.trim()
})

const textJournalMarkdown = computed(() => {
  if (!isTextJournalCreate.value)
    return ''

  const title = parsedArgs.value?.title?.trim() || 'Journal Entry'
  const content = parsedArgs.value?.content?.trim() || ''
  return `# ${title}\n\n${content}`
})

const imageJournalMarkdown = computed(() => {
  if (!isImageJournalCreate.value)
    return ''

  const args = parsedArgs.value as ImageJournalArgs
  const title = args?.title?.trim() || 'Untitled Image'
  const prompt = args?.prompt?.trim() || ''
  const mode = args?.mode || 'inline'

  let footer = ''
  if (mode === 'bg')
    footer = '\n\n> **Scene Shift**: Setting this as the active background...'
  else if (mode === 'widget')
    footer = '\n\n> **Canvas Created**: Spawning an artistry widget for you...'
  else
    footer = '\n\n> **Sharing**: Sending a quick sketch to our chat history...'

  return `### ${title}\n\n*${prompt}*${footer}`
})

const imageJournalResult = computed(() => {
  if (props.toolName !== 'image_journal' || !props.result)
    return null
  try {
    return typeof props.result === 'string' ? JSON.parse(props.result) : props.result
  }
  catch {
    return null
  }
})

const textJournalSearchResult = computed<any[] | null>(() => {
  if (props.toolName !== 'text_journal' || !props.result)
    return null
  if (Array.isArray(props.result))
    return props.result
  if (typeof props.result === 'string') {
    try {
      const parsed = JSON.parse(props.result)
      if (Array.isArray(parsed))
        return parsed
    }
    catch {}
  }
  return null
})

const backgroundStore = useBackgroundStore()
const resolvedImageUrl = computed(() => {
  const result = imageJournalResult.value
  if (!result)
    return null
  if (result.entryId) {
    const bgUrl = backgroundStore.getBackgroundUrl(result.entryId)
    if (bgUrl)
      return bgUrl
  }
  return result.imageUrl
})

const screenshotResult = computed(() => {
  if (props.toolName !== 'take_screenshot' || !props.result)
    return null

  // NOTICE: results persisted before structured tool results were preserved arrive as a
  // JSON-stringified content-part array; parse them so the image still renders.
  let parts: any = props.result
  if (typeof parts === 'string') {
    try {
      parts = JSON.parse(parts)
    }
    catch {
      return null
    }
  }
  if (!Array.isArray(parts))
    return null

  const text = parts.filter((part: any) => part?.type === 'text').map((part: any) => part.text).join('\n')
  const imageUrl: string | null = parts.find((part: any) => part?.type === 'image_url')?.image_url?.url ?? null
  return { text, imageUrl }
})

const formattedArgs = computed(() => {
  try {
    const parsed = JSON.parse(props.args)
    return JSON.stringify(parsed, null, 2).trim()
  }
  catch {
    return props.args
  }
})

const toolSummary = computed(() => {
  return formatToolCallSummary(props.toolName, parsedArgs.value || props.args)
})
</script>

<template>
  <Collapsible
    :class="[
      'bg-white/95 dark:bg-neutral-800/95 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 shadow-xs px-3.5 py-2.5',
      'flex flex-col gap-2 items-start w-full transition-all',
    ]"
  >
    <template #trigger="{ visible, setVisible }">
      <button
        :class="[
          'w-full text-start flex items-center justify-between gap-2 group cursor-pointer select-none',
        ]"
        @click="setVisible(!visible)"
      >
        <div class="min-w-0 flex flex-1 items-center gap-2.5">
          <div
            v-if="state === 'executing'"
            i-eos-icons:loading class="shrink-0 text-base text-primary-500"
          />
          <div
            v-else-if="state === 'error'"
            i-ph:warning-circle-duotone class="shrink-0 text-base text-red-500"
          />
          <div
            v-else-if="state === 'done'"
            i-ph:check-circle-duotone class="shrink-0 text-base text-emerald-500"
          />
          <div
            v-else
            i-solar:sledgehammer-bold-duotone class="shrink-0 text-base op-50"
          />
          <code class="truncate text-xs text-neutral-800 font-medium tracking-tight font-mono dark:text-neutral-200" :title="toolSummary">
            {{ toolSummary }}
          </code>
          <span v-if="state === 'error' && result" class="ml-1 truncate text-xs text-red-500 op-80">
            ({{ result }})
          </span>
        </div>

        <div
          class="i-solar:alt-arrow-down-linear shrink-0 text-xs text-neutral-400 transition-transform duration-200 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
          :class="[visible ? 'rotate-180' : '']"
        />
      </button>
    </template>
    <div
      :class="[
        'rounded-lg p-2.5 w-full mt-1',
        'bg-neutral-100/70 text-sm text-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-200',
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

        <div v-else-if="textJournalSearchResult" class="mt-2 flex flex-col gap-2">
          <div v-for="entry in textJournalSearchResult" :key="entry.id" class="border-l-2 border-primary-500/30 rounded-r-md bg-primary-500/5 px-2 py-1.5">
            <div class="mb-1 flex items-center justify-between gap-1">
              <div class="flex items-center gap-1.5 truncate">
                <span
                  v-if="entry.layer"
                  :class="[
                    'text-[9px] font-semibold px-1 py-0.2 rounded uppercase tracking-wider',
                    entry.layer === 'knowledge-graph' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : entry.layer === 'dialogue' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                      : entry.layer === 'short-term' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                  ]"
                >
                  {{ entry.layer === 'knowledge-graph' ? 'Knowledge Graph' : entry.layer }}
                </span>
                <span class="truncate text-[10px] font-bold tracking-tight uppercase op-60">
                  {{ entry.subject || entry.title || 'Memory' }}
                </span>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <span v-if="entry.relevanceScore" class="text-[9px] font-mono op-40">
                  {{ Math.round(entry.relevanceScore * 100) }}%
                </span>
                <span v-if="entry.date || entry.createdAt" class="text-[9px] op-40">
                  {{ entry.date || (entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '') }}
                </span>
              </div>
            </div>
            <div class="line-clamp-3 text-[13px] leading-relaxed italic op-90">
              "{{ entry.observed_text || entry.content || entry.fact }}"
            </div>
          </div>
          <div v-if="textJournalSearchResult.length === 0" class="py-2 text-center text-xs italic op-40">
            No semantic matches found for this query.
          </div>
        </div>

        <div v-else-if="result && typeof result === 'string'" class="mt-2 whitespace-pre-wrap text-xs op-80">
          {{ result }}
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
        <div v-if="resolvedImageUrl" class="mt-4 overflow-hidden border border-primary-500/20 rounded-xl shadow-lg">
          <img
            :src="resolvedImageUrl"
            class="w-full cursor-pointer object-contain transition-all active:scale-[0.98] hover:ring-2 hover:ring-primary-500/50"
            @click="openImagePreview({ title: (parsedArgs as ImageJournalArgs)?.title || 'Generated Image', url: resolvedImageUrl })"
          >
        </div>
      </template>

      <div v-else-if="screenshotResult" class="flex flex-col gap-2">
        <div v-if="screenshotResult.imageUrl" class="max-w-sm w-fit overflow-hidden border border-primary-500/20 rounded-xl">
          <img
            :src="screenshotResult.imageUrl"
            class="max-h-64 cursor-zoom-in object-contain transition-all hover:ring-2 hover:ring-primary-500/50"
            @click="openImagePreview({ title: 'Screenshot', url: screenshotResult.imageUrl })"
          >
        </div>
        <div v-if="screenshotResult.text" class="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs op-80">
          {{ screenshotResult.text }}
        </div>
      </div>

      <div v-else class="flex flex-col gap-2">
        <div class="whitespace-pre-wrap break-words text-[10px] font-mono op-80">
          {{ formattedArgs }}
        </div>
        <div v-if="result && typeof result === 'string'" class="border-t border-neutral-200/50 pt-1.5 dark:border-neutral-700/50">
          <div class="mb-1 text-[9px] text-neutral-500 font-semibold tracking-wider uppercase">
            Output
          </div>
          <div class="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-black/5 p-1.5 text-[10px] text-neutral-700 font-mono dark:bg-black/30 dark:text-neutral-300">
            {{ result }}
          </div>
        </div>
      </div>
    </div>
  </Collapsible>
</template>

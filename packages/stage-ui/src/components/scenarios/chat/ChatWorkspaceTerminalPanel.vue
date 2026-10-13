<script setup lang="ts">
import { useSandbox } from '@proj-airi/stage-ui/composables/use-sandbox'
import { ansiToHtml } from '@proj-airi/stage-ui/libs/sandbox'
import { useElementSize } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  fillContainer?: boolean
}>(), {
  fillContainer: false,
})

const {
  isExecuting,
  commandHistory,
  exec,
  listFiles,
  clearLogs,
  readFile,
  reset,
} = useSandbox()

const panelRootRef = ref<HTMLElement | null>(null)
const { width: panelWidth } = useElementSize(panelRootRef)

// Responsive breakpoints based on panel container width:
// - Wide: >= 310px (full labels & text)
// - Compact: < 310px (e.g. 270px width: tabs collapse to glyphs with tooltips, compact prompt)
// - Minimal: < 235px (e.g. 200px width: minimal glyphs, $ prompt prefix, ultra-compact action icons)
const isCompact = computed(() => panelWidth.value > 0 && panelWidth.value < 310)
const isMinimal = computed(() => panelWidth.value > 0 && panelWidth.value < 235)

type PanelTab = 'terminal' | 'explorer' | 'state'
const activeTab = ref<PanelTab>('terminal')

// --- Terminal State ---
const commandInput = ref('')
const commandInputHistory = ref<string[]>([])
const historyIndex = ref(-1)
const terminalScrollRef = ref<HTMLDivElement | null>(null)

// Auto-scroll terminal on new commands
watch(
  () => commandHistory.value.length,
  async () => {
    await nextTick()
    if (terminalScrollRef.value) {
      terminalScrollRef.value.scrollTop = terminalScrollRef.value.scrollHeight
    }
  },
)

async function handleRunCommand() {
  const cmd = commandInput.value.trim()
  if (!cmd || isExecuting.value)
    return

  commandInputHistory.value.push(cmd)
  historyIndex.value = -1
  commandInput.value = ''

  await exec(cmd)
  await loadExplorerFiles()
}

function handleHistoryNav(direction: 'up' | 'down') {
  if (commandInputHistory.value.length === 0)
    return

  if (direction === 'up') {
    if (historyIndex.value === -1) {
      historyIndex.value = commandInputHistory.value.length - 1
    }
    else if (historyIndex.value > 0) {
      historyIndex.value--
    }
  }
  else if (direction === 'down') {
    if (historyIndex.value !== -1) {
      if (historyIndex.value < commandInputHistory.value.length - 1) {
        historyIndex.value++
      }
      else {
        historyIndex.value = -1
        commandInput.value = ''
        return
      }
    }
  }

  if (historyIndex.value !== -1) {
    commandInput.value = commandInputHistory.value[historyIndex.value] || ''
  }
}

// --- Explorer State ---
interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

const files = ref<FileItem[]>([])
const selectedFile = ref<string | null>(null)
const selectedFileContent = ref<string>('')
const isLoadingFile = ref(false)

async function loadExplorerFiles() {
  files.value = await listFiles('/workspace')
}

async function handleSelectFile(file: FileItem) {
  if (file.isDirectory)
    return
  selectedFile.value = file.path
  isLoadingFile.value = true
  try {
    selectedFileContent.value = await readFile(file.path)
  }
  catch (err: any) {
    selectedFileContent.value = `Error reading file: ${err.message}`
  }
  finally {
    isLoadingFile.value = false
  }
}

function closeFileViewer() {
  selectedFile.value = null
  selectedFileContent.value = ''
}

function getFileIcon(name: string): string {
  if (name.endsWith('.ts'))
    return 'i-solar:code-file-bold text-sky-400'
  if (name.endsWith('.js'))
    return 'i-solar:code-file-bold text-amber-400'
  if (name.endsWith('.json'))
    return 'i-solar:document-text-bold text-emerald-400'
  if (name.endsWith('.md'))
    return 'i-solar:notebook-bold text-violet-400'
  return 'i-solar:file-bold text-neutral-400'
}

function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  if (bytes < 1024)
    return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

// --- State Inspector ---
const selectedStateKey = ref<'telemetry' | 'session' | 'cognition' | 'messages'>('telemetry')
const stateData = ref<string>('')
const isLoadingState = ref(false)

async function loadState(key: 'telemetry' | 'session' | 'cognition' | 'messages') {
  selectedStateKey.value = key
  isLoadingState.value = true
  try {
    stateData.value = await readFile(`/workspace/.airi/${key}.json`)
  }
  catch (err: any) {
    stateData.value = `Error loading state: ${err.message}`
  }
  finally {
    isLoadingState.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'explorer') {
    void loadExplorerFiles()
  }
  else if (tab === 'state') {
    void loadState(selectedStateKey.value)
  }
})

onMounted(async () => {
  await loadExplorerFiles()
})
</script>

<template>
  <div
    ref="panelRootRef"
    :class="[
      'flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-100 transition-all',
      props.fillContainer
        ? 'h-full w-full flex-1 min-h-0 bg-transparent'
        : 'border border-neutral-200/60 dark:border-primary-500/20 rounded-2xl bg-white/70 dark:bg-neutral-900/80 backdrop-blur-md shadow-xl',
    ]"
  >
    <!-- Header Navigation & Action Bar -->
    <div
      :class="[
        'flex items-center justify-between px-3 py-2 shrink-0 select-none border-b',
        props.fillContainer
          ? 'border-neutral-200/40 dark:border-white/5 bg-transparent'
          : 'border-neutral-200/50 dark:border-white/5 bg-white/40 dark:bg-neutral-950/40',
      ]"
    >
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          title="Terminal"
          :class="[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer select-none',
            activeTab === 'terminal'
              ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400 font-semibold shadow-xs'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 font-medium',
          ]"
          @click="activeTab = 'terminal'"
        >
          <span class="shrink-0 text-xs font-bold leading-none font-mono">&gt;_</span>
          <span v-if="!isCompact">Terminal</span>
          <span
            v-if="isExecuting"
            class="h-1.5 w-1.5 shrink-0 animate-ping rounded-full bg-primary-500"
          />
        </button>

        <button
          type="button"
          :title="`Explorer (${files.length} files)`"
          :class="[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer select-none',
            activeTab === 'explorer'
              ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400 font-semibold shadow-xs'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 font-medium',
          ]"
          @click="activeTab = 'explorer'"
        >
          <span class="i-solar:folder-with-files-bold-duotone shrink-0 text-xs" />
          <span v-if="!isCompact">Explorer</span>
          <span
            :class="[
              'shrink-0 rounded px-1.5 py-0.2 text-[10px] font-mono font-medium',
              activeTab === 'explorer'
                ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300'
                : 'bg-neutral-600/15 dark:bg-neutral-700/80 text-neutral-600 dark:text-neutral-300',
            ]"
          >
            {{ files.length }}
          </span>
        </button>

        <button
          type="button"
          title="Live State"
          :class="[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer select-none',
            activeTab === 'state'
              ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400 font-semibold shadow-xs'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 font-medium',
          ]"
          @click="activeTab = 'state'"
        >
          <span class="i-solar:settings-minimalistic-linear shrink-0 text-xs" />
          <span v-if="!isCompact">State</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-1">
        <button
          v-if="activeTab === 'terminal'"
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-500 font-medium transition-colors hover:bg-neutral-100 dark:text-neutral-400 hover:text-rose-500 dark:hover:bg-neutral-800/60 dark:hover:text-rose-400"
          title="Clear Terminal Logs"
          @click="clearLogs"
        >
          <span class="i-solar:trash-bin-trash-linear shrink-0 text-xs" />
          <span v-if="!isCompact">Clear</span>
        </button>

        <button
          v-if="activeTab === 'explorer'"
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-500 font-medium transition-colors hover:bg-neutral-100 dark:text-neutral-400 hover:text-primary-500 dark:hover:bg-neutral-800/60"
          title="Refresh Workspace Files"
          @click="loadExplorerFiles"
        >
          <span class="i-solar:restart-bold shrink-0 text-xs" />
          <span v-if="!isCompact">Refresh</span>
        </button>

        <button
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-neutral-500 font-medium transition-colors hover:bg-neutral-100 dark:text-neutral-400 hover:text-primary-500 dark:hover:bg-neutral-800/60"
          title="Reset RAM Disk"
          @click="reset"
        >
          <span class="i-solar:restart-bold shrink-0 text-xs" />
        </button>
      </div>
    </div>

    <!-- TAB 1: Live Terminal View -->
    <div
      v-if="activeTab === 'terminal'"
      :class="[
        'flex flex-col',
        props.fillContainer ? 'flex-1 min-h-0' : '',
      ]"
    >
      <!-- Scrollable Logs Stream -->
      <div
        ref="terminalScrollRef"
        :class="[
          'flex flex-col gap-2.5 overflow-y-auto p-3 text-[11px] leading-relaxed font-mono selection:bg-primary-500/20',
          props.fillContainer
            ? 'flex-1 min-h-0 bg-transparent'
            : 'h-[360px] bg-neutral-50/50 dark:bg-neutral-950/60',
        ]"
      >
        <!-- Terminal Welcome Banner ("AIRI Workspace" Identity Card) -->
        <div
          :class="[
            'rounded-2xl p-3 border shadow-xs flex items-center justify-between gap-3 shrink-0 transition-all select-none',
            'bg-white/80 dark:bg-neutral-900/50 border-neutral-100 dark:border-primary-500/15 backdrop-blur-sm',
          ]"
        >
          <div class="min-w-0 flex items-center gap-3">
            <!-- Left Squircle Icon Tile -->
            <div
              :class="[
                'size-10 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-sm',
                'bg-primary-500/15 text-primary-500 dark:text-primary-400 border border-primary-500/20',
              ]"
            >
              &gt;_
            </div>

            <!-- Center Info Column -->
            <div class="min-w-0 flex flex-col justify-center">
              <div class="flex items-center gap-2 truncate">
                <span class="text-xs text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
                  AIRI Workspace
                </span>
                <span class="text-[11px] text-neutral-400 font-normal font-mono dark:text-neutral-500">
                  /workspace
                </span>
              </div>
              <div class="mt-0.5 truncate text-[10px] text-neutral-400 font-mono dark:text-neutral-500">
                {{ isCompact ? 'POSIX • TS 5.8 • Node 22' : 'POSIX shell • TypeScript 5.8 • Node 22.14' }}
              </div>
            </div>
          </div>

          <!-- Right Status Badge -->
          <div
            :class="[
              'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium shrink-0',
              isExecuting
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
            ]"
          >
            <span
              :class="[
                'size-1.5 rounded-full shrink-0',
                isExecuting ? 'bg-amber-500 animate-ping' : 'bg-emerald-500',
              ]"
            />
            <span>{{ isExecuting ? 'Running' : 'Ready' }}</span>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="commandHistory.length === 0"
          class="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-neutral-400 dark:text-neutral-500"
        >
          <span class="i-solar:terminal-linear text-3xl text-primary-500 opacity-40" />
          <span class="text-xs text-neutral-600 font-medium dark:text-neutral-400">No commands executed yet.</span>
          <span class="px-2 text-center text-[10px] text-neutral-400 dark:text-neutral-500">
            Commands run by the companion or entered below will stream here in real time.
          </span>
        </div>

        <!-- Command Execution Entries (Frosted Bubble Cards) -->
        <div
          v-for="entry in commandHistory"
          :key="entry.id"
          :class="[
            'rounded-2xl p-3.5 border shadow-xs transition-all space-y-2',
            'bg-white/85 dark:bg-neutral-900/50 border-white/60 dark:border-primary-500/15 backdrop-blur-sm',
            'hover:border-primary-500/30 dark:hover:border-primary-500/30',
          ]"
        >
          <!-- Command Prompt Header -->
          <div class="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 dark:border-white/5">
            <div class="min-w-0 flex flex-1 items-center gap-1.5">
              <span class="shrink-0 text-xs text-primary-500 font-semibold font-mono dark:text-primary-400">
                {{ isCompact ? '$' : 'airi@sandbox:~$' }}
              </span>
              <span class="truncate text-xs text-neutral-800 font-bold font-mono dark:text-neutral-100">
                {{ entry.command }}
              </span>
            </div>
            <div class="flex shrink-0 items-center gap-2 text-[10px] font-mono">
              <span v-if="!isMinimal" class="text-neutral-400 dark:text-neutral-500">
                {{ entry.durationMs }} ms
              </span>
              <span
                :class="[
                  'rounded-full px-2 py-0.5 text-[10px] font-mono font-medium',
                  entry.exitCode === 0
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20',
                ]"
              >
                {{ isMinimal ? (entry.exitCode === 0 ? '✓' : `!${entry.exitCode}`) : `exit ${entry.exitCode}` }}
              </span>
            </div>
          </div>

          <!-- STDOUT Output -->
          <div
            v-if="entry.stdout"
            :class="[
              'max-h-60 overflow-x-auto overflow-y-auto leading-relaxed select-text font-mono text-[11px]',
              entry.command.trim().startsWith('cat ')
                ? 'bg-primary-500/5 dark:bg-primary-950/30 rounded-xl p-3 border border-primary-500/10 dark:border-primary-500/20 text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap break-all'
                : 'text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap break-all px-0.5',
            ]"
            v-html="ansiToHtml(entry.stdout)"
          />

          <!-- STDERR Output -->
          <div
            v-if="entry.stderr"
            :class="[
              'max-h-60 overflow-x-auto overflow-y-auto rounded-xl p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all select-text',
              'bg-rose-500/10 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-500/20',
            ]"
            v-html="ansiToHtml(entry.stderr)"
          />
        </div>
      </div>

      <!-- Command Prompt Floating Input Capsule -->
      <div class="shrink-0 p-2.5">
        <form
          :class="[
            'flex items-center gap-2 px-3 py-1.5 rounded-2xl border shadow-sm transition-all',
            'bg-white/90 dark:bg-neutral-900/60 border-neutral-200/50 dark:border-primary-500/20 backdrop-blur-md',
            'focus-within:border-primary-500/40 focus-within:ring-2 focus-within:ring-primary-500/10',
          ]"
          @submit.prevent="handleRunCommand"
        >
          <!-- Prompt prefix -->
          <span class="shrink-0 text-xs text-primary-500 font-bold font-mono dark:text-primary-400">
            {{ isCompact ? '$' : 'airi@sandbox:~$' }}
          </span>

          <!-- Command Input -->
          <input
            v-model="commandInput"
            type="text"
            :placeholder="isMinimal ? 'Command...' : isCompact ? 'Run command...' : 'Run a command...'"
            :class="[
              'min-w-0 flex-1 bg-transparent text-xs font-mono outline-none',
              'text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
            ]"
            :disabled="isExecuting"
            @keydown.up.prevent="handleHistoryNav('up')"
            @keydown.down.prevent="handleHistoryNav('down')"
          >

          <!-- Shortcut Helper -->
          <span v-if="!isCompact" class="shrink-0 select-none text-[10px] text-neutral-400 font-normal dark:text-neutral-500">
            Enter to run
          </span>

          <!-- Run Button -->
          <button
            type="submit"
            :disabled="isExecuting || !commandInput.trim()"
            :title="isCompact ? 'Run command' : undefined"
            :class="[
              'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-white font-bold transition-all shadow-xs select-none',
              'bg-primary-500 hover:bg-primary-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
            ]"
          >
            <span v-if="isExecuting" class="i-solar:refresh-circle-bold animate-spin text-xs" />
            <span v-else class="i-solar:plain-bold text-xs" />
            <span v-if="!isMinimal">Run</span>
          </button>
        </form>
      </div>
    </div>

    <!-- TAB 2: Workspace Explorer View -->
    <div
      v-else-if="activeTab === 'explorer'"
      :class="[
        'flex flex-col overflow-hidden',
        props.fillContainer ? 'flex-1 min-h-0 bg-transparent' : 'h-[400px] bg-neutral-50/50 dark:bg-neutral-950/60',
      ]"
    >
      <!-- File Viewer Overlay (if a file is clicked) -->
      <div v-if="selectedFile" class="flex flex-1 flex-col overflow-hidden">
        <div class="flex items-center justify-between border-b border-neutral-100 bg-white/60 px-3 py-2 text-xs backdrop-blur-sm dark:border-white/5 dark:bg-neutral-900/60">
          <div class="min-w-0 flex items-center gap-1.5 truncate text-neutral-800 font-mono dark:text-neutral-100">
            <span class="i-solar:file-text-bold shrink-0 text-primary-500" />
            <span class="truncate">{{ selectedFile }}</span>
          </div>
          <button
            type="button"
            class="shrink-0 cursor-pointer rounded-lg px-2 py-0.5 text-[10px] text-neutral-500 font-bold transition-colors hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-white"
            @click="closeFileViewer"
          >
            ✕ Close
          </button>
        </div>
        <div class="flex-1 overflow-auto bg-white/40 p-3 text-[11px] text-neutral-700 leading-relaxed font-mono dark:bg-black/20 selection:bg-primary-500/20 dark:text-neutral-200">
          <pre class="whitespace-pre-wrap break-all">{{ selectedFileContent }}</pre>
        </div>
      </div>

      <!-- File Grid / List -->
      <div v-else class="flex-1 overflow-y-auto p-3">
        <div class="mb-2 select-none text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
          Files in /workspace
        </div>

        <div v-if="files.length === 0" class="py-12 text-center text-xs text-neutral-400 italic dark:text-neutral-500">
          No files in /workspace
        </div>

        <div class="flex flex-col gap-1.5">
          <div
            v-for="file in files"
            :key="file.path"
            class="shadow-2xs dark:hover:bg-neutral-850 flex cursor-pointer items-center justify-between border border-neutral-100 rounded-xl bg-white/80 px-3 py-2 transition-all dark:border-primary-500/15 hover:border-primary-500/30 dark:bg-neutral-900/50 hover:bg-white"
            @click="handleSelectFile(file)"
          >
            <div class="min-w-0 flex items-center gap-2 truncate text-xs font-mono">
              <span :class="getFileIcon(file.name)" class="shrink-0 text-sm" />
              <span class="truncate text-neutral-800 font-medium dark:text-neutral-100">{{ file.name }}</span>
            </div>
            <span class="shrink-0 pl-1 text-[10px] text-neutral-400 font-mono dark:text-neutral-500">
              {{ formatBytes(file.size) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: Live State Inspector -->
    <div
      v-else-if="activeTab === 'state'"
      :class="[
        'flex flex-col overflow-hidden',
        props.fillContainer ? 'flex-1 min-h-0 bg-transparent' : 'h-[400px] bg-neutral-50/50 dark:bg-neutral-950/60',
      ]"
    >
      <!-- State Selector Badges -->
      <div class="flex flex-wrap items-center gap-1.5 border-b border-neutral-100 bg-white/60 px-3 py-2 backdrop-blur-sm dark:border-white/5 dark:bg-neutral-900/60">
        <button
          v-for="item in (['telemetry', 'session', 'cognition', 'messages'] as const)"
          :key="item"
          type="button"
          :title="`/workspace/.airi/${item}.json`"
          :class="[
            'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase font-mono transition-colors cursor-pointer select-none',
            selectedStateKey === item
              ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/30 shadow-2xs'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60',
          ]"
          @click="loadState(item)"
        >
          {{ item }}
        </button>
      </div>

      <!-- State JSON Viewer -->
      <div class="flex-1 overflow-auto bg-white/40 p-3 text-[11px] text-neutral-700 leading-relaxed font-mono dark:bg-black/20 selection:bg-primary-500/20 dark:text-neutral-200">
        <div v-if="isLoadingState" class="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
          <span class="i-solar:refresh-circle-bold animate-spin text-sm" />
          <span>Reading state from RAM disk...</span>
        </div>
        <pre v-else class="whitespace-pre-wrap break-all">{{ stateData }}</pre>
      </div>
    </div>
  </div>
</template>

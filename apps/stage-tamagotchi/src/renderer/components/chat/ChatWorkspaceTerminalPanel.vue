<script setup lang="ts">
import { useSandbox } from '@proj-airi/stage-ui/composables/use-sandbox'
import { ansiToHtml } from '@proj-airi/stage-ui/libs/sandbox'
import { useElementSize } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

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
    class="flex flex-col overflow-hidden border border-neutral-200/60 rounded-2xl bg-neutral-900 text-neutral-100 shadow-xl transition-all dark:border-neutral-800"
  >
    <!-- Header Navigation & Action Bar -->
    <div class="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-2.5 py-1.5">
      <div class="flex items-center gap-1">
        <button
          type="button"
          title="Terminal"
          :class="[
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            activeTab === 'terminal'
              ? 'bg-neutral-800 text-emerald-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850',
          ]"
          @click="activeTab = 'terminal'"
        >
          <span class="i-solar:terminal-bold-duotone shrink-0 text-xs" />
          <span v-if="!isCompact">Terminal</span>
          <span
            v-if="isExecuting"
            class="h-1.5 w-1.5 shrink-0 animate-ping rounded-full bg-emerald-400"
          />
        </button>

        <button
          type="button"
          :title="`Explorer (${files.length} files)`"
          :class="[
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            activeTab === 'explorer'
              ? 'bg-neutral-800 text-sky-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850',
          ]"
          @click="activeTab = 'explorer'"
        >
          <span class="i-solar:folder-with-files-bold-duotone shrink-0 text-xs" />
          <span v-if="!isCompact">Explorer</span>
          <span class="shrink-0 rounded bg-neutral-700/80 px-1 py-0.2 text-[9px] text-neutral-300 font-mono">
            {{ files.length }}
          </span>
        </button>

        <button
          type="button"
          title="Live State"
          :class="[
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            activeTab === 'state'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850',
          ]"
          @click="activeTab = 'state'"
        >
          <span class="i-solar:cpu-bold-duotone shrink-0 text-xs" />
          <span v-if="!isCompact">State</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-0.5">
        <button
          v-if="activeTab === 'terminal'"
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] text-neutral-400 font-medium transition-colors hover:bg-neutral-800 hover:text-rose-400"
          title="Clear Terminal Logs"
          @click="clearLogs"
        >
          <span class="i-solar:trash-bin-trash-bold shrink-0 text-xs" />
          <span v-if="!isCompact">Clear</span>
        </button>

        <button
          v-if="activeTab === 'explorer'"
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] text-neutral-400 font-medium transition-colors hover:bg-neutral-800 hover:text-sky-400"
          title="Refresh Workspace Files"
          @click="loadExplorerFiles"
        >
          <span class="i-solar:restart-bold shrink-0 text-xs" />
          <span v-if="!isCompact">Refresh</span>
        </button>

        <button
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] text-neutral-400 font-medium transition-colors hover:bg-neutral-800 hover:text-amber-400"
          title="Reset RAM Disk"
          @click="reset"
        >
          <span class="i-solar:refresh-circle-bold shrink-0 text-xs" />
        </button>
      </div>
    </div>

    <!-- TAB 1: Live Terminal View -->
    <div v-if="activeTab === 'terminal'" class="flex flex-col">
      <!-- Scrollable Logs Stream (Pretty Tall) -->
      <div
        ref="terminalScrollRef"
        class="h-[340px] flex flex-col gap-2.5 overflow-y-auto bg-neutral-950/90 p-2.5 text-[11px] leading-relaxed font-mono selection:bg-primary-500/30"
      >
        <!-- Terminal Welcome Banner -->
        <div class="border border-neutral-800/80 rounded-lg bg-neutral-900/60 p-2 text-neutral-400 space-y-0.5">
          <div class="flex items-center justify-between text-[10px] text-neutral-300 font-bold tracking-wider uppercase">
            <span class="flex items-center gap-1.5 truncate text-emerald-400">
              <span class="i-solar:shield-check-bold shrink-0 text-xs" />
              <span class="truncate">{{ isCompact ? 'Virtual Terminal' : 'AIRI In-Memory Workstation (/workspace)' }}</span>
            </span>
            <span v-if="!isCompact" class="shrink-0 text-[9px] text-neutral-500 font-mono">0B Host Footprint</span>
          </div>
          <div class="truncate text-[9px] text-neutral-500">
            {{ isCompact ? 'POSIX • tsc-rs • node v22' : 'POSIX Shell • tsc-rs (TS 5.8) • node v22.14.0 • Live VFS State' }}
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="commandHistory.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-neutral-500">
          <span class="i-solar:terminal-linear text-3xl opacity-40" />
          <span class="text-xs">No commands executed yet.</span>
          <span class="px-2 text-center text-[10px] text-neutral-600">Commands run by the agent or entered below stream here in real time.</span>
        </div>

        <!-- Command Execution Entries -->
        <div
          v-for="entry in commandHistory"
          :key="entry.id"
          class="border border-neutral-800/60 rounded-lg bg-neutral-900/50 p-2 transition-all space-y-1.5 hover:border-neutral-700/80"
        >
          <!-- Command Prompt Header -->
          <div class="flex items-start justify-between gap-1.5 border-b border-neutral-800/60 pb-1">
            <div class="min-w-0 flex flex-1 items-center gap-1 text-neutral-200 font-bold">
              <span class="shrink-0 text-emerald-400 font-mono">{{ isCompact ? '$' : 'airi@sandbox:~$' }}</span>
              <span class="truncate font-mono">{{ entry.command }}</span>
            </div>
            <div class="flex shrink-0 items-center gap-1 text-[9px] font-mono">
              <span v-if="!isMinimal" class="text-neutral-500">{{ entry.durationMs }}ms</span>
              <span
                :class="entry.exitCode === 0
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                  : 'bg-rose-950/60 text-rose-400 border border-rose-800/50'"
                class="rounded px-1.5 py-0.2 font-bold"
              >
                {{ isMinimal ? (entry.exitCode === 0 ? '✓' : `!${entry.exitCode}`) : `exit ${entry.exitCode}` }}
              </span>
            </div>
          </div>

          <!-- STDOUT Output -->
          <div
            v-if="entry.stdout"
            class="max-h-48 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 text-[10px] text-neutral-300 font-mono"
            v-html="ansiToHtml(entry.stdout)"
          />

          <!-- STDERR Output -->
          <div
            v-if="entry.stderr"
            class="max-h-48 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all rounded bg-rose-950/20 p-2 text-[10px] text-rose-300 font-mono"
            v-html="ansiToHtml(entry.stderr)"
          />
        </div>
      </div>

      <!-- Command Prompt Input Bar -->
      <form
        class="flex items-center gap-1.5 border-t border-neutral-800 bg-neutral-900/90 px-2 py-1.5"
        @submit.prevent="handleRunCommand"
      >
        <span class="shrink-0 text-xs text-emerald-400 font-bold font-mono">{{ isCompact ? '$' : 'airi@sandbox:~$' }}</span>
        <input
          v-model="commandInput"
          type="text"
          :placeholder="isMinimal ? 'Command...' : isCompact ? 'Run command...' : 'Run command (e.g. ls -la, jq . /workspace/.airi/telemetry.json)...'"
          class="min-w-0 flex-1 bg-transparent text-xs text-neutral-100 font-mono outline-none placeholder:text-neutral-600 focus:placeholder:text-neutral-500"
          :disabled="isExecuting"
          @keydown.up.prevent="handleHistoryNav('up')"
          @keydown.down.prevent="handleHistoryNav('down')"
        >
        <button
          type="submit"
          :disabled="isExecuting || !commandInput.trim()"
          :title="isCompact ? 'Run command' : undefined"
          class="flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] text-white font-bold transition-all disabled:cursor-not-allowed hover:bg-emerald-500 disabled:opacity-40"
        >
          <span v-if="isExecuting" class="i-solar:refresh-circle-bold animate-spin text-xs" />
          <span v-else class="i-solar:arrow-right-bold text-xs" />
          <span v-if="!isCompact">Run</span>
        </button>
      </form>
    </div>

    <!-- TAB 2: Workspace Explorer View -->
    <div v-else-if="activeTab === 'explorer'" class="h-[380px] flex flex-col overflow-hidden bg-neutral-950/90">
      <!-- File Viewer Overlay (if a file is clicked) -->
      <div v-if="selectedFile" class="flex flex-1 flex-col overflow-hidden">
        <div class="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs">
          <div class="min-w-0 flex items-center gap-1.5 truncate text-neutral-200 font-mono">
            <span class="i-solar:file-text-bold shrink-0 text-sky-400" />
            <span class="truncate">{{ selectedFile }}</span>
          </div>
          <button
            type="button"
            class="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-neutral-400 font-bold transition-colors hover:bg-neutral-800 hover:text-white"
            @click="closeFileViewer"
          >
            ✕ Close
          </button>
        </div>
        <div class="flex-1 overflow-auto bg-neutral-950 p-2.5 text-[10px] text-neutral-300 leading-relaxed font-mono selection:bg-sky-500/30">
          <pre class="whitespace-pre-wrap break-all">{{ selectedFileContent }}</pre>
        </div>
      </div>

      <!-- File Grid / List -->
      <div v-else class="flex-1 overflow-y-auto p-2.5">
        <div class="mb-2 text-[10px] text-neutral-500 font-bold tracking-wider uppercase">
          Files in /workspace
        </div>

        <div v-if="files.length === 0" class="py-12 text-center text-xs text-neutral-500 italic">
          No files in /workspace
        </div>

        <div class="flex flex-col gap-1">
          <div
            v-for="file in files"
            :key="file.path"
            class="hover:bg-neutral-850 flex cursor-pointer items-center justify-between border border-neutral-800/60 rounded-lg bg-neutral-900/40 px-2.5 py-1.5 transition-all hover:border-neutral-700"
            @click="handleSelectFile(file)"
          >
            <div class="min-w-0 flex items-center gap-1.5 truncate text-xs font-mono">
              <span :class="getFileIcon(file.name)" class="shrink-0 text-sm" />
              <span class="truncate text-neutral-200 font-medium">{{ file.name }}</span>
            </div>
            <span class="shrink-0 pl-1 text-[9px] text-neutral-500 font-mono">
              {{ formatBytes(file.size) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: Live State Inspector -->
    <div v-else-if="activeTab === 'state'" class="h-[380px] flex flex-col overflow-hidden bg-neutral-950/90">
      <!-- State Selector Badges -->
      <div class="flex flex-wrap items-center gap-1 border-b border-neutral-800 bg-neutral-900 px-2 py-1.5">
        <button
          v-for="item in (['telemetry', 'session', 'cognition', 'messages'] as const)"
          :key="item"
          type="button"
          :title="`/workspace/.airi/${item}.json`"
          :class="[
            'px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono transition-colors cursor-pointer',
            selectedStateKey === item
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-neutral-400 hover:text-neutral-200',
          ]"
          @click="loadState(item)"
        >
          {{ item }}
        </button>
      </div>

      <!-- State JSON Viewer -->
      <div class="flex-1 overflow-auto bg-neutral-950 p-2.5 text-[10px] text-neutral-300 leading-relaxed font-mono selection:bg-amber-500/30">
        <div v-if="isLoadingState" class="flex items-center gap-2 text-neutral-500">
          <span class="i-solar:refresh-circle-bold animate-spin text-sm" />
          <span>Reading state from RAM disk...</span>
        </div>
        <pre v-else class="whitespace-pre-wrap break-all">{{ stateData }}</pre>
      </div>
    </div>
  </div>
</template>

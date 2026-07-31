<script setup lang="ts">
import type { ElectronMcpStdioConfigFile, ElectronMcpStdioRuntimeStatus, ElectronMcpToolDescriptor } from '../../../../shared/eventa'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { tryGetMcpToolBridge } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { Button } from '@proj-airi/ui'
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import {
  electronMcpApplyAndRestart,
  electronMcpGetConfig,
  electronMcpGetRuntimeStatus,
  electronMcpOpenConfigFile,
  electronMcpUpdateConfig,
} from '../../../../shared/eventa'

console.log('[MCP] Settings module loaded')

const openConfigFile = useElectronEventaInvoke(electronMcpOpenConfigFile)
const applyAndRestart = useElectronEventaInvoke(electronMcpApplyAndRestart)
const getRuntimeStatus = useElectronEventaInvoke(electronMcpGetRuntimeStatus)
const getConfig = useElectronEventaInvoke(electronMcpGetConfig)
const updateConfig = useElectronEventaInvoke(electronMcpUpdateConfig)

// UI State
const currentTab = ref<'manage' | 'discover'>('manage')
const isBusy = ref(false)
const status = ref<ElectronMcpStdioRuntimeStatus>()
const tools = ref<ElectronMcpToolDescriptor[]>([])
const config = ref<ElectronMcpStdioConfigFile>()
const lastActionMessage = ref('')
const errorMessage = ref('')

// Manage Tab State
const expandedServers = ref<Set<string>>(new Set())
const configPath = computed(() => status.value?.path ?? '')

// Discover Tab State
interface RegistryServer {
  name: string
  short_description: string
  github_stars?: number
  url: string
  source_code_url?: string
  package_name?: string
  remotes?: Array<{ url_direct: string, transport: string }>
}

const searchQuery = ref('')
const registryServers = ref<RegistryServer[]>([])
const isRegistryLoading = ref(false)
const registryError = ref('')

const toolsByServer = computed(() => {
  const map: Record<string, ElectronMcpToolDescriptor[]> = {}
  for (const tool of tools.value) {
    if (!map[tool.serverName])
      map[tool.serverName] = []
    map[tool.serverName].push(tool)
  }
  return map
})

function toggleServer(name: string) {
  const next = new Set(expandedServers.value)
  if (next.has(name))
    next.delete(name)
  else
    next.add(name)
  expandedServers.value = next
}

async function refreshStatus() {
  isBusy.value = true
  errorMessage.value = ''

  console.log('[MCP] Refreshing status via Bridge...')

  try {
    const bridge = tryGetMcpToolBridge()
    if (!bridge) {
      throw new Error('MCP tool bridge is not available in this runtime.')
    }

    console.log('[MCP] Bridge found:', bridge)

    // Use Bridge for runtime data
    const [resStatus, resTools, resConfig] = await Promise.allSettled([
      bridge.getRuntimeStatus(),
      bridge.listTools(),
      getConfig(),
    ])

    if (resStatus.status === 'fulfilled' && resStatus.value) {
      console.log('[MCP] Bridge Runtime status loaded:', resStatus.value)
      status.value = resStatus.value
    }
    else if (resStatus.status === 'rejected') {
      console.error('[MCP] Bridge failed to get runtime status:', resStatus.reason)
      errorMessage.value = `Bridge Error: ${resStatus.reason?.message || resStatus.reason}`
    }

    if (resTools.status === 'fulfilled' && resTools.value) {
      console.log(`[MCP] Bridge Tools loaded: ${resTools.value.length} tools`)
      tools.value = resTools.value
    }

    if (resConfig.status === 'fulfilled' && resConfig.value) {
      config.value = resConfig.value
    }

    // Fallback Mock Data ONLY if IPC totally failed or returned nothing
    if (!status.value?.servers?.length) {
      console.log('[MCP] No servers found from bridge, loading mock data...')
      status.value = {
        path: status.value?.path || 'mcp.json (Fallback)',
        updatedAt: Date.now(),
        servers: [
          {
            name: 'Example Filesystem Server (Mock)',
            state: 'stopped',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/search'],
            pid: null,
          },
        ],
      }
    }
  }
  catch (error) {
    console.warn('[MCP] Bridge is not yet available, falling back to IPC or mock.')
    // Fallback to direct IPC if bridge is missing
    try {
      const res = await getRuntimeStatus()
      if (res)
        status.value = res
    }
    catch (ipcErr) {
      console.error('[MCP] Direct IPC also failed:', ipcErr)
    }

    if (!status.value?.servers?.length) {
      status.value = {
        path: 'mcp.json (Bridge Missing)',
        updatedAt: Date.now(),
        servers: [{ name: 'Bridge Sync Failure', state: 'error', command: '', args: [], pid: null }],
      }
    }
  }
  finally {
    isBusy.value = false
  }
}

async function handleOpenConfigFile() {
  isBusy.value = true
  errorMessage.value = ''
  try {
    const result = await openConfigFile()
    lastActionMessage.value = `Configuration file opened at: ${result.path}`
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
}

async function handleApplyAndRestart() {
  isBusy.value = true
  errorMessage.value = ''
  try {
    const result = await applyAndRestart()
    await refreshStatus()
    lastActionMessage.value = `MCP servers restarted. Started: ${result.started.length}, Failed: ${result.failed.length}, Skipped: ${result.skipped.length}`
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
}

// Registry Fetching
const fetchRegistry = useDebounceFn(async (query: string) => {
  isRegistryLoading.value = true
  registryError.value = ''
  try {
    const url = new URL('https://api.pulsemcp.com/v0beta/servers')
    url.searchParams.set('count_per_page', '30')
    const trimmedQuery = query.trim()
    if (trimmedQuery)
      url.searchParams.set('query', trimmedQuery)

    const response = await fetch(url.toString())
    const data = await response.json()
    let servers: RegistryServer[] = data.servers || []
    if (trimmedQuery) {
      const lower = trimmedQuery.toLowerCase()
      const matches = servers.filter(s =>
        s.name?.toLowerCase().includes(lower)
        || s.short_description?.toLowerCase().includes(lower)
        || s.package_name?.toLowerCase().includes(lower),
      )
      if (matches.length > 0) {
        servers = matches
      }
    }
    registryServers.value = servers
  }
  catch (error) {
    registryError.value = 'Failed to load registry.'
    console.error(error)
  }
  finally {
    isRegistryLoading.value = false
  }
}, 300)

watch(searchQuery, (val) => {
  fetchRegistry(val)
})

async function handleInstall(server: RegistryServer) {
  isBusy.value = true
  lastActionMessage.value = ''
  try {
    const slug = server.package_name || server.name.toLowerCase().replace(/\s+/g, '-')
    const command = 'npx'
    const args: string[] = ['-y']

    if (server.source_code_url?.includes('github.com')) {
      const parts = server.source_code_url.split('/')
      const repo = parts[4]?.replace('.git', '')
      if (repo && repo.startsWith('mcp-server-'))
        args.push(repo)
      else
        args.push(server.package_name || slug)
    }
    else {
      args.push(slug)
    }

    await updateConfig({
      mcpServers: {
        [slug]: {
          command,
          args,
          enabled: true,
        },
      },
    })

    await handleApplyAndRestart()
    currentTab.value = 'manage'
    lastActionMessage.value = `Successfully installed ${server.name}`
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
}

function isInstalled(name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  return !!config.value?.mcpServers[slug]
}

onMounted(async () => {
  await refreshStatus()
  fetchRegistry('')
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header Area -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-bold tracking-tight">
          MCP Servers
        </h2>
        <p class="text-neutral-500">
          Connect and manage MCP servers and tools to extend AIRI's capabilities.
        </p>
      </div>

      <!-- Tab Switcher -->
      <div :class="['flex items-center gap-1 p-1 rounded-lg w-fit', 'bg-neutral-200/50 dark:bg-neutral-800/50']">
        <button
          v-for="tab in (['manage', 'discover'] as const)"
          :key="tab"
          :class="[
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
            currentTab === tab
              ? 'bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
          ]"
          @click="currentTab = tab"
        >
          {{ tab === 'manage' ? 'Manage' : 'Discover' }}
        </button>
      </div>
    </div>

    <!-- Feedback Area -->
    <Transition name="fade">
      <div v-if="lastActionMessage || errorMessage" class="flex flex-col gap-2">
        <div
          v-if="lastActionMessage"
          :class="[
            'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3',
            'text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
          ]"
        >
          {{ lastActionMessage }}
        </div>
        <div
          v-if="errorMessage"
          :class="[
            'rounded-lg border border-red-200 bg-red-50 px-4 py-3',
            'text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
          ]"
        >
          {{ errorMessage }}
        </div>
      </div>
    </Transition>

    <!-- Manage Tab -->
    <div v-if="currentTab === 'manage'" v-motion-fade class="flex flex-col gap-6">
      <!-- Global Controls -->
      <div
        :class="[
          'rounded-2xl p-6',
          'border border-neutral-200/70 bg-white/50 backdrop-blur-sm dark:border-neutral-700/50 dark:bg-neutral-900/40',
          'flex flex-col gap-6',
        ]"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-col gap-1">
            <h3 class="text-sm text-neutral-400 font-semibold tracking-wider uppercase">
              Runtime Status
            </h3>
            <div class="break-all text-xs text-neutral-500">
              <span class="font-medium">Config:</span> {{ configPath || '-' }}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Button variant="secondary" size="sm" :disabled="isBusy" @click="handleOpenConfigFile">
              <template #icon>
                <div i-ph:file-json-bold />
              </template>
              Edit JSON
            </Button>
            <Button variant="secondary" size="sm" :disabled="isBusy" @click="refreshStatus">
              <template #icon>
                <div i-ph:arrows-clockwise-bold :class="{ 'animate-spin': isBusy }" />
              </template>
              Refresh
            </Button>
            <Button size="sm" :disabled="isBusy" @click="handleApplyAndRestart">
              <template #icon>
                <div i-ph:play-bold />
              </template>
              Save & Restart
            </Button>
          </div>
        </div>

        <!-- Servers Grid -->
        <div v-if="status?.servers?.length" class="grid gap-3">
          <div
            v-for="server in status.servers"
            :key="server.name"
            :class="[
              'rounded-xl border transition-all duration-300 overflow-hidden',
              server.state === 'running'
                ? 'border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-500/10 dark:bg-emerald-500/5'
                : server.state === 'error'
                  ? 'border-red-200/50 bg-red-50/30 dark:border-red-500/10 dark:bg-red-500/5'
                  : 'border-neutral-200/50 bg-neutral-100/30 dark:border-neutral-700/50 dark:bg-neutral-800/20',
              expandedServers.has(server.name) ? 'shadow-lg ring-1 ring-black/5 dark:ring-white/5' : '',
            ]"
          >
            <button
              class="group w-full flex items-center justify-between px-4 py-4 text-left"
              @click="toggleServer(server.name)"
            >
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'size-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]',
                    server.state === 'running' ? 'bg-emerald-500 shadow-emerald-500/50' : server.state === 'error' ? 'bg-red-500 shadow-red-500/50' : 'bg-neutral-400',
                    { 'animate-pulse': server.state === 'running' },
                  ]"
                />
                <div class="flex flex-col">
                  <span class="text-sm text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
                    {{ server.name }}
                  </span>
                  <span class="mt-0.5 text-[10px] font-bold leading-none uppercase opacity-40">
                    {{ server.state }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-4">
                <div class="flex flex-col items-end opacity-40 transition-opacity group-hover:opacity-100">
                  <span class="text-[10px] leading-none font-mono tabular-nums">
                    PID: {{ server.pid || 'N/A' }}
                  </span>
                  <span class="mt-1 text-[10px] leading-none font-mono tabular-nums">
                    {{ toolsByServer[server.name]?.length || 0 }} TOOLS
                  </span>
                </div>
                <div
                  :class="[
                    'p-1.5 rounded-full bg-black/5 dark:bg-white/5 transition-transform duration-300',
                    expandedServers.has(server.name) ? 'rotate-180' : '',
                  ]"
                >
                  <div i-ph:caret-down-bold class="text-xs opacity-50" />
                </div>
              </div>
            </button>

            <!-- Expanded Details -->
            <Transition name="expand">
              <div v-if="expandedServers.has(server.name)" class="border-t border-black/5 dark:border-white/5">
                <div class="flex flex-col gap-4 p-4">
                  <!-- Command info -->
                  <div class="flex flex-col gap-1.5 rounded-lg bg-black/5 p-3 dark:bg-white/5">
                    <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Launch Command</span>
                    <code class="break-all text-xs opacity-70">
                      {{ server.command }} {{ server.args.join(' ') }}
                    </code>
                  </div>

                  <!-- Error message -->
                  <div v-if="server.lastError" class="border border-red-500/20 rounded-lg bg-red-500/10 p-3">
                    <span class="text-[10px] text-red-400 font-bold tracking-wider uppercase">Last Error</span>
                    <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                      {{ server.lastError }}
                    </p>
                  </div>

                  <!-- Tools Grid -->
                  <div v-if="toolsByServer[server.name]?.length">
                    <span class="ml-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Tools</span>
                    <div class="grid grid-cols-1 mt-2 gap-2 sm:grid-cols-2">
                      <div
                        v-for="tool in toolsByServer[server.name]"
                        :key="tool.name"
                        class="border border-neutral-100 rounded-xl bg-white p-3 shadow-sm dark:border-neutral-700/50 dark:bg-neutral-800"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <span class="truncate text-xs font-bold">{{ tool.toolName }}</span>
                          <div i-ph:lightning-bold class="shrink-0 text-[10px] opacity-30" />
                        </div>
                        <p v-if="tool.description" class="line-clamp-2 mt-1 text-[10px] text-neutral-500 leading-relaxed">
                          {{ tool.description }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Empty State for Manage Tab -->
        <div v-else class="flex flex-col items-center justify-center border border-neutral-200 rounded-xl border-dashed p-12 text-center dark:border-neutral-800">
          <div i-ph:terminal-window-bold class="mb-4 text-4xl text-neutral-200 dark:text-neutral-700" />
          <p class="text-sm text-neutral-500 font-medium">
            No MCP servers currently active.
          </p>
          <p class="mt-1 text-xs text-neutral-400">
            Visit the "Discover" tab to find and install new servers.
          </p>
        </div>
      </div>
    </div>

    <!-- Discover Tab -->
    <div v-else v-motion-fade class="flex flex-col gap-6">
      <p class="text-xs text-neutral-500">
        Discover third-party plugins created by the community to expand AIRI's capabilities.
      </p>

      <!-- Search Box -->
      <div class="group relative">
        <div class="absolute left-4 top-1/2 text-neutral-400 transition-colors transition-colors duration-300 -translate-y-1/2 group-focus-within:text-emerald-500">
          <div i-ph:magnifying-glass-bold class="text-lg" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search MCP servers (e.g. Google Search, Filesystem)..."
          :class="[
            'w-full pl-12 pr-4 py-4 rounded-2xl text-base',
            'bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-700/50',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all duration-300',
            'shadow-sm hover:shadow-md dark:shadow-none',
          ]"
        >
        <div v-if="isRegistryLoading" class="absolute right-4 top-1/2 -translate-y-1/2">
          <div i-ph:circle-notch-bold class="animate-spin text-emerald-500" />
        </div>
      </div>

      <!-- Registry Grid -->
      <div v-if="registryServers.length" class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          v-for="server in registryServers"
          :key="server.url"
          :class="[
            'group relative flex flex-col p-5 rounded-2xl transition-all duration-300',
            'bg-white/50 dark:bg-neutral-900/40 border border-neutral-200/70 dark:border-neutral-700/50',
            'hover:bg-white hover:shadow-xl hover:-translate-y-1 dark:hover:bg-neutral-800',
          ]"
        >
          <div class="mb-3 flex items-start justify-between gap-4">
            <div class="min-w-0 flex flex-col gap-0.5">
              <h4 class="truncate text-base font-bold transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                {{ server.name }}
              </h4>
              <div v-if="server.github_stars" class="flex items-center gap-1 text-[10px] text-amber-500 font-bold tracking-wider uppercase">
                <div i-ph:star-fill />
                {{ server.github_stars }} stars
              </div>
            </div>

            <Button
              size="sm"
              :variant="isInstalled(server.name) ? 'secondary' : 'primary'"
              :disabled="isBusy || isInstalled(server.name)"
              @click="handleInstall(server)"
            >
              <template #icon>
                <div :i-ph:download-simple-bold="!isInstalled(server.name)" :i-ph:check-bold="isInstalled(server.name)" />
              </template>
              {{ isInstalled(server.name) ? 'Installed' : 'Install' }}
            </Button>
          </div>

          <p class="line-clamp-3 mb-6 flex-grow text-sm text-neutral-500 leading-relaxed">
            {{ server.short_description }}
          </p>

          <div class="mt-auto flex items-center justify-between border-t border-black/5 pt-4 dark:border-white/5">
            <div class="flex items-center gap-2">
              <div
                v-if="server.remotes?.length"
                class="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] text-blue-600 font-bold tracking-widest uppercase dark:bg-blue-500/10 dark:text-blue-400"
              >
                SSE
              </div>
              <div
                class="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] text-neutral-500 font-bold tracking-widest uppercase dark:bg-neutral-800"
              >
                STDIO
              </div>
            </div>
            <a
              v-if="server.source_code_url"
              :href="server.source_code_url"
              target="_blank"
              class="text-neutral-400 transition-colors hover:text-black dark:hover:text-white"
            >
              <div i-ph:github-logo-bold class="text-lg" />
            </a>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!isRegistryLoading" class="flex flex-col items-center justify-center p-12 text-center">
        <div i-ph:ghost-bold class="mb-4 text-5xl text-neutral-200 dark:text-neutral-700" />
        <p class="text-neutral-500">
          {{ searchQuery ? `No servers found matching "${searchQuery}"` : 'Loading registry...' }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 500px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
}

input::placeholder {
  @apply text-neutral-400 opacity-60;
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.mcp-server.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

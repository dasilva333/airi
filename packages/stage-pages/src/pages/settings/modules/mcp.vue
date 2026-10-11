<script setup lang="ts">
import type {
  McpConfigFile,
  McpRuntimeStatus,
  McpServerConfig,
  McpToolDescriptor,
} from '@proj-airi/stage-ui/stores/mcp-tool-bridge'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { tryGetMcpToolBridge } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { Button, FieldInput } from '@proj-airi/ui'
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

import McpConnectionTestPanel from './components/McpConnectionTestPanel.vue'

// UI State
const currentTab = ref<'manage' | 'discover' | 'test'>('manage')
const preselectedTestServer = ref('')
const isBusy = ref(false)
const status = ref<McpRuntimeStatus>()
const tools = ref<McpToolDescriptor[]>([])
const config = ref<McpConfigFile>()
const lastActionMessage = ref('')
const errorMessage = ref('')

// Add Remote Server Modal State
const showAddServerModal = ref(false)
const newServerName = ref('')
const newServerUrl = ref('')
const newServerAuthHeader = ref('')

// Raw JSON Editor Modal State
const showJsonModal = ref(false)
const rawJsonText = ref('')

function handleTestServerFromCard(serverName: string) {
  preselectedTestServer.value = serverName
  currentTab.value = 'test'
}

// Manage Tab State
const expandedServers = ref<Set<string>>(new Set())
const configPath = computed(() => status.value?.path ?? 'settings/mcp/config')

// Discover Tab State
interface RegistryPackage {
  registryType: string
  identifier: string
  version?: string
  runtimeHint?: string
  transport?: {
    type: string
    url?: string
  }
  runtimeArguments?: Array<{ value: string, type?: string }>
  packageArguments?: Array<{ name: string, isRequired?: boolean, type?: string, default?: string, description?: string }>
  environmentVariables?: Array<{ name: string, isRequired?: boolean, isSecret?: boolean, description?: string, default?: string }>
}

interface RegistryRemote {
  type: string
  url: string
  headers?: Array<{ name: string, isRequired?: boolean, isSecret?: boolean }>
}

interface RegistryServer {
  canonicalName: string
  name: string
  short_description: string
  github_stars?: number
  url: string
  source_code_url?: string
  package_name?: string
  packages?: RegistryPackage[]
  remotes?: RegistryRemote[]
}

const searchQuery = ref('')
const registryServers = ref<RegistryServer[]>([])
const isRegistryLoading = ref(false)
const registryError = ref('')

const toolsByServer = computed(() => {
  const map: Record<string, McpToolDescriptor[]> = {}
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

  try {
    const bridge = tryGetMcpToolBridge()
    if (!bridge) {
      status.value = {
        path: 'No MCP Bridge Active',
        updatedAt: Date.now(),
        servers: [],
      }
      return
    }

    const [resStatus, resTools, resConfig] = await Promise.allSettled([
      bridge.getRuntimeStatus(),
      bridge.listTools(),
      bridge.getConfig ? bridge.getConfig() : Promise.resolve({ mcpServers: {} } as McpConfigFile),
    ])

    if (resStatus.status === 'fulfilled' && resStatus.value) {
      status.value = resStatus.value
    }
    else if (resStatus.status === 'rejected') {
      errorMessage.value = `Bridge Error: ${resStatus.reason?.message || resStatus.reason}`
    }

    if (resTools.status === 'fulfilled' && resTools.value) {
      tools.value = resTools.value
    }

    if (resConfig.status === 'fulfilled' && resConfig.value) {
      config.value = resConfig.value
    }
  }
  finally {
    isBusy.value = false
  }
}

async function handleApplyAndRestart() {
  isBusy.value = true
  errorMessage.value = ''
  try {
    const bridge = tryGetMcpToolBridge()
    if (bridge?.applyAndRestart) {
      await bridge.applyAndRestart()
    }
    await refreshStatus()
    lastActionMessage.value = 'MCP servers refreshed and applied.'
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
    throw error
  }
  finally {
    isBusy.value = false
  }
}

async function handleSaveNewServer() {
  const name = newServerName.value.trim()
  const url = newServerUrl.value.trim()
  if (!name || !url) {
    errorMessage.value = 'Server Name and Endpoint URL are required.'
    return
  }

  isBusy.value = true
  errorMessage.value = ''
  try {
    const bridge = tryGetMcpToolBridge()
    if (!bridge?.updateConfig) {
      throw new Error('Bridge cannot update configuration in this runtime.')
    }

    const headers: Record<string, string> = {}
    if (newServerAuthHeader.value.trim()) {
      headers.Authorization = newServerAuthHeader.value.trim()
    }

    const nextConfig = {
      ...config.value?.mcpServers,
      [name]: {
        url,
        headers: Object.keys(headers).length ? headers : undefined,
        enabled: true,
      },
    }

    await bridge.updateConfig({ mcpServers: nextConfig })
    showAddServerModal.value = false
    newServerName.value = ''
    newServerUrl.value = ''
    newServerAuthHeader.value = ''
    lastActionMessage.value = `Added server "${name}" successfully.`
    await handleApplyAndRestart()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
}

async function handleDeleteServer(serverName: string) {
  isBusy.value = true
  errorMessage.value = ''
  try {
    const bridge = tryGetMcpToolBridge()
    if (!bridge?.updateConfig || !config.value?.mcpServers)
      return

    const nextMcpServers = { ...config.value.mcpServers }
    delete nextMcpServers[serverName]

    await bridge.updateConfig({
      mcpServers: nextMcpServers,
    })
    await handleApplyAndRestart()
    lastActionMessage.value = `Deleted server "${serverName}"`
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
}

async function handleToggleServerEnabled(serverName: string) {
  isBusy.value = true
  errorMessage.value = ''
  try {
    const bridge = tryGetMcpToolBridge()
    const target = config.value?.mcpServers?.[serverName]
    if (!bridge?.updateConfig || !target)
      return

    const currentEnabled = target.enabled !== false
    const nextConfig = {
      ...config.value?.mcpServers,
      [serverName]: {
        ...target,
        enabled: !currentEnabled,
      },
    }

    await bridge.updateConfig({ mcpServers: nextConfig })
    await handleApplyAndRestart()
    lastActionMessage.value = `${currentEnabled ? 'Disabled' : 'Enabled'} server "${serverName}"`
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
}

function handleOpenJsonModal() {
  rawJsonText.value = JSON.stringify(config.value || { mcpServers: {} }, null, 2)
  showJsonModal.value = true
}

async function handleSaveRawJson() {
  isBusy.value = true
  errorMessage.value = ''
  try {
    const parsed = JSON.parse(rawJsonText.value)
    const bridge = tryGetMcpToolBridge()
    if (!bridge?.updateConfig) {
      throw new Error('Bridge cannot update configuration in this runtime.')
    }
    await bridge.updateConfig(parsed)
    showJsonModal.value = false
    await handleApplyAndRestart()
    lastActionMessage.value = 'Updated MCP configuration.'
  }
  catch (err: any) {
    errorMessage.value = `Invalid JSON: ${err.message}`
  }
  finally {
    isBusy.value = false
  }
}

// Registry Fetching
let latestSearchSeq = 0

const fetchRegistry = useDebounceFn(async (query: string) => {
  const currentSeq = ++latestSearchSeq
  isRegistryLoading.value = true
  registryError.value = ''
  try {
    const url = new URL('https://registry.modelcontextprotocol.io/v0.1/servers')
    url.searchParams.set('version', 'latest')
    url.searchParams.set('limit', '30')
    const trimmedQuery = query.trim()
    if (trimmedQuery)
      url.searchParams.set('search', trimmedQuery)

    const response = await fetch(url.toString())
    if (!response.ok)
      throw new Error(`Registry API error: ${response.status} ${response.statusText}`)

    const data = await response.json()
    if (currentSeq !== latestSearchSeq)
      return

    const rawServers: any[] = data.servers || []
    let servers: RegistryServer[] = rawServers.map((entry: any) => {
      const s = entry.server || entry
      const pkg = s.packages?.[0]
      return {
        canonicalName: s.name,
        name: s.title || s.name,
        short_description: s.description || '',
        url: s.websiteUrl || s.repository?.url || '',
        source_code_url: s.repository?.url || '',
        package_name: pkg?.identifier || s.name,
        packages: s.packages || [],
        remotes: s.remotes || [],
      }
    })

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

    if (currentSeq === latestSearchSeq) {
      registryServers.value = servers
    }
  }
  catch (error) {
    if (currentSeq === latestSearchSeq) {
      registryError.value = 'Failed to load registry.'
      console.error(error)
    }
  }
  finally {
    if (currentSeq === latestSearchSeq) {
      isRegistryLoading.value = false
    }
  }
}, 300)

async function handleInstallRegistryServer(server: RegistryServer) {
  const streamableRemote = server.remotes?.find(r => r.type === 'streamable-http' || r.type === 'http')

  if (!isStageTamagotchi() && !streamableRemote) {
    errorMessage.value = `Server "${server.name}" uses local stdio processes, which require the AIRI Desktop app. In Web mode, please connect Remote HTTP endpoints.`
    return
  }

  isBusy.value = true
  errorMessage.value = ''
  try {
    const bridge = tryGetMcpToolBridge()
    if (!bridge?.updateConfig)
      throw new Error('Bridge cannot update config.')

    const slug = (server.package_name || server.canonicalName || server.name).toLowerCase().replace(/\s+/g, '-')

    let serverConfig: McpServerConfig

    if (streamableRemote) {
      serverConfig = {
        url: streamableRemote.url,
        enabled: true,
      }
    }
    else {
      // Desktop stdio fallback
      serverConfig = {
        command: 'npx',
        args: ['-y', server.package_name || slug],
        enabled: true,
      }
    }

    await bridge.updateConfig({
      mcpServers: {
        ...config.value?.mcpServers,
        [slug]: serverConfig,
      },
    })

    await handleApplyAndRestart()
    currentTab.value = 'manage'
    lastActionMessage.value = `Installed "${server.name}" successfully.`
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
}

function isInstalled(server: RegistryServer) {
  const slug = (server.package_name || server.canonicalName || server.name).toLowerCase().replace(/\s+/g, '-')
  return !!config.value?.mcpServers?.[slug]
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
          MCP Servers & Tools
        </h2>
        <p class="text-neutral-500">
          Connect and manage Model Context Protocol (MCP) servers to give AIRI extensible tool capabilities.
        </p>
      </div>

      <!-- Tab Switcher -->
      <div :class="['flex items-center gap-1 p-1 rounded-lg w-fit', 'bg-neutral-200/50 dark:bg-neutral-800/50']">
        <button
          v-for="tab in (['manage', 'discover', 'test'] as const)"
          :key="tab"
          :class="[
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
            currentTab === tab
              ? 'bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
          ]"
          @click="currentTab = tab"
        >
          {{ tab === 'manage' ? 'Manage' : tab === 'discover' ? 'Discover' : 'Test Connection' }}
        </button>
      </div>
    </div>

    <!-- Feedback Area -->
    <Transition name="fade">
      <div v-if="lastActionMessage || errorMessage" class="flex flex-col gap-2">
        <div
          v-if="lastActionMessage"
          class="border border-emerald-200 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {{ lastActionMessage }}
        </div>
        <div
          v-if="errorMessage"
          class="border border-red-200 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
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
              <span class="font-medium">Storage:</span> {{ configPath || '-' }}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Button size="sm" @click="showAddServerModal = true">
              <template #icon>
                <div i-solar:add-circle-bold-duotone />
              </template>
              Add Server
            </Button>
            <Button variant="secondary" size="sm" :disabled="isBusy" @click="handleOpenJsonModal">
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
              Reconnect
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
                    {{ server.transport === 'http' ? 'REMOTE HTTP' : `PID: ${server.pid || 'N/A'}` }}
                  </span>
                  <span class="mt-1 text-[10px] leading-none font-mono tabular-nums">
                    {{ toolsByServer[server.name]?.length || 0 }} TOOLS
                  </span>
                </div>
                <div
                  :class="[
                    'text-neutral-400 transition-transform duration-200',
                    expandedServers.has(server.name) ? 'rotate-180' : '',
                  ]"
                  i-ph:caret-down-bold
                />
              </div>
            </button>

            <!-- Expanded Server Details -->
            <div
              v-if="expandedServers.has(server.name)"
              class="flex flex-col gap-4 border-t border-black/5 bg-black/[0.01] p-4 dark:border-white/5 dark:bg-white/[0.01]"
            >
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">Endpoint / Command</span>
                  <span
                    :class="[
                      'px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold',
                      server.transport === 'http' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    ]"
                  >
                    {{ server.transport === 'http' ? 'Streamable HTTP' : 'Local Stdio' }}
                  </span>
                </div>
                <code class="break-all rounded-lg bg-neutral-200/50 p-2.5 text-xs font-mono dark:bg-neutral-800/50">
                  {{ server.transport === 'http' ? server.url : `${server.command} ${(server.args || []).join(' ')}` }}
                </code>
              </div>

              <!-- Tools List -->
              <div v-if="toolsByServer[server.name]?.length" class="flex flex-col gap-2">
                <span class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">Discovered Tools</span>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="t in toolsByServer[server.name]"
                    :key="t.name"
                    class="rounded-md bg-neutral-200/60 px-2 py-1 text-xs text-neutral-700 font-mono dark:bg-neutral-800/60 dark:text-neutral-300"
                    :title="t.description"
                  >
                    {{ t.toolName }}
                  </span>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center justify-end gap-2 border-t border-black/5 pt-3 dark:border-white/5">
                <Button
                  size="sm"
                  variant="secondary"
                  @click="handleTestServerFromCard(server.name)"
                >
                  <template #icon>
                    <div i-solar:plug-circle-bold-duotone />
                  </template>
                  Test Connection
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  @click="handleToggleServerEnabled(server.name)"
                >
                  {{ config?.mcpServers?.[server.name]?.enabled === false ? 'Enable' : 'Disable' }}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  @click="handleDeleteServer(server.name)"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="border border-black/10 rounded-xl border-dashed p-8 text-center text-xs text-neutral-400 dark:border-white/10">
          No MCP servers currently configured. Click "Add Server" or explore the "Discover" tab to add endpoints.
        </div>
      </div>
    </div>

    <!-- Discover Tab -->
    <div v-if="currentTab === 'discover'" v-motion-fade class="flex flex-col gap-6">
      <div class="flex items-center gap-3">
        <FieldInput
          v-model="searchQuery"
          placeholder="Search PulseMCP registry (e.g. fetch, weather, remote)..."
          class="flex-1"
          @input="fetchRegistry(searchQuery)"
        />
      </div>

      <div v-if="isRegistryLoading" class="py-12 text-center text-sm text-neutral-400">
        Searching MCP servers...
      </div>

      <div v-else-if="registryServers.length > 0" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          v-for="server in registryServers"
          :key="server.canonicalName"
          class="flex flex-col justify-between gap-3 border border-black/5 rounded-xl bg-white/40 p-4 backdrop-blur-sm dark:border-white/5 dark:bg-neutral-900/30"
        >
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-bold">{{ server.name }}</span>
              <span
                v-if="server.remotes?.length"
                class="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-600 font-bold uppercase dark:text-sky-400"
              >
                Remote HTTP
              </span>
            </div>
            <p class="line-clamp-2 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              {{ server.short_description }}
            </p>
          </div>

          <div class="flex items-center justify-between pt-2">
            <a
              v-if="server.source_code_url"
              :href="server.source_code_url"
              target="_blank"
              rel="noreferrer"
              class="text-xs text-primary-500 hover:underline"
            >
              Source
            </a>
            <div v-else />

            <Button
              size="sm"
              :variant="isInstalled(server) ? 'secondary' : 'primary'"
              :disabled="isInstalled(server)"
              @click="handleInstallRegistryServer(server)"
            >
              {{ isInstalled(server) ? 'Installed' : 'Install' }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Test Connection Tab -->
    <div v-if="currentTab === 'test'" v-motion-fade class="flex flex-col gap-6">
      <McpConnectionTestPanel
        :config="config"
        :initial-server="preselectedTestServer"
      />
    </div>

    <!-- Add Server Dialog -->
    <div
      v-if="showAddServerModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div class="max-w-md w-full flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
        <h3 class="text-lg font-bold">
          Add Remote MCP Server
        </h3>
        <p class="text-xs text-neutral-500">
          Connect a remote streamable HTTP MCP server to provide tools in this runtime.
        </p>

        <div class="flex flex-col gap-3">
          <FieldInput
            v-model="newServerName"
            label="Server Identifier"
            placeholder="e.g. weather-api"
          />
          <FieldInput
            v-model="newServerUrl"
            label="Endpoint URL"
            placeholder="https://example.com/api/mcp"
          />
          <FieldInput
            v-model="newServerAuthHeader"
            label="Authorization Header (Optional)"
            placeholder="Bearer token..."
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="secondary" @click="showAddServerModal = false">
            Cancel
          </Button>
          <Button :disabled="!newServerName || !newServerUrl" @click="handleSaveNewServer">
            Add Endpoint
          </Button>
        </div>
      </div>
    </div>

    <!-- Edit JSON Dialog -->
    <div
      v-if="showJsonModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div class="max-w-xl w-full flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
        <h3 class="text-lg font-bold">
          Edit MCP Configuration JSON
        </h3>
        <textarea
          v-model="rawJsonText"
          class="h-64 w-full border border-black/10 rounded-lg bg-neutral-50 p-3 text-xs font-mono dark:border-white/10 dark:bg-neutral-950"
        />
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="showJsonModal = false">
            Cancel
          </Button>
          <Button @click="handleSaveRawJson">
            Save
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.mcp-server.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

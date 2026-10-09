<script setup lang="ts">
import type {
  ElectronMcpConfigFile,
  ElectronMcpServerConfig,
  ElectronMcpTestResult,
} from '../../../../../shared/eventa'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { Button, Callout, FieldInput, FieldSelect } from '@proj-airi/ui'
import { computed, ref, watch } from 'vue'

import { electronMcpTestServer } from '../../../../../shared/eventa'

const props = defineProps<{
  config?: ElectronMcpConfigFile
  initialServer?: string
}>()

const emit = defineEmits<{
  tested: [result: ElectronMcpTestResult]
}>()

const invokeTestServer = useElectronEventaInvoke(electronMcpTestServer)

// Mode: pick configured server or test ad-hoc target
const testMode = ref<'configured' | 'adhoc'>('configured')
const selectedServer = ref(props.initialServer || '')

// Ad-hoc configuration
const adhocName = ref('adhoc-test')
const adhocTransport = ref<'http' | 'stdio'>('http')
const adhocUrl = ref('')
const adhocAuthHeader = ref('')
const adhocCommand = ref('npx')
const adhocArgs = ref('-y @modelcontextprotocol/server-filesystem')

const isTesting = ref(false)
const testResult = ref<ElectronMcpTestResult>()

watch(() => props.initialServer, (newVal) => {
  if (newVal) {
    selectedServer.value = newVal
    testMode.value = 'configured'
  }
})

// Options for configured servers
const serverOptions = computed(() => {
  const servers = props.config?.mcpServers || {}
  const list = Object.keys(servers).map(name => ({
    label: `${name} (${'url' in servers[name] ? 'Remote HTTP' : 'Local Stdio'})`,
    value: name,
  }))
  if (list.length && !selectedServer.value) {
    selectedServer.value = list[0].value
  }
  return list
})

const activeServerConfig = computed(() => {
  if (testMode.value !== 'configured')
    return undefined
  return props.config?.mcpServers?.[selectedServer.value]
})

async function runTest(targetOverrideName?: string) {
  let name = ''
  let targetConfig: ElectronMcpServerConfig | undefined

  if (targetOverrideName) {
    selectedServer.value = targetOverrideName
    testMode.value = 'configured'
  }

  if (testMode.value === 'configured') {
    if (!selectedServer.value || !props.config?.mcpServers?.[selectedServer.value]) {
      testResult.value = {
        ok: false,
        error: 'Please select a valid configured server to test.',
        durationMs: 0,
      }
      return
    }
    name = selectedServer.value
    targetConfig = props.config.mcpServers[name]
  }
  else {
    name = adhocName.value.trim() || 'adhoc-test'
    if (adhocTransport.value === 'http') {
      if (!adhocUrl.value.trim()) {
        testResult.value = {
          ok: false,
          error: 'Please provide an absolute HTTP or HTTPS URL to test.',
          durationMs: 0,
        }
        return
      }
      const headers: Record<string, string> = {}
      if (adhocAuthHeader.value.trim()) {
        headers.Authorization = adhocAuthHeader.value.trim()
      }
      targetConfig = {
        url: adhocUrl.value.trim(),
        headers: Object.keys(headers).length ? headers : undefined,
      }
    }
    else {
      if (!adhocCommand.value.trim()) {
        testResult.value = {
          ok: false,
          error: 'Please provide a valid launch command (e.g. npx).',
          durationMs: 0,
        }
        return
      }
      const args = adhocArgs.value.trim() ? adhocArgs.value.trim().split(/\s+/) : []
      targetConfig = {
        command: adhocCommand.value.trim(),
        args,
      }
    }
  }

  isTesting.value = true
  testResult.value = undefined

  try {
    const res = await invokeTestServer({
      name,
      config: targetConfig,
    })
    testResult.value = res
    emit('tested', res)
  }
  catch (err: any) {
    testResult.value = {
      ok: false,
      error: err?.message || String(err),
      durationMs: 0,
    }
  }
  finally {
    isTesting.value = false
  }
}

defineExpose({
  testServer: runTest,
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Main Card -->
    <div
      :class="[
        'rounded-2xl p-6',
        'border border-neutral-200/70 bg-white/50 backdrop-blur-sm dark:border-neutral-700/50 dark:bg-neutral-900/40',
        'flex flex-col gap-6 shadow-sm',
      ]"
    >
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <div i-solar:plug-circle-bold-duotone class="text-xl text-primary-500" />
          <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
            MCP Connection Test Bench
          </h3>
        </div>
        <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
          Briefly probe an MCP server over stdio or streamable HTTP to verify connectivity, measure round-trip latency, and inspect exposed tool signatures.
        </p>
      </div>

      <!-- Mode Selector -->
      <div class="flex items-center gap-2 border-b border-black/5 pb-4 dark:border-white/5">
        <button
          type="button"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            testMode === 'configured'
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200',
          ]"
          @click="testMode = 'configured'"
        >
          Configured Server
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            testMode === 'adhoc'
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200',
          ]"
          @click="testMode = 'adhoc'"
        >
          Ad-Hoc / Custom Endpoint
        </button>
      </div>

      <!-- Mode: Configured Server -->
      <div v-if="testMode === 'configured'" class="flex flex-col gap-4">
        <div v-if="serverOptions.length > 0" class="flex flex-wrap items-end gap-3">
          <FieldSelect
            v-model="selectedServer"
            layout="vertical"
            class="min-w-64 flex-1"
            label="Target Server"
            description="Select an active server from mcp.json"
            :options="serverOptions"
            :disabled="isTesting"
          />

          <Button
            size="md"
            :loading="isTesting"
            :disabled="isTesting || !selectedServer"
            @click="runTest()"
          >
            <template #icon>
              <div i-solar:play-circle-bold-duotone />
            </template>
            Test Connection
          </Button>
        </div>

        <div v-else class="border border-neutral-300 rounded-xl border-dashed p-6 text-center text-xs text-neutral-400 dark:border-neutral-700">
          No MCP servers found in mcp.json. Add one in the Manage or Discover tab first.
        </div>

        <!-- Target Summary Preview -->
        <div
          v-if="activeServerConfig"
          class="flex flex-col gap-1.5 rounded-xl bg-black/5 p-3 text-xs dark:bg-white/5"
        >
          <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            {{ 'url' in activeServerConfig ? 'Target URL' : 'Launch Target' }}
          </span>
          <code class="break-all font-mono opacity-80">
            {{ 'url' in activeServerConfig ? activeServerConfig.url : `${activeServerConfig.command} ${(activeServerConfig.args || []).join(' ')}`.trim() }}
          </code>
        </div>
      </div>

      <!-- Mode: Ad-Hoc Target -->
      <div v-else class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
            <input
              v-model="adhocTransport"
              type="radio"
              value="http"
              class="text-primary-500"
            >
            <span>Streamable HTTP Remote</span>
          </label>
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
            <input
              v-model="adhocTransport"
              type="radio"
              value="stdio"
              class="text-primary-500"
            >
            <span>Local Stdio Process</span>
          </label>
        </div>

        <!-- HTTP Fields -->
        <div v-if="adhocTransport === 'http'" class="flex flex-col gap-3">
          <FieldInput
            v-model="adhocUrl"
            label="Remote Endpoint URL"
            placeholder="https://example.com/api/mcp"
            description="Absolute HTTP or HTTPS endpoint supporting streamable HTTP"
          />
          <FieldInput
            v-model="adhocAuthHeader"
            label="Authorization Header (Optional)"
            placeholder="Bearer secret_token_here"
            description="Optional credentials sent with the test connection"
          />
        </div>

        <!-- Stdio Fields -->
        <div v-else class="flex flex-col gap-3">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldInput
              v-model="adhocCommand"
              label="Executable Command"
              placeholder="npx"
            />
            <FieldInput
              v-model="adhocArgs"
              label="Command Arguments"
              placeholder="-y @modelcontextprotocol/server-filesystem"
            />
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <Button
            size="md"
            :loading="isTesting"
            :disabled="isTesting"
            @click="runTest()"
          >
            <template #icon>
              <div i-solar:play-circle-bold-duotone />
            </template>
            Probe Endpoint
          </Button>
        </div>
      </div>

      <!-- Test Results Callout -->
      <Transition name="fade">
        <div v-if="testResult" class="flex flex-col gap-3 border-t border-black/5 pt-4 dark:border-white/5">
          <Callout
            :theme="testResult.ok ? 'lime' : 'orange'"
            :label="testResult.ok
              ? `Connection Successful (${testResult.durationMs}ms) — ${testResult.tools?.length || 0} tools discovered`
              : `Connection Failed (${testResult.durationMs}ms)`"
          >
            <div v-if="!testResult.ok && testResult.error" class="whitespace-pre-wrap break-all text-xs leading-relaxed font-mono opacity-90">
              {{ testResult.error }}
            </div>

            <div v-if="testResult.ok && testResult.tools?.length" class="flex flex-wrap gap-1.5 pt-1 text-xs">
              <span
                v-for="toolName in testResult.tools"
                :key="toolName"
                class="flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1 text-emerald-800 font-mono dark:bg-emerald-400/20 dark:text-emerald-200"
              >
                <div i-ph:lightning-bold class="text-[10px] opacity-60" />
                <span>{{ toolName }}</span>
              </span>
            </div>

            <div v-if="testResult.ok && (!testResult.tools || !testResult.tools.length)" class="text-xs text-neutral-500 italic">
              Connected successfully, but server returned zero tools.
            </div>
          </Callout>
        </div>
      </Transition>
    </div>
  </div>
</template>

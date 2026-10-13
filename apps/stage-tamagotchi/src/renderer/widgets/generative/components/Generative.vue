<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useSandbox } from '@proj-airi/stage-ui/composables/use-sandbox'
import { buildWidgetIframeSrcdoc } from '@proj-airi/stage-ui/libs/sandbox'
import { tryGetMcpToolBridge } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { electronOpenMainDevtools } from '../../../../shared/eventa'

const props = withDefaults(defineProps<{
  id?: string
  title?: string
  path?: string
  code?: string
  modelValue?: Record<string, any>
  size?: 's' | 'm' | 'l' | { cols?: number, rows?: number }
}>(), {
  id: '',
  title: 'Generative Widget',
  path: '',
  code: '',
})

const openDevTools = useElectronEventaInvoke(electronOpenMainDevtools)
const { init, mountedWidgets, readFile } = useSandbox()

const resolvedWidget = computed(() => {
  if (props.id) {
    const found = mountedWidgets.value.find(w => w.id === props.id)
    if (found) {
      return {
        id: found.id,
        title: found.title || props.title || 'Generative Widget',
        path: found.path,
        sourcePath: found.sourcePath,
        code: found.code,
        state: found.state,
      }
    }
  }
  return {
    id: props.id || 'widget-standalone',
    title: props.title || 'Generative Widget',
    path: props.path || '/workspace/widget.js',
    sourcePath: undefined,
    code: props.code || '',
    state: undefined,
  }
})

const displayTitle = computed(() => resolvedWidget.value.title || 'Generative Widget')
const iframeSrcdoc = ref('')
const isLoading = ref(false)
const iframeKey = ref(0)
const errorMessage = ref<string | null>(null)

async function refresh() {
  isLoading.value = true
  errorMessage.value = null
  try {
    let code = resolvedWidget.value.code
    const path = resolvedWidget.value.path
    if (!code && path) {
      try {
        code = await readFile(path)
      }
      catch {}
    }
    iframeSrcdoc.value = await buildWidgetIframeSrcdoc({
      id: resolvedWidget.value.id,
      path: path || '/workspace/widget.js',
      sourcePath: resolvedWidget.value.sourcePath,
      code: code || '',
      title: displayTitle.value,
      state: resolvedWidget.value.state,
    }, readFile)
    iframeKey.value++
  }
  catch (err: any) {
    errorMessage.value = err.message || 'Failed to render widget'
  }
  finally {
    isLoading.value = false
  }
}

function handleIframeMessage(e: MessageEvent) {
  if (e.data?.type === 'open-devtools') {
    void openDevTools?.()
    return
  }

  if (e.data?.type === 'mcp-call') {
    const { id, name, args } = e.data
    const bridge = tryGetMcpToolBridge()
    const target = e.source as WindowProxy | null
    if (!bridge) {
      target?.postMessage({ type: 'mcp-call-result', id, error: 'MCP tool bridge not available' }, '*')
      return
    }
    bridge.callTool({ name, arguments: args })
      .then((res) => {
        if (res.isError) {
          target?.postMessage({ type: 'mcp-call-result', id, error: String(res.toolResult || 'MCP tool execution failed') }, '*')
        }
        else {
          target?.postMessage({ type: 'mcp-call-result', id, result: res.structuredContent ?? res.toolResult ?? res.content }, '*')
        }
      })
      .catch((err: any) => {
        target?.postMessage({ type: 'mcp-call-result', id, error: err.message || 'MCP tool error' }, '*')
      })
  }
}

watch(() => [resolvedWidget.value.code, resolvedWidget.value.path], () => {
  void refresh()
}, { immediate: true })

onMounted(async () => {
  window.addEventListener('message', handleIframeMessage)
  await init?.()
  void refresh()
})

onUnmounted(() => {
  window.removeEventListener('message', handleIframeMessage)
})
</script>

<template>
  <div class="h-full w-full flex flex-col select-none overflow-hidden border border-neutral-700/60 rounded-2xl bg-neutral-900/90 shadow-2xl backdrop-blur-xl">
    <!-- Header Bar with clearance for window drag pill (center) and close button (right) -->
    <div class="h-10 flex shrink-0 items-center justify-between border-b border-neutral-800/80 bg-neutral-950/40 px-3">
      <div class="max-w-[45%] flex items-center gap-2">
        <span class="i-solar:widget-5-bold-duotone shrink-0 text-sm text-primary-400" />
        <span class="truncate text-xs text-neutral-200 font-semibold">{{ displayTitle }}</span>
      </div>
      <!-- Right controls: reload button with right margin for close button (✕ at top-2 right-2) -->
      <div class="mr-9 flex items-center gap-1.5">
        <button
          title="Reload widget canvas"
          class="size-6 flex items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800/60 hover:text-neutral-100"
          @click="refresh"
        >
          <span class="i-solar:refresh-linear text-xs" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Iframe Container taking full remaining space -->
    <div class="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-transparent">
      <div v-if="isLoading" class="backdrop-blur-xs absolute inset-0 z-10 flex items-center justify-center bg-black/40">
        <span class="i-solar:refresh-linear animate-spin text-xl text-primary-400" />
      </div>
      <iframe
        :key="iframeKey"
        :srcdoc="iframeSrcdoc"
        sandbox="allow-scripts allow-forms allow-popups"
        class="h-full w-full border-none bg-transparent"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComfyUIWorkflowTemplate } from '@proj-airi/stage-ui/stores/modules/artistry'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { artistryComfyHealthCheck } from '@proj-airi/stage-shared'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

const artistryStore = useArtistryStore()

const {
  comfyuiServerUrl,
  comfyuiSavedWorkflows,
  comfyuiActiveWorkflow,
} = storeToRefs(artistryStore)

const expandedWorkflow = ref<string | null>(null)

// --- Connection test ---
const connectionStatus = ref<'idle' | 'testing' | 'connected' | 'failed'>('idle')
const connectionInfo = ref('')
const isCorsError = ref(false)

const healthCheck = (window as any).electron ? useElectronEventaInvoke(artistryComfyHealthCheck) : null

async function testConnection() {
  connectionStatus.value = 'testing'
  connectionInfo.value = ''
  isCorsError.value = false
  try {
    const url = comfyuiServerUrl.value.replace(/\/+$/, '')

    let result: { gpus: string, vramStr: string }

    if (healthCheck) {
      result = await healthCheck({ url })
    }
    else {
      // Browser fallback: direct fetch to /system_stats
      const response = await fetch(`${url}/system_stats`, {
        method: 'GET',
        mode: 'cors',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const devices = data.devices || []
      const gpuNames = devices.map((d: any) => d.name).join(', ') || 'Unknown GPU'
      const vramTotal = devices.reduce((acc: number, d: any) => acc + (d.vram_total || 0), 0)
      const vramStr = vramTotal ? `${(vramTotal / (1024 ** 3)).toFixed(1)}GB` : ''

      result = { gpus: gpuNames, vramStr }
    }

    const { gpus, vramStr } = result
    connectionInfo.value = `Connected — ${gpus}${vramStr ? ` (${vramStr} VRAM)` : ''}`
    connectionStatus.value = 'connected'
  }
  catch (e: any) {
    if (e.message.toLowerCase().includes('fetch') || e.message.includes('CORS') || e.message.includes('Forbidden')) {
      isCorsError.value = true
    }
    connectionInfo.value = `Failed: ${e.message}`
    connectionStatus.value = 'failed'
  }
}

// --- Workflow Upload & Modal Target Configurator ---
const isModalOpen = ref(false)
const uploadError = ref('')
const successBannerMessage = ref('')
const pendingWorkflowName = ref('')
const pendingWorkflowRaw = ref<Record<string, any> | null>(null)

interface ParsedNode {
  id: string
  title: string
  type: string
  inputs: Record<string, any>
}

const parsedNodes = ref<ParsedNode[]>([])

// Prompt Target Selection
const promptNodeId = ref<string>('')
const promptProperty = ref<string>('')

// Image Target Selection (Optional)
const imageNodeId = ref<string>('')
const imageProperty = ref<string>('')

// Computed options for Prompt Node dropdown
const promptNodeOptions = computed(() => {
  return parsedNodes.value.map(n => ({
    id: n.id,
    label: `${n.title} (${n.type}) [ID: ${n.id}]`,
  }))
})

// Computed options for Prompt Property dropdown based on selected promptNodeId
const promptPropertyOptions = computed(() => {
  const node = parsedNodes.value.find(n => n.id === promptNodeId.value)
  if (!node)
    return []
  return Object.keys(node.inputs)
    .filter(key => !Array.isArray(node.inputs[key])) // Exclude link arrays
})

// Current value preview for selected prompt property
const promptPropertyValuePreview = computed(() => {
  const node = parsedNodes.value.find(n => n.id === promptNodeId.value)
  if (!node || !promptProperty.value)
    return ''
  const val = node.inputs[promptProperty.value]
  return typeof val === 'string' ? val : JSON.stringify(val)
})

// Computed options for Image Node dropdown
const imageNodeOptions = computed(() => {
  return [
    { id: '', label: '(None - Text to Image Only)' },
    ...parsedNodes.value.map(n => ({
      id: n.id,
      label: `${n.title} (${n.type}) [ID: ${n.id}]`,
    })),
  ]
})

// Computed options for Image Property dropdown based on selected imageNodeId
const imagePropertyOptions = computed(() => {
  const node = parsedNodes.value.find(n => n.id === imageNodeId.value)
  if (!node)
    return []
  return Object.keys(node.inputs)
    .filter(key => !Array.isArray(node.inputs[key]))
})

// Current value preview for selected image property
const imagePropertyValuePreview = computed(() => {
  const node = parsedNodes.value.find(n => n.id === imageNodeId.value)
  if (!node || !imageProperty.value)
    return ''
  const val = node.inputs[imageProperty.value]
  return typeof val === 'string' ? val : JSON.stringify(val)
})

// Reset property selection when node selection changes
watch(promptNodeId, () => {
  const props = promptPropertyOptions.value
  if (props.length > 0) {
    // Smart auto-select 'text', 'value', or 'prompt' if available
    const preferred = props.find(p => ['text', 'value', 'prompt', 'string'].includes(p.toLowerCase()))
    promptProperty.value = preferred || props[0]
  }
  else {
    promptProperty.value = ''
  }
})

watch(imageNodeId, () => {
  const props = imagePropertyOptions.value
  if (props.length > 0) {
    const preferred = props.find(p => p.toLowerCase().includes('image'))
    imageProperty.value = preferred || props[0]
  }
  else {
    imageProperty.value = ''
  }
})

function handleFileUpload(event: Event) {
  uploadError.value = ''
  successBannerMessage.value = ''
  pendingWorkflowRaw.value = null
  parsedNodes.value = []
  promptNodeId.value = ''
  promptProperty.value = ''
  imageNodeId.value = ''
  imageProperty.value = ''

  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target?.result as string)
      pendingWorkflowRaw.value = json
      pendingWorkflowName.value = file.name.replace(/\.json$/, '')

      const nodes: ParsedNode[] = []
      for (const [nodeId, node] of Object.entries(json as Record<string, any>)) {
        if (node?.inputs && typeof node.inputs === 'object') {
          const title = node._meta?.title || node.class_type || `Node ${nodeId}`
          const type = node.class_type || 'Unknown'
          nodes.push({
            id: nodeId,
            title,
            type,
            inputs: node.inputs,
          })
        }
      }

      if (nodes.length === 0) {
        uploadError.value = 'No valid node structures found in this workflow JSON file.'
        input.value = ''
        return
      }

      parsedNodes.value = nodes

      // Auto-detect best candidate node for Prompt Target
      const defaultPromptNode = nodes.find(n =>
        n.inputs && ('text' in n.inputs || 'value' in n.inputs || 'prompt' in n.inputs)
        && n.type.toLowerCase().includes('textencode'),
      ) || nodes.find(n => n.inputs && ('text' in n.inputs || 'value' in n.inputs || 'prompt' in n.inputs)) || nodes[0]

      if (defaultPromptNode) {
        promptNodeId.value = defaultPromptNode.id
      }

      // Auto-detect LoadImage node for Image Target
      const defaultImageNode = nodes.find(n => n.type.toLowerCase().includes('loadimage') || (n.inputs && 'image' in n.inputs))
      if (defaultImageNode) {
        imageNodeId.value = defaultImageNode.id
      }

      isModalOpen.value = true
      input.value = ''
    }
    catch (err: any) {
      uploadError.value = `Invalid JSON file: ${err.message}`
      input.value = ''
    }
  }
  reader.readAsText(file)
}

function saveWorkflow() {
  if (!pendingWorkflowRaw.value || !pendingWorkflowName.value.trim() || !promptNodeId.value || !promptProperty.value)
    return

  const targetPromptNode = parsedNodes.value.find(n => n.id === promptNodeId.value)
  if (!targetPromptNode)
    return

  // Deep clone workflow JSON to apply any image placeholders
  const workflowClone = JSON.parse(JSON.stringify(pendingWorkflowRaw.value))

  // If an image target was specified, inject {{IMAGE}} into its property input
  if (imageNodeId.value && imageProperty.value && workflowClone[imageNodeId.value]?.inputs) {
    workflowClone[imageNodeId.value].inputs[imageProperty.value] = '{{IMAGE}}'
  }

  const id = pendingWorkflowName.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const template: ComfyUIWorkflowTemplate = {
    id,
    name: pendingWorkflowName.value.trim(),
    workflow: workflowClone,
    exposedFields: {
      [targetPromptNode.title]: [promptProperty.value],
    },
  }

  const existing = comfyuiSavedWorkflows.value.findIndex(w => w.id === id)
  if (existing >= 0) {
    comfyuiSavedWorkflows.value[existing] = template
  }
  else {
    comfyuiSavedWorkflows.value = [...comfyuiSavedWorkflows.value, template]
  }

  // Auto-set as active if it's the first one
  if (!comfyuiActiveWorkflow.value) {
    comfyuiActiveWorkflow.value = id
  }

  successBannerMessage.value = `Workflow "${template.name}" successfully saved!`

  closeModal()
}

function closeModal() {
  isModalOpen.value = false
  pendingWorkflowRaw.value = null
  parsedNodes.value = []
  promptNodeId.value = ''
  promptProperty.value = ''
  imageNodeId.value = ''
  imageProperty.value = ''
}

function removeWorkflow(id: string) {
  comfyuiSavedWorkflows.value = comfyuiSavedWorkflows.value.filter(w => w.id !== id)
  if (comfyuiActiveWorkflow.value === id) {
    comfyuiActiveWorkflow.value = comfyuiSavedWorkflows.value[0]?.id || ''
  }
}

function generateExampleJson(wf: ComfyUIWorkflowTemplate) {
  const example: Record<string, any> = {
    template: wf.id,
  }
  for (const [nodeTitle, fields] of Object.entries(wf.exposedFields)) {
    example[nodeTitle] = {}
    for (const field of fields) {
      const nodeId = Object.keys(wf.workflow).find(id => (wf.workflow[id]._meta?.title || wf.workflow[id].class_type) === nodeTitle)
      const val = nodeId ? wf.workflow[nodeId].inputs[field] : '...'
      example[nodeTitle][field] = val
    }
  }
  return JSON.stringify(example, null, 2)
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header: 2-Step Setup Guide -->
    <div class="flex flex-col gap-4 border border-indigo-500/20 rounded-2xl bg-indigo-500/5 p-5">
      <div class="flex items-center gap-3">
        <div class="i-solar:gallery-bold-duotone shrink-0 text-3xl text-indigo-500" />
        <div class="flex flex-col">
          <h2 class="text-xl text-neutral-800 font-bold dark:text-neutral-100">
            ComfyUI Setup & Instructions
          </h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Follow these two simple steps to connect ComfyUI workflows to your AIRI characters.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <!-- Step 1 Card -->
        <div class="flex items-start gap-3 border border-neutral-200/60 rounded-xl bg-white/70 p-4 dark:border-neutral-700/50 dark:bg-neutral-800/50">
          <div class="size-7 flex shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs text-white font-bold">
            1
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm text-neutral-800 font-bold dark:text-neutral-200">Export API Format from ComfyUI</span>
            <span class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              In ComfyUI, click <code class="rounded bg-neutral-100 px-1 py-0.5 text-[11px] font-mono dark:bg-neutral-900">File &gt; Export (API)</code> to download your <code class="rounded bg-neutral-100 px-1 py-0.5 text-[11px] font-mono dark:bg-neutral-900">workflow_api.json</code> file.
            </span>
          </div>
        </div>

        <!-- Step 2 Card -->
        <div class="flex items-start gap-3 border border-neutral-200/60 rounded-xl bg-white/70 p-4 dark:border-neutral-700/50 dark:bg-neutral-800/50">
          <div class="size-7 flex shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs text-white font-bold">
            2
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm text-neutral-800 font-bold dark:text-neutral-200">Assign to Character Card</span>
            <span class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              After uploading below, go to
              <RouterLink to="/settings/airi-card" class="text-indigo-600 font-semibold underline dark:text-indigo-400 hover:text-indigo-700">
                AIRI Cards
              </RouterLink>, click the pencil icon to edit your character, open the <strong>Artistry</strong> tab, select <strong>ComfyUI</strong>, and click Apply.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Success Banner -->
    <Transition name="fade">
      <div
        v-if="successBannerMessage"
        class="flex items-center justify-between border border-emerald-500/30 rounded-xl bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300"
      >
        <div class="flex items-center gap-3">
          <div class="i-solar:check-circle-bold-duotone text-2xl text-emerald-500" />
          <div class="flex flex-col">
            <span class="text-sm font-bold">{{ successBannerMessage }}</span>
            <span class="text-xs">
              Now go to
              <RouterLink to="/settings/airi-card" class="font-bold underline hover:text-emerald-900 dark:hover:text-white">
                AIRI Cards &gt; Edit Character &gt; Artistry Tab
              </RouterLink>
              to activate it for your character!
            </span>
          </div>
        </div>
        <button type="button" class="text-xs font-bold opacity-60 hover:opacity-100" @click="successBannerMessage = ''">
          Dismiss
        </button>
      </div>
    </Transition>

    <!-- Connection -->
    <div class="flex flex-col gap-4">
      <h3 class="text-lg text-neutral-700 font-medium dark:text-neutral-300">
        Connection
      </h3>
      <div class="flex items-end gap-3">
        <div class="flex-1">
          <FieldInput
            v-model="comfyuiServerUrl"
            label="Server URL"
            description="The address where ComfyUI is running"
            placeholder="http://localhost:8188"
          />
        </div>
        <button
          class="mb-0.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200"
          :class="{
            'bg-indigo-500 text-white hover:bg-indigo-600': connectionStatus !== 'testing',
            'bg-neutral-300 text-neutral-500 cursor-wait': connectionStatus === 'testing',
          }"
          :disabled="connectionStatus === 'testing'"
          @click="testConnection"
        >
          {{ connectionStatus === 'testing' ? 'Testing...' : '🔌 Test' }}
        </button>
      </div>
      <div
        v-if="connectionInfo"
        class="rounded-lg px-3 py-2 text-sm"
        :class="{
          'bg-green-500/10 text-green-600 dark:text-green-400': connectionStatus === 'connected',
          'bg-red-500/10 text-red-600 dark:text-red-400': connectionStatus === 'failed',
        }"
      >
        {{ connectionInfo }}
      </div>

      <!-- CORS Troubleshooting -->
      <div
        v-if="isCorsError"
        class="flex flex-col gap-2 border border-amber-500/20 rounded-xl bg-amber-500/10 p-4"
      >
        <div class="flex items-center gap-2 text-sm text-amber-600 font-bold dark:text-amber-400">
          <div i-solar:shield-warning-bold-duotone />
          CORS Block Detected
        </div>
        <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
          ComfyUI blocks requests from other applications by default. To allow AIRI to connect, you must start ComfyUI with the <code class="rounded bg-neutral-200 px-1 dark:bg-neutral-800">--enable-cors-header "*"</code> flag.
        </p>
        <div class="break-all rounded bg-black/5 p-2 text-[10px] text-neutral-500 font-mono dark:bg-black/20 dark:text-neutral-400">
          python main.py --enable-cors-header "*"
        </div>
      </div>
    </div>

    <!-- Workflow Templates Section -->
    <div class="flex flex-col gap-5">
      <h3 class="text-lg text-neutral-700 font-medium dark:text-neutral-300">
        Workflow Templates
      </h3>

      <!-- Top-Level Drag and Drop Upload Zone -->
      <div class="relative flex flex-col items-center justify-center border-2 border-indigo-400/50 rounded-2xl border-dashed bg-indigo-500/5 p-6 text-center transition-all hover:border-indigo-500 hover:bg-indigo-500/10">
        <input
          type="file"
          accept=".json"
          class="absolute inset-0 z-10 cursor-pointer opacity-0"
          @change="handleFileUpload"
        >
        <div class="i-solar:document-add-bold-duotone mb-2 text-4xl text-indigo-500" />
        <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
          Drop or Select a <code class="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700 font-mono dark:bg-indigo-900/50 dark:text-indigo-300">workflow_api.json</code> File
        </span>
        <span class="mt-1 text-xs text-neutral-400">
          Click or drag your ComfyUI exported API JSON file here to configure a new workflow template.
        </span>
      </div>

      <div v-if="uploadError" class="border border-red-500/30 rounded-xl bg-red-500/10 px-4 py-3 text-xs text-red-500">
        {{ uploadError }}
      </div>

      <!-- Saved Workflows List -->
      <div v-if="comfyuiSavedWorkflows.length === 0" class="text-sm text-neutral-400 italic dark:text-neutral-500">
        No workflows uploaded yet. Drop a file above to add your first template.
      </div>

      <div v-for="wf in comfyuiSavedWorkflows" :key="wf.id" class="flex flex-col gap-2 border border-neutral-200 rounded-xl p-4 dark:border-neutral-700">
        <div class="flex items-center gap-3">
          <input
            type="radio"
            :checked="comfyuiActiveWorkflow === wf.id"
            name="active-workflow"
            class="accent-indigo-500"
            @change="comfyuiActiveWorkflow = wf.id"
          >
          <div class="flex-1 cursor-pointer" @click="expandedWorkflow = (expandedWorkflow === wf.id ? null : wf.id)">
            <div class="flex items-center gap-2 text-sm text-neutral-800 font-medium dark:text-neutral-200">
              {{ wf.name }}
              <div v-if="expandedWorkflow === wf.id" class="i-solar:alt-arrow-down-linear text-xs opacity-50" />
              <div v-else class="i-solar:alt-arrow-right-linear text-xs opacity-50" />
            </div>
            <div class="text-xs text-neutral-400 dark:text-neutral-500">
              {{ Object.keys(wf.workflow).length }} nodes · Target Node: {{ Object.keys(wf.exposedFields)[0] || 'None' }}
            </div>
          </div>
          <button
            class="text-xs text-red-400 transition-colors hover:text-red-500"
            @click="removeWorkflow(wf.id)"
          >
            Remove
          </button>
        </div>

        <!-- Expanded Details -->
        <div v-if="expandedWorkflow === wf.id" class="mt-2 flex flex-col gap-5 border-t border-neutral-100 pb-2 pl-7 pt-4 dark:border-neutral-800">
          <div class="flex flex-col gap-2">
            <div class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
              Target Prompt Node
            </div>
            <div class="flex flex-wrap gap-3">
              <div v-for="(_fields, nodeTitle) in wf.exposedFields" :key="nodeTitle" class="flex flex-col gap-1.5">
                <div class="self-start rounded bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-600 font-semibold font-mono dark:bg-indigo-500/20 dark:text-indigo-400">
                  {{ nodeTitle }} (.text)
                </div>
              </div>
            </div>
          </div>

          <!-- Integration Snippet -->
          <div class="flex flex-col gap-3 border border-indigo-500/10 rounded-xl bg-neutral-900/5 p-4 dark:bg-indigo-500/5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs text-indigo-600 font-bold dark:text-indigo-400">
                <div i-solar:code-bold-duotone />
                Artistry Config Snippet
              </div>
              <button
                class="rounded bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-600 transition-colors hover:bg-indigo-500/20 dark:text-indigo-400"
                @click="copyToClipboard(generateExampleJson(wf))"
              >
                Copy JSON
              </button>
            </div>

            <div class="text-[11px] text-neutral-700 leading-relaxed font-mono dark:text-neutral-300">
              <div class="flex gap-2">
                <span class="text-indigo-500 dark:text-indigo-400">{</span>
              </div>
              <div class="pl-4">
                <span class="text-emerald-600 dark:text-emerald-400">"template"</span>: <span class="text-amber-600">"{{ wf.id }}"</span>,
              </div>
              <div v-for="(fields, nodeTitle, index) in wf.exposedFields" :key="nodeTitle" class="pl-4">
                <span class="text-emerald-600 dark:text-emerald-400">"{{ nodeTitle }}"</span>: {
                <div v-for="(f, fIndex) in fields" :key="f" class="pl-4">
                  <span class="text-emerald-600 dark:text-emerald-400">"{{ f }}"</span>: <span class="text-blue-500">"..."</span>{{ fIndex < fields.length - 1 ? ',' : '' }}
                </div>
                }<span>{{ index < Object.keys(wf.exposedFields).length - 1 ? ',' : '' }}</span>
              </div>
              <div class="flex gap-2">
                <span class="text-indigo-500 dark:text-indigo-400">}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Configure Workflow Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isModalOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div
            class="max-h-[85vh] max-w-xl w-full flex flex-col overflow-hidden border border-neutral-200/50 rounded-2xl bg-white p-6 shadow-2xl dark:border-neutral-700/50 dark:bg-neutral-900"
          >
            <!-- Modal Header -->
            <div class="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div class="flex items-center gap-2">
                <div class="i-solar:settings-bold-duotone text-xl text-indigo-500" />
                <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
                  Configure ComfyUI Workflow
                </h3>
              </div>
              <button
                type="button"
                class="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                @click="closeModal"
              >
                <div class="i-solar:close-circle-bold text-lg" />
              </button>
            </div>

            <!-- Modal Content -->
            <div class="flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
              <FieldInput
                v-model="pendingWorkflowName"
                label="Workflow Name"
                description="Give this workflow a recognizable template name"
                placeholder="e.g. Anime Text2Img"
              />

              <!-- Target 1: Positive Prompt Target -->
              <div class="flex flex-col gap-3 border border-indigo-500/30 rounded-xl bg-indigo-500/5 p-4">
                <div class="flex items-center gap-2 text-xs text-indigo-600 font-bold dark:text-indigo-400">
                  <div class="i-solar:document-text-bold-duotone text-base" />
                  <span>1. Positive Prompt Target (Required)</span>
                </div>
                <span class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Select the node and property where AIRI will inject generated positive prompts.
                </span>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="flex flex-col gap-1">
                    <label class="text-[11px] text-neutral-500 font-bold tracking-wider uppercase">Target Node</label>
                    <select
                      v-model="promptNodeId"
                      class="w-full border border-neutral-200 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-700 focus:border-indigo-500 dark:bg-neutral-800 dark:text-neutral-200"
                    >
                      <option v-for="opt in promptNodeOptions" :key="opt.id" :value="opt.id">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div class="flex flex-col gap-1">
                    <label class="text-[11px] text-neutral-500 font-bold tracking-wider uppercase">Target Property</label>
                    <select
                      v-model="promptProperty"
                      class="w-full border border-neutral-200 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-700 focus:border-indigo-500 dark:bg-neutral-800 dark:text-neutral-200"
                      :disabled="promptPropertyOptions.length === 0"
                    >
                      <option v-for="p in promptPropertyOptions" :key="p" :value="p">
                        {{ p }}
                      </option>
                    </select>
                  </div>
                </div>

                <div v-if="promptPropertyValuePreview !== ''" class="mt-1 break-all rounded-lg bg-black/5 p-2 text-[11px] text-neutral-600 font-mono dark:bg-black/20 dark:text-neutral-400">
                  <span class="text-indigo-600 font-bold dark:text-indigo-400">Current Value:</span> "{{ promptPropertyValuePreview }}"
                </div>
              </div>

              <!-- Target 2: Image Input Target (Optional) -->
              <div class="flex flex-col gap-3 border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-4 dark:border-neutral-700/60 dark:bg-neutral-800/30">
                <div class="flex items-center gap-2 text-xs text-neutral-700 font-bold dark:text-neutral-300">
                  <div class="i-solar:gallery-bold-duotone text-base text-neutral-500" />
                  <span>2. Image Input Target (Optional - Img2Img / ControlNet)</span>
                </div>
                <span class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Select a node to receive character/input images. AIRI will upload the image to ComfyUI and set this property automatically.
                </span>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="flex flex-col gap-1">
                    <label class="text-[11px] text-neutral-500 font-bold tracking-wider uppercase">Image Node</label>
                    <select
                      v-model="imageNodeId"
                      class="w-full border border-neutral-200 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-700 focus:border-indigo-500 dark:bg-neutral-800 dark:text-neutral-200"
                    >
                      <option v-for="opt in imageNodeOptions" :key="opt.id" :value="opt.id">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div class="flex flex-col gap-1">
                    <label class="text-[11px] text-neutral-500 font-bold tracking-wider uppercase">Image Property</label>
                    <select
                      v-model="imageProperty"
                      class="w-full border border-neutral-200 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-700 focus:border-indigo-500 dark:bg-neutral-800 dark:text-neutral-200"
                      :disabled="!imageNodeId || imagePropertyOptions.length === 0"
                    >
                      <option v-for="p in imagePropertyOptions" :key="p" :value="p">
                        {{ p }}
                      </option>
                    </select>
                  </div>
                </div>

                <div v-if="imageNodeId && imagePropertyValuePreview !== ''" class="mt-1 break-all rounded-lg bg-black/5 p-2 text-[11px] text-neutral-600 font-mono dark:bg-black/20 dark:text-neutral-400">
                  <span class="text-neutral-700 font-bold dark:text-neutral-300">Current Value:</span> "{{ imagePropertyValuePreview }}"
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="mt-4 flex items-center justify-end gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-xs text-neutral-500 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                @click="closeModal"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl bg-indigo-500 px-5 py-2 text-xs text-white font-bold tracking-wider uppercase transition-all disabled:pointer-events-none hover:bg-indigo-600 disabled:opacity-40"
                :disabled="!pendingWorkflowName.trim() || !promptNodeId || !promptProperty"
                @click="saveWorkflow"
              >
                Save Workflow
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.provider.comfyui.settings.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

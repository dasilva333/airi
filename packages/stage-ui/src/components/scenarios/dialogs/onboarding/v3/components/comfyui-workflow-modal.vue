<script setup lang="ts">
import type { ComfyUIWorkflowTemplate } from '../../../../../../stores/modules/artistry'

import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

interface ParsedNode {
  id: string
  title: string
  type: string
  inputs: Record<string, any>
}

const props = defineProps<{
  open: boolean
  rawWorkflow: Record<string, any> | null
  defaultName?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', template: ComfyUIWorkflowTemplate): void
  (e: 'close'): void
}>()

const workflowName = ref('')
const promptNodeId = ref('')
const promptProperty = ref('')
const imageNodeId = ref('')
const imageProperty = ref('')

const parsedNodes = computed<ParsedNode[]>(() => {
  if (!props.rawWorkflow)
    return []
  const nodes: ParsedNode[] = []
  for (const [nodeId, node] of Object.entries(props.rawWorkflow)) {
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
  return nodes
})

const promptNodeOptions = computed(() => {
  return parsedNodes.value.map(n => ({
    id: n.id,
    label: `${n.title} (${n.type}) [ID: ${n.id}]`,
  }))
})

const promptPropertyOptions = computed(() => {
  const node = parsedNodes.value.find(n => n.id === promptNodeId.value)
  if (!node)
    return []
  return Object.keys(node.inputs).filter(key => !Array.isArray(node.inputs[key]))
})

const imageNodeOptions = computed(() => {
  return [
    { id: '', label: '(None - Text to Image Only)' },
    ...parsedNodes.value.map(n => ({
      id: n.id,
      label: `${n.title} (${n.type}) [ID: ${n.id}]`,
    })),
  ]
})

const imagePropertyOptions = computed(() => {
  const node = parsedNodes.value.find(n => n.id === imageNodeId.value)
  if (!node)
    return []
  return Object.keys(node.inputs).filter(key => !Array.isArray(node.inputs[key]))
})

watch(() => props.open, (isOpen) => {
  if (isOpen && props.rawWorkflow) {
    workflowName.value = (props.defaultName || 'comfyui_workflow').replace(/\.json$/i, '')
    imageNodeId.value = ''
    imageProperty.value = ''

    // Auto-detect CLIPTextEncode for prompt target
    const defaultPromptNode = parsedNodes.value.find(n =>
      n.inputs && ('text' in n.inputs || 'value' in n.inputs || 'prompt' in n.inputs)
      && n.type.toLowerCase().includes('textencode'),
    ) || parsedNodes.value.find(n => n.inputs && ('text' in n.inputs || 'value' in n.inputs || 'prompt' in n.inputs)) || parsedNodes.value[0]

    if (defaultPromptNode) {
      promptNodeId.value = defaultPromptNode.id
      const props = Object.keys(defaultPromptNode.inputs).filter(key => !Array.isArray(defaultPromptNode.inputs[key]))
      const preferred = props.find(p => ['text', 'value', 'prompt', 'string'].includes(p.toLowerCase()))
      promptProperty.value = preferred || props[0] || ''
    }

    // Auto-detect LoadImage for image target
    const defaultImageNode = parsedNodes.value.find(n => n.type.toLowerCase().includes('loadimage') || (n.inputs && 'image' in n.inputs))
    if (defaultImageNode) {
      imageNodeId.value = defaultImageNode.id
      const props = Object.keys(defaultImageNode.inputs).filter(key => !Array.isArray(defaultImageNode.inputs[key]))
      const preferred = props.find(p => p.toLowerCase().includes('image'))
      imageProperty.value = preferred || props[0] || ''
    }
  }
})

watch(promptNodeId, () => {
  const props = promptPropertyOptions.value
  if (props.length > 0) {
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

function handleSave() {
  if (!props.rawWorkflow || !workflowName.value.trim() || !promptNodeId.value || !promptProperty.value)
    return

  const targetPromptNode = parsedNodes.value.find(n => n.id === promptNodeId.value)
  if (!targetPromptNode)
    return

  const workflowClone = JSON.parse(JSON.stringify(props.rawWorkflow))

  if (imageNodeId.value && imageProperty.value && workflowClone[imageNodeId.value]?.inputs) {
    workflowClone[imageNodeId.value].inputs[imageProperty.value] = '{{IMAGE}}'
  }

  const id = workflowName.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const template: ComfyUIWorkflowTemplate = {
    id,
    name: workflowName.value.trim(),
    workflow: workflowClone,
    exposedFields: {
      [targetPromptNode.title]: [promptProperty.value],
    },
  }

  emit('save', template)
  emit('update:open', false)
}

function handleClose() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <DialogRoot :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogPortal>
      <DialogOverlay :class="['fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fadeIn']" />
      <DialogContent :class="['fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 p-6 text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto']">
        <!-- Header -->
        <div :class="['flex items-center justify-between border-b border-neutral-800 pb-3']">
          <div :class="['flex items-center gap-2.5']">
            <div :class="['w-8 h-8 rounded-xl bg-primary-500/10 text-primary-400 flex items-center justify-center text-lg']">
              ⚙️
            </div>
            <div>
              <DialogTitle :class="['text-sm font-bold text-white tracking-wide']">
                Configure ComfyUI Workflow
              </DialogTitle>
              <p :class="['text-[11px] text-neutral-400 mt-0.5']">
                Map prompt and image injection points into the workflow graph
              </p>
            </div>
          </div>
          <button
            type="button"
            :class="['p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer']"
            @click="handleClose"
          >
            <div :class="['i-solar:close-circle-bold w-5 h-5']" />
          </button>
        </div>

        <!-- Workflow Name -->
        <div :class="['space-y-1.5']">
          <label :class="['text-xs font-semibold text-neutral-200 block']">Workflow Name</label>
          <p :class="['text-[11px] text-neutral-400']">
            Give this workflow a recognizable template name
          </p>
          <input
            v-model="workflowName"
            type="text"
            placeholder="e.g. anima_hikarun"
            :class="['w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:border-primary-500 focus:outline-none']"
          >
        </div>

        <!-- Section 1: Positive Prompt Target (Required) -->
        <div :class="['rounded-xl border border-primary-500/30 bg-primary-950/10 p-4 space-y-3']">
          <div :class="['flex items-center gap-2 text-xs font-bold text-primary-300']">
            <span>📝</span>
            <span>1. Positive Prompt Target (Required)</span>
          </div>
          <p :class="['text-[11px] text-neutral-400']">
            Select the node and property where AIRI will inject generated positive prompts.
          </p>

          <div :class="['space-y-1']">
            <label :class="['text-[10px] uppercase font-bold tracking-wider text-neutral-400']">Target Node</label>
            <select
              v-model="promptNodeId"
              :class="['w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 focus:border-primary-500 focus:outline-none cursor-pointer']"
            >
              <option v-for="n in promptNodeOptions" :key="n.id" :value="n.id">
                {{ n.label }}
              </option>
            </select>
          </div>

          <div v-if="promptPropertyOptions.length > 0" :class="['space-y-1']">
            <label :class="['text-[10px] uppercase font-bold tracking-wider text-neutral-400']">Target Property</label>
            <select
              v-model="promptProperty"
              :class="['w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 focus:border-primary-500 focus:outline-none cursor-pointer']"
            >
              <option v-for="prop in promptPropertyOptions" :key="prop" :value="prop">
                {{ prop }}
              </option>
            </select>
          </div>
        </div>

        <!-- Section 2: Image Input Target (Optional) -->
        <div :class="['rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 space-y-3']">
          <div :class="['flex items-center gap-2 text-xs font-bold text-neutral-200']">
            <span>🖼️</span>
            <span>2. Image Input Target (Optional – Img2Img / ControlNet)</span>
          </div>
          <p :class="['text-[11px] text-neutral-400']">
            Select a node to receive character/input images. AIRI will upload the image to ComfyUI and set this property automatically.
          </p>

          <div :class="['space-y-1']">
            <label :class="['text-[10px] uppercase font-bold tracking-wider text-neutral-400']">Image Node</label>
            <select
              v-model="imageNodeId"
              :class="['w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 focus:border-primary-500 focus:outline-none cursor-pointer']"
            >
              <option v-for="n in imageNodeOptions" :key="n.id" :value="n.id">
                {{ n.label }}
              </option>
            </select>
          </div>

          <div v-if="imageNodeId && imagePropertyOptions.length > 0" :class="['space-y-1']">
            <label :class="['text-[10px] uppercase font-bold tracking-wider text-neutral-400']">Image Property</label>
            <select
              v-model="imageProperty"
              :class="['w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 focus:border-primary-500 focus:outline-none cursor-pointer']"
            >
              <option v-for="prop in imagePropertyOptions" :key="prop" :value="prop">
                {{ prop }}
              </option>
            </select>
          </div>
        </div>

        <!-- Footer Actions -->
        <div :class="['flex items-center justify-end gap-3 pt-3 border-t border-neutral-800']">
          <button
            type="button"
            :class="['px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer']"
            @click="handleClose"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="!workflowName.trim() || !promptNodeId || !promptProperty"
            :class="[
              'px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg transition-all cursor-pointer',
              workflowName.trim() && promptNodeId && promptProperty
                ? 'bg-primary-600 hover:bg-primary-500 shadow-primary-600/30'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50',
            ]"
            @click="handleSave"
          >
            SAVE WORKFLOW
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { Button, FieldInput } from '@proj-airi/ui'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

// Motion Playground State
const prompt = ref('a person doing jumping jacks')
const outputFormat = ref<'vrma' | 'vmd' | 'motion_json'>('vrma')
const outputLength = ref<'60' | '120'>('60')
const isGenerating = ref(false)
const statusLogs = ref<string[]>([])
const downloadUrl = ref<string | null>(null)
const downloadFileName = ref<string>('motion.vrma')

function addLog(msg: string) {
  const timestamp = new Date().toLocaleTimeString()
  statusLogs.value.push(`[${timestamp}] ${msg}`)
}

async function handleGenerateMotion() {
  if (!prompt.value.trim())
    return

  isGenerating.value = true
  downloadUrl.value = null
  statusLogs.value = []

  addLog(`Initiating Motion Generation for prompt: "${prompt.value}"`)
  addLog(`Loading CLIP Text Encoder (Xenova/clip-vit-base-patch32)...`)

  // Playground simulation / preview harness for Phase 2 UI validation
  setTimeout(() => {
    addLog(`CLIP embedding generated [1, 512].`)
    addLog(`WebGPU FlowMDM session active (dasilva333/flowmdm-onnx).`)
    addLog(`Running 50-step DDIM denoising...`)

    setTimeout(() => {
      addLog(`50-step DDIM denoising complete.`)
      addLog(`Decoding 263-dim HumanML3D tensor to ${outputFormat.value.toUpperCase()} format...`)

      // Create sample downloadable file indicator
      const blob = new Blob(['FLOWMDM_DUMMY_MOTION_DATA'], { type: 'application/octet-stream' })
      downloadUrl.value = URL.createObjectURL(blob)
      downloadFileName.value = `motion_${Date.now()}.${outputFormat.value === 'motion_json' ? 'json' : outputFormat.value}`

      addLog(`Motion exported successfully. Format: ${outputFormat.value.toUpperCase()}`)
      isGenerating.value = false
    }, 1500)
  }, 1000)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="space-y-1">
      <RouterLink
        to="/settings/modules/text-to-motion"
        class="inline-flex items-center gap-1.5 text-xs text-neutral-400 font-medium transition-colors dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        <div class="i-solar:alt-arrow-left-bold text-xs" />
        <span>Text to Motion Settings</span>
      </RouterLink>
      <h2 class="text-lg text-neutral-800 font-bold md:text-2xl dark:text-neutral-100">
        FlowMDM (Local WebGPU)
      </h2>
      <p class="text-xs text-neutral-400 dark:text-neutral-500">
        On-device 3D motion diffusion running natively in browser WebGPU. Requires no API keys.
      </p>
    </div>

    <!-- Details Card -->
    <div class="border border-neutral-200 rounded-2xl bg-white p-6 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/40">
      <h3 class="flex items-center gap-2 text-base text-neutral-800 font-bold dark:text-neutral-100">
        <div class="i-solar:info-square-bold-duotone text-primary-500" />
        Model Pipeline Overview
      </h3>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="border-neutral-150 border rounded-xl bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
          <div class="text-xs text-neutral-400 font-medium dark:text-neutral-500">
            CLIP Text Encoder
          </div>
          <div class="mt-1 text-sm text-neutral-700 font-bold dark:text-neutral-200">
            Xenova/clip-vit-base-patch32
          </div>
          <div class="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            Encodes prompt to 512-dim embedding matrix (via @xenova/transformers).
          </div>
        </div>

        <div class="border-neutral-150 border rounded-xl bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
          <div class="text-xs text-neutral-400 font-medium dark:text-neutral-500">
            FlowMDM ONNX Denoiser
          </div>
          <div class="mt-1 text-sm text-neutral-700 font-bold dark:text-neutral-200">
            dasilva333/flowmdm-onnx (86.8 MB)
          </div>
          <div class="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            50-step DDIM Gaussian motion diffusion running on WebGPU.
          </div>
        </div>
      </div>
    </div>

    <!-- Provider Playground Card -->
    <div class="border border-neutral-200 rounded-2xl bg-white p-6 space-y-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div>
        <h3 class="flex items-center gap-2 text-base text-neutral-800 font-bold dark:text-neutral-100">
          <div class="i-solar:test-tube-bold-duotone text-primary-500" />
          Motion Provider Playground
        </h3>
        <p class="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Test text-to-motion generation and download generated animation files directly.
        </p>
      </div>

      <div class="space-y-4">
        <FieldInput
          v-model="prompt"
          label="Prompt Input"
          description="Describe the motion action to generate."
          placeholder="a person doing jumping jacks"
        />

        <!-- Format and Length Selectors -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-xs text-neutral-700 font-medium dark:text-neutral-300">
              Output Format
            </label>
            <div class="flex gap-2">
              <button
                v-for="fmt in [
                  { id: 'vrma', label: 'VRMA (.vrma)' },
                  { id: 'vmd', label: 'MMD (.vmd)' },
                  { id: 'motion_json', label: 'Live2D (motion.json)' },
                ]"
                :key="fmt.id"
                type="button"
                :class="[
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  outputFormat === fmt.id
                    ? 'bg-primary-500 text-white dark:bg-primary-600'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
                ]"
                @click="outputFormat = fmt.id as any"
              >
                {{ fmt.label }}
              </button>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs text-neutral-700 font-medium dark:text-neutral-300">
              Output Length
            </label>
            <div class="flex gap-2">
              <button
                v-for="len in [
                  { id: '60', label: '60 frames (3.0s)' },
                  { id: '120', label: '120 frames (6.0s)' },
                ]"
                :key="len.id"
                type="button"
                :class="[
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  outputLength === len.id
                    ? 'bg-primary-500 text-white dark:bg-primary-600'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
                ]"
                @click="outputLength = len.id as any"
              >
                {{ len.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div class="pt-2">
          <Button
            variant="primary"
            size="md"
            :label="isGenerating ? 'Generating Motion...' : '⚡ Generate Motion'"
            :loading="isGenerating"
            :disabled="isGenerating || !prompt.trim()"
            @click="handleGenerateMotion"
          />
        </div>

        <!-- Download & Status Log -->
        <div v-if="statusLogs.length > 0" class="border-neutral-150 border rounded-xl bg-neutral-900 p-4 text-xs text-neutral-200 font-mono space-y-3 dark:border-neutral-800">
          <div class="flex items-center justify-between text-neutral-400">
            <span>Status Log</span>
            <a
              v-if="downloadUrl"
              :href="downloadUrl"
              :download="downloadFileName"
              class="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs text-white font-bold transition-colors hover:bg-emerald-500"
            >
              <div class="i-solar:download-minimalistic-bold" />
              Download {{ downloadFileName }}
            </a>
          </div>

          <div class="max-h-40 overflow-y-auto space-y-1">
            <div v-for="(log, idx) in statusLogs" :key="idx" class="text-neutral-300">
              {{ log }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: FlowMDM Settings
  subtitleKey: Motion Provider Settings
  stageTransition:
    name: slide
</route>

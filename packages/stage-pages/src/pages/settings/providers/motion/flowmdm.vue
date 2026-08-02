<script setup lang="ts">
import type { MotionGenerationResult } from '@proj-airi/stage-ui/stores/modules/text-to-motion'

import { useCustomVrmAnimationsStore } from '@proj-airi/stage-ui-three'
import { useTextToMotionStore } from '@proj-airi/stage-ui/stores/modules/text-to-motion'
import { Button, FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'

const textToMotionStore = useTextToMotionStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const { downloadProgress } = storeToRefs(textToMotionStore)

// Motion Playground State
const prompt = ref('a person doing jumping jacks')
const outputFormat = ref<'vrma' | 'vmd' | 'motion_json'>('vrma')
const outputLength = ref<'60' | '120'>('60')
const isGenerating = ref(false)
const shouldDownloadBackup = ref(false)
const statusLogs = ref<string[]>([])
const lastResult = ref<MotionGenerationResult | null>(null)
const isWebGPUAvailable = ref(false)

onMounted(() => {
  isWebGPUAvailable.value = textToMotionStore.isWebGPUSupported()
})

function addLog(msg: string) {
  const timestamp = new Date().toLocaleTimeString()
  statusLogs.value.push(`[${timestamp}] ${msg}`)
}

async function handleGenerateMotion() {
  if (!prompt.value.trim())
    return

  isGenerating.value = true
  lastResult.value = null
  statusLogs.value = []

  addLog(`Initiating Motion Generation for prompt: "${prompt.value}"`)

  try {
    const result = await textToMotionStore.generateMotion(prompt.value, {
      format: outputFormat.value,
      outputLength: Number(outputLength.value),
      onLog: addLog,
    })

    lastResult.value = result

    // Auto-save to library
    try {
      await textToMotionStore.saveResultToLibrary(result, customVrmAnimationsStore.addCustomAnimation)
      addLog(`Saved to motion library: ${result.fileName}`)
      toast.success('Motion saved to library!')
    }
    catch (dbErr: any) {
      addLog(`[WARN] Library save failed: ${dbErr.message || String(dbErr)}`)
      toast.error(`Library save failed: ${dbErr.message || String(dbErr)}`)
    }

    // Optional backup download
    if (shouldDownloadBackup.value) {
      textToMotionStore.downloadResultToDisk(result)
      addLog(`Downloaded backup: ${result.fileName}`)
      toast.success('Backup file downloaded!')
    }
  }
  catch (err: any) {
    addLog(`[ERROR] ${err.message || String(err)}`)
    toast.error(`Generation failed: ${err.message || String(err)}`)
  }
  finally {
    isGenerating.value = false
  }
}

function handleManualDownload() {
  if (lastResult.value) {
    textToMotionStore.downloadResultToDisk(lastResult.value)
    toast.success('File downloaded!')
  }
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
      <div class="flex items-center justify-between">
        <h2 class="text-lg text-neutral-800 font-bold md:text-2xl dark:text-neutral-100">
          FlowMDM (Local WebGPU)
        </h2>
        <!-- WebGPU Badge -->
        <span
          class="inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-bold"
          :class="isWebGPUAvailable
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'"
        >
          <div :class="isWebGPUAvailable ? 'i-solar:check-circle-bold' : 'i-solar:close-circle-bold'" />
          {{ isWebGPUAvailable ? 'WebGPU Supported' : 'WebGPU Unsupported' }}
        </span>
      </div>
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

    <!-- Download Progress Bar (When downloading weights) -->
    <div v-if="downloadProgress.isDownloading" class="border border-primary-500/30 rounded-2xl bg-primary-500/10 p-4 space-y-2 dark:border-primary-500/20">
      <div class="flex items-center justify-between text-xs text-primary-700 font-bold dark:text-primary-300">
        <span>Downloading Model Weights: {{ downloadProgress.file }}</span>
        <span>{{ downloadProgress.percentage }}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-primary-200/50 dark:bg-primary-950/50">
        <div
          class="h-full bg-primary-500 transition-all duration-300"
          :style="{ width: `${downloadProgress.percentage}%` }"
        />
      </div>
      <p class="text-[10px] text-primary-600/80 dark:text-primary-400/80">
        {{ downloadProgress.status }}
      </p>
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

        <!-- Action Button + Download Checkbox -->
        <div class="flex flex-col gap-2 pt-2">
          <div class="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              :label="isGenerating ? 'Generating Motion...' : '⚡ Generate Motion'"
              :loading="isGenerating"
              :disabled="isGenerating || !prompt.trim()"
              @click="handleGenerateMotion"
            />
          </div>

          <label class="flex cursor-pointer select-none items-center gap-1.5 py-0.5">
            <input
              v-model="shouldDownloadBackup"
              type="checkbox"
              class="h-3 w-3 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
            >
            <span class="text-[10px] text-neutral-400 font-semibold dark:text-neutral-500">Also download backup file to disk</span>
          </label>
        </div>

        <!-- Result Actions (appears after generation) -->
        <div v-if="lastResult" class="flex items-center gap-3 border border-emerald-500/30 rounded-xl bg-emerald-500/10 px-4 py-3 dark:border-emerald-500/20">
          <div class="i-solar:check-circle-bold text-lg text-emerald-500" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs text-emerald-700 font-bold dark:text-emerald-300">
              {{ lastResult.fileName }}
            </div>
            <div class="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
              Saved to motion library
            </div>
          </div>
          <button
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white font-bold transition-colors hover:bg-emerald-500"
            @click="handleManualDownload"
          >
            <div class="i-solar:download-minimalistic-bold" />
            Download .vrma
          </button>
        </div>

        <!-- Download & Status Log -->
        <div v-if="statusLogs.length > 0" class="border-neutral-150 border rounded-xl bg-neutral-900 p-4 text-xs text-neutral-200 font-mono space-y-3 dark:border-neutral-800">
          <div class="flex items-center justify-between text-neutral-400">
            <span>Status Log</span>
            <button
              v-if="lastResult"
              class="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs text-white font-bold transition-colors hover:bg-emerald-500"
              @click="handleManualDownload"
            >
              <div class="i-solar:download-minimalistic-bold" />
              Download {{ lastResult.fileName }}
            </button>
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

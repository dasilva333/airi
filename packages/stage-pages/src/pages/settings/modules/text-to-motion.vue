<script setup lang="ts">
import { useTextToMotionStore } from '@proj-airi/stage-ui/stores/modules/text-to-motion'
import { RouterLink } from 'vue-router'

const textToMotionStore = useTextToMotionStore()

const modes = [
  {
    id: 'procedural',
    title: 'Procedural LLM Acting (Default)',
    description: 'Parses LLM motion and expression tags in real-time to drive character pose parameters. Zero GPU memory overhead.',
    icon: 'i-solar:code-square-bold-duotone',
    badge: 'Lightweight',
  },
  {
    id: 'flowmdm',
    title: 'FlowMDM (Local WebGPU Diffusion)',
    description: 'On-device 3D motion diffusion model generating smooth skeletal motion tensors directly from text prompts using WebGPU.',
    icon: 'i-solar:cpu-bold-duotone',
    badge: 'WebGPU 3D',
  },
]
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div>
      <h2 class="text-lg text-neutral-800 font-bold md:text-2xl dark:text-neutral-100">
        Text to Motion Settings
      </h2>
      <p class="text-xs text-neutral-400 dark:text-neutral-500">
        Configure how AIRI generates and animates 3D character movements from dialogue and text prompts.
      </p>
    </div>

    <!-- Mode Selector Card Matrix -->
    <div class="border border-neutral-200 rounded-2xl bg-white p-6 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div>
        <h3 class="flex items-center gap-2 text-base text-neutral-800 font-bold dark:text-neutral-100">
          <div class="i-solar:running-round-bold-duotone text-primary-500" />
          Active Motion Engine Provider
        </h3>
        <p class="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Select the active backend used to generate character animations during live sessions.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          v-for="m in modes"
          :key="m.id"
          :class="[
            'relative cursor-pointer rounded-xl border p-5 transition-all',
            textToMotionStore.mode === m.id
              ? 'border-primary-500 bg-primary-500/5 dark:border-primary-500/80 dark:bg-primary-500/10 shadow-sm'
              : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/30 hover:border-neutral-300 dark:hover:border-neutral-700',
          ]"
          @click="textToMotionStore.setMode(m.id as any)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div :class="[m.icon, 'text-2xl', textToMotionStore.mode === m.id ? 'text-primary-500' : 'text-neutral-400']" />
              <div>
                <div class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
                  {{ m.title }}
                </div>
                <span class="mt-1 inline-block rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-400">
                  {{ m.badge }}
                </span>
              </div>
            </div>
            <div
              v-if="textToMotionStore.mode === m.id"
              class="i-solar:check-circle-bold text-lg text-primary-500"
            />
          </div>
          <p class="mt-3 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            {{ m.description }}
          </p>
        </div>
      </div>
    </div>

    <!-- Playground Quick Link Card -->
    <div class="border border-neutral-200 rounded-2xl bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h4 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
            FlowMDM Provider Playground
          </h4>
          <p class="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            Test custom text prompts, preview motion tensor outputs, and export animation files (.vrma, .vmd, .json).
          </p>
        </div>
        <RouterLink
          to="/settings/providers/motion/flowmdm"
          class="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2 text-xs text-neutral-700 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          <span>Open Playground</span>
          <div class="i-solar:alt-arrow-right-bold" />
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: Text to Motion Settings
  subtitleKey: Modules
  icon: i-solar:running-round-bold-duotone
  stageTransition:
    name: slide
</route>

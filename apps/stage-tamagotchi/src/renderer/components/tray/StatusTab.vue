<script setup lang="ts">
import { ref } from 'vue'

const selectedModel = ref('Gemini 2.5 Pro')
const selectedRange = ref('Last Week')
</script>

<template>
  <div class="h-full flex flex-col space-y-3">
    <!-- Two Column Dashboard Grid -->
    <div class="grid grid-cols-2 gap-2.5">
      <!-- Left Column: Model & Tokens -->
      <div
        :class="[
          'p-3 rounded-2xl border',
          'bg-neutral-50/80 dark:bg-neutral-900/60',
          'border-neutral-200/80 dark:border-neutral-800/80',
          'flex flex-col space-y-2.5',
        ]"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1 text-[11px] text-neutral-800 font-bold dark:text-neutral-100">
            <div class="i-solar:layers-minimalistic-bold text-emerald-500" />
            Model & Tokens
          </div>
          <span
            :class="[
              'px-1.5 py-0.5 rounded-full text-[9px] font-bold',
              'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400',
            ]"
          >
            Active
          </span>
        </div>

        <!-- Model dropdown button -->
        <button
          type="button"
          :class="[
            'w-full px-2 py-1.5 rounded-xl border text-left',
            'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700',
            'text-[11px] font-semibold text-neutral-800 dark:text-neutral-100',
            'flex items-center justify-between shadow-sm',
          ]"
        >
          <span class="flex items-center gap-1.5 truncate">
            <div class="i-solar:stars-bold flex-shrink-0 text-xs text-cyan-500" />
            <span class="truncate">{{ selectedModel }}</span>
          </span>
          <div class="i-solar:alt-arrow-down-linear text-xs text-neutral-400" />
        </button>

        <!-- Context Usage Bar -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[10px]">
            <span class="text-neutral-500 dark:text-neutral-400">Context Usage</span>
            <span class="text-emerald-600 font-bold font-mono dark:text-emerald-400">12.8%</span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800">
            <div class="h-full rounded-full bg-emerald-500" style="width: 12.8%" />
          </div>
          <div class="text-right text-[9px] text-neutral-400 font-mono">
            128,384 / 1,000,000
          </div>
        </div>

        <!-- Voice & System-1 Metrics -->
        <div class="border-t border-neutral-200/60 pt-1 text-[10px] space-y-1.5 dark:border-neutral-800/60">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <span class="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Voice Tokens
            </span>
            <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-300">95,457</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <span class="h-1.5 w-1.5 rounded-full bg-purple-400" />
              System-1 Tokens
            </span>
            <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-300">1,388,956</span>
          </div>
        </div>

        <!-- Time Range Selector -->
        <div class="mt-auto pt-1">
          <button
            type="button"
            :class="[
              'w-full px-2 py-1 rounded-lg border text-left',
              'bg-neutral-100/70 dark:bg-neutral-800/70 border-neutral-200/80 dark:border-neutral-700/80',
              'text-[10px] text-neutral-600 dark:text-neutral-300',
              'flex items-center justify-between',
            ]"
          >
            <span>Range: <strong class="text-neutral-900 dark:text-neutral-100">{{ selectedRange }}</strong></span>
            <div class="i-solar:alt-arrow-down-linear text-[10px] text-neutral-400" />
          </button>
        </div>
      </div>

      <!-- Right Column: Runtime & Health -->
      <div
        :class="[
          'p-3 rounded-2xl border',
          'bg-neutral-50/80 dark:bg-neutral-900/60',
          'border-neutral-200/80 dark:border-neutral-800/80',
          'flex flex-col space-y-2.5',
        ]"
      >
        <div class="flex items-center gap-1 text-[11px] text-neutral-800 font-bold dark:text-neutral-100">
          <div class="i-solar:heart-pulse-bold text-emerald-500" />
          Runtime & Health
        </div>

        <!-- Latency & VRAM Specs -->
        <div class="text-[10px] space-y-2">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <div class="i-solar:stopwatch-bold text-xs text-neutral-400" />
              Latency
            </span>
            <span class="text-emerald-600 font-bold font-mono dark:text-emerald-400">420 ms</span>
          </div>

          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <div class="i-solar:cpu-bolt-bold text-xs text-neutral-400" />
              GPU (VRAM)
            </span>
            <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-200">1.2 GB / 8 GB</span>
          </div>

          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <div class="i-solar:server-square-bold text-xs text-neutral-400" />
              RAM (App)
            </span>
            <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-200">764 MB</span>
          </div>
        </div>

        <!-- Service Indicators -->
        <div class="border-t border-neutral-200/60 pt-2 text-[10px] space-y-1.5 dark:border-neutral-800/60">
          <div class="flex items-center justify-between">
            <span class="text-neutral-500 dark:text-neutral-400">Stage Renderer</span>
            <span class="flex items-center gap-1 text-[9px] text-emerald-600 font-medium font-mono dark:text-emerald-400">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Idle
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-neutral-500 dark:text-neutral-400">Voice / TTS</span>
            <span class="flex items-center gap-1 text-[9px] text-emerald-600 font-medium font-mono dark:text-emerald-400">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Ready
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-neutral-500 dark:text-neutral-400">Vision (Capture)</span>
            <span class="flex items-center gap-1 text-[9px] text-emerald-600 font-medium font-mono dark:text-emerald-400">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              On
            </span>
          </div>
        </div>

        <!-- Bottom Action: Generate Report -->
        <div class="mt-auto pt-1">
          <button
            type="button"
            :class="[
              'w-full py-1.5 rounded-xl text-[10px] font-bold text-center',
              'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
              'border border-emerald-500/20 transition',
              'flex items-center justify-center gap-1',
            ]"
          >
            <div class="i-solar:document-text-bold text-xs" />
            Generate Report
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

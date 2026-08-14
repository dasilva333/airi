<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  onNext?: () => void
  onPrevious?: () => void
  onSelectPath?: (path: 'new' | 'returning') => void
}

const props = defineProps<Props>()
const selectedPath = ref<'new' | 'returning'>('new')

watch(selectedPath, (path) => {
  props.onSelectPath?.(path)
}, { immediate: true })
</script>

<template>
  <div class="h-full flex flex-col gap-5 font-sans">
    <div
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      class="text-center"
    >
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Choose Your Path
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Choose how you want to configure your companion.
      </p>
    </div>

    <!-- Choice Selection Cards -->
    <div class="flex flex-1 flex-col justify-center overflow-y-auto px-1">
      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        :delay="100"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <!-- New User Option -->
        <div
          class="relative min-h-[150px] flex flex-col cursor-pointer justify-between overflow-hidden border-2 rounded-2xl p-5 transition-all duration-300 ease-out"
          :class="[
            selectedPath === 'new'
              ? 'bg-gradient-to-br from-primary-500/10 to-indigo-500/10 border-primary-500 dark:border-primary-400 shadow-lg shadow-primary-500/5'
              : 'bg-white/40 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/80 hover:border-primary-500/50 dark:hover:border-primary-400/50 backdrop-blur-md',
          ]"
          @click="selectedPath = 'new'"
        >
          <div>
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  class="rounded-xl p-2.5"
                  :class="[
                    selectedPath === 'new'
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
                  ]"
                >
                  <div class="i-solar:stars-line-duotone h-5 w-5" />
                </div>
                <span class="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] text-primary-600 font-bold dark:text-primary-400">
                  LOCAL-FIRST
                </span>
              </div>
              <div
                class="h-5 w-5 flex items-center justify-center border-2 rounded-full transition-colors"
                :class="selectedPath === 'new' ? 'border-primary-500 dark:border-primary-400' : 'border-neutral-300 dark:border-neutral-600'"
              >
                <div v-if="selectedPath === 'new'" class="h-2.5 w-2.5 rounded-full bg-primary-500 dark:bg-primary-400" />
              </div>
            </div>
            <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
              Local Companion (Offline)
            </h3>
            <p class="mt-1.5 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              100% private, on-device setup for brain, voice, avatar, and persona. No account required.
            </p>
          </div>
        </div>

        <!-- Cloudflare Connected Option (Disabled Preview) -->
        <div
          class="pointer-events-none relative min-h-[150px] flex flex-col cursor-not-allowed select-none justify-between overflow-hidden border-2 border-neutral-200/60 rounded-2xl bg-neutral-100/40 p-5 opacity-60 transition-all duration-300 ease-out dark:border-neutral-800/80 dark:bg-neutral-900/20"
        >
          <div>
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  class="rounded-xl bg-neutral-200/80 p-2.5 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                >
                  <div class="i-solar:cloud-storage-line-duotone h-5 w-5" />
                </div>
                <span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
                  ZERO-TRUST
                </span>
              </div>
              <span class="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-600 font-bold dark:text-purple-400">
                COMING SOON
              </span>
            </div>
            <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
              Sign In with Cloudflare
            </h3>
            <p class="mt-1.5 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Sync existing companions across devices, or connect a fresh account for automated edge relays and private zero-trust backups.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

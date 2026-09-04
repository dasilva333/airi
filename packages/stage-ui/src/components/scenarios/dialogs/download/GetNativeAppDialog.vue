<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

import { useGetNativeAppModal } from '../../../../composables/use-native-app-modal'

const { isOpen, dismiss, close } = useGetNativeAppModal()

const platforms = [
  {
    id: 'ios',
    name: 'iOS & iPadOS',
    badge: 'Apple TestFlight',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    icon: 'i-simple-icons:apple',
    description: 'On-device Apple Neural Engine (ANE) dialogue, offline voice synthesis, and zero tab throttling on iPhone & iPad.',
    actionLabel: 'Join TestFlight',
    actionUrl: 'https://testflight.apple.com/join/YBxb5mp4',
    recommended: true,
  },
  {
    id: 'android',
    name: 'Android',
    badge: 'Direct APK',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: 'i-simple-icons:android',
    description: 'Standalone pocket companion for Android mobile & tablets with local persistence and background readiness.',
    actionLabel: 'Download APK',
    actionUrl: 'https://github.com/dasilva333/airi/releases',
    recommended: false,
  },
  {
    id: 'desktop',
    name: 'Windows & macOS',
    badge: '.exe · .dmg',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    icon: 'i-solar:laptop-minimalistic-bold-duotone',
    description: 'Transparent desktop companion floating over your work, 24/7 background vision & sensor perception, and local ComfyUI.',
    actionLabel: 'Download Desktop',
    actionUrl: 'https://github.com/dasilva333/airi/releases',
    recommended: true,
  },
  {
    id: 'linux',
    name: 'Linux',
    badge: 'Build From Source',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: 'i-simple-icons:linux',
    description: 'Run natively on Linux distros by cloning and building from source with Node.js, pnpm, and Cargo.',
    actionLabel: 'View GitHub Repo',
    actionUrl: 'https://github.com/dasilva333/airi',
    recommended: false,
  },
]

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md transition-opacity duration-200" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-[101] max-h-[90vh] max-w-2xl w-[95vw] flex flex-col overflow-hidden border border-neutral-200/80 rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur-2xl transition-all -translate-x-1/2 -translate-y-1/2 dark:border-neutral-800/80 dark:bg-neutral-900/95 sm:p-7"
      >
        <!-- Header -->
        <div class="flex items-start justify-between gap-4 pb-4">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <div class="size-8 flex items-center justify-center rounded-xl bg-primary-500/15 text-primary-500">
                <div class="i-solar:devices-bold-duotone text-lg" />
              </div>
              <DialogTitle class="text-lg text-neutral-900 font-bold sm:text-xl dark:text-neutral-100">
                Get AIRI for Desktop & Mobile
              </DialogTitle>
            </div>
            <DialogDescription class="text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
              Enjoying the browser version? Native apps give AIRI transparent window overlays, on-device Neural Engine AI, and zero browser tab throttling!
            </DialogDescription>
          </div>

          <DialogClose
            class="size-8 flex shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            @click="close"
          >
            <div class="i-solar:close-circle-bold text-xl" />
          </DialogClose>
        </div>

        <!-- Platform Grid -->
        <div class="grid grid-cols-1 min-h-0 flex-1 gap-3 overflow-y-auto py-2 sm:grid-cols-2">
          <div
            v-for="platform in platforms"
            :key="platform.id"
            class="group relative flex flex-col justify-between border rounded-2xl p-4 transition-all duration-200 hover:scale-[1.01]"
            :class="[
              platform.recommended
                ? 'border-primary-500/30 bg-primary-500/5 dark:bg-primary-500/5 hover:border-primary-500/60'
                : 'border-neutral-200/80 bg-neutral-50/50 dark:border-neutral-800/80 dark:bg-neutral-800/30 hover:border-neutral-300 dark:hover:border-neutral-700',
            ]"
          >
            <div>
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <div class="shadow-xs size-7 flex items-center justify-center rounded-lg bg-white text-base dark:bg-neutral-800">
                    <div :class="platform.icon" />
                  </div>
                  <span class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
                    {{ platform.name }}
                  </span>
                </div>
                <span
                  class="border rounded-full px-2 py-0.5 text-[10px] font-bold"
                  :class="platform.badgeColor"
                >
                  {{ platform.badge }}
                </span>
              </div>

              <p class="mt-2.5 text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
                {{ platform.description }}
              </p>
            </div>

            <div class="mt-4 pt-2">
              <Button
                :variant="platform.recommended ? 'primary' : 'secondary'"
                size="sm"
                class="w-full flex items-center justify-center gap-1.5 text-xs font-semibold"
                @click="openUrl(platform.actionUrl)"
              >
                <span>{{ platform.actionLabel }}</span>
                <div class="i-solar:arrow-right-up-linear text-sm" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-4 flex flex-col-reverse items-center justify-between gap-3 border-t border-neutral-200/60 pt-4 sm:flex-row dark:border-neutral-800/60">
          <span class="text-center text-[11px] text-neutral-400 sm:text-left">
            You can access these downloads anytime in Settings Hub.
          </span>
          <div class="w-full flex items-center gap-2 sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              class="w-full px-4 text-xs font-medium sm:w-auto"
              @click="dismiss"
            >
              Continue in Browser
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

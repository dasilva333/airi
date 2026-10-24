<script setup lang="ts">
import { StageControlEditor } from '@proj-airi/stage-ui/components'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

const showSheet = defineModel<boolean>({ default: false })
</script>

<template>
  <DialogRoot :open="showSheet" @update:open="val => showSheet = val">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent
        :class="[
          'fixed inset-x-0 bottom-0 z-[9999] mx-auto max-w-lg max-h-[90dvh] w-full flex flex-col',
          'rounded-t-[32px] border border-b-0 border-neutral-200/60 dark:border-neutral-800/80',
          'bg-white/95 dark:bg-neutral-950/95 shadow-2xl backdrop-blur-xl outline-none',
          'data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow',
        ]"
      >
        <!-- Grab Handle -->
        <div class="flex shrink-0 items-center justify-center px-4 pb-1 pt-2.5">
          <div class="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between px-5 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="size-9 flex shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500 dark:bg-primary-500/20 dark:text-primary-400">
              <div class="i-solar:widget-2-bold-duotone size-4.5" />
            </div>
            <DialogTitle class="text-base text-neutral-900 font-bold dark:text-neutral-50">
              Floating Controls Settings
            </DialogTitle>
          </div>
          <button
            type="button"
            class="cursor-pointer rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Close"
            @click="showSheet = false"
          >
            <div class="i-solar:close-circle-linear size-5" />
          </button>
        </div>

        <!-- Editor (scrolls inside the sheet; page stays put) -->
        <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-8 scrollbar-thin">
          <StageControlEditor compact />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

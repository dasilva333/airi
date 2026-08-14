<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

interface Props {
  modelValue: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'wizard'): void
  (e: 'guided'): void
  (e: 'advanced'): void
}>()

function selectWizard() {
  emit('update:modelValue', false)
  emit('wizard')
}

function selectGuided() {
  emit('update:modelValue', false)
  emit('guided')
}

function selectAdvanced() {
  emit('update:modelValue', false)
  emit('advanced')
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-100 max-h-[90vh] max-w-3xl w-[92%] overflow-y-auto border border-neutral-200/80 rounded-2xl bg-white/95 p-5 shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-800/80 dark:bg-neutral-900/95 sm:p-6"
      >
        <DialogTitle class="mb-1 text-lg text-neutral-800 font-bold sm:text-xl dark:text-neutral-100">
          Create New Character Card
        </DialogTitle>
        <DialogDescription class="mb-5 text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
          Choose how you want to create your new character roleplay card.
        </DialogDescription>

        <div class="grid grid-cols-1 mb-5 gap-3.5 md:grid-cols-3">
          <!-- Companion Wizard Option -->
          <div
            class="group flex flex-col cursor-pointer border border-purple-500/30 rounded-xl bg-purple-500/5 p-4 transition-all duration-300 hover:border-purple-500/50 hover:bg-purple-500/10"
            @click="selectWizard"
          >
            <div class="mb-2.5 flex items-center justify-between">
              <div class="rounded-lg bg-purple-500/20 p-2 text-purple-500">
                <div i-solar:stars-line-bold-duotone class="text-xl" />
              </div>
              <span class="rounded bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-600 font-bold tracking-wider uppercase dark:text-purple-400">
                Recommended
              </span>
            </div>
            <h4 class="text-sm text-neutral-800 font-bold transition-colors sm:text-base dark:text-neutral-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
              Companion Wizard
            </h4>
            <p class="mt-1 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Guided setup sequence for mind, voice, body avatar, and persona.
            </p>
          </div>

          <!-- Guided Creator Option -->
          <div
            class="group flex flex-col cursor-pointer border border-primary-500/20 rounded-xl bg-primary-500/5 p-4 transition-all duration-300 hover:border-primary-500/40 hover:bg-primary-500/10"
            @click="selectGuided"
          >
            <div class="mb-2.5 flex items-center justify-between">
              <div class="rounded-lg bg-primary-500/20 p-2 text-primary-500">
                <div i-solar:magic-stick-3-line-duotone class="text-xl" />
              </div>
              <span class="rounded bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-500 font-bold tracking-wider uppercase">
                AnimaDex
              </span>
            </div>
            <h4 class="text-sm text-neutral-800 font-bold transition-colors sm:text-base dark:text-neutral-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">
              Guided AI Creator
            </h4>
            <p class="mt-1 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Synthesize a card from the 36k AnimaDex catalog with story prompts.
            </p>
          </div>

          <!-- Advanced Creator Option -->
          <div
            class="group flex flex-col cursor-pointer border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 transition-all duration-300 dark:border-neutral-800 hover:border-neutral-300 dark:bg-neutral-800/10 hover:bg-neutral-100/50 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/30"
            @click="selectAdvanced"
          >
            <div class="mb-2.5 flex items-center">
              <div class="rounded-lg bg-neutral-200 p-2 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                <div i-solar:settings-line-duotone class="text-xl" />
              </div>
            </div>
            <h4 class="text-sm text-neutral-800 font-bold transition-colors sm:text-base dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white">
              Advanced Manual
            </h4>
            <p class="mt-1 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Manually fill character traits, greeting lines, prompts, &amp; models.
            </p>
          </div>
        </div>

        <div class="flex flex-row justify-end">
          <Button
            variant="secondary"
            label="Cancel"
            class="h-[36px] px-4 text-xs"
            @click="emit('update:modelValue', false)"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

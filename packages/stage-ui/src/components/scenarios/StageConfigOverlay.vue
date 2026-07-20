<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'apply-preset', preset: 'mini' | 'med.' | 'large' | 'full'): void
  (e: 'apply-alignment', alignment: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): void
  (e: 'hide-stage'): void
}>()

const isOpen = ref(false)
const mode = ref<'size' | 'position'>('size')

const PRESETS = [
  { name: 'mini' as const, icon: 'i-solar:minimize-square-3-linear' },
  { name: 'med.' as const, icon: 'i-solar:maximize-square-2-linear' },
  { name: 'large' as const, icon: 'i-solar:maximize-square-3-linear' },
  { name: 'full' as const, icon: 'i-solar:screencast-linear' },
]

const CORNERS = [
  { id: 'top-left' as const, icon: 'i-ph:arrow-up-left' },
  { id: 'top-right' as const, icon: 'i-ph:arrow-up-right' },
  { id: 'bottom-left' as const, icon: 'i-ph:arrow-down-left' },
  { id: 'bottom-right' as const, icon: 'i-ph:arrow-down-right' },
]

watch(() => props.open, (val) => {
  if (val !== undefined && val !== isOpen.value) {
    isOpen.value = val
  }
})

watch(isOpen, (val) => {
  emit('update:open', val)
})

function toggleMode() {
  mode.value = mode.value === 'size' ? 'position' : 'size'
}

function handlePreset(preset: 'mini' | 'med.' | 'large' | 'full') {
  emit('apply-preset', preset)
  isOpen.value = false
}

function handleCorner(alignment: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') {
  emit('apply-alignment', alignment)
  isOpen.value = false
}

function handleHide() {
  emit('hide-stage')
  isOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-100"
        @click.self="isOpen = false"
      >
        <div
          :class="[
            'absolute right-3 top-10 z-110',
            'flex flex-col gap-2',
            'p-3 rounded-2xl',
            'border border-neutral-200/20 dark:border-neutral-700/20',
            'bg-neutral-50/30 dark:bg-neutral-900/30',
            'backdrop-blur-xl',
            'shadow-xl shadow-black/5 dark:shadow-black/20',
          ]"
        >
          <!-- Row 1: Mode Toggle + Hide -->
          <div class="flex items-center justify-between gap-2">
            <button
              :class="[
                'size-9 flex items-center justify-center rounded-xl cursor-pointer',
                'border border-white/20 dark:border-neutral-500/20',
                'bg-white/15 dark:bg-neutral-800/30',
                'backdrop-blur-md',
                'text-neutral-700 dark:text-neutral-200',
                'transition-all duration-150',
                'hover:bg-white/30 dark:hover:bg-neutral-700/40',
              ]"
              :title="mode === 'size' ? 'Switch to Position Mode' : 'Switch to Size Mode'"
              @click="toggleMode"
            >
              <div v-if="mode === 'size'" class="i-ph:plus-square size-5" />
              <div v-else class="i-ph:copy size-5" />
            </button>

            <button
              :class="[
                'size-9 flex items-center justify-center rounded-xl cursor-pointer',
                'border border-white/20 dark:border-neutral-500/20',
                'bg-white/15 dark:bg-neutral-800/30',
                'backdrop-blur-md',
                'text-neutral-700 dark:text-neutral-200',
                'transition-all duration-150',
                'hover:bg-red-500/20 hover:text-red-400',
              ]"
              title="Hide Stage"
              @click="handleHide"
            >
              <div class="i-ph:eye-slash size-5" />
            </button>
          </div>

          <!-- Row 2: Size Presets Grid -->
          <div v-if="mode === 'size'" class="grid grid-cols-2 gap-2">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              :class="[
                'flex flex-col items-center justify-center gap-1 rounded-xl cursor-pointer aspect-square',
                'border border-white/20 dark:border-neutral-500/20',
                'bg-white/15 dark:bg-neutral-800/30',
                'backdrop-blur-md',
                'text-neutral-700 dark:text-neutral-200',
                'transition-all duration-150',
                'hover:bg-white/30 dark:hover:bg-neutral-700/40',
              ]"
              :title="p.name"
              @click="handlePreset(p.name)"
            >
              <span class="text-[9px] font-semibold capitalize">{{ p.name }}</span>
            </button>
          </div>

          <!-- Row 2: Corner Positions Grid -->
          <div v-else class="grid grid-cols-2 gap-2">
            <button
              v-for="c in CORNERS"
              :key="c.id"
              :class="[
                'flex flex-col items-center justify-center gap-1 rounded-xl cursor-pointer aspect-square',
                'border border-white/20 dark:border-neutral-500/20',
                'bg-white/15 dark:bg-neutral-800/30',
                'backdrop-blur-md',
                'text-neutral-700 dark:text-neutral-200',
                'transition-all duration-150',
                'hover:bg-white/30 dark:hover:bg-neutral-700/40',
              ]"
              :title="c.id"
              @click="handleCorner(c.id)"
            >
              <div :class="[c.icon, 'size-6']" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

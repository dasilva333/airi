<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  showBackground?: boolean
  showModel?: boolean
}>(), {
  showBackground: true,
  showModel: true,
})

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'update:showBackground', val: boolean): void
  (e: 'update:showModel', val: boolean): void
  (e: 'apply-preset', preset: 'mini' | 'med.' | 'large' | 'full'): void
  (e: 'center-model'): void
  (e: 'hide-stage'): void
}>()

const isOpen = ref(false)

const PRESETS = [
  { name: 'mini' as const, icon: 'i-solar:minimize-square-3-linear' },
  { name: 'med.' as const, icon: 'i-solar:maximize-square-2-linear' },
  { name: 'large' as const, icon: 'i-solar:maximize-square-3-linear' },
  { name: 'full' as const, icon: 'i-solar:screencast-linear' },
]

watch(() => props.open, (val) => {
  if (val !== undefined && val !== isOpen.value) {
    isOpen.value = val
  }
})

watch(isOpen, (val) => {
  emit('update:open', val)
})

function handleCenterModel() {
  emit('center-model')
  isOpen.value = false
}

function handlePreset(preset: 'mini' | 'med.' | 'large' | 'full') {
  emit('apply-preset', preset)
  isOpen.value = false
}

function handleHide() {
  emit('hide-stage')
  isOpen.value = false
}

function toggleBackground() {
  emit('update:showBackground', !props.showBackground)
}

function toggleModel() {
  emit('update:showModel', !props.showModel)
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
          <!-- Row 1: Center Mascot + Hide Stage -->
          <div class="flex items-center justify-between gap-2">
            <button
              :class="[
                'size-9 flex items-center justify-center rounded-xl cursor-pointer',
                'border border-white/20 dark:border-neutral-500/20',
                'bg-white/15 dark:bg-neutral-800/30',
                'backdrop-blur-md',
                'text-neutral-700 dark:text-neutral-200',
                'transition-all duration-150',
                'hover:bg-white/30 dark:hover:bg-neutral-700/40 hover:text-primary-500 dark:hover:text-primary-400',
              ]"
              title="Center Mascot in Viewport"
              @click="handleCenterModel"
            >
              <div class="i-ph:crosshair-simple size-5" />
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

          <!-- Rows 2 & 3: Size Presets Grid -->
          <div class="grid grid-cols-2 gap-2">
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

          <!-- Row 4: Background Image & Running Model Layer Visibility Toggles -->
          <div class="grid grid-cols-2 gap-2">
            <button
              :class="[
                'size-9 w-full flex items-center justify-center rounded-xl cursor-pointer',
                'border border-white/20 dark:border-neutral-500/20',
                'backdrop-blur-md transition-all duration-150',
                showBackground
                  ? 'bg-white/25 dark:bg-neutral-700/40 text-neutral-800 dark:text-neutral-100 hover:bg-white/40 dark:hover:bg-neutral-600/50'
                  : 'bg-white/5 dark:bg-neutral-900/20 text-neutral-400 dark:text-neutral-500 opacity-60 hover:opacity-100',
              ]"
              :title="showBackground ? 'Hide Stage Background Image' : 'Show Stage Background Image'"
              @click="toggleBackground"
            >
              <div :class="[showBackground ? 'i-ph:image' : 'i-ph:image-slash', 'size-5']" />
            </button>

            <button
              :class="[
                'size-9 w-full flex items-center justify-center rounded-xl cursor-pointer',
                'border border-white/20 dark:border-neutral-500/20',
                'backdrop-blur-md transition-all duration-150',
                showModel
                  ? 'bg-white/25 dark:bg-neutral-700/40 text-neutral-800 dark:text-neutral-100 hover:bg-white/40 dark:hover:bg-neutral-600/50'
                  : 'bg-white/5 dark:bg-neutral-900/20 text-neutral-400 dark:text-neutral-500 opacity-60 hover:opacity-100',
              ]"
              :title="showModel ? 'Hide Running Model Layer' : 'Show Running Model Layer'"
              @click="toggleModel"
            >
              <div :class="[showModel ? 'i-ph:user' : 'i-ph:user-slash', 'size-5']" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

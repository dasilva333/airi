<script setup lang="ts">
import { useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useSettingsControlStrip } from '../../../stores/settings/control-strip'

const modelStore = useModelStore()
const controlStripStore = useSettingsControlStrip()
const { stageMateEnabled } = storeToRefs(controlStripStore)

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

// Bespoke popover metadata (mirrors ModelCustomizer VFX_EFFECTS styling,
// preview-only: no keyword management, no insert actions).
const VFX_ITEMS = [
  {
    key: 'fire',
    name: 'Fire',
    icon: 'i-solar:fire-bold-duotone',
    badgeBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  {
    key: 'electric',
    name: 'Electric',
    icon: 'i-solar:bolt-bold-duotone',
    badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  },
  {
    key: 'magic',
    name: 'Magic',
    icon: 'i-solar:stars-minimalistic-bold-duotone',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  {
    key: 'verdant',
    name: 'Verdant',
    icon: 'i-solar:leaf-bold-duotone',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
]

function triggerPreview(key: string) {
  // NOTICE: the VFX aura layer is format-agnostic (hook fan-out in
  // stage-ui-three model-store). Renderer-specific extras from ModelCustomizer
  // (VRM emotion pulse, MMD previewExpression) stay in the manage surface.
  modelStore.triggerVfx(key, 4.0)
  if (stageMateEnabled.value && isElectron.value) {
    import('@proj-airi/electron-vueuse').then(({ useElectronEventaInvoke }) => {
      import('@proj-airi/stage-shared').then(({ electronStageMateTriggerExpression }) => {
        const triggerExpr = useElectronEventaInvoke(electronStageMateTriggerExpression)
        triggerExpr({ name: key, weight: 1.0, durationMs: 4000 })
      })
    }).catch(() => {})
  }
}
</script>

<template>
  <div :class="['grid grid-cols-2 gap-1.5']">
    <button
      v-for="item in VFX_ITEMS"
      :key="item.key"
      type="button"
      :class="['flex cursor-pointer flex-col items-center gap-1 border rounded-xl px-2 py-2.5 transition-all active:scale-95', 'bg-white dark:bg-neutral-900', item.badgeBg, 'hover:brightness-105']"
      :title="`Preview ${item.name} aura`"
      @click="triggerPreview(item.key)"
    >
      <div :class="[item.icon, 'size-5']" />
      <span :class="['text-[11px] font-bold']">{{ item.name }}</span>
      <span :class="['flex items-center gap-1 text-[10px] opacity-70']">
        <div :class="['i-solar:play-bold size-3']" />
        <span>Preview</span>
      </span>
    </button>
  </div>
</template>

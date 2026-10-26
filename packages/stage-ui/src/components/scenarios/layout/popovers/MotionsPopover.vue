<script setup lang="ts">
/**
 * Motions popover — per-renderer motion list with idle-cycle multi-select.
 *
 * Self-serving: it owns the renderer stores (Live2D / MMD / Spine / VRM) it
 * reads and the card mutations it writes. The stock-MMD list that used to be
 * duplicated twice in the shell now comes from the constants module.
 */
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useMmd } from '@proj-airi/stage-ui-mmd/stores/mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, ref, toRef } from 'vue'

import StripPopover from '../StripPopover.vue'

import { STOCK_MMD_MOTIONS } from '../../../../constants/control-strip-labels'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettings } from '../../../../stores/settings'

const emit = defineEmits<{ close: [] }>()

const settingsStore = useSettings()
const cardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(cardStore)

const modelStore = useModelStore()
const vrmIdleAnimation = toRef(modelStore as any, 'vrmIdleAnimation')

const live2dStore = useLive2d()
const mmdStore = useMmd()
const spineStore = useSpine()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()

const stockMmd = new Set<string>(STOCK_MMD_MOTIONS)

const availableMotions = computed(() => {
  const list: Array<{ key: string, label: string, raw?: any }> = []

  // Prepend None option
  list.push({
    key: '',
    label: 'None',
  })

  if (settingsStore.stageModelRenderer === 'vrm') {
    list.push(...customVrmAnimationsStore.animationKeys.map(key => ({
      key,
      label: customVrmAnimationsStore.animationLabelByKey[key] || key,
    })))
  }
  else if (settingsStore.stageModelRenderer === 'live2d') {
    list.push(...(live2dStore.availableMotions || []).map(motion => ({
      key: `${motion.motionName}:${motion.motionIndex}`,
      label: `${motion.motionName} (${motion.motionIndex})`,
      raw: motion,
    })))
  }
  else if (settingsStore.stageModelRenderer === 'mmd') {
    list.push(...(mmdStore.availableMotions || []).map(motion => ({
      key: motion,
      label: motion,
    })))
  }
  else if (settingsStore.stageModelRenderer === 'spine') {
    list.push(...(spineStore.availableAnimations || []).map(animation => ({
      key: animation.name,
      label: animation.name,
    })))
  }

  return list
})

const motionsFilterTab = ref<'all' | 'gen'>('all')

const showGenMotionTab = computed(() => {
  const renderer = settingsStore.stageModelRenderer
  return renderer === 'vrm' || renderer === 'mmd'
})

const genMotionsCount = computed(() => {
  if (settingsStore.stageModelRenderer === 'vrm')
    return availableMotions.value.filter(m => m.key && m.key.startsWith('custom-vrma:')).length
  if (settingsStore.stageModelRenderer === 'mmd')
    return availableMotions.value.filter(m => m.key && !stockMmd.has(m.key)).length
  return 0
})

const filteredMotions = computed(() => {
  if (motionsFilterTab.value === 'all' || !showGenMotionTab.value)
    return availableMotions.value

  if (settingsStore.stageModelRenderer === 'vrm')
    return availableMotions.value.filter(m => m.key && m.key.startsWith('custom-vrma:'))

  if (settingsStore.stageModelRenderer === 'mmd')
    return availableMotions.value.filter(m => m.key && !stockMmd.has(m.key))

  return availableMotions.value
})

const idleCycleCount = computed(() => {
  const set = activeCard.value?.extensions?.airi?.acting?.idleAnimations || []
  return availableMotions.value.filter(m => m.key && set.includes(m.key)).length
})

// Membership in the idle cycle set (persisted on the card) — the multi-select
// replacement for the old "now playing" highlight. Tapping a row toggles it;
// the play end-cap auditions without touching the set.
function isMotionInCycle(motion: { key: string }): boolean {
  if (!motion.key)
    return idleCycleCount.value === 0
  const set = activeCard.value?.extensions?.airi?.acting?.idleAnimations || []
  return set.includes(motion.key)
}

function toggleMotionInCycle(motion: { key: string }) {
  if (!activeCardId.value || !activeCard.value)
    return
  if (!motion.key) {
    // None: clear the set through the existing per-renderer reset path.
    playMotion(motion)
    return
  }
  const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
  const next = current.includes(motion.key)
    ? current.filter(key => key !== motion.key)
    : [...current, motion.key]
  cardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions.airi,
        acting: {
          ...activeCard.value.extensions.airi.acting,
          idleAnimations: next,
        },
      },
    },
  })
}

function playMotion(motion: { key: string, raw?: any }) {
  if (motion.key === '') {
    if (settingsStore.stageModelRenderer === 'vrm') {
      vrmIdleAnimation.value = ''
      if (activeCardId.value && activeCard.value) {
        const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
        const next = current.filter(key => key.includes(':'))
        cardStore.updateCard(activeCardId.value, {
          extensions: {
            ...activeCard.value.extensions,
            airi: {
              ...activeCard.value.extensions.airi,
              acting: {
                ...activeCard.value.extensions.airi.acting,
                idleAnimations: next,
              },
            },
          },
        })
      }
    }
    else if (settingsStore.stageModelRenderer === 'live2d') {
      const modelId = activeCardId.value || 'global'
      localStorage.removeItem(`live2d-${modelId}-selected-motion`)
      localStorage.removeItem(`live2d-${modelId}-selected-motion-name`)
      localStorage.removeItem(`live2d-${modelId}-selected-motion-group`)
      localStorage.removeItem(`live2d-${modelId}-selected-motion-index`)
      live2dStore.currentMotion = { group: 'Idle', index: 0 }
    }
    else if (settingsStore.stageModelRenderer === 'mmd') {
      mmdStore.currentMotion = ''
      if (activeCardId.value && activeCard.value) {
        const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
        const next = current.filter(key => !key.startsWith('mmd:'))
        cardStore.updateCard(activeCardId.value, {
          extensions: {
            ...activeCard.value.extensions,
            airi: {
              ...activeCard.value.extensions.airi,
              acting: {
                ...activeCard.value.extensions.airi.acting,
                idleAnimations: next,
              },
            },
          },
        })
      }
    }
    else if (settingsStore.stageModelRenderer === 'spine') {
      spineStore.currentAnimation = { ...spineStore.currentAnimation, name: '' }
      if (activeCardId.value && activeCard.value) {
        const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
        const next = current.filter(key => !key.startsWith('spine:'))
        cardStore.updateCard(activeCardId.value, {
          extensions: {
            ...activeCard.value.extensions,
            airi: {
              ...activeCard.value.extensions.airi,
              acting: {
                ...activeCard.value.extensions.airi.acting,
                idleAnimations: next,
              },
            },
          },
        })
      }
    }
    return
  }

  if (settingsStore.stageModelRenderer === 'vrm') {
    vrmIdleAnimation.value = motion.key
  }
  else if (settingsStore.stageModelRenderer === 'live2d') {
    live2dStore.currentMotion = {
      group: motion.raw.motionName,
      index: motion.raw.motionIndex,
    }
    const modelId = activeCardId.value || 'global'
    localStorage.setItem(`live2d-${modelId}-selected-motion`, motion.raw.displayPath)
    localStorage.setItem(`live2d-${modelId}-selected-motion-name`, motion.raw.name)
    localStorage.setItem(`live2d-${modelId}-selected-motion-group`, motion.raw.group)
    localStorage.setItem(`live2d-${modelId}-selected-motion-index`, motion.raw.index != null ? String(motion.raw.index) : '0')
  }
  else if (settingsStore.stageModelRenderer === 'mmd') {
    mmdStore.currentMotion = motion.key
  }
  else if (settingsStore.stageModelRenderer === 'spine') {
    spineStore.currentAnimation = { ...spineStore.currentAnimation, name: motion.key }
  }
}
</script>

<template>
  <StripPopover title="Motions" @close="emit('close')">
    <template #header>
      <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Motions</span>
          <span class="rounded-full bg-primary-500/10 px-1.5 py-0.5 text-[10px] text-primary-600 font-bold font-mono dark:text-primary-400">
            {{ idleCycleCount }} in cycle
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- All | Gen Toggle (vrm and mmd only) -->
          <div
            v-if="showGenMotionTab"
            class="flex items-center gap-0.5 border border-neutral-200/70 rounded-lg bg-neutral-100 p-0.5 dark:border-neutral-700/60 dark:bg-neutral-800/80"
          >
            <button
              type="button"
              :class="[
                'px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer',
                motionsFilterTab === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="motionsFilterTab = 'all'"
            >
              All
            </button>
            <button
              type="button"
              :class="[
                'px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1',
                motionsFilterTab === 'gen'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="motionsFilterTab = 'gen'"
            >
              <span>Gen</span>
              <span
                v-if="genMotionsCount > 0"
                class="rounded-full bg-primary-500/15 px-1 py-0.2 text-[8px] text-primary-600 font-bold dark:text-primary-400"
              >
                {{ genMotionsCount }}
              </span>
            </button>
          </div>

          <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="emit('close')">
            <span class="i-solar:close-circle-outline text-lg" />
          </button>
        </div>
      </div>
    </template>

    <div class="max-h-48 flex flex-col gap-1.5 overflow-y-auto py-1 scrollbar-thin">
      <div
        v-for="motion in filteredMotions"
        :key="motion.key"
        :class="[
          'w-full flex items-center gap-1 border rounded-xl p-1 text-left text-xs transition-all duration-200',
          isMotionInCycle(motion)
            ? 'bg-amber-500/20 border-amber-400/50 text-amber-600 dark:text-amber-300 font-semibold'
            : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
        ]"
      >
        <button
          type="button"
          class="min-w-0 flex flex-1 cursor-pointer items-center justify-between rounded-lg px-2 py-1.5"
          :title="motion.key ? 'Toggle in idle cycle' : 'Clear idle cycle'"
          @click="toggleMotionInCycle(motion)"
        >
          <span class="mr-2 truncate font-medium">{{ motion.label }}</span>
          <span
            v-if="isMotionInCycle(motion)"
            class="i-solar:check-circle-bold flex-shrink-0 text-sm text-amber-500"
          />
        </button>
        <button
          v-if="motion.key"
          type="button"
          class="flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          title="Play once"
          @click.stop="playMotion(motion)"
        >
          <span class="i-solar:play-bold size-4" />
        </button>
      </div>

      <div
        v-if="filteredMotions.length === 0"
        class="flex flex-col items-center justify-center py-6 text-center opacity-40"
      >
        <span class="i-solar:magic-stick-3-bold-duotone text-2xl" />
        <span class="mt-1 text-[10px]">
          {{ motionsFilterTab === 'gen' ? 'No generated or uploaded motions' : 'No motions available' }}
        </span>
      </div>
    </div>
  </StripPopover>
</template>

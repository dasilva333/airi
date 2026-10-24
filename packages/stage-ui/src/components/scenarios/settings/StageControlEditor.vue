<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { CUSTOMIZER_CATALOG } from '../../../constants/control-customizer'
import { useSettingsControlStrip } from '../../../stores/settings/control-strip'

const props = withDefaults(defineProps<{
  /** Tighter spacing + condensed header for bottom-sheet embedding. */
  compact?: boolean
}>(), {
  compact: false,
})

const { t } = useI18n()
const controlStripStore = useSettingsControlStrip()
const { buttons, dockedEdge } = storeToRefs(controlStripStore)

const selectedCategory = ref<string>('all')
const MAX_MOBILE_SLOTS = 7

// List of all active/enabled buttons in their current order (filtered for mobile)
const activeButtons = computed(() => {
  const isDesktop = isStageTamagotchi()
  const allCatalog = CUSTOMIZER_CATALOG.flatMap(g => g.items)
  const desktopOnlyMap = new Map(allCatalog.map(i => [i.id, !!i.desktopOnly]))

  return buttons.value.filter((btn) => {
    if (!btn.enabled)
      return false
    if (!isDesktop && desktopOnlyMap.get(btn.id))
      return false
    return true
  })
})

// Categories for filter chips
const categories = computed(() => {
  return [
    { id: 'all', name: 'All Controls', icon: 'i-solar:widget-2-bold-duotone' },
    ...CUSTOMIZER_CATALOG.map(group => ({
      id: group.id,
      name: group.name,
      icon: group.icon,
    })),
  ]
})

// Available items based on selected category, filtering out desktop-only items on mobile
const filteredItems = computed(() => {
  const isDesktop = isStageTamagotchi()
  let items = CUSTOMIZER_CATALOG.flatMap(group =>
    group.items.map(item => ({
      ...item,
      groupId: group.id,
      groupName: group.name,
    })),
  )

  // Filter out desktop-only controls if on mobile/web
  if (!isDesktop) {
    items = items.filter(item => !item.desktopOnly)
  }

  // Filter by category
  if (selectedCategory.value !== 'all') {
    items = items.filter(item => item.groupId === selectedCategory.value)
  }

  return items
})

// Check if a specific control is currently active on the strip
function isControlOnStrip(itemId: string) {
  return buttons.value.some(b => b.id === itemId && b.enabled)
}

// Add or enable a control on the strip
function handleAddControl(item: { id: string, label: string, icon: string }) {
  const existingIndex = buttons.value.findIndex(b => b.id === item.id)

  if (existingIndex >= 0) {
    // If it exists in the list but was disabled, re-enable it and move to active list end
    const updated = [...buttons.value]
    const [target] = updated.splice(existingIndex, 1)
    target.enabled = true
    // Insert after the last currently enabled button
    const lastActiveIdx = updated.findLastIndex(b => b.enabled)
    updated.splice(lastActiveIdx + 1, 0, target)
    buttons.value = updated
  }
  else {
    // Add new button to the active list
    const newBtn = {
      id: item.id,
      label: item.label,
      icon: item.icon,
      enabled: true,
    }
    const updated = [...buttons.value]
    const lastActiveIdx = updated.findLastIndex(b => b.enabled)
    updated.splice(lastActiveIdx + 1, 0, newBtn)
    buttons.value = updated
  }
}

// Remove or disable a control from the strip
function handleRemoveControl(itemId: string) {
  const updated = buttons.value.map((b) => {
    if (b.id === itemId) {
      return { ...b, enabled: false }
    }
    return b
  })
  buttons.value = updated
}

// Shift button order on the strip
function handleMoveButton(indexInActive: number, direction: 'left' | 'right') {
  const targetActiveIndex = direction === 'left' ? indexInActive - 1 : indexInActive + 1
  if (targetActiveIndex < 0 || targetActiveIndex >= activeButtons.value.length)
    return

  const currentBtn = activeButtons.value[indexInActive]
  const targetBtn = activeButtons.value[targetActiveIndex]

  // Find their real indices in the buttons array
  const fromIndex = buttons.value.findIndex(b => b.id === currentBtn.id)
  const toIndex = buttons.value.findIndex(b => b.id === targetBtn.id)

  if (fromIndex >= 0 && toIndex >= 0) {
    const updated = [...buttons.value]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    buttons.value = updated
  }
}

// Reset strip to default buttons
function handleResetDefaults() {
  controlStripStore.resetButtons()
}
</script>

<template>
  <div :class="[compact ? 'w-full mx-auto flex flex-col gap-4 p-4 pb-8' : 'w-full max-w-5xl mx-auto flex flex-col gap-6 p-4 sm:p-6 lg:p-8 pb-28']">
    <!-- Hero / Title Card with Reset Action -->
    <div
      :class="[
        'relative overflow-hidden rounded-3xl border border-neutral-200/80 dark:border-neutral-800',
        'bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl shadow-sm',
        compact ? 'p-3.5' : 'p-5 sm:p-6',
        'flex flex-row items-center justify-between gap-3',
      ]"
    >
      <div :class="['min-w-0 flex items-center gap-3']">
        <div v-if="!compact" :class="['size-12 text-2xl rounded-2xl bg-primary-500/10 text-primary-500 dark:bg-primary-500/20 dark:text-primary-400 flex items-center justify-center shrink-0']">
          <div :class="['i-solar:widget-2-bold-duotone']" />
        </div>
        <div class="min-w-0">
          <h1 :class="[compact ? 'text-base' : 'text-lg sm:text-xl', 'font-bold text-neutral-900 dark:text-neutral-100 truncate']">
            {{ t('settings.pages.stage.title', 'Floating Controls') }}
          </h1>
          <p :class="[compact ? 'text-xs whitespace-normal' : 'text-xs sm:text-sm', 'text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.stage.description', 'Customize floating action strip slots, docking edge, and quick triggers.') }}
          </p>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        :class="['rounded-xl px-3.5 h-9 font-medium flex items-center gap-1.5 shrink-0']"
        @click="handleResetDefaults"
      >
        <div :class="['i-solar:restart-square-linear text-base']" />
        <span :class="[compact ? 'hidden min-[420px]:inline' : '']">Reset Defaults</span>
      </Button>
    </div>

    <!-- Section 1: Edge Docking Preference (Mobile / Web only) -->
    <section v-if="!isStageTamagotchi()" :class="['flex flex-col gap-2.5']">
      <div :class="['flex items-center justify-between']">
        <label :class="['text-xs text-neutral-500 dark:text-neutral-400 font-bold tracking-wider uppercase']">
          Edge Docking Side
        </label>
        <span :class="['text-xs text-neutral-400 font-medium font-mono']">
          14px Notch Anchor
        </span>
      </div>

      <div :class="['grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100/70 p-1.5 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60']">
        <button
          type="button"
          :class="[
            'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer',
            dockedEdge === 'left'
              ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-800 dark:text-primary-400 ring-1 ring-primary-500/20'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="dockedEdge = 'left'"
        >
          <div :class="['i-solar:sidebar-minimalistic-bold-duotone size-4 rotate-180']" />
          <span>Left Edge</span>
        </button>
        <button
          type="button"
          :class="[
            'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer',
            dockedEdge !== 'left'
              ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-800 dark:text-primary-400 ring-1 ring-primary-500/20'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="dockedEdge = 'right'"
        >
          <div :class="['i-solar:sidebar-minimalistic-bold-duotone size-4']" />
          <span>Right Edge (Default)</span>
        </button>
      </div>
    </section>

    <!-- Section 2: Active Strip Slots Preview -->
    <section :class="['flex flex-col gap-2.5']">
      <div :class="['flex items-center justify-between']">
        <div :class="['flex items-center gap-2']">
          <label :class="['text-xs text-neutral-500 dark:text-neutral-400 font-bold tracking-wider uppercase']">
            Active Strip Slots
          </label>
          <span :class="['rounded-full bg-primary-500/10 px-2 py-0.5 text-[11px] text-primary-600 font-bold font-mono dark:text-primary-400 border border-primary-500/20']">
            {{ activeButtons.length }} Active
          </span>
        </div>
        <span :class="['text-xs text-neutral-400']">
          Reorder or remove
        </span>
      </div>

      <!-- Strip Container -->
      <div :class="['flex flex-col border border-neutral-200/80 rounded-2xl bg-white/70 p-3.5 shadow-xs backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/60']">
        <div v-if="activeButtons.length === 0" :class="['py-8 text-center text-xs text-neutral-400']">
          No controls active on the strip. Add some from the catalog below!
        </div>

        <div v-else :class="['space-y-2']">
          <div
            v-for="(btn, idx) in activeButtons"
            :key="btn.id"
            :class="['flex items-center justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800/60 px-3.5 py-2.5 text-xs font-medium border border-neutral-200/50 dark:border-neutral-700/50 transition-all']"
          >
            <!-- Icon + Label -->
            <div :class="['min-w-0 flex items-center gap-3 pr-2']">
              <span :class="['text-[11px] text-neutral-400 font-bold font-mono w-5']">{{ idx + 1 }}.</span>
              <div :class="['size-8 flex items-center justify-center rounded-lg bg-white dark:bg-neutral-700 text-primary-500 shadow-xs border border-neutral-200/60 dark:border-neutral-600/40']">
                <div :class="[btn.icon, 'size-4.5']" />
              </div>
              <span :class="['truncate text-neutral-800 font-semibold dark:text-neutral-200']">
                {{ btn.label }}
              </span>
            </div>

            <!-- Actions: Shift Left / Shift Right / Remove -->
            <div :class="['flex shrink-0 items-center gap-1']">
              <button
                type="button"
                :disabled="idx === 0"
                :class="['size-8 flex items-center justify-center rounded-lg text-neutral-400 transition active:scale-95 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-20 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 cursor-pointer disabled:cursor-not-allowed']"
                title="Move Up"
                @click="handleMoveButton(idx, 'left')"
              >
                <div :class="['i-solar:alt-arrow-up-bold size-4']" />
              </button>
              <button
                type="button"
                :disabled="idx === activeButtons.length - 1"
                :class="['size-8 flex items-center justify-center rounded-lg text-neutral-400 transition active:scale-95 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-20 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 cursor-pointer disabled:cursor-not-allowed']"
                title="Move Down"
                @click="handleMoveButton(idx, 'right')"
              >
                <div :class="['i-solar:alt-arrow-down-bold size-4']" />
              </button>
              <button
                type="button"
                :class="['size-8 flex items-center justify-center rounded-lg text-neutral-400 transition active:scale-95 hover:bg-red-500/10 hover:text-red-500 dark:hover:bg-red-500/20 cursor-pointer']"
                title="Remove from Strip"
                @click="handleRemoveControl(btn.id)"
              >
                <div :class="['i-solar:close-circle-bold size-4.5']" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 3: Category Filter Chips -->
    <section :class="['flex flex-col gap-2.5']">
      <label :class="['text-xs text-neutral-500 dark:text-neutral-400 font-bold tracking-wider uppercase']">
        Browse Catalog by Category
      </label>

      <!-- Horizontal Scrollable Chips -->
      <div :class="['flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none']">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          :class="[
            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0',
            selectedCategory === cat.id
              ? 'bg-primary-500 text-white shadow-xs shadow-primary-500/20'
              : 'bg-white/80 text-neutral-600 dark:bg-neutral-900/80 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800',
          ]"
          @click="selectedCategory = cat.id"
        >
          <div :class="[cat.icon, 'size-3.5']" />
          <span>{{ cat.name }}</span>
        </button>
      </div>
    </section>

    <!-- Section 4: Available Controls List -->
    <section :class="['flex flex-col gap-2.5']">
      <div :class="['flex items-center justify-between']">
        <label :class="['text-xs text-neutral-500 dark:text-neutral-400 font-bold tracking-wider uppercase']">
          Available Controls ({{ filteredItems.length }})
        </label>
      </div>

      <div :class="[compact ? 'grid grid-cols-1 gap-2.5' : 'grid grid-cols-1 md:grid-cols-2 gap-3']">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          :class="[
            'flex items-center justify-between border border-neutral-200/80 rounded-2xl bg-white/80 p-3.5 shadow-xs backdrop-blur-md transition-all',
            'dark:border-neutral-800/80 hover:border-primary-500/40 dark:bg-neutral-900/80',
          ]"
        >
          <!-- Left: Icon & Info -->
          <div :class="['min-w-0 flex items-start gap-3 pr-2']">
            <div
              :class="[
                'size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                isControlOnStrip(item.id)
                  ? 'bg-primary-500/10 text-primary-500 dark:bg-primary-500/20 dark:text-primary-400'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
              ]"
            >
              <div :class="[item.icon, 'size-5']" />
            </div>

            <div :class="['min-w-0 flex flex-col']">
              <div :class="['flex items-center gap-1.5']">
                <span :class="['truncate text-xs text-neutral-900 font-bold dark:text-neutral-100']">
                  {{ item.label }}
                </span>
                <span v-if="!compact" :class="['rounded bg-neutral-100 px-1.5 py-0.2 text-[9px] text-neutral-400 font-semibold uppercase dark:bg-neutral-800']">
                  {{ item.groupName }}
                </span>
              </div>
              <p :class="['line-clamp-2 mt-0.5 text-[11px] text-neutral-500 leading-snug dark:text-neutral-400']">
                {{ item.description }}
              </p>
            </div>
          </div>

          <!-- Right: 1-Tap Toggle Button -->
          <div :class="['shrink-0 pl-2']">
            <button
              v-if="isControlOnStrip(item.id)"
              type="button"
              :class="[
                'flex cursor-pointer items-center gap-1 border border-primary-500/30 rounded-xl bg-primary-500/10 px-2.5 py-1.5 text-xs text-primary-600 font-bold transition active:scale-95',
                'hover:border-red-500/30 hover:bg-red-500/10 dark:text-primary-400 hover:text-red-600',
              ]"
              title="Click to remove from strip"
              @click="handleRemoveControl(item.id)"
            >
              <div :class="['i-solar:check-circle-bold size-3.5 text-primary-500']" />
              <span>On Strip</span>
            </button>

            <button
              v-else
              type="button"
              :disabled="activeButtons.length >= MAX_MOBILE_SLOTS"
              :class="[
                'flex cursor-pointer items-center gap-1 rounded-xl bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-700 font-bold transition active:scale-95',
                'disabled:cursor-not-allowed dark:bg-neutral-800 hover:bg-primary-500 dark:text-neutral-200 hover:text-white disabled:opacity-40 dark:hover:bg-primary-600 dark:hover:text-white',
              ]"
              :title="activeButtons.length >= MAX_MOBILE_SLOTS ? 'Maximum 7 slots reached' : 'Add to strip'"
              @click="handleAddControl(item)"
            >
              <div :class="['i-solar:add-circle-linear size-3.5']" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

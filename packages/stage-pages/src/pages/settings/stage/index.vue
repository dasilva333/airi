<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { CUSTOMIZER_CATALOG } from '@proj-airi/stage-ui/constants/control-customizer'
import { useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings/control-strip'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
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
function isControlOnStrip(itemId: string): boolean {
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

function handleGoBack() {
  if (window.history.length > 1) {
    router.back()
  }
  else {
    router.push('/')
  }
}
</script>

<template>
  <div class="min-h-screen w-full bg-neutral-50/50 pb-20 text-neutral-800 dark:bg-neutral-950/80 dark:text-neutral-200">
    <!-- Top Navigation Bar -->
    <header class="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-neutral-800/60 dark:bg-neutral-900/80">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="size-9 flex cursor-pointer items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 transition active:scale-95 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
          title="Back"
          @click="handleGoBack"
        >
          <div class="i-solar:arrow-left-linear size-5" />
        </button>
        <div>
          <h1 class="text-sm text-neutral-900 font-bold tracking-tight dark:text-neutral-100">
            Control Strip
          </h1>
          <p class="text-[10px] text-neutral-400 font-medium">
            Customize floating buttons & dock behavior
          </p>
        </div>
      </div>

      <!-- Reset defaults button -->
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1 rounded-xl bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-600 font-semibold transition active:scale-95 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
        title="Reset Strip to Defaults"
        @click="handleResetDefaults"
      >
        <div class="i-solar:restart-square-linear size-3.5" />
        <span class="hidden sm:inline">Reset Defaults</span>
      </button>
    </header>

    <main class="mx-auto max-w-xl flex flex-col gap-6 px-4 pt-4">
      <!-- Section 1: Edge Docking Preference -->
      <section class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <label class="text-[11px] text-neutral-400 font-bold tracking-wider uppercase">
            1. Edge Docking Side
          </label>
          <span class="text-[10px] text-neutral-400 font-medium">
            14px Notch Anchor
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100/70 p-1.5 dark:bg-neutral-900/70">
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
            <div class="i-solar:sidebar-minimalistic-bold-duotone size-4 rotate-180" />
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
            <div class="i-solar:sidebar-minimalistic-bold-duotone size-4" />
            <span>Right Edge (Default)</span>
          </button>
        </div>
      </section>

      <!-- Section 2: Active Strip Slots Preview -->
      <section class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <label class="text-[11px] text-neutral-400 font-bold tracking-wider uppercase">
              2. Active Strip Slots
            </label>
            <span class="rounded-full bg-primary-500/10 px-1.5 py-0.5 text-[10px] text-primary-600 font-bold font-mono dark:text-primary-400">
              {{ activeButtons.length }} Active
            </span>
          </div>
          <span class="text-[10px] text-neutral-400">
            Reorder or remove
          </span>
        </div>

        <!-- Strip Container -->
        <div class="flex flex-col border border-neutral-200/60 rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-900/60">
          <div v-if="activeButtons.length === 0" class="py-6 text-center text-xs text-neutral-400">
            No controls active on the strip. Add some from the list below!
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="(btn, idx) in activeButtons"
              :key="btn.id"
              class="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-xs font-medium dark:bg-neutral-800/60"
            >
              <!-- Icon + Label -->
              <div class="min-w-0 flex items-center gap-2.5 pr-2">
                <span class="text-[10px] text-neutral-400 font-bold font-mono">{{ idx + 1 }}.</span>
                <div class="size-7 flex items-center justify-center rounded-lg bg-white text-primary-500 shadow-sm dark:bg-neutral-700">
                  <div :class="[btn.icon, 'size-4']" />
                </div>
                <span class="truncate text-neutral-800 font-semibold dark:text-neutral-200">
                  {{ btn.label }}
                </span>
              </div>

              <!-- Actions: Shift Left / Shift Right / Remove -->
              <div class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  :disabled="idx === 0"
                  class="size-7 flex items-center justify-center rounded-lg text-neutral-400 transition active:scale-95 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-20 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  title="Move Up / Earlier"
                  @click="handleMoveButton(idx, 'left')"
                >
                  <div class="i-solar:alt-arrow-up-bold size-3.5" />
                </button>
                <button
                  type="button"
                  :disabled="idx === activeButtons.length - 1"
                  class="size-7 flex items-center justify-center rounded-lg text-neutral-400 transition active:scale-95 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-20 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  title="Move Down / Later"
                  @click="handleMoveButton(idx, 'right')"
                >
                  <div class="i-solar:alt-arrow-down-bold size-3.5" />
                </button>
                <button
                  type="button"
                  class="size-7 flex items-center justify-center rounded-lg text-neutral-400 transition active:scale-95 hover:bg-red-500/10 hover:text-red-500 dark:hover:bg-red-500/20"
                  title="Remove from Strip"
                  @click="handleRemoveControl(btn.id)"
                >
                  <div class="i-solar:close-circle-bold size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Category Filter Chips -->
      <section class="flex flex-col gap-2.5">
        <label class="text-[11px] text-neutral-400 font-bold tracking-wider uppercase">
          3. Browse Catalog by Category
        </label>

        <!-- Horizontal Scrollable Chips -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            v-for="cat in categories"
            :key="cat.id"
            type="button"
            :class="[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0',
              selectedCategory === cat.id
                ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/20'
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
      <section class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <label class="text-[11px] text-neutral-400 font-bold tracking-wider uppercase">
            4. Available Controls ({{ filteredItems.length }})
          </label>
        </div>

        <div class="flex flex-col gap-2">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="flex items-center justify-between border border-neutral-200/60 rounded-2xl bg-white/80 p-3 shadow-sm backdrop-blur-md transition-all dark:border-neutral-800/60 hover:border-primary-500/30 dark:bg-neutral-900/80"
          >
            <!-- Left: Icon & Info -->
            <div class="min-w-0 flex items-start gap-3 pr-2">
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

              <div class="min-w-0 flex flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-xs text-neutral-900 font-bold dark:text-neutral-100">
                    {{ item.label }}
                  </span>
                  <span class="rounded bg-neutral-100 px-1 py-0.2 text-[9px] text-neutral-400 font-semibold uppercase dark:bg-neutral-800">
                    {{ item.groupName }}
                  </span>
                </div>
                <p class="line-clamp-2 mt-0.5 text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
                  {{ item.description }}
                </p>
              </div>
            </div>

            <!-- Right: 1-Tap Toggle Button -->
            <div class="shrink-0 pl-2">
              <button
                v-if="isControlOnStrip(item.id)"
                type="button"
                class="flex cursor-pointer items-center gap-1 border border-primary-500/30 rounded-xl bg-primary-500/10 px-2.5 py-1.5 text-xs text-primary-600 font-bold transition active:scale-95 hover:border-red-500/30 hover:bg-red-500/10 dark:text-primary-400 hover:text-red-600"
                title="Click to remove from strip"
                @click="handleRemoveControl(item.id)"
              >
                <div class="i-solar:check-circle-bold size-3.5 text-primary-500" />
                <span>On Strip</span>
              </button>

              <button
                v-else
                type="button"
                :disabled="activeButtons.length >= MAX_MOBILE_SLOTS"
                class="flex cursor-pointer items-center gap-1 rounded-xl bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-700 font-bold transition active:scale-95 disabled:cursor-not-allowed dark:bg-neutral-800 hover:bg-primary-500 dark:text-neutral-200 hover:text-white disabled:opacity-40 dark:hover:bg-primary-600 dark:hover:text-white"
                :title="activeButtons.length >= MAX_MOBILE_SLOTS ? 'Maximum 7 slots reached' : 'Add to strip'"
                @click="handleAddControl(item)"
              >
                <div class="i-solar:add-circle-linear size-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

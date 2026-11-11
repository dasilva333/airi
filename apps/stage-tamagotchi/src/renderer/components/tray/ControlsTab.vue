<script setup lang="ts">
import { CUSTOMIZER_CATALOG } from '@proj-airi/stage-ui/constants/control-customizer'
import { useSettingsAudioDevice, useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings'
import { useBroadcastChannel, useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

// Pocket has its own saved layout. Never reset or replace the user's floating strip.
const DEFAULT_TRAY_IDS = [
  'mic',
  'stage',
  'chat',
  'gemini-session',
  'gemini-tts',
  'caption',
  'theme-mode',
  'workspace',
  'viewport-cycle-modes',
]

const ACTIONABLE_IDS = new Set([
  'actor-gunslinger',
  'head-tethered-caption',
  'viewport-cycle-modes',
  'viewport-tactile',
  'viewport-drag',
  'viewport-positioning',
  'viewport-orbit',
  'viewport-reset-coordinates',
  'viewport-auto-hide',
  'gemini-session',
  'gemini-tts',
  'gemini-grounding',
  'theme-mode',
  'caption-theme-mode',
  'caption-sync-position',
  'caption-sync-visibility',
  'caption-docking',
  'caption-layout-mode',
  'always-on-top',
  'stage',
  'stage-mate',
  'chat',
  'caption',
  'workspace',
  'mic',
  'settings',
  'layout',
  'exit-app',
])

const shortLabels: Record<string, string> = {
  'gemini-session': 'Session',
  'gemini-tts': 'TTS',
  'viewport-cycle-modes': 'Pointer',
  'actor-characters': 'Characters',
  'actor-wardrobe': 'Outfits',
  'actor-motion-playground': 'Motion',
  'actor-all-emotions': 'Emotions',
  'gemini-witness': 'Vision',
  'theme-mode': 'Theme',
  'stage': 'Stage',
  'mic': 'Mic',
  'caption': 'Captions',
  'chat': 'Chat',
  'workspace': 'Workspace',
}

const catalogItems = [...new Map(CUSTOMIZER_CATALOG.flatMap(group => group.items).map(item => [item.id, item] as const)).values()]
const catalogById = new Map(catalogItems.map(item => [item.id, item] as const))
const trayIds = useLocalStorage<string[]>('settings/tray/controls', [...DEFAULT_TRAY_IDS])
const controlStrip = useSettingsControlStrip()
const audioDevice = useSettingsAudioDevice()
const { buttons: stripButtons } = storeToRefs(controlStrip)
const { post: postTrayAction } = useBroadcastChannel<string, string>({ name: 'airi-pocket-tray-actions' })

const editing = ref(false)
const search = ref('')
const trayItems = computed(() => trayIds.value.map(id => catalogById.get(id)).filter((item): item is NonNullable<typeof item> => !!item))
const activeStripCount = computed(() => stripButtons.value.filter(button => button.enabled).length)
const filteredGroups = computed(() => CUSTOMIZER_CATALOG.map(group => ({
  ...group,
  items: group.items.filter(item => !item.disabled && (
    !search.value.trim()
    || [item.label, item.description, group.name].some(text => text.toLowerCase().includes(search.value.trim().toLowerCase()))
  )),
})).filter(group => group.items.length))

function isOnTray(id: string) {
  return trayIds.value.includes(id)
}

function isOnStrip(id: string) {
  return stripButtons.value.some(button => button.id === id && button.enabled)
}

function toggleTray(id: string) {
  trayIds.value = isOnTray(id)
    ? trayIds.value.filter(value => value !== id)
    : [...trayIds.value, id]
}

function toggleStrip(id: string) {
  const item = catalogById.get(id)
  if (!item)
    return

  const existing = stripButtons.value.find(button => button.id === id)
  if (existing) {
    stripButtons.value = stripButtons.value.map(button => button.id === id ? { ...button, enabled: !button.enabled } : button)
  }
  else {
    stripButtons.value = [...stripButtons.value, {
      id,
      enabled: true,
      label: item.label,
      icon: item.icon,
    }]
  }
}

function moveTray(id: string, direction: -1 | 1) {
  const list = [...trayIds.value]
  const from = list.indexOf(id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length)
    return
  ;[list[from], list[to]] = [list[to], list[from]]
  trayIds.value = list
}

function stateOf(id: string): boolean | undefined {
  switch (id) {
    case 'mic': return audioDevice.enabled
    case 'stage': return controlStrip.stageEnabled
    case 'stage-mate': return controlStrip.stageMateEnabled
    case 'chat': return controlStrip.chatOpen
    case 'caption': return controlStrip.captionOpen
    case 'workspace': return controlStrip.workspaceOpen
    default: return undefined
  }
}

function statusOf(id: string, type: string) {
  const state = stateOf(id)
  if (state !== undefined)
    return state ? 'On' : 'Off'
  if (!ACTIONABLE_IDS.has(id))
    return 'In main app'
  if (type === 'cycler')
    return 'Cycle'
  if (type === 'menu')
    return 'Open'
  if (type === 'toggle')
    return 'Toggle'
  return 'Run'
}

function triggerControl(id: string) {
  if (!ACTIONABLE_IDS.has(id))
    return
  // The primary Stage renderer owns actions; this tray must not instantiate
  // another model renderer or independently mutate the same control state.
  postTrayAction(id)
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-[13px] text-neutral-900 font-bold dark:text-neutral-100">
          <div class="i-solar:widget-2-bold text-lg text-primary-600 dark:text-primary-400" />
          Quick Controls
        </div>
        <p class="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          {{ editing ? 'Choose where each control lives.' : 'Your own Pocket layout, independent of the strip.' }}
        </p>
      </div>
      <button
        type="button"
        :aria-pressed="editing"
        class="flex shrink-0 items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-[11px] text-primary-700 font-semibold transition hover:bg-primary-100 dark:border-primary-800/70 dark:bg-primary-950/40 dark:text-primary-300"
        @click="editing = !editing"
      >
        <div :class="editing ? 'i-solar:check-circle-linear' : 'i-solar:pen-new-square-linear'" class="text-sm" />
        {{ editing ? 'Done' : 'Customize' }}
      </button>
    </div>

    <template v-if="!editing">
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="item in trayItems"
          :key="item.id"
          type="button"
          :disabled="!ACTIONABLE_IDS.has(item.id)"
          :title="ACTIONABLE_IDS.has(item.id) ? item.description : 'Available on the floating Control Strip; Pocket action is not yet wired'"
          class="group flex min-w-0 min-h-[91px] flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-45"
          :class="stateOf(item.id) === true
            ? 'border-primary-200 bg-primary-50/70 hover:bg-primary-100 dark:border-primary-800/70 dark:bg-primary-950/25'
            : 'border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50/40 dark:border-neutral-800 dark:bg-neutral-900/80 dark:hover:border-primary-700'"
          @click="triggerControl(item.id)"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100/80 text-primary-650 dark:bg-primary-950/60 dark:text-primary-400"
          >
            <span :class="item.icon" class="text-xl" />
          </span>
          <span class="w-full truncate text-[11px] text-neutral-900 font-semibold leading-tight dark:text-neutral-100">
            {{ shortLabels[item.id] || item.label }}
          </span>
          <span class="w-full truncate text-[10px] leading-tight" :class="stateOf(item.id) === true ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-500 dark:text-neutral-400'">
            {{ statusOf(item.id, item.type) }}
          </span>
        </button>

        <button
          type="button"
          class="flex min-h-[91px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-primary-300 bg-primary-50/20 p-2 text-primary-600 transition hover:bg-primary-50 dark:border-primary-800 dark:bg-primary-950/10 dark:text-primary-400"
          @click="editing = true"
        >
          <span class="i-solar:add-circle-linear text-2xl" />
          <span class="text-[11px] font-semibold">Add control</span>
        </button>
      </div>
      <div v-if="!trayItems.length" class="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-xs text-neutral-500 dark:border-neutral-700">
        No tray controls selected. Choose Customize to add your favorites.
      </div>
    </template>

    <div v-else class="flex flex-col gap-3">
      <div class="rounded-xl bg-primary-50/70 p-2.5 text-[11px] text-primary-800 dark:bg-primary-950/30 dark:text-primary-200">
        Tray and Strip are independent. Select both to keep a control on each surface, or remove it from the strip to declutter your desktop.
      </div>
      <input
        v-model="search"
        type="search"
        placeholder="Search controls..."
        aria-label="Search controls"
        class="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-primary-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
      <section v-for="group in filteredGroups" :key="group.id" class="space-y-1">
        <div class="flex items-center gap-1.5 px-1 py-1 text-[10px] text-neutral-500 font-bold uppercase tracking-wider dark:text-neutral-400">
          <span :class="group.icon" />
          {{ group.name }}
        </div>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <span :class="item.icon" class="shrink-0 text-lg text-primary-600 dark:text-primary-400" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-[11px] text-neutral-900 font-semibold dark:text-neutral-100">{{ item.label }}</div>
            <div class="truncate text-[9px] text-neutral-500 dark:text-neutral-400">
              {{ ACTIONABLE_IDS.has(item.id) ? item.description : 'Pocket action pending; available on the floating strip' }}
            </div>
          </div>
          <button
            type="button"
            :aria-pressed="isOnStrip(item.id)"
            :title="isOnStrip(item.id) ? 'Remove from floating strip' : 'Add to floating strip'"
            class="rounded-lg border px-1.5 py-1 text-[10px] font-semibold"
            :class="isOnStrip(item.id) ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300' : 'border-neutral-200 text-neutral-500 dark:border-neutral-700'"
            @click="toggleStrip(item.id)"
          >
            Strip
          </button>
          <button
            type="button"
            :aria-pressed="isOnTray(item.id)"
            :title="isOnTray(item.id) ? 'Remove from Pocket' : 'Add to Pocket'"
            class="rounded-lg border px-1.5 py-1 text-[10px] font-semibold"
            :class="isOnTray(item.id) ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300' : 'border-neutral-200 text-neutral-500 dark:border-neutral-700'"
            @click="toggleTray(item.id)"
          >
            Tray
          </button>
          <div v-if="isOnTray(item.id)" class="flex flex-col gap-0.5">
            <button type="button" title="Move up" aria-label="Move control up" class="i-solar:alt-arrow-up-linear text-xs text-neutral-500 hover:text-primary-600" @click="moveTray(item.id, -1)" />
            <button type="button" title="Move down" aria-label="Move control down" class="i-solar:alt-arrow-down-linear text-xs text-neutral-500 hover:text-primary-600" @click="moveTray(item.id, 1)" />
          </div>
        </div>
      </section>
    </div>

    <div class="mt-auto flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50/90 px-3 py-2 text-[10px] dark:border-neutral-800 dark:bg-neutral-900/80">
      <span class="flex min-w-0 items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
        <span class="i-solar:layers-minimalistic-linear text-primary-600 dark:text-primary-400" />
        <span class="truncate">Pocket {{ trayItems.length }} · Strip {{ activeStripCount }}</span>
      </span>
      <button
        type="button"
        class="shrink-0 text-primary-700 font-semibold hover:underline dark:text-primary-400"
        @click="editing = !editing"
      >
        {{ editing ? 'Done editing' : 'Edit placement' }}
      </button>
    </div>
  </div>
</template>

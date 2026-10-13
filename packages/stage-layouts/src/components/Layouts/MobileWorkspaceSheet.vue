<script setup lang="ts">
import { useSandbox } from '@proj-airi/stage-ui/composables/use-sandbox'
import { ansiToHtml } from '@proj-airi/stage-ui/libs/sandbox'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores'
import { useLocalStorage, useScreenSafeArea } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const cardStore = useAiriCardStore()
const isSandboxAllowed = computed(() => {
  const tools = cardStore.activeCard?.extensions?.airi?.generation?.known?.allowedTools
  return Boolean(tools && (tools.includes('bash') || tools.includes('mcp_bash')))
})

async function handleEnableSandbox() {
  if (!cardStore.activeCard || !cardStore.activeCardId)
    return
  const card = cardStore.activeCard
  const airi = card.extensions?.airi
  const currentTools = airi?.generation?.known?.allowedTools ?? ['text_journal', 'image_journal']
  const nextTools = currentTools.includes('bash') ? currentTools : [...currentTools, 'bash']

  await cardStore.updateCard(cardStore.activeCardId, {
    extensions: {
      ...card.extensions,
      airi: {
        ...airi,
        generation: {
          ...airi?.generation,
          known: {
            ...airi?.generation?.known,
            allowedTools: nextTools,
          },
        },
      },
    },
  } as any)
}

const activeTab = useLocalStorage<'widgets' | 'terminal'>('airi:mobile-workspace-tab', 'widgets')

const screenSafeArea = useScreenSafeArea()
const safeBottomOffset = computed(() => {
  const raw = Number.parseFloat(screenSafeArea.bottom.value?.replace('px', '') || '0')
  return Math.max(raw + 16, 76)
})

const {
  isExecuting,
  commandHistory,
  exec,
  clearLogs,
  reset,
  mountedWidgets,
  setWidgetSurface,
  mountPersistedWidget,
  getPersistedWidgets,
} = useSandbox()

// --- Terminal State ---
const commandInput = ref('')
const commandHistoryNav = ref<string[]>([])
const navIndex = ref(-1)
const terminalScrollRef = ref<HTMLDivElement | null>(null)

function isNearBottom(el: HTMLElement, threshold = 60): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

// Auto-scroll terminal on new command output only if user is already at bottom
watch(
  () => commandHistory.value,
  async () => {
    const el = terminalScrollRef.value
    const shouldScroll = !el || isNearBottom(el)
    await nextTick()
    if (el && shouldScroll) {
      el.scrollTop = el.scrollHeight
    }
  },
  { deep: true },
)

async function handleRunCommand() {
  const cmd = commandInput.value.trim()
  if (!cmd || isExecuting.value)
    return

  commandHistoryNav.value.push(cmd)
  navIndex.value = -1
  commandInput.value = ''

  await exec(cmd)
  await reloadPersistedWidgets()
}

function handleHistoryNav(direction: 'up' | 'down') {
  if (commandHistoryNav.value.length === 0)
    return

  if (direction === 'up') {
    if (navIndex.value === -1) {
      navIndex.value = commandHistoryNav.value.length - 1
    }
    else if (navIndex.value > 0) {
      navIndex.value--
    }
  }
  else if (direction === 'down') {
    if (navIndex.value !== -1) {
      if (navIndex.value < commandHistoryNav.value.length - 1) {
        navIndex.value++
      }
      else {
        navIndex.value = -1
        commandInput.value = ''
        return
      }
    }
  }

  if (navIndex.value !== -1) {
    commandInput.value = commandHistoryNav.value[navIndex.value] || ''
  }
}

// --- Widgets State ---
const persistedWidgets = ref<any[]>([])
const onStageSectionOpen = ref(true)
const moreWidgetsSectionOpen = ref(true)

async function reloadPersistedWidgets() {
  try {
    persistedWidgets.value = await getPersistedWidgets()
  }
  catch {
    persistedWidgets.value = []
  }
}

onMounted(async () => {
  await reloadPersistedWidgets()
})

const onStageWidgets = computed(() => {
  return mountedWidgets.value.filter(w => w.surface === 'widget')
})

const offlineWidgets = computed(() => {
  const mountedIds = new Set(mountedWidgets.value.map(w => w.id))
  return persistedWidgets.value.filter(w => !mountedIds.has(w.id))
})

async function handleToggleOnStage(widget: any) {
  const isCurrentlyMountedOnStage = mountedWidgets.value.some(w => (w.id === widget.id || w.path === widget.path) && w.surface === 'widget')
  if (isCurrentlyMountedOnStage) {
    // NOTICE: toggling off stage docks back to panel instead of unmounting,
    // so the widget stays available in the panel/library.
    await setWidgetSurface(widget.id, 'panel')
  }
  else {
    const targetId = widget.id || widget.sourcePath || widget.path
    await mountPersistedWidget(targetId, 'widget')
    await setWidgetSurface(targetId, 'widget')
  }
  await reloadPersistedWidgets()
}

async function handleMountOfflineWidget(widget: any) {
  const targetId = widget.id || widget.sourcePath || widget.path
  await mountPersistedWidget(targetId, 'widget')
  await setWidgetSurface(targetId, 'widget')
  await reloadPersistedWidgets()
}

function getWidgetTitle(widget: any): string {
  if (widget.title)
    return widget.title
  const path = widget.sourcePath || widget.path || ''
  const filename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Widget'
  if (filename.includes('strawberry'))
    return 'Arona\'s Strawberry Pet 🍓'
  if (filename.includes('relu') || filename.includes('companion'))
    return 'ReLU Debugger Buddy'
  if (filename.includes('cafe') || filename.includes('pos'))
    return 'Haven Cafe POS'
  if (filename.includes('vit') || filename.includes('vitals'))
    return 'Vit-AIRI Dev Pulse'
  return filename.replace(/[-_]/g, ' ')
}

function getWidgetSubtitle(widget: any): string {
  if (widget.description)
    return widget.description
  const title = (widget.title || widget.sourcePath || widget.path || '').toLowerCase()
  if (title.includes('strawberry') || title.includes('pet'))
    return 'Your little stage companion.'
  if (title.includes('relu') || title.includes('companion'))
    return 'Companion tools at a glance.'
  if (title.includes('cafe') || title.includes('pos'))
    return 'Your café’s little counter.'
  if (title.includes('vit') || title.includes('pulse') || title.includes('vitals'))
    return 'Workspace activity at a glance.'
  return widget.sourcePath || widget.path || 'Interactive stage widget'
}

function isStrawberryWidget(widget: any): boolean {
  const name = (widget.title || widget.sourcePath || widget.path || '').toLowerCase()
  return name.includes('strawberry') || name.includes('pet')
}
</script>

<template>
  <div
    :class="[
      'fixed z-50 max-h-[82dvh] sm:max-h-[76dvh] flex flex-col',
      'sm:max-w-lg sm:inset-x-auto sm:w-full',
      'rounded-3xl border border-primary-500/20 dark:border-primary-500/25',
      'bg-white/94 dark:bg-[#15171c]/96',
      'backdrop-blur-2xl shadow-2xl shadow-primary-950/10 dark:shadow-black/80',
      'ring-1 ring-primary-500/10 dark:ring-primary-500/15',
      'relative overflow-hidden',
      'transition-all duration-300',
    ]"
    :style="{ bottom: `${safeBottomOffset}px` }"
  >
    <!-- Subtle Ambient Chromatic Tint Layer -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 from-primary-500/[0.04] via-primary-500/[0.01] to-transparent bg-gradient-to-b dark:from-primary-500/[0.05] dark:via-primary-500/[0.015] dark:to-transparent"
    />

    <!-- Top Drag Indicator -->
    <div class="relative mx-auto mt-2 h-1 w-8 shrink-0 rounded-full bg-neutral-300/80 dark:bg-neutral-700/80" />

    <!-- Fixed Header Area -->
    <div class="relative flex shrink-0 items-center justify-between px-4 pb-1.5 pt-2">
      <div class="flex items-center gap-2.5">
        <div class="shadow-2xs size-8.5 flex shrink-0 items-center justify-center border border-primary-500/20 rounded-xl bg-primary-500/10 text-xs text-primary-600 font-bold font-mono dark:border-primary-400/20 dark:bg-primary-500/20 dark:text-primary-400">
          &gt;_
        </div>
        <div class="flex flex-col">
          <h2 class="text-sm text-neutral-900 font-bold leading-tight dark:text-neutral-100">
            Workspace
          </h2>
          <p class="text-[11px] text-neutral-600 leading-tight dark:text-neutral-400">
            Your companion's tools and widgets
          </p>
        </div>
      </div>

      <!-- Clean Circular Close Button with simple X -->
      <button
        type="button"
        class="hover:bg-neutral-150/70 size-7 flex shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors dark:text-neutral-400 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-white/10 dark:hover:text-neutral-200"
        title="Close Workspace"
        @click="emit('close')"
      >
        <div class="i-carbon:close text-base" />
      </button>
    </div>

    <!-- Segmented Tab Switcher -->
    <div class="relative shrink-0 px-4 pb-2 pt-0.5">
      <div class="flex gap-1 border border-neutral-200/60 rounded-xl bg-neutral-200/50 p-1 dark:border-white/5 dark:bg-black/40">
        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
            activeTab === 'widgets'
              ? 'bg-white text-primary-600 border border-primary-500/30 shadow-xs dark:bg-primary-500/20 dark:text-primary-300 dark:border-primary-500/40 font-semibold'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="activeTab = 'widgets'"
        >
          <div class="i-solar:widget-2-bold-duotone text-sm" />
          Widgets
        </button>
        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
            activeTab === 'terminal'
              ? 'bg-white text-primary-600 border border-primary-500/30 shadow-xs dark:bg-primary-500/20 dark:text-primary-300 dark:border-primary-500/40 font-semibold'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="activeTab = 'terminal'"
        >
          <div class="i-solar:code-square-bold-duotone text-sm" />
          Virtual Terminal
        </button>
      </div>
    </div>

    <!-- TAB 1: WIDGETS -->
    <div
      v-if="activeTab === 'widgets'"
      class="relative min-h-0 flex-1 overflow-y-auto px-4 pb-7 space-y-2.5"
    >
      <div class="text-[11px] text-neutral-600 dark:text-neutral-400">
        Choose what appears on your stage.
      </div>

      <!-- Section: On Stage -->
      <div class="shadow-2xs border border-neutral-200/50 rounded-2xl bg-neutral-100/70 p-2.5 dark:border-white/5 dark:bg-black/25">
        <button
          type="button"
          class="w-full flex select-none items-center justify-between rounded-lg px-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          @click="onStageSectionOpen = !onStageSectionOpen"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">On stage</span>
            <span class="rounded-full bg-primary-500/15 px-2 py-0.2 text-[10px] text-primary-700 font-bold dark:bg-primary-500/20 dark:text-primary-300">
              {{ onStageWidgets.length }}
            </span>
          </div>
          <div
            class="i-solar:alt-arrow-down-bold text-xs text-neutral-500 transition-transform duration-200 dark:text-neutral-400"
            :class="onStageSectionOpen ? 'rotate-180' : ''"
          />
        </button>

        <div v-if="onStageSectionOpen" class="mt-2 space-y-2">
          <div
            v-for="widget in onStageWidgets"
            :key="widget.id"
            class="shadow-2xs flex items-center justify-between border border-neutral-200/60 rounded-xl bg-white p-2.5 dark:border-neutral-700/40 dark:bg-[#1e2128]"
          >
            <div class="min-w-0 flex items-center gap-2.5 pr-2">
              <div
                v-if="isStrawberryWidget(widget)"
                class="shadow-2xs size-9 flex shrink-0 items-center justify-center border border-pink-500/20 rounded-xl bg-pink-500/10 text-lg text-pink-600 dark:border-pink-900/30 dark:bg-pink-950/30 dark:text-pink-400"
              >
                🍓
              </div>
              <div
                v-else
                class="shadow-2xs size-9 flex shrink-0 items-center justify-center border border-violet-500/20 rounded-xl bg-violet-500/10 text-base text-violet-600 dark:border-violet-900/30 dark:bg-violet-950/30 dark:text-violet-400"
              >
                <div class="i-solar:widget-bold text-base" />
              </div>
              <div class="min-w-0 flex flex-col">
                <span class="truncate text-xs text-neutral-900 font-bold dark:text-neutral-100">
                  {{ getWidgetTitle(widget) }}
                </span>
                <span class="truncate text-[10px] text-neutral-600 dark:text-neutral-400">
                  {{ getWidgetSubtitle(widget) }}
                </span>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                :class="[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                  'bg-primary-600 dark:bg-primary-500',
                ]"
                title="Toggle stage visibility"
                @click="handleToggleOnStage(widget)"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                />
              </button>
            </div>
          </div>

          <div
            v-if="onStageWidgets.length === 0"
            class="py-3 text-center text-xs text-neutral-500 dark:text-neutral-400"
          >
            No widgets currently mounted on the stage.
          </div>
        </div>
      </div>

      <!-- Section: More Widgets -->
      <div class="shadow-2xs border border-neutral-200/50 rounded-2xl bg-neutral-100/70 p-2.5 dark:border-white/5 dark:bg-black/25">
        <button
          type="button"
          class="w-full flex select-none items-center justify-between rounded-lg px-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          @click="moreWidgetsSectionOpen = !moreWidgetsSectionOpen"
        >
          <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">More widgets</span>
          <div
            class="i-solar:alt-arrow-down-bold text-xs text-neutral-500 transition-transform duration-200 dark:text-neutral-400"
            :class="moreWidgetsSectionOpen ? 'rotate-180' : ''"
          />
        </button>

        <div v-if="moreWidgetsSectionOpen" class="mt-2 space-y-2">
          <div
            v-for="widget in offlineWidgets"
            :key="widget.id"
            class="shadow-2xs flex items-center justify-between border border-neutral-200/60 rounded-xl bg-white p-2.5 dark:border-neutral-700/40 dark:bg-[#1e2128]"
          >
            <div class="min-w-0 flex items-center gap-2.5 pr-2">
              <div
                v-if="isStrawberryWidget(widget)"
                class="shadow-2xs size-9 flex shrink-0 items-center justify-center border border-pink-500/20 rounded-xl bg-pink-500/10 text-lg text-pink-600 dark:border-pink-900/30 dark:bg-pink-950/30 dark:text-pink-400"
              >
                🍓
              </div>
              <div
                v-else
                class="shadow-2xs size-9 flex shrink-0 items-center justify-center border border-violet-500/20 rounded-xl bg-violet-500/10 text-base text-violet-600 dark:border-violet-900/30 dark:bg-violet-950/30 dark:text-violet-400"
              >
                <div class="i-solar:widget-bold text-base" />
              </div>
              <div class="min-w-0 flex flex-col">
                <span class="truncate text-xs text-neutral-900 font-bold dark:text-neutral-100">
                  {{ getWidgetTitle(widget) }}
                </span>
                <span class="truncate text-[10px] text-neutral-600 dark:text-neutral-400">
                  {{ getWidgetSubtitle(widget) }}
                </span>
              </div>
            </div>

            <button
              type="button"
              class="flex shrink-0 items-center gap-1 border border-primary-500/40 rounded-full px-3 py-1 text-xs text-primary-600 font-semibold transition-colors dark:border-primary-500/50 hover:bg-primary-50 dark:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-primary-950/40"
              @click="handleMountOfflineWidget(widget)"
            >
              <div class="i-solar:add-circle-linear text-sm" />
              Add
            </button>
          </div>

          <div
            v-if="offlineWidgets.length === 0"
            class="py-3 text-center text-xs text-neutral-500 dark:text-neutral-400"
          >
            No other persisted widgets in <code class="font-mono">/workspace</code>.
          </div>
        </div>
      </div>

      <!-- Footer Persistence Note -->
      <div class="flex items-center gap-1.5 pt-1 text-[11px] text-neutral-600 dark:text-neutral-400">
        <div class="i-solar:info-circle-bold size-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span>Widgets stay on your stage when you close this window.</span>
      </div>
    </div>

    <!-- TAB 2: VIRTUAL TERMINAL -->
    <div
      v-else-if="activeTab === 'terminal'"
      class="relative min-h-0 flex flex-1 flex-col px-4 pb-3"
    >
      <!-- If Sandbox is not enabled for character -->
      <div
        v-if="!isSandboxAllowed"
        class="shadow-xs my-auto flex flex-1 flex-col items-center justify-center border border-neutral-200/60 rounded-2xl bg-white p-6 text-center space-y-3 dark:border-neutral-700/40 dark:bg-[#1e2128]"
      >
        <div class="size-12 flex items-center justify-center border border-primary-500/20 rounded-2xl bg-primary-500/10 text-xl text-primary-600 font-bold font-mono shadow-inner dark:border-primary-400/30 dark:bg-primary-500/20 dark:text-primary-400">
          &gt;_
        </div>
        <div class="space-y-1">
          <h3 class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
            Virtual Terminal Disabled
          </h3>
          <p class="max-w-xs text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
            {{ cardStore.activeCard?.name || 'Your companion' }} does not currently have permission to execute commands or interact with the POSIX workspace.
          </p>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs text-white font-semibold shadow-md shadow-primary-600/25 transition-all active:scale-95 hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          @click="handleEnableSandbox"
        >
          <div class="i-solar:shield-check-bold text-sm" />
          Enable Virtual Terminal
        </button>
        <span class="text-[10px] text-neutral-500 dark:text-neutral-400">
          Enables in-memory POSIX terminal and interactive widgets
        </span>
      </div>

      <!-- If Sandbox is enabled: Scrollable Feed + Anchored Composer -->
      <template v-else>
        <!-- Scrollable History Feed Area -->
        <div
          ref="terminalScrollRef"
          class="min-h-0 flex-1 overflow-y-auto px-0.5 pr-1.5 space-y-2"
        >
          <!-- Workspace Status Card -->
          <div class="shadow-2xs flex shrink-0 items-center justify-between border border-neutral-200/60 rounded-xl bg-white p-2.5 dark:border-neutral-700/40 dark:bg-[#1e2128]">
            <div class="flex items-center gap-2.5">
              <div class="shadow-2xs size-8.5 flex shrink-0 items-center justify-center border border-primary-500/20 rounded-lg bg-primary-500/10 text-xs text-primary-600 font-bold font-mono dark:border-primary-400/20 dark:bg-primary-500/20 dark:text-primary-400">
                &gt;_
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">AIRI Workspace</span>
                  <span class="text-[10px] text-neutral-500 font-mono dark:text-neutral-400">/workspace</span>
                </div>
                <span class="text-[11px] text-neutral-600 leading-tight dark:text-neutral-400">
                  POSIX shell · TypeScript 5.8 · Node 22.14
                </span>
              </div>
            </div>

            <span class="flex items-center gap-1.5 border border-emerald-500/20 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 font-bold dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-400">
              <span class="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Ready
            </span>
          </div>

          <!-- Terminal Section Header -->
          <div class="flex shrink-0 items-center justify-between pt-0.5">
            <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">Terminal</span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="flex items-center gap-1 border border-neutral-200/60 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] text-neutral-700 font-medium transition-colors dark:border-neutral-700/50 dark:bg-neutral-800/90 hover:bg-neutral-100 dark:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-700"
                title="Clear buffer"
                @click="clearLogs"
              >
                <div class="i-solar:trash-bin-trash-bold text-xs text-neutral-400" />
                Clear
              </button>
              <button
                type="button"
                class="flex items-center gap-1 border border-neutral-200/60 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] text-neutral-700 font-medium transition-colors dark:border-neutral-700/50 dark:bg-neutral-800/90 hover:bg-neutral-100 dark:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-700"
                title="Restart sandbox"
                @click="reset"
              >
                <div class="i-solar:restart-square-linear text-xs text-neutral-400" />
                Restart
              </button>
            </div>
          </div>

          <!-- Empty History Notice -->
          <div
            v-if="commandHistory.length === 0"
            class="select-none border border-primary-500/15 rounded-xl bg-primary-500/[0.04] p-3 text-xs text-neutral-600 font-mono shadow-inner dark:border-neutral-800/80 dark:bg-[#0e1013] dark:text-neutral-400"
          >
            <div class="text-primary-600 font-bold dark:text-primary-400">
              airi@sandbox:~$ # Workspace ready.
            </div>
            <div class="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400">
              Run commands to inspect files, query state, or test widgets.
            </div>
          </div>

          <!-- Command History Cards with Inset Hierarchy and Horizontal Scrolling -->
          <div
            v-for="entry in commandHistory"
            :key="entry.id"
            class="shadow-2xs border border-primary-500/12 rounded-xl bg-primary-500/[0.04] p-2.5 space-y-1.5 dark:border-neutral-800/80 dark:bg-[#0e1013] dark:shadow-inner"
          >
            <!-- Command Prompt Header -->
            <div class="flex items-center justify-between text-xs">
              <div class="min-w-0 flex items-center gap-1.5 pr-2 font-mono">
                <span class="shrink-0 text-primary-600 font-bold dark:text-primary-400">airi@sandbox:~$</span>
                <span class="truncate text-neutral-900 font-bold dark:text-neutral-100">{{ entry.command }}</span>
              </div>
              <div class="flex shrink-0 items-center gap-1.5 font-mono">
                <span v-if="entry.durationMs" class="text-[10px] text-neutral-500 dark:text-neutral-400">
                  {{ entry.durationMs }} ms
                </span>
                <span
                  :class="[
                    'rounded-full px-2 py-0.2 text-[10px] font-bold lowercase',
                    entry.exitCode === 0
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20',
                  ]"
                >
                  exit {{ entry.exitCode }}
                </span>
              </div>
            </div>

            <!-- Monospace STDOUT with Horizontal Scrolling -->
            <pre
              v-if="entry.stdout"
              class="select-text overflow-x-auto whitespace-pre px-1 py-0.5 text-[11px] text-neutral-800 leading-relaxed font-mono dark:text-neutral-200"
              v-html="ansiToHtml(entry.stdout)"
            />

            <!-- Monospace STDERR with Horizontal Scrolling -->
            <pre
              v-if="entry.stderr"
              class="select-text overflow-x-auto whitespace-pre px-1 py-0.5 text-[11px] text-rose-600 leading-relaxed font-mono dark:text-rose-400"
              v-html="ansiToHtml(entry.stderr)"
            />
          </div>
        </div>

        <!-- Anchored Command Composer Bar Below History -->
        <div class="shrink-0 pt-2">
          <div class="shadow-xs flex items-center gap-2 border border-neutral-200/60 rounded-xl bg-white p-1.5 pl-3 dark:border-neutral-700/40 dark:bg-[#1e2128]">
            <!-- Adaptive Prompt Prefix: Shortened on Mobile, Full on Desktop -->
            <span class="shrink-0 select-none text-xs text-primary-600 font-bold font-mono dark:text-primary-400">
              <span class="hidden sm:inline">airi@sandbox:~$</span>
              <span class="sm:hidden">&gt;_</span>
            </span>

            <input
              v-model="commandInput"
              type="text"
              placeholder="Run a command..."
              class="min-w-0 flex-1 bg-transparent text-xs text-neutral-900 font-mono outline-none dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              :disabled="isExecuting"
              @keydown.enter.prevent="handleRunCommand"
              @keydown.up.prevent="handleHistoryNav('up')"
              @keydown.down.prevent="handleHistoryNav('down')"
            >

            <!-- Terminal Run Button with Play Glyph -->
            <button
              type="button"
              :disabled="isExecuting || !commandInput.trim()"
              :class="[
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                commandInput.trim() && !isExecuting
                  ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-sm shadow-primary-600/25 active:scale-95 cursor-pointer'
                  : 'bg-neutral-150 text-neutral-400 dark:bg-neutral-800/80 dark:text-neutral-500 cursor-not-allowed',
              ]"
              @click="handleRunCommand"
            >
              <div class="i-solar:play-bold text-xs" />
              <span>Run</span>
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

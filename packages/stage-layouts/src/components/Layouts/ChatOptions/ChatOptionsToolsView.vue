<script setup lang="ts">
import { describeMusicProvisionFailure, ensureMusicToolProvisioned } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const emit = defineEmits<{
  (e: 'openProviderSettings'): void
}>()

const airiCardStore = useAiriCardStore()
const providersStore = useProvidersStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const allowedTools = computed<string[]>(() => {
  return activeCard.value?.extensions?.airi?.generation?.known?.allowedTools ?? ['text_journal', 'image_journal']
})

function isToolActive(toolName: string): boolean {
  if (toolName === 'bash') {
    return allowedTools.value.includes('bash') || (activeCard.value?.extensions?.airi?.sandbox?.enabled ?? false)
  }
  // Accept the `mcp_` alias so a card that only carries `mcp_music` still reads as enabled.
  if (toolName === 'music') {
    return allowedTools.value.includes('music') || allowedTools.value.includes('mcp_music')
  }
  return allowedTools.value.includes(toolName)
}

function handleToggleTool(toolName: string) {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isToolActive(toolName)
  const next = !current
  let nextTools: string[]

  if (next) {
    nextTools = allowedTools.value.includes(toolName) ? allowedTools.value : [...allowedTools.value, toolName]
  }
  else {
    nextTools = allowedTools.value.filter(t => t !== toolName && t !== `mcp_${toolName}`)
  }

  const patch: any = {
    generation: {
      ...activeCard.value.extensions?.airi?.generation,
      known: {
        ...activeCard.value.extensions?.airi?.generation?.known,
        allowedTools: nextTools,
      },
    },
  }

  if (toolName === 'bash') {
    patch.sandbox = {
      ...activeCard.value.extensions?.airi?.sandbox,
      enabled: next,
    }
  }

  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        ...patch,
      },
    },
  } as any)
}

// --- Sound Studio (music over MCP) -----------------------------------------
// Unlike web search and filesystem, music has no fixed command to spawn: the
// audio server advertises its own MCP endpoint. Enabling therefore requires a
// live probe, which makes the toggle genuinely blocking instead of optimistic.

const musicProvisioning = ref(false)
const musicError = ref('')

async function handleToggleMusic() {
  if (musicProvisioning.value)
    return

  // Disabling never needs the server: drop the ACL token and keep the mcp.json
  // entry, exactly like web search.
  if (isToolActive('music')) {
    musicError.value = ''
    handleToggleTool('music')
    return
  }

  musicProvisioning.value = true
  musicError.value = ''
  try {
    const providerBaseUrl = providersStore.getProviderConfig('airi-audio-server')?.baseUrl as string | undefined
    const outcome = await ensureMusicToolProvisioned({ providerBaseUrl })
    if (!outcome.ok) {
      musicError.value = describeMusicProvisionFailure(outcome.reason)
      return
    }
    handleToggleTool('music')
  }
  finally {
    musicProvisioning.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- Header Banner -->
    <div class="mb-1 flex items-center gap-3 px-1 py-1">
      <div class="size-10 flex shrink-0 items-center justify-center border border-sky-500/20 rounded-xl bg-sky-500/15 text-sky-500 dark:bg-sky-500/20">
        <div class="i-solar:laptop-minimalistic-bold-duotone size-6" />
      </div>
      <div class="flex flex-col">
        <span class="text-xs text-neutral-800 font-bold dark:text-neutral-100">Tools & Workstation</span>
        <span class="text-[10px] text-neutral-400 dark:text-neutral-500">Terminal, files, web, screenshots</span>
      </div>
    </div>

    <!-- 1. Virtual Terminal (bash) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleTool('bash')"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('bash')
            ? 'text-violet-500 i-solar:code-square-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:code-square-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Virtual Terminal</span>
          <span class="text-[9px] text-neutral-400">RAM disk & compiler workstation</span>
        </div>
      </div>
      <div
        :class="isToolActive('bash') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('bash') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 2. Computer Files (filesystem) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleTool('filesystem')"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('filesystem')
            ? 'text-amber-500 i-solar:folder-with-files-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:folder-with-files-linear'"
        />
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Computer Files</span>
            <span class="rounded bg-amber-500/10 px-1 py-0.2 text-[8px] text-amber-600 font-semibold uppercase dark:text-amber-400">Desktop</span>
          </div>
          <span class="text-[9px] text-neutral-400">Browse and search local folders</span>
        </div>
      </div>
      <div
        :class="isToolActive('filesystem') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('filesystem') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 3. Web & Research (web_search) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleTool('web_search')"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('web_search')
            ? 'text-cyan-500 i-solar:global-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:global-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Web & Research</span>
          <span class="text-[9px] text-neutral-400">Real-time web search & page markdown</span>
        </div>
      </div>
      <div
        :class="isToolActive('web_search') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('web_search') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 4. Screen Snapshots (take_screenshot) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleTool('take_screenshot')"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('take_screenshot')
            ? 'text-teal-500 i-solar:camera-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:camera-linear'"
        />
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Screen Snapshots</span>
            <span class="rounded bg-teal-500/10 px-1 py-0.2 text-[8px] text-teal-600 font-semibold uppercase dark:text-teal-400">Desktop</span>
          </div>
          <span class="text-[9px] text-neutral-400">Inspect desktop screen on request</span>
        </div>
      </div>
      <div
        :class="isToolActive('take_screenshot') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('take_screenshot') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 5. Connected Plugins (mcp) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleTool('mcp')"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('mcp')
            ? 'text-indigo-500 i-solar:tuning-square-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:tuning-square-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Connected Plugins</span>
          <span class="text-[9px] text-neutral-400">External MCP tools & connected services</span>
        </div>
      </div>
      <div
        :class="isToolActive('mcp') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('mcp') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 6. Motion Generator (generate_motion) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleTool('generate_motion')"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('generate_motion')
            ? 'text-orange-500 i-solar:running-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:running-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Motion Generator</span>
          <span class="text-[9px] text-neutral-400">Procedural 3D animation synthesis</span>
        </div>
      </div>
      <div
        :class="isToolActive('generate_motion') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('generate_motion') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 7. Image Journal (image_journal) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleTool('image_journal')"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('image_journal')
            ? 'text-pink-500 i-solar:gallery-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:gallery-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Image Journal</span>
          <span class="text-[9px] text-neutral-400">Autonomous image generation & backdrops</span>
        </div>
      </div>
      <div
        :class="isToolActive('image_journal') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('image_journal') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 8. Memory & Journal (text_journal) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleTool('text_journal')"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('text_journal')
            ? 'text-emerald-500 i-solar:notebook-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:notebook-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Memory & Journal</span>
          <span class="text-[9px] text-neutral-400">Append-only journal & STMM blocks</span>
        </div>
      </div>
      <div
        :class="isToolActive('text_journal') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('text_journal') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- 9. Sound Studio (music over MCP) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      :class="{ 'op-60 pointer-events-none': musicProvisioning }"
      @click="handleToggleMusic"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isToolActive('music')
            ? 'text-fuchsia-500 i-solar:music-notes-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:music-notes-linear'"
        />
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Sound Studio</span>
            <span class="rounded bg-fuchsia-500/10 px-1 py-0.2 text-[8px] text-fuchsia-600 font-semibold uppercase dark:text-fuchsia-400">Audio Server</span>
          </div>
          <span class="text-[9px] text-neutral-400">
            {{ musicProvisioning ? 'Connecting to audio server…' : 'Music generation & ABC score planning' }}
          </span>
        </div>
      </div>
      <div
        :class="isToolActive('music') ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isToolActive('music') ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Music activation failure: the toggle refuses rather than lying about state -->
    <div v-if="musicError" class="mt-1 rounded-xl bg-red-500/10 px-2.5 py-2">
      <p class="text-[10px] text-red-600 font-semibold leading-snug dark:text-red-400">
        {{ musicError }}
      </p>
      <button
        type="button"
        class="mt-1 text-[10px] text-red-500 underline underline-offset-2"
        @click="emit('openProviderSettings')"
      >
        Open provider settings
      </button>
    </div>
  </div>
</template>

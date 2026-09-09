<script setup lang="ts">
import { computed } from 'vue'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draftStore = useOnboardingV3Draft()

function handleToggleWebSearch() {
  draftStore.setTools({
    mcpWebSearchEnabled: !draftStore.state.mcpWebSearchEnabled,
  })
}

function handleToggleFilesystem() {
  draftStore.setTools({
    mcpFilesystemEnabled: !draftStore.state.mcpFilesystemEnabled,
  })
}

function handleToggleMotionGenerator() {
  draftStore.setTools({
    toolMotionGeneratorEnabled: !draftStore.state.toolMotionGeneratorEnabled,
  })
}

const activeToolCount = computed(() => {
  let count = 0
  if (draftStore.state.mcpWebSearchEnabled)
    count++
  if (draftStore.state.mcpFilesystemEnabled)
    count++
  if (draftStore.state.toolMotionGeneratorEnabled)
    count++
  return count
})
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col gap-5 py-1 select-none animate-fadeIn']">
    <!-- Header Section -->
    <div :class="['flex flex-col items-center text-center gap-2']">
      <div :class="['inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-400 text-xs font-semibold']">
        <div :class="['i-solar:widget-add-bold-duotone h-3.5 w-3.5']" />
        <span>Desktop Actions & Tool Protocol</span>
      </div>
      <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
        Automation & MCP Tools
      </h1>
      <p :class="['text-xs text-neutral-500 dark:text-neutral-400 max-w-xl text-center leading-relaxed']">
        Give your companion real-world capabilities. Enable zero-key web search, safe local workspace exploration, and 3D kinetic motion generation.
      </p>
    </div>

    <!-- Capability Packs List -->
    <div :class="['flex flex-col gap-4']">
      <!-- 1. Web & Research Pack -->
      <div
        :class="[
          'rounded-2xl border transition-all p-4.5 flex flex-col gap-3',
          draftStore.state.mcpWebSearchEnabled
            ? 'border-sky-500/40 bg-white/70 dark:bg-sky-950/10 shadow-sm'
            : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30 opacity-75',
        ]"
      >
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3 min-w-0']">
            <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-sky-500/15 text-sky-500']">
              <div :class="['i-solar:global-bold-duotone text-xl']" />
            </div>
            <div :class="['flex flex-col min-w-0']">
              <div :class="['flex items-center gap-2 flex-wrap']">
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  Web & Research Pack
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-300 font-mono']">
                  0-Key Web Search
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Equips the companion with real-time web search and page markdown extraction via <code :class="['text-sky-500 font-mono text-[11px]']">open-websearch</code> (DuckDuckGo, Bing, Brave, Baidu) without requiring paid API keys or subscription tokens.
              </p>
            </div>
          </div>

          <!-- Switch Toggle -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
            <input
              type="checkbox"
              :checked="draftStore.state.mcpWebSearchEnabled"
              :class="['sr-only peer']"
              @change="handleToggleWebSearch"
            >
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600']" />
          </label>
        </div>

        <div
          v-if="draftStore.state.mcpWebSearchEnabled"
          :class="['flex flex-wrap gap-2 pt-1 border-t border-sky-500/20']"
        >
          <span :class="['inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-700 dark:text-sky-300 font-mono']">
            <div :class="['i-solar:magnifer-bold text-sky-500']" />
            web_search
          </span>
          <span :class="['inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-700 dark:text-sky-300 font-mono']">
            <div :class="['i-solar:document-text-bold text-sky-500']" />
            fetch_content (Markdown)
          </span>
          <span :class="['inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium']">
            <div :class="['i-solar:check-circle-bold text-emerald-500']" />
            Zero Setup Needed
          </span>
        </div>
      </div>

      <!-- 2. Local Workspace & Filesystem Pack -->
      <div
        :class="[
          'rounded-2xl border transition-all p-4.5 flex flex-col gap-3',
          draftStore.state.mcpFilesystemEnabled
            ? 'border-amber-500/40 bg-white/70 dark:bg-amber-950/10 shadow-sm'
            : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30 opacity-75',
        ]"
      >
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3 min-w-0']">
            <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-500']">
              <div :class="['i-solar:folder-with-files-bold-duotone text-xl']" />
            </div>
            <div :class="['flex flex-col min-w-0']">
              <div :class="['flex items-center gap-2 flex-wrap']">
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  Local Workspace & Filesystem Pack
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 font-mono']">
                  Desktop MCP
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Allows the companion to read, list, and search files inside designated project directories via <code :class="['text-amber-500 font-mono text-[11px]']">@modelcontextprotocol/server-filesystem</code>, with user-configured read boundaries.
              </p>
            </div>
          </div>

          <!-- Switch Toggle -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
            <input
              type="checkbox"
              :checked="draftStore.state.mcpFilesystemEnabled"
              :class="['sr-only peer']"
              @change="handleToggleFilesystem"
            >
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600']" />
          </label>
        </div>

        <div
          v-if="draftStore.state.mcpFilesystemEnabled"
          :class="['flex flex-wrap gap-2 pt-1 border-t border-amber-500/20']"
        >
          <span :class="['inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-mono']">
            <div :class="['i-solar:file-check-bold text-amber-500']" />
            read_file / list_directory
          </span>
          <span :class="['inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-mono']">
            <div :class="['i-solar:folder-security-bold text-amber-500']" />
            directory_tree / search_files
          </span>
          <span :class="['inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium']">
            <div :class="['i-solar:shield-warning-bold text-amber-500']" />
            Scoped to ~/Projects
          </span>
        </div>
      </div>

      <!-- 3. Kinetic Motion Generator Pack -->
      <div
        :class="[
          'rounded-2xl border transition-all p-4.5 flex flex-col gap-3',
          draftStore.state.toolMotionGeneratorEnabled
            ? 'border-rose-500/40 bg-white/70 dark:bg-rose-950/10 shadow-sm'
            : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30 opacity-75',
        ]"
      >
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3 min-w-0']">
            <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-500/15 text-rose-500']">
              <div :class="['i-solar:running-2-bold-duotone text-xl']" />
            </div>
            <div :class="['flex flex-col min-w-0']">
              <div :class="['flex items-center gap-2 flex-wrap']">
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  Kinetic Motion Generator Pack
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-300 font-mono']">
                  generate_motion
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Allows humanoid VRM companions to autonomously author and generate new 3D skeletal animations and dances in real time from conversation via Procedural LLM keyframing and FlowMDM WebGPU neural diffusion.
              </p>
            </div>
          </div>

          <!-- Switch Toggle -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
            <input
              type="checkbox"
              :checked="draftStore.state.toolMotionGeneratorEnabled"
              :class="['sr-only peer']"
              @change="handleToggleMotionGenerator"
            >
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600']" />
          </label>
        </div>

        <div
          v-if="draftStore.state.toolMotionGeneratorEnabled"
          :class="['rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-2.5']"
        >
          <div :class="['i-solar:info-circle-bold text-rose-500 text-base shrink-0 mt-0.5']" />
          <div :class="['leading-relaxed']">
            Supports VRM avatars. Output motions compile directly to VRMA binary tracks and play immediately on Stage.
          </div>
        </div>
      </div>
    </div>

    <!-- Active Tool Arsenal Summary -->
    <div :class="['rounded-2xl border border-neutral-200/80 bg-neutral-100/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50 flex flex-col gap-2.5']">
      <div :class="['flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-200']">
        <div :class="['flex items-center gap-2']">
          <div :class="['i-solar:widget-bold-duotone text-primary-500']" />
          <span>Active Desktop Toolbelt</span>
        </div>
        <span :class="['text-[11px] font-mono text-emerald-500 font-medium']">
          {{ activeToolCount }} Tool{{ activeToolCount === 1 ? '' : 's' }} Granted
        </span>
      </div>

      <div :class="['flex flex-wrap gap-2 pt-1']">
        <span
          v-if="draftStore.state.mcpWebSearchEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:global-bold text-sky-500']" />
          web_search (0-Key)
        </span>
        <span
          v-if="draftStore.state.mcpFilesystemEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:folder-with-files-bold text-amber-500']" />
          filesystem (Desktop MCP)
        </span>
        <span
          v-if="draftStore.state.toolMotionGeneratorEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:running-2-bold text-rose-500']" />
          generate_motion (3D VRMA)
        </span>
        <span
          v-if="activeToolCount === 0"
          :class="['text-xs text-neutral-400 dark:text-neutral-500 italic py-0.5']"
        >
          No external tools enabled (safe sandboxed mode).
        </span>
      </div>
    </div>

    <!-- Navigation Footer -->
    <div :class="['flex items-center justify-between pt-2 border-t border-neutral-200/80 dark:border-white/5']">
      <button
        type="button"
        :class="['px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        ← Previous Step
      </button>
      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer flex items-center gap-1.5']"
        @click="props.onNext"
      >
        <span>Confirm & Continue</span>
        <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
      </button>
    </div>
  </div>
</template>

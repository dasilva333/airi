<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useTextToMotionStore } from '../../../../../../stores/modules/text-to-motion'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

const draftStore = useOnboardingV3Draft()
const displayModelsStore = useDisplayModelsStore()
const textToMotionStore = useTextToMotionStore()

const activeModelId = computed(() => draftStore.state.vesselDisplayModelId || 'preset-live2d-2')
const currentModel = computed(() => {
  const targetId = activeModelId.value
  return displayModelsStore.displayModels.find((m: { id: string, format?: DisplayModelFormat }) =>
    m.id === targetId
    || m.id === `display-model-${targetId}`
    || m.id.replace(/^display-model-/, '') === targetId.replace(/^display-model-/, ''),
  )
})

const isVrmModel = computed(() => {
  const fmt = currentModel.value?.format
  if (fmt === DisplayModelFormat.VRM)
    return true
  const idLower = (activeModelId.value || '').toLowerCase()
  if (idLower.includes('vrm'))
    return true
  return false
})

const isPrewarming = ref(false)
const prewarmDone = ref(false)

onMounted(async () => {
  if (displayModelsStore.displayModels.length === 0) {
    await displayModelsStore.loadDisplayModelsFromIndexedDB?.(true)
  }
})

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

function handleToggleScreenshot() {
  draftStore.setTools({
    toolScreenshotEnabled: !draftStore.state.toolScreenshotEnabled,
  })
}

function handleToggleMotionGenerator() {
  const nextState = !draftStore.state.toolMotionGeneratorEnabled
  draftStore.setTools({ toolMotionGeneratorEnabled: nextState })
  if (nextState && !prewarmDone.value && !isPrewarming.value) {
    void triggerPrewarmMotion()
  }
}

async function triggerPrewarmMotion() {
  if (isPrewarming.value)
    return

  isPrewarming.value = true
  try {
    await textToMotionStore.generateMotion('wave hello')
    prewarmDone.value = true
  }
  catch (err) {
    console.warn('[StepTools] Motion prewarm fallback:', err)
    prewarmDone.value = true
  }
  finally {
    isPrewarming.value = false
  }
}

const activeToolCount = computed(() => {
  let count = 0
  if (draftStore.state.mcpWebSearchEnabled)
    count++
  if (draftStore.state.mcpFilesystemEnabled)
    count++
  if (draftStore.state.toolMotionGeneratorEnabled)
    count++
  if (draftStore.state.toolScreenshotEnabled)
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
        <span>{{ t('onboarding.steps.tools.subtitle') }}</span>
      </div>
      <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
        {{ t('onboarding.steps.tools.title') }}
      </h1>
      <p :class="['text-xs text-neutral-500 dark:text-neutral-400 max-w-xl text-center leading-relaxed']">
        {{ t('onboarding.steps.tools.description') }}
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
                  {{ t('onboarding.steps.tools.webResearchPack') }}
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-300 font-mono']">
                  {{ t('onboarding.steps.tools.0KeyWebSearch') }}
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                <i18n-t scope="global" keypath="onboarding.steps.tools.webSearchDescription" tag="span">
                  <template #code>
                    <code :class="['text-sky-500 font-mono text-[11px]']">open-websearch</code>
                  </template>
                </i18n-t>
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
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600']" />
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
            {{ t('onboarding.steps.tools.fetchContentMarkdown') }}
          </span>
          <span :class="['inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium']">
            <div :class="['i-solar:check-circle-bold text-emerald-500']" />
            {{ t('onboarding.steps.tools.zeroSetupNeeded') }}
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
                  {{ t('onboarding.steps.tools.localWorkspaceFilesystemPack') }}
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 font-mono']">
                  {{ t('onboarding.steps.tools.desktopMcp') }}
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                <i18n-t scope="global" keypath="onboarding.steps.tools.filesystemDescription" tag="span">
                  <template #code>
                    <code :class="['text-amber-500 font-mono text-[11px]']">@modelcontextprotocol/server-filesystem</code>
                  </template>
                </i18n-t>
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
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600']" />
          </label>
        </div>

        <div
          v-if="draftStore.state.mcpFilesystemEnabled"
          :class="['flex flex-wrap gap-2 pt-1 border-t border-amber-500/20']"
        >
          <span :class="['inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-mono']">
            <div :class="['i-solar:file-check-bold text-amber-500']" />
            {{ t('onboarding.steps.tools.readFileListDirectory') }}
          </span>
          <span :class="['inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-mono']">
            <div :class="['i-solar:folder-security-bold text-amber-500']" />
            {{ t('onboarding.steps.tools.directoryTreeSearchFiles') }}
          </span>
          <span :class="['inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium']">
            <div :class="['i-solar:shield-warning-bold text-amber-500']" />
            {{ t('onboarding.steps.tools.scopedToProjects') }}
          </span>
        </div>
      </div>

      <!-- 3. Screen Snapshots Pack -->
      <div
        :class="[
          'rounded-2xl border transition-all p-4.5 flex flex-col gap-3',
          draftStore.state.toolScreenshotEnabled
            ? 'border-teal-500/40 bg-white/70 dark:bg-teal-950/10 shadow-sm'
            : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30 opacity-75',
        ]"
      >
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3 min-w-0']">
            <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-teal-500/15 text-teal-500']">
              <div :class="['i-solar:camera-bold-duotone text-xl']" />
            </div>
            <div :class="['flex flex-col min-w-0']">
              <div :class="['flex items-center gap-2 flex-wrap']">
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  {{ t('onboarding.steps.tools.screenSnapshotsPack') }}
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-600 dark:text-teal-300 font-mono']">
                  {{ t('onboarding.steps.tools.desktopOnly') }}
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                <i18n-t scope="global" keypath="onboarding.steps.tools.screenshotDescription" tag="span">
                  <template #code>
                    <code :class="['text-teal-500 font-mono text-[11px]']">take_screenshot</code>
                  </template>
                </i18n-t>
              </p>
            </div>
          </div>

          <!-- Switch Toggle -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
            <input
              type="checkbox"
              :checked="draftStore.state.toolScreenshotEnabled"
              :class="['sr-only peer']"
              @change="handleToggleScreenshot"
            >
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600']" />
          </label>
        </div>

        <div
          v-if="draftStore.state.toolScreenshotEnabled"
          :class="['flex flex-wrap gap-2 pt-1 border-t border-teal-500/20']"
        >
          <span :class="['inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-700 dark:text-teal-300 font-medium']">
            <div :class="['i-solar:monitor-bold text-teal-500']" />
            {{ t('onboarding.steps.tools.screenOrAnyWindow') }}
          </span>
          <span :class="['inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-700 dark:text-teal-300 font-medium']">
            <div :class="['i-solar:eye-bold text-teal-500']" />
            {{ t('onboarding.steps.tools.usesVisionSettings') }}
          </span>
        </div>
      </div>

      <!-- 4. Kinetic Motion Generator Pack -->
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
                  {{ t('onboarding.steps.tools.kineticMotionGeneratorPack') }}
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-300 font-mono']">
                  generate_motion
                </span>
                <span
                  v-if="!isVrmModel"
                  :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 font-mono flex items-center gap-1']"
                >
                  <div :class="['i-solar:shield-warning-bold text-amber-500 w-3 h-3']" />
                  <span>{{ t('onboarding.steps.tools.vrmAvatarOptimized') }}</span>
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                {{ t('onboarding.steps.tools.allowsHumanoidVrmCompanionsToAutonomouslyAuthorAndGenerateNew3dSkel') }}
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
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600']" />
          </label>
        </div>

        <!-- Expanded Pre-warm & Download Panel when Enabled -->
        <div
          v-if="draftStore.state.toolMotionGeneratorEnabled"
          :class="['flex flex-col gap-2.5 pt-2 border-t border-rose-500/20']"
        >
          <div :class="['flex items-center justify-between gap-3 flex-wrap']">
            <div :class="['flex items-center gap-2 text-xs font-semibold text-rose-900 dark:text-rose-200']">
              <div :class="['i-solar:cpu-bolt-bold text-rose-500']" />
              <span>{{ t('onboarding.steps.tools.motion.status', { status: prewarmDone ? t('onboarding.steps.tools.primedReady') : isPrewarming ? t('onboarding.steps.tools.preWarmingShards') : t('onboarding.steps.tools.enabled') }) }}</span>
            </div>

            <button
              type="button"
              :disabled="isPrewarming"
              :class="[
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm',
                isPrewarming
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-300 animate-pulse'
                  : prewarmDone
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                    : 'bg-rose-600 hover:bg-rose-500 text-white border-transparent shadow-rose-600/25',
              ]"
              @click="triggerPrewarmMotion"
            >
              <div v-if="isPrewarming" :class="['i-solar:restart-bold w-3.5 h-3.5 animate-spin text-rose-500']" />
              <div v-else-if="prewarmDone" :class="['i-solar:check-circle-bold w-3.5 h-3.5 text-emerald-500']" />
              <div v-else :class="['i-solar:download-minimalistic-bold w-3.5 h-3.5']" />

              <span>
                {{
                  isPrewarming ? t('onboarding.steps.tools.downloadingShardsValue', { percentage15: textToMotionStore.downloadProgress.percentage || 15 }) : prewarmDone ? t('onboarding.steps.tools.preWarmedCached') : t('onboarding.steps.tools.preWarmDownloadEngine')
                }}
              </span>
            </button>
          </div>

          <!-- Progress Bar when Downloading / Pre-warming -->
          <div
            v-if="isPrewarming"
            :class="['rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 flex flex-col gap-1.5']"
          >
            <div :class="['flex items-center justify-between text-[11px] font-mono text-rose-700 dark:text-rose-300']">
              <span>{{ textToMotionStore.downloadProgress.status || t('onboarding.steps.tools.loadingClipEncoderOnnxDenoiser') }}</span>
              <span>{{ textToMotionStore.downloadProgress.percentage || 15 }}%</span>
            </div>
            <div :class="['w-full h-1.5 bg-rose-500/20 rounded-full overflow-hidden']">
              <div
                :class="['h-full bg-rose-500 rounded-full transition-all duration-300']"
                :style="{ width: `${textToMotionStore.downloadProgress.percentage || 15}%` }"
              />
            </div>
          </div>

          <div
            v-else
            :class="['rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-2']"
          >
            <div :class="['i-solar:info-circle-bold text-rose-500 text-sm shrink-0 mt-0.5']" />
            <div :class="['leading-relaxed']">
              <i18n-t scope="global" keypath="onboarding.steps.tools.motionOutputDescription" tag="span">
                <template #emphasis>
                  <span v-if="!isVrmModel" class="text-amber-600 font-semibold dark:text-amber-300"> {{ t('onboarding.steps.tools.noteYourSelectedVesselLive2dSpineUses2dAnimationChannelsSwitchToA') }}</span>
                </template>
              </i18n-t>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Tool Arsenal Summary -->
    <div :class="['rounded-2xl border border-neutral-200/80 bg-neutral-100/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50 flex flex-col gap-2.5']">
      <div :class="['flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-200']">
        <div :class="['flex items-center gap-2']">
          <div :class="['i-solar:widget-bold-duotone text-primary-500']" />
          <span>{{ t('onboarding.steps.tools.activeDesktopToolbelt') }}</span>
        </div>
        <span :class="['text-[11px] font-mono text-emerald-500 font-medium']">
          {{ t('onboarding.steps.tools.toolGranted', { count: activeToolCount }, activeToolCount) }}
        </span>
      </div>

      <div :class="['flex flex-wrap gap-2 pt-1']">
        <span
          v-if="draftStore.state.mcpWebSearchEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:global-bold text-sky-500']" />
          {{ t('onboarding.steps.tools.webSearch0Key') }}
        </span>
        <span
          v-if="draftStore.state.mcpFilesystemEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:folder-with-files-bold text-amber-500']" />
          {{ t('onboarding.steps.tools.filesystemDesktopMcp') }}
        </span>
        <span
          v-if="draftStore.state.toolMotionGeneratorEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:running-2-bold text-rose-500']" />
          {{ t('onboarding.steps.tools.generateMotion3dVrma') }}
        </span>
        <span
          v-if="draftStore.state.toolScreenshotEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:camera-bold text-teal-500']" />
          {{ t('onboarding.steps.tools.takeScreenshotDesktop') }}
        </span>
        <span
          v-if="activeToolCount === 0"
          :class="['text-xs text-neutral-400 dark:text-neutral-500 italic py-0.5']"
        >
          {{ t('onboarding.steps.tools.noExternalToolsEnabledSafeSandboxedMode') }}
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
        {{ t('onboarding.shell.previous') }}
      </button>
      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer flex items-center gap-1.5']"
        @click="props.onNext"
      >
        <span>{{ t('onboarding.shell.next') }}</span>
        <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UpdateChannel } from '../../shared/update-channels'

import { useElectronAutoUpdater } from '@proj-airi/electron-vueuse'
import { AboutContent, MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { useSharedAnalyticsStore } from '@proj-airi/stage-ui/stores/analytics/index'
import { Button, DoubleCheckButton, Progress } from '@proj-airi/ui'
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { DrawerContent, DrawerDescription, DrawerHandle, DrawerOverlay, DrawerPortal, DrawerRoot, DrawerTitle } from 'vaul-vue'
import { computed, ref } from 'vue'

import { updateChannels } from '../../shared/update-channels'

const analyticsStore = useSharedAnalyticsStore()
const { buildInfo } = storeToRefs(analyticsStore)

const {
  state: updateState,
  isBusy,
  checkForUpdates,
  downloadUpdate,
  applyUpdate,
  setChannel,
  dismissRollback,
} = useElectronAutoUpdater()

const isSwitchingChannel = ref(false)
const showChangelog = ref(false)
const isDesktop = useMediaQuery('(min-width: 768px)')

const activeChannel = computed<UpdateChannel>(() => {
  const current = updateState.value.channel as UpdateChannel
  return updateChannels.includes(current) ? current : 'canary'
})

const isDisabled = computed(() => updateState.value.status === 'disabled')
const isLatestVersion = computed(() =>
  (updateState.value.status === 'idle' || updateState.value.status === 'not-available')
  && !updateState.value.info
  && !isDisabled.value,
)
const isError = computed(() => updateState.value.status === 'error')

const channelDescriptions: Record<UpdateChannel, { label: string, desc: string, icon: string }> = {
  stable: { label: 'Stable', desc: 'Standard production releases', icon: 'i-solar:shield-check-outline' },
  canary: { label: 'Canary', desc: 'Preview builds and release candidates', icon: 'i-solar:fire-outline' },
  dev: { label: 'Dev', desc: 'Continuous builds from main branch', icon: 'i-solar:code-file-outline' },
  nightly: { label: 'Nightly', desc: 'Daily consolidated snapshots', icon: 'i-solar:moon-stars-outline' },
}

const links = [
  { label: 'Documentation', href: 'https://dasilva333.github.io/airi/en/docs/overview/', icon: 'i-solar:document-add-outline' },
  { label: 'Web Stage', href: 'https://dasilva333.github.io/airi/web-stage/', icon: 'i-solar:global-outline' },
  { label: 'GitHub', href: 'https://github.com/dasilva333/airi', icon: 'i-simple-icons:github' },
]

async function handleChannelSelect(ch: UpdateChannel) {
  if (isSwitchingChannel.value || activeChannel.value === ch || isBusy.value)
    return

  isSwitchingChannel.value = true
  try {
    await setChannel({ channel: ch })
  }
  catch (error) {
    console.error('Failed to change update channel:', error)
  }
  finally {
    isSwitchingChannel.value = false
  }
}

function handleDownloadClick() {
  if (updateState.value.info?.releaseNotes)
    showChangelog.value = true
  else
    void downloadUpdate()
}

function confirmDownload() {
  showChangelog.value = false
  void downloadUpdate()
}

async function handleApplyUpdate() {
  try {
    await applyUpdate()
  }
  catch (error) {
    console.error('Failed to apply update:', error)
  }
}

// Ensure releaseNotes is formatted as a string for markdown rendering
const releaseNotesContent = computed(() => {
  const notes = updateState.value.info?.releaseNotes
  if (Array.isArray(notes))
    return notes.map(n => typeof n === 'string' ? n : n?.note ?? '').join('\n\n')

  return typeof notes === 'string' ? notes : ''
})
</script>

<template>
  <div
    :class="[
      'min-h-dvh',
      'min-w-dvw',
      'bg-neutral-50/80',
      'text-neutral-800',
      'dark:bg-neutral-900',
      'dark:text-neutral-100',
    ]"
  >
    <div :class="['mx-auto max-w-[min(960px,calc(100%-2rem))]', 'px-6 py-20']">
      <AboutContent title="Project" highlight="AIRI" subtitle="Desktop ver." />

      <!-- Rollback Notice Banner -->
      <div
        v-if="updateState.rollback"
        :class="[
          'mb-6 p-4.5 rounded-2xl',
          'bg-amber-500/10 border border-amber-500/30',
          'text-amber-800 dark:text-amber-200',
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
          'backdrop-blur-sm shadow-sm',
        ]"
      >
        <div :class="['flex items-start gap-3']">
          <div :class="['i-solar:shield-warning-bold text-2xl text-amber-500 shrink-0 mt-0.5 sm:mt-0']" />
          <div>
            <div :class="['font-semibold text-sm']">
              Safety Rollback Detected
            </div>
            <div :class="['text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              The application rolled back from v{{ updateState.rollback.from.version }} to
              v{{ updateState.rollback.to.version }} due to launch failure ({{ updateState.rollback.reason }}).
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          label="Dismiss"
          icon="i-solar:check-read-outline"
          @click="dismissRollback()"
        />
      </div>

      <!-- Main Content Card -->
      <div :class="['mb-8', 'rounded-2xl', 'bg-white/60 dark:bg-black/30', 'p-6', 'border border-neutral-200/50 dark:border-neutral-800/50', 'backdrop-blur-md shadow-sm']">
        <!-- Build Info -->
        <div :class="['flex flex-wrap items-center justify-between gap-4', 'mb-6', 'border-b border-neutral-200/50 dark:border-neutral-800/50', 'pb-6']">
          <div>
            <div :class="['text-xs uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400']">
              Installed Version
            </div>
            <div :class="['text-2xl font-semibold font-mono tracking-tight mt-1 flex items-center gap-2.5']">
              <span>{{ buildInfo.version }}</span>
              <span
                :class="[
                  'text-xs px-2.5 py-0.5 rounded-full font-sans font-medium',
                  activeChannel === 'stable'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/20',
                ]"
              >
                {{ channelDescriptions[activeChannel].label }}
              </span>
            </div>
          </div>
          <div :class="['text-right text-xs text-neutral-400 dark:text-neutral-500 font-mono']">
            <div>{{ buildInfo.branch }}@{{ buildInfo.commit }}</div>
            <div :class="['text-[11px] mt-0.5']">
              {{ buildInfo.builtOn }}
            </div>
          </div>
        </div>

        <!-- Update Channels Segmented Selector -->
        <div :class="['mb-6', 'border-b border-neutral-200/50 dark:border-neutral-800/50', 'pb-6']">
          <div :class="['flex items-center justify-between mb-3']">
            <span :class="['text-xs uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400']">
              Update Channel
            </span>
            <span :class="['text-xs text-neutral-400 font-medium']">
              {{ channelDescriptions[activeChannel].desc }}
            </span>
          </div>

          <div :class="['grid grid-cols-2 sm:grid-cols-4 gap-2']">
            <button
              v-for="ch in updateChannels"
              :key="ch"
              type="button"
              :disabled="isSwitchingChannel || isBusy"
              :class="[
                'px-3.5 py-2.5 rounded-xl text-left transition-all duration-150',
                'flex flex-col gap-1 border',
                activeChannel === ch
                  ? 'bg-primary-500/15 border-primary-500/40 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'bg-neutral-100/70 hover:bg-neutral-200/60 dark:bg-neutral-800/50 dark:hover:bg-neutral-800/80 border-transparent text-neutral-600 dark:text-neutral-400',
                (isSwitchingChannel || isBusy) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              ]"
              @click="handleChannelSelect(ch)"
            >
              <div :class="['flex items-center justify-between w-full']">
                <span :class="['font-semibold text-xs tracking-wide flex items-center gap-1.5']">
                  <div :class="[channelDescriptions[ch].icon, 'text-sm']" />
                  {{ channelDescriptions[ch].label }}
                </span>
                <div
                  v-if="activeChannel === ch"
                  :class="['i-solar:check-circle-bold text-sm text-primary-500']"
                />
              </div>
              <span :class="['text-[11px] opacity-75 line-clamp-1']">
                {{ channelDescriptions[ch].desc }}
              </span>
            </button>
          </div>
        </div>

        <!-- Update Action Area -->
        <div :class="['flex flex-col gap-4']">
          <!-- State: Available -->
          <div v-if="updateState.status === 'available'" :class="['flex flex-col gap-3.5']">
            <div :class="['p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 flex flex-wrap items-center justify-between gap-3']">
              <div :class="['flex items-center gap-2.5']">
                <div :class="['i-solar:gift-linear text-xl text-primary-500']" />
                <div :class="['text-sm flex items-center gap-2']">
                  <span :class="['font-mono text-neutral-500 dark:text-neutral-400']">v{{ buildInfo.version }}</span>
                  <div :class="['i-solar:arrow-right-line-duotone text-neutral-400']" />
                  <span :class="['font-mono font-bold text-primary-600 dark:text-primary-400']">v{{ updateState.info?.version }}</span>
                </div>
              </div>
              <div
                v-if="updateState.info?.requires"
                :class="[
                  'text-xs px-2.5 py-1 rounded-full font-medium',
                  updateState.info.requires === 'reload'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                ]"
              >
                {{ updateState.info.requires === 'reload' ? 'Instant Hot Reload' : 'Full Restart Required' }}
              </div>
            </div>

            <div :class="['flex flex-wrap gap-2']">
              <Button
                variant="primary"
                :loading="isBusy"
                icon="i-solar:download-minimalistic-outline"
                label="Download Update"
                @click="handleDownloadClick()"
              />
            </div>
          </div>

          <!-- State: Downloading -->
          <div v-else-if="updateState.status === 'downloading'" :class="['flex flex-col gap-2.5']">
            <div :class="['flex justify-between items-center text-sm']">
              <span :class="['font-medium flex items-center gap-2']">
                <div :class="['i-solar:download-minimalistic-outline animate-bounce text-primary-500']" />
                Downloading update (v{{ updateState.info?.version }})...
              </span>
              <span :class="['font-mono font-bold text-primary-600 dark:text-primary-400']">
                {{ (updateState.progress?.percent ?? 0).toFixed(1) }}%
              </span>
            </div>
            <Progress :progress="updateState.progress?.percent ?? 0" />
            <div :class="['flex justify-between items-center text-xs text-neutral-400 font-mono']">
              <span>
                {{ ((updateState.progress?.transferred ?? 0) / 1024 / 1024).toFixed(1) }} MB /
                {{ ((updateState.progress?.total ?? 0) / 1024 / 1024).toFixed(1) }} MB
              </span>
              <span>
                {{ ((updateState.progress?.bytesPerSecond ?? 0) / 1024 / 1024).toFixed(2) }} MB/s
              </span>
            </div>
          </div>

          <!-- State: Downloaded / Staged (Apply Update) -->
          <div v-else-if="updateState.status === 'downloaded'" :class="['flex flex-col gap-3.5']">
            <div :class="['p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-1']">
              <div :class="['flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300']">
                <div :class="['i-solar:check-circle-bold text-lg text-emerald-500']" />
                Update Ready to Apply (v{{ updateState.info?.version }})
              </div>
              <div :class="['text-xs text-neutral-600 dark:text-neutral-400 pl-7']">
                <span v-if="updateState.info?.requires === 'reload'">
                  Only web assets were changed. The application will instantly reload without dropping companion or audio processes.
                </span>
                <span v-else>
                  Application core or native dependencies were modified. A quick restart is required to switch to the new release.
                </span>
              </div>
            </div>

            <div :class="['flex flex-wrap gap-2']">
              <!-- If requires reload, apply instantly without double-check prompt -->
              <Button
                v-if="updateState.info?.requires === 'reload'"
                variant="primary"
                icon="i-solar:refresh-outline"
                label="Reload to Apply"
                @click="handleApplyUpdate()"
              />

              <!-- If requires restart, confirm restart -->
              <DoubleCheckButton
                v-else
                variant="primary"
                @confirm="handleApplyUpdate()"
              >
                Restart to update
                <template #confirm>
                  Confirm Restart
                </template>
                <template #cancel>
                  Cancel
                </template>
              </DoubleCheckButton>
            </div>
          </div>

          <!-- State: Idle, Checking, Error, Disabled, Not Available -->
          <div v-else :class="['flex flex-col gap-4']">
            <div v-if="isError" :class="['text-sm text-red-600 dark:text-red-400 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2']">
              <div :class="['i-solar:danger-triangle-linear text-lg shrink-0']" />
              <span>Update Check Failed: {{ updateState.error?.message }}</span>
            </div>

            <div :class="['flex flex-wrap items-center gap-3']">
              <Button
                :variant="isError ? 'caution' : 'secondary'"
                :loading="isBusy || isSwitchingChannel"
                :disabled="isDisabled"
                :icon="isLatestVersion ? 'i-solar:check-circle-outline' : isDisabled ? 'i-solar:forbidden-circle-outline' : 'i-solar:refresh-outline'"
                :label="isBusy ? 'Checking for updates...' : isLatestVersion ? 'Check for updates' : isDisabled ? 'Updates disabled in package manager' : isError ? 'Retry Check' : 'Check for updates'"
                @click="checkForUpdates()"
              />

              <div v-if="isLatestVersion" :class="['text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5']">
                <div :class="['i-solar:check-circle-bold text-sm']" />
                Up to date on {{ channelDescriptions[activeChannel].label }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Links -->
      <div>
        <div :class="['text-xs uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400 mb-3']">
          Project Links
        </div>
        <div :class="['flex flex-wrap gap-2']">
          <a
            v-for="link in links"
            :key="link.href"
            :href="link.href"
            target="_blank"
            class="contents"
          >
            <Button
              variant="secondary-muted"
              :icon="link.icon"
              :label="link.label"
              size="sm"
            />
          </a>
        </div>
      </div>
    </div>

    <!-- Changelog Dialog (Desktop) -->
    <DialogRoot v-if="isDesktop" v-model:open="showChangelog">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
        <DialogContent class="fixed left-1/2 top-1/2 z-[9999] max-h-[85vh] max-w-2xl w-[90vw] flex flex-col rounded-2xl bg-white p-6 shadow-xl outline-none backdrop-blur-md -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:bg-neutral-900">
          <DialogTitle class="mb-2 text-lg font-medium">
            Update Available
          </DialogTitle>
          <DialogDescription class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            A new version (v{{ updateState.info?.version }}) is available for download.
          </DialogDescription>

          <div class="min-h-0 flex-1 overflow-y-auto border border-neutral-200 rounded-lg bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/50">
            <MarkdownRenderer :content="releaseNotesContent || '_No release notes provided._'" class="text-sm" />
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <Button variant="secondary" @click="showChangelog = false">
              Cancel
            </Button>
            <Button variant="primary" icon="i-solar:download-minimalistic-outline" @click="confirmDownload">
              Confirm Download
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Changelog Drawer (Mobile) -->
    <DrawerRoot v-else v-model:open="showChangelog" should-scale-background>
      <DrawerPortal>
        <DrawerOverlay class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm" />
        <DrawerContent class="fixed bottom-0 left-0 right-0 z-[10000] mt-24 h-[85vh] flex flex-col rounded-t-2xl bg-neutral-100 outline-none dark:bg-neutral-900">
          <div class="flex flex-1 flex-col rounded-t-2xl bg-white p-4 dark:bg-neutral-900">
            <DrawerHandle class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <DrawerTitle class="mb-2 text-lg font-medium">
              Update Available
            </DrawerTitle>
            <DrawerDescription class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              A new version (v{{ updateState.info?.version }}) is available for download.
            </DrawerDescription>

            <div class="min-h-0 flex-1 overflow-y-auto border border-neutral-200 rounded-lg bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/50">
              <MarkdownRenderer :content="releaseNotesContent || '_No release notes provided._'" class="text-sm" />
            </div>

            <div class="mt-4 flex gap-3">
              <Button variant="secondary" block @click="showChangelog = false">
                Cancel
              </Button>
              <Button variant="primary" block icon="i-solar:download-minimalistic-outline" @click="confirmDownload">
                Download
              </Button>
            </div>
          </div>
        </DrawerContent>
      </DrawerPortal>
    </DrawerRoot>
  </div>
</template>

<route lang="yaml">
meta:
  layout: plain
</route>

<script setup lang="ts">
import ConnectionSettings from '@proj-airi/stage-pages/pages/settings/system/ConnectionSettings.vue'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { FieldCheckbox, FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { electronGetCorsBypassUrls, electronSetCorsBypassUrls } from '../../../../shared/eventa'
import { useServerChannelSettingsStore } from '../../../stores/settings/server-channel'

const serverChannelSettingsStore = useServerChannelSettingsStore()
const { websocketTlsConfig, hostname, authToken } = storeToRefs(serverChannelSettingsStore)
const { t } = useI18n()

const websocketTlsEnabled = computed({
  get: () => websocketTlsConfig.value != null,
  set: (value: boolean) => {
    serverChannelSettingsStore.websocketTlsConfig = value ? {} : null
  },
})

const getCorsBypassUrls = useElectronEventaInvoke(electronGetCorsBypassUrls)
const setCorsBypassUrls = useElectronEventaInvoke(electronSetCorsBypassUrls)

const urls = ref<string[]>([])
const newUrl = ref('')

async function loadUrls() {
  try {
    urls.value = await getCorsBypassUrls()
  }
  catch (e) {
    console.error('Failed to load CORS bypass URLs:', e)
  }
}

async function addUrl() {
  const trimmed = newUrl.value.trim()
  if (!trimmed || urls.value.includes(trimmed))
    return
  const updated = [...urls.value, trimmed]
  try {
    await setCorsBypassUrls(updated)
    urls.value = updated
    newUrl.value = ''
  }
  catch (e) {
    console.error('Failed to add CORS bypass URL:', e)
  }
}

async function deleteUrl(index: number) {
  const updated = urls.value.filter((_, i) => i !== index)
  try {
    await setCorsBypassUrls(updated)
    urls.value = updated
  }
  catch (e) {
    console.error('Failed to delete CORS bypass URL:', e)
  }
}

onMounted(() => {
  loadUrls()
})
</script>

<template>
  <ConnectionSettings>
    <template #platform-specific>
      <FieldCheckbox
        v-model="websocketTlsEnabled"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250 + (5 * 10)"
        :delay="5 * 50"
        :label="t('settings.pages.connection.websocket-secure-enabled.label')"
        :description="t('settings.pages.connection.websocket-secure-enabled.description')"
      />

      <FieldInput
        v-model="hostname"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250 + (6 * 10)"
        :delay="6 * 50"
        :label="t('settings.pages.connection.server-hostname.label')"
        :description="t('settings.pages.connection.server-hostname.description')"
      />

      <FieldInput
        v-model="authToken"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250 + (7 * 10)"
        :delay="7 * 50"
        :label="t('settings.pages.connection.server-auth-token.label')"
        :description="t('settings.pages.connection.server-auth-token.description')"
        type="password"
      />

      <!-- CORS Bypass Settings Section -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250 + (8 * 10)"
        :delay="8 * 50"
        class="mt-6 flex flex-col gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-700"
      >
        <div class="flex flex-col gap-1">
          <div class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
            CORS Bypass URLs
          </div>
          <div class="text-xs text-neutral-500 dark:text-neutral-400">
            Domains matched by these wildcard patterns will bypass browser CORS restrictions.
          </div>
        </div>

        <div class="flex gap-2">
          <input
            v-model="newUrl"
            type="text"
            placeholder="https://example.com/*"
            class="flex-1 border border-neutral-300 rounded bg-white px-3 py-1.5 text-sm outline-none transition-colors dark:border-neutral-600 focus:border-neutral-500 dark:bg-neutral-900 dark:text-white"
            @keydown.enter="addUrl"
          >
          <button
            class="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white font-medium transition-colors dark:bg-neutral-100 hover:bg-neutral-800 dark:text-neutral-900 dark:hover:bg-neutral-200"
            @click="addUrl"
          >
            Add
          </button>
        </div>

        <div v-if="urls.length > 0" class="max-h-80 flex flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin">
          <div
            v-for="(url, index) in urls"
            :key="url"
            class="dark:border-neutral-850 flex items-center justify-between border border-neutral-200 rounded bg-neutral-100/50 px-3 py-2 text-sm dark:bg-neutral-900/50"
          >
            <span class="mr-4 truncate text-xs text-neutral-700 font-mono dark:text-neutral-300">{{ url }}</span>
            <button
              class="flex items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 dark:text-neutral-500 hover:text-red-500 dark:hover:bg-neutral-800 dark:hover:text-red-400"
              @click="deleteUrl(index)"
            >
              <div class="i-solar:trash-bin-trash-bold-duotone h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </ConnectionSettings>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.connection.title
  subtitleKey: settings.pages.system.title
  descriptionKey: settings.pages.connection.description
  icon: i-solar:wi-fi-router-bold-duotone
  stageTransition:
    name: slide
</route>

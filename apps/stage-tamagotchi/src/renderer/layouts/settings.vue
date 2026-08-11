<script setup lang="ts">
import { PageHeader } from '@proj-airi/stage-ui/components'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'

import WindowTitleBar from '../components/Window/TitleBar.vue'

import { useRestoreScroll } from '../composables/use-restore-scroll'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const providersStore = useProvidersStore()
const scrollContainer = ref<HTMLElement>()
useRestoreScroll(scrollContainer)

function handleBack() {
  // Declarative back: never navigate 'up' out of the settings surface. The router
  // guard and `disableBackButton` already gate this, but early-return so that a
  // direct call can't fall through to the Control Strip.
  if (route.meta?.rootOfSettings)
    return

  if (route.path.startsWith('/settings/providers/')) {
    const segments = route.path.split('/').filter(Boolean)
    const category = segments[2]
    const hash = category && category !== 'chat' ? `#${category}` : '#chat'
    router.push(`/settings/providers${hash}`)
    return
  }

  router.push('/settings')
}

const routeMeta = computed(() => route.meta as {
  titleKey?: string
  subtitleKey?: string
  title?: string
  subtitle?: string
  rootOfSettings?: boolean
})

const providerTitle = computed(() => {
  if (!route.path.startsWith('/settings/providers/'))
    return undefined

  const segments = route.path.split('/').filter(Boolean)
  const providerId = segments[3]

  if (!providerId)
    return undefined

  try {
    const metadata = providersStore.getProviderMetadata(providerId)
    return t(metadata.nameKey)
  }
  catch {
    return undefined
  }
})

// const activeSettingsTutorial = ref('default')
const routeHeaderMetadata = computed(() => {
  const { titleKey, subtitleKey, title, subtitle } = routeMeta.value
  const resolvedTitle = titleKey ? t(titleKey) : title
  const resolvedSubtitle = subtitleKey ? t(subtitleKey) : subtitle

  if (resolvedTitle || resolvedSubtitle) {
    return {
      title: resolvedTitle,
      subtitle: resolvedSubtitle,
    }
  }

  if (providerTitle.value) {
    return {
      title: providerTitle.value,
      subtitle: t('settings.title'),
    }
  }

  return undefined
})

function updateSettingsWindowTitle() {
  const parts = ['AIRI', 'Settings']
  const activeTitle = routeHeaderMetadata.value?.title?.trim()

  if (activeTitle)
    parts.push(activeTitle)

  const nextTitle = parts.join(' - ')

  if (document.title !== nextTitle) {
    console.log('[SettingsTitle] Updating document.title', {
      from: document.title,
      to: nextTitle,
      route: route.path,
      activeTitle,
    })
    document.title = nextTitle
  }
}

watchEffect(() => {
  updateSettingsWindowTitle()
})
</script>

<template>
  <div h-full w-full bg="$bg-color" flex="~ col">
    <WindowTitleBar :title="routeHeaderMetadata?.title ?? ''" icon="i-solar:settings-bold" />
    <div
      :style="{
        paddingTop: `44px`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
      }"

      min-h-0 flex-1
    >
      <div ref="scrollContainer" relative h-full w-full overflow-y-auto scrollbar-none>
        <div flex="~ col" mx-auto h-full max-w-screen-xl>
          <PageHeader
            :title="routeHeaderMetadata?.title ?? ''"
            :subtitle="routeHeaderMetadata?.subtitle ?? ''"
            :disable-back-button="routeMeta.rootOfSettings"
            px-4
            @back="handleBack"
          />
          <div min-h-0 flex-1 px-4>
            <RouterView />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

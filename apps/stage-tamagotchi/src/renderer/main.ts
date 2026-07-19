import type { Pinia } from 'pinia'
import type { Plugin } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

import Tres from '@tresjs/core'

import { autoAnimatePlugin } from '@formkit/auto-animate/vue'
import { MotionPlugin } from '@vueuse/motion'
import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import App from './App.vue'

import { i18n } from './modules/i18n'

import '@unocss/reset/tailwind.css'
import 'splitpanes/dist/splitpanes.css'
import 'vue-sonner/style.css'
import './styles/main.css'
import 'uno.css'
// Fonts
import '@proj-airi/font-cjkfonts-allseto/index.css'
import '@proj-airi/font-xiaolai/index.css'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/jura'
import '@fontsource-variable/quicksand'
import '@fontsource-variable/urbanist'
import '@fontsource-variable/comfortaa'
import '@fontsource/dm-mono'
import '@fontsource/dm-serif-display'
import '@fontsource/gugi'
import '@fontsource/kiwi-maru'
import '@fontsource/m-plus-rounded-1c'
import '@fontsource/sniglet'

const pinia = createPinia()

const router = createRouter({
  history: createWebHashHistory(),
  // TODO: vite-plugin-vue-layouts is long deprecated, replace with another layout solution
  routes: setupLayouts(routes as RouteRecordRaw[]),
})

const app = createApp(App)

app
  .use(MotionPlugin)
  // TODO: Fix autoAnimatePlugin type error
  .use(autoAnimatePlugin as unknown as Plugin)
  .use(router)
  .use(pinia)
  .use(i18n)
  .use(Tres)

app.mount('#app')

async function installNan0AfterMount(pinia: Pinia): Promise<void> {
  const [{ useNan0RuntimeStore }, { createNan0RendererIdentity }] = await Promise.all([
    import('@proj-airi/stage-ui/stores/nan0'),
    import('@proj-airi/stage-ui/stores/nan0-renderer'),
  ])
  const renderer = createNan0RendererIdentity(window.location.hash || '#/')

  if (!renderer.isOwner && !renderer.isExecutor)
    return

  await useNan0RuntimeStore(pinia).ensureInstalled(renderer)
}

void installNan0AfterMount(pinia).catch((error) => {
  console.error('[Nan0] Installation failed after renderer mount:', error)
})

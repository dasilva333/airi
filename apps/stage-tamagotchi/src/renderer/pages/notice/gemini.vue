<script setup lang="ts">
import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { Button, Checkbox } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { noticeWindowEventa } from '../../../shared/eventa'
import GeminiGraphic from '../../assets/onboarding/gemini-graphic.png'
import { useControlsIslandStore } from '../../stores/controls-island'

const context = useElectronEventaContext()
const sendAction = useElectronEventaInvoke(noticeWindowEventa.windowAction, context.value)
const notifyMounted = useElectronEventaInvoke(noticeWindowEventa.pageMounted, context.value)
const notifyUnmounted = useElectronEventaInvoke(noticeWindowEventa.pageUnmounted, context.value)
const route = useRoute()
const { t } = useI18n()

const controlsIslandStore = useControlsIslandStore()
const dontShowGeminiOnboardingPending = ref(false)
const { dontShowGeminiOnboarding } = storeToRefs(controlsIslandStore)

const requestId = ref<string | null>(null)
const waitingForRequest = computed(() => !requestId.value)

onMounted(async () => {
  try {
    const id =
      typeof route.query.id === 'string' ? route.query.id : Array.isArray(route.query.id) ? route.query.id[0] : null

    const pending = await notifyMounted({ id: id ?? undefined })
    if (pending?.id && pending.type === 'gemini-onboarding') {
      requestId.value = pending.id
    }
  } catch (error) {
    console.warn('Failed to notify notice window mounted:', error)
  }
})

onBeforeUnmount(async () => {
  try {
    await notifyUnmounted({ id: undefined })
  } catch {
    /* noop */
  }
})

async function handleAction(action: 'confirm' | 'cancel' | 'close') {
  const id = requestId.value
  if (!id) {
    window.close()
    return
  }

  try {
    if (action === 'confirm') dontShowGeminiOnboarding.value = dontShowGeminiOnboardingPending.value

    await sendAction({ action, id })
  } catch (error) {
    console.warn('Failed to notify main process of notice action:', error)
  } finally {
    window.close()
  }
}
</script>

<template>
  <div class="h-100dvh w-100dvw overflow-hidden bg-black text-white">
    <!-- Premium Gemini Backdrop -->
    <div class="absolute inset-0 z-0 h-full w-full opacity-30">
      <div class="gemini-gradient animate-gradient-slow h-full w-full" />
    </div>

    <div class="relative z-1 h-full w-full flex">
      <!-- Vertical Artist Graphic Sidebar (38%) -->
      <div
        v-motion
        :initial="{ opacity: 0, x: -60 }"
        :enter="{ opacity: 1, x: 0 }"
        :duration="900"
        class="relative h-full w-[38%] overflow-hidden border-r border-white/10 bg-black/40 shadow-2xl backdrop-blur-md"
      >
        <img
          :src="GeminiGraphic"
          class="h-full w-full object-cover opacity-80 transition-opacity duration-1000 hover:opacity-100"
          alt="Gemini Cosmic Visualization"
        >

        <!-- Sidebar Glow overlay -->
        <div class="absolute inset-0 from-black via-transparent to-transparent bg-gradient-to-t opacity-60" />

        <!-- Floating Badge -->
        <div class="absolute bottom-8 left-8 z-10 transition-transform duration-500 hover:scale-105">
          <div
            class="inline-flex items-center gap-3 border border-white/10 rounded-full bg-white/5 py-1.5 pl-3 pr-4 text-[10px] font-bold tracking-[0.25em] uppercase shadow-lg backdrop-blur-xl"
          >
            <div class="size-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            Powered by Gemini
          </div>
        </div>
      </div>

      <!-- Content Area (Right side) -->
      <div class="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto p-8 lg:p-12">
        <!-- System Header -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="600"
          :delay="200"
          class="mb-4 flex items-center gap-3"
        >
          <div class="h-px w-10 bg-sky-400/50" />
          <span class="text-[12px] text-sky-400 font-bold tracking-[0.3em] uppercase">Intelligence Node Online</span>
        </div>

        <!-- Hero Title -->
        <h1
          v-motion
          :initial="{ opacity: 0, x: 30 }"
          :enter="{ opacity: 1, x: 0 }"
          :duration="700"
          :delay="300"
          class="mb-6 text-4xl font-black tracking-tight lg:text-5xl"
        >
          <span class="from-sky-400 via-purple-400 to-white bg-gradient-to-r bg-clip-text text-transparent">
            {{ t('tamagotchi.stage.notice.gemini-onboarding.title') }}
          </span>
        </h1>

        <p
          v-motion
          :initial="{ opacity: 0 }"
          :enter="{ opacity: 1 }"
          :delay="500"
          class="max-w-xl text-lg text-neutral-400 font-medium leading-relaxed"
        >
          {{ t('tamagotchi.stage.notice.gemini-onboarding.intro') }}
        </p>

        <div class="flex-1" />

        <!-- Feature Grid (Bottom Section) -->
        <div
          ref="descriptionContainerRef"
          v-motion
          :initial="{ opacity: 0, y: 30 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="800"
          :delay="600"
          class="mb-4 border border-white/5 rounded-3xl bg-white/5 p-6 shadow-inner backdrop-blur-2xl"
        >
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <!-- Multimodal Perception -->
            <div class="group transition-all hover:translate-x-1">
              <div class="flex items-center gap-3 text-sky-300 font-bold">
                <div i-ph:eye-bold class="size-5 transition-transform group-hover:scale-110" />
                {{ t('tamagotchi.stage.notice.gemini-onboarding.vision-title') }}
              </div>
              <p class="mt-2 text-sm text-neutral-400 leading-snug">
                {{ t('tamagotchi.stage.notice.gemini-onboarding.vision-description') }}
              </p>
            </div>

            <!-- Knowledge Grounding -->
            <div class="group transition-all hover:translate-x-1">
              <div class="flex items-center gap-3 text-purple-300 font-bold">
                <div i-ph:brain-bold class="size-5 transition-transform group-hover:scale-110" />
                {{ t('tamagotchi.stage.notice.gemini-onboarding.memory-title') }}
              </div>
              <p class="mt-2 text-sm text-neutral-400 leading-snug">
                {{ t('tamagotchi.stage.notice.gemini-onboarding.memory-description') }}
              </p>
            </div>
          </div>

          <!-- Actions Strip -->
          <div class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              variant="primary"
              size="lg"
              block
              :label="t('tamagotchi.stage.notice.gemini-onboarding.confirm')"
              :disabled="waitingForRequest"
              :loading="waitingForRequest"
              class="h-14 from-sky-600 to-purple-600 bg-gradient-to-r font-bold shadow-purple-900/20 shadow-xl transition-all active:scale-95 border-none! hover:shadow-sky-500/20!"
              @click="handleAction('confirm')"
            />

            <div class="flex shrink-0 items-center gap-3 border-neutral-800 px-4 sm:border-l">
              <Checkbox v-model="dontShowGeminiOnboardingPending" />
              <span class="select-none text-sm text-neutral-500 font-medium">
                {{ t('tamagotchi.stage.notice.gemini-onboarding.dont-show-again') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gemini-gradient {
  background: linear-gradient(-45deg, #0f172a, #1a1a2e, #2e1065, #0ea5e9, #4f46e5);
  background-size: 400% 400%;
}

@keyframes gradient-bg {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animate-gradient-slow {
  animation: gradient-bg 20s ease-in-out infinite;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

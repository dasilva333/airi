<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { DOCS_SECTIONS, DOCS_SIDEBAR } from '../constants/docs-sidebar'

const showSidebar = ref(true)
const toggleSidebar = () => (showSidebar.value = !showSidebar.value)

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const currentPath = computed(() => {
  const path = route.path.replace(/^\/settings\/docs\/?/, '')
  return path || 'overview/'
})

const activeSectionId = computed(() => {
  const segment = currentPath.value.split('/')[0]
  return DOCS_SECTIONS.find((s) => s.id === segment)?.id ?? 'overview'
})

const sidebarItems = computed(() => {
  return DOCS_SIDEBAR[activeSectionId.value] || []
})

function navigateToSection(id: string) {
  const section = DOCS_SECTIONS.find((s) => s.id === id)
  if (section?.defaultPath) {
    router.push(`/settings/docs/${section.defaultPath}`)
  } else {
    router.push(`/settings/docs/${id}/`)
  }
}

function navigateToLink(link: string) {
  router.push(`/settings/docs/${link}`)
}

function isLinkActive(link: string) {
  const normalizedLink = link.endsWith('/') ? link : `${link}/`
  const normalizedCurrent = currentPath.value.endsWith('/') ? currentPath.value : `${currentPath.value}/`
  return normalizedCurrent === normalizedLink
}

const activeSection = computed(() => DOCS_SECTIONS.find((s) => s.id === activeSectionId.value))
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-black text-white">
    <!-- Premium Backdrop (Inspired by Gemini) -->
    <div class="absolute inset-0 z-0 h-full w-full opacity-25">
      <div class="gemini-gradient animate-gradient-slow h-full w-full" />
    </div>

    <div class="relative z-1 h-full w-full flex flex-col backdrop-blur-sm">
      <!-- Top Navigation Tabs (Glass) -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-6 py-4 backdrop-blur-xl"
      >
        <div class="flex items-center gap-4">
          <!-- Back Button -->
          <button
            class="group h-8 w-8 flex items-center justify-center rounded-xl bg-white/5 transition-all active:scale-95 hover:bg-white/10"
            title="Back to Settings"
            @click="router.push('/settings/')"
          >
            <div i-solar:alt-arrow-left-outline class="text-lg text-white/50 transition-colors group-hover:text-white" />
          </button>

          <!-- Sidebar Toggle (Logo-style) -->
          <button
            class="h-8 w-8 flex items-center justify-center rounded-xl from-sky-400 to-purple-600 bg-gradient-to-br shadow-lg transition-all active:scale-95 hover:scale-105"
            :title="showSidebar ? 'Collapse Sidebar' : 'Expand Sidebar'"
            @click="toggleSidebar"
          >
            <div
              :class="[
                showSidebar ? 'i-solar:hamburger-menu-broken' : 'i-solar:side-menu-linear',
                'text-white text-lg',
              ]"
            />
          </button>

          <div class="flex flex-col leading-tight">
            <span class="text-base text-white/90 font-black tracking-tighter">AIRI</span>
            <span class="text-[10px] text-white/40 font-bold tracking-[0.2em] uppercase">Docs</span>
          </div>
        </div>

        <div class="flex flex-1 items-center justify-center gap-1 px-8">
          <button
            v-for="section in DOCS_SECTIONS"
            :key="section.id"
            class="group relative flex items-center gap-2 rounded-full px-4 py-2 transition-all duration-300"
            :class="[
              activeSectionId === section.id
                ? 'text-sky-300 bg-white/5'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5',
            ]"
            @click="navigateToSection(section.id)"
          >
            <div :class="[section.icon, 'text-base transition-transform group-hover:scale-110']" />
            <span class="text-[10px] font-black tracking-[0.2em] uppercase">{{ t(section.titleKey) }}</span>

            <!-- Active Indicator dot -->
            <div
              v-if="activeSectionId === section.id"
              v-motion
              :initial="{ scale: 0, opacity: 0 }"
              :enter="{ scale: 1, opacity: 1 }"
              class="absolute left-1/2 h-1 w-1 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] -bottom-1 -translate-x-1/2"
            />
          </button>
        </div>

        <!-- Right Side Spacer for balance -->
        <div class="w-[140px]" />
      </div>

      <div class="min-h-0 flex flex-1">
        <!-- Sidebar (Glass) -->
        <div
          v-if="showSidebar"
          v-motion
          :initial="{ opacity: 0, x: -20, width: 0 }"
          :enter="{ opacity: 1, x: 0, width: 288 }"
          :leave="{ opacity: 0, x: -20, width: 0 }"
          :duration="400"
          class="w-72 flex flex-col overflow-hidden border-r border-white/5 bg-black/20 p-4 shadow-xl backdrop-blur-md"
        >
          <div class="mb-4 flex items-center gap-2 px-2 py-1">
            <div class="h-px flex-1 bg-white/10" />
            <span class="text-[10px] text-sky-400/60 font-black tracking-[0.3em] uppercase">Navigation</span>
            <div class="h-px w-4 bg-white/10" />
          </div>

          <div class="flex-1 overflow-y-auto pr-1 scrollbar-none">
            <div v-for="group in sidebarItems" :key="group.text" class="mb-8">
              <div class="mb-3 px-3 text-[10px] text-white/30 font-black tracking-[0.25em] uppercase">
                {{ group.text }}
              </div>

              <div class="flex flex-col gap-1.5">
                <template v-for="item in group.items" :key="item.text">
                  <!-- Collapsible/Group with items -->
                  <div v-if="item.items" class="mb-1">
                    <div class="mb-1 flex items-center gap-2 px-3 py-1 text-[11px] text-white/50 font-bold">
                      <div class="h-1.5 w-1.5 rounded-full bg-purple-500/40" />
                      {{ item.text }}
                    </div>
                    <div class="ml-3.5 flex flex-col gap-1 border-l border-white/5 pl-3">
                      <button
                        v-for="subItem in item.items"
                        :key="subItem.text"
                        class="rounded-lg px-3 py-1.5 text-left text-xs transition-all duration-200"
                        :class="[
                          isLinkActive(subItem.link!)
                            ? 'bg-white/10 font-bold text-sky-300 shadow-sm'
                            : 'text-white/40 hover:bg-white/5 hover:text-white/70',
                        ]"
                        @click="navigateToLink(subItem.link!)"
                      >
                        {{ subItem.text }}
                      </button>
                    </div>
                  </div>

                  <!-- Direct link -->
                  <button
                    v-else
                    class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-all duration-300"
                    :class="[
                      isLinkActive(item.link!)
                        ? 'bg-gradient-to-r from-sky-500/20 to-purple-500/10 font-bold text-sky-300 shadow-inner border border-white/5'
                        : 'text-white/40 hover:bg-white/5 hover:text-white/80',
                    ]"
                    @click="navigateToLink(item.link!)"
                  >
                    <div
                      class="h-1 w-1 rounded-full bg-white/20 transition-all group-hover:scale-150 group-hover:bg-sky-400/50"
                      :class="{ 'bg-sky-400 scale-150 shadow-[0_0_6px_rgba(56,189,248,0.8)]': isLinkActive(item.link!) }"
                    />
                    {{ item.text }}
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="relative flex flex-1 flex-col overflow-hidden bg-black/30">
          <div class="pointer-events-none absolute inset-0 from-sky-500/5 via-transparent to-purple-500/5 bg-gradient-to-br" />

          <main class="relative z-1 h-full overflow-y-auto p-8 scrollbar-none lg:p-12">
            <div class="mx-auto max-w-4xl">
              <!-- Content Header (Intelligence Node Style) -->
              <div
                v-motion
                :initial="{ opacity: 0, y: 10 }"
                :enter="{ opacity: 1, y: 0 }"
                :duration="600"
                class="mb-6 flex items-center gap-3"
              >
                <div class="h-px w-10 bg-sky-400/50" />
                <span class="text-[10px] text-sky-400 font-black tracking-[0.4em] uppercase">
                  {{ activeSection?.id }} // Node_Online
                </span>

                <!-- Status Glow Dot -->
                <div class="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              </div>

              <div
                v-motion
                :initial="{ opacity: 0, x: 20 }"
                :enter="{ opacity: 1, x: 0 }"
                :duration="800"
                :delay="200"
              >
                <router-view v-slot="{ Component }">
                  <transition
                    name="fade-slide"
                    mode="out-in"
                  >
                    <component :is="Component" />
                  </transition>
                </router-view>
              </div>

              <!-- Language Switcher (Floating Bottom Right or Top Nav) -->
              <div
                class="fixed bottom-8 right-8 z-50 flex items-center gap-1 border border-white/10 rounded-2xl bg-black/60 p-1 shadow-2xl backdrop-blur-2xl"
              >
                <button
                  v-for="l in ['en', 'zh-Hans', 'ja']"
                  :key="l"
                  class="rounded-xl px-3 py-1.5 text-[10px] font-black tracking-widest uppercase transition-all"
                  :class="[
                    locale === l
                      ? 'bg-sky-500 text-white shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                      : 'text-white/30 hover:text-white/70 hover:bg-white/5',
                  ]"
                  @click="locale = l"
                >
                  {{ l === 'zh-Hans' ? 'ZH' : l }}
                </button>
              </div>
            </div>
          </main>
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

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

button {
  -webkit-app-region: no-drag;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>

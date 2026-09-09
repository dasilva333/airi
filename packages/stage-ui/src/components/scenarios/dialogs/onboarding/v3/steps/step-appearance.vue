<script setup lang="ts">
import { useSettingsGeneral, useSettingsTheme } from '@proj-airi/stage-ui/stores/settings'
import { Button, useTheme } from '@proj-airi/ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SettingsThemeHeaderWidget from '../../../../../widgets/SettingsThemeHeaderWidget.vue'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { isDark } = useTheme()
const settingsGeneral = useSettingsGeneral()
const settingsTheme = useSettingsTheme()
const { locale } = useI18n()

interface LanguageItem {
  code: string
  name: string
  native: string
  badge: string
  region: string
}

const languages: LanguageItem[] = [
  { code: 'en', name: 'English', native: 'English', badge: 'EN', region: 'International' },
  { code: 'ja', name: 'Japanese', native: '日本語', badge: 'JA', region: 'Japan' },
  { code: 'zh-Hans', name: 'Simplified Chinese', native: '简体中文', badge: '简', region: 'China / SG' },
  { code: 'zh-Hant', name: 'Traditional Chinese', native: '繁體中文', badge: '繁', region: 'Taiwan / HK' },
  { code: 'es', name: 'Spanish', native: 'Español', badge: 'ES', region: 'Spain / LatAm' },
  { code: 'fr', name: 'French', native: 'Français', badge: 'FR', region: 'France / CA' },
  { code: 'ru', name: 'Russian', native: 'Русский', badge: 'RU', region: 'Eurasia' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', badge: 'VI', region: 'Vietnam' },
]

function selectLanguage(code: string) {
  settingsGeneral.language = code
  locale.value = code
}

const currentLanguage = computed(() => settingsGeneral.language || locale.value || 'en')

// 24-color spectrum presets (grouped in 4 rows of 6) identical to Settings
const colorSpectrumRows = [
  {
    group: 'Warm & Fire',
    swatches: [
      { name: 'Crimson', color: '#E11D48' },
      { name: 'Coral', color: '#F43F5E' },
      { name: 'Tangerine', color: '#EA580C' },
      { name: 'Marigold', color: '#F59E0B' },
      { name: 'Amber', color: '#EAB308' },
      { name: 'Lemon', color: '#84CC16' },
    ],
  },
  {
    group: 'Earth & Flora',
    swatches: [
      { name: 'Lime', color: '#65A30D' },
      { name: 'Emerald', color: '#16A34A' },
      { name: 'Mint', color: '#10B981' },
      { name: 'Jade', color: '#059669' },
      { name: 'Viridian', color: '#0D9488' },
      { name: 'Teal', color: '#0891B2' },
    ],
  },
  {
    group: 'Ocean & Sky',
    swatches: [
      { name: 'Turquoise', color: '#06B6D4' },
      { name: 'Cyan (Default)', color: undefined },
      { name: 'Cerulean', color: '#2563EB' },
      { name: 'Cobalt', color: '#3B82F6' },
      { name: 'Sapphire', color: '#4F46E5' },
      { name: 'Denim', color: '#6366F1' },
    ],
  },
  {
    group: 'Royal & Bloom',
    swatches: [
      { name: 'Indigo', color: '#7C3AED' },
      { name: 'Amethyst', color: '#9333EA' },
      { name: 'Violet', color: '#A855F7' },
      { name: 'Fuchsia', color: '#C026D3' },
      { name: 'Magenta', color: '#DB2777' },
      { name: 'Rose', color: '#E11D74' },
    ],
  },
]

function selectColor(color?: string) {
  settingsTheme.applyPrimaryColorFrom(color)
}

function resetColorToDefault() {
  settingsTheme.setThemeColorsHue()
}

const activeColorName = computed(() => {
  for (const row of colorSpectrumRows) {
    for (const swatch of row.swatches) {
      if (settingsTheme.isColorSelectedForPrimary(swatch.color)) {
        return swatch.name
      }
    }
  }
  return 'Cyan (AIRI Signature)'
})
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col gap-4 py-2 select-none']">
    <!-- Header Section (Icon, Title, Companion Bubble) -->
    <div :class="['flex flex-col items-center text-center gap-3']">
      <!-- Title & Subtitle -->
      <div
        v-motion
        :initial="{ opacity: 0, y: -6 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="350"
        :class="['text-center']"
      >
        <div :class="['inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-400 text-xs font-semibold mb-1']">
          <div :class="['i-solar:palette-round-bold-duotone h-3.5 w-3.5']" />
          <span>Step 2 of 16 · Environment Setup</span>
        </div>
        <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
          Language & Appearance
        </h1>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
          Personalize your studio display language, visual mode, and primary accent palette.
        </p>
      </div>

      <!-- Compact Companion Speech Bubble -->
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.98 }"
        :enter="{ opacity: 1, scale: 1 }"
        :duration="350"
        :delay="100"
        :class="['max-w-xl w-full flex items-start gap-3 text-left']"
      >
        <div
          :class="[
            'h-8 w-8 flex flex-shrink-0 items-center justify-center border border-primary-500/30 rounded-full',
            'bg-gradient-to-br from-primary-500/20 to-indigo-500/20 shadow-xs mt-0.5',
          ]"
        >
          <div :class="['i-solar:emoji-funny-circle-bold-duotone h-5 w-5 text-primary-400']" />
        </div>
        <div
          :class="[
            'relative flex-1 border border-primary-500/20 rounded-xl rounded-tl-xs px-4 py-2',
            'text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed backdrop-blur-md',
            'bg-primary-500/5 dark:bg-primary-950/20 shadow-sm',
          ]"
        >
          "Before configuring my mind and senses, customize your studio workspace. All changes update immediately across the entire window."
        </div>
      </div>
    </div>

    <!-- Main 2-Column Configuration Grid -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="150"
      :class="['grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch']"
    >
      <!-- Left Column: Display Language (md:col-span-6) -->
      <div
        :class="[
          'md:col-span-6 flex flex-col justify-between rounded-2xl border p-4 backdrop-blur-md transition-all',
          'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60',
        ]"
      >
        <!-- Header -->
        <div :class="['flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800/80']">
          <div :class="['flex items-center gap-2']">
            <div :class="['i-solar:global-bold-duotone text-lg text-primary-500']" />
            <div>
              <h2 :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                Display Language
              </h2>
              <p :class="['text-[11px] text-neutral-400']">
                Current: <span :class="['text-primary-500 font-semibold uppercase']">{{ currentLanguage }}</span>
              </p>
            </div>
          </div>
          <span :class="['text-[10px] font-mono px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50']">
            8 Locales
          </span>
        </div>

        <!-- 8 Language Grid (2 Cols x 4 Rows) -->
        <div :class="['grid grid-cols-2 gap-2 my-3']">
          <button
            v-for="item in languages"
            :key="item.code"
            type="button"
            :class="[
              'group relative flex items-center justify-between p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer',
              currentLanguage === item.code
                ? 'border-primary-500 bg-primary-500/10 shadow-xs ring-1 ring-primary-500/30 dark:bg-primary-950/40'
                : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40',
            ]"
            @click="selectLanguage(item.code)"
          >
            <div :class="['flex items-center gap-2 min-w-0']">
              <span
                :class="[
                  'h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                  currentLanguage === item.code
                    ? 'bg-primary-500 text-white shadow-xs'
                    : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 group-hover:bg-neutral-300 dark:group-hover:bg-neutral-700',
                ]"
              >
                {{ item.badge }}
              </span>
              <div :class="['min-w-0']">
                <div
                  :class="[
                    'text-xs font-semibold truncate',
                    currentLanguage === item.code
                      ? 'text-primary-600 dark:text-primary-300'
                      : 'text-neutral-800 dark:text-neutral-200',
                  ]"
                >
                  {{ item.native }}
                </div>
                <div :class="['text-[10px] text-neutral-400 truncate']">
                  {{ item.name }}
                </div>
              </div>
            </div>

            <!-- Active Checkmark Indicator -->
            <div
              v-if="currentLanguage === item.code"
              :class="['i-solar:check-circle-bold text-sm text-primary-500 shrink-0 ml-1']"
            />
          </button>
        </div>

        <div :class="['text-[11px] text-neutral-400 flex items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/80']">
          <div :class="['i-solar:info-circle-linear text-xs text-neutral-400']" />
          <span>Applies to dialogue, settings, and stage controls.</span>
        </div>
      </div>

      <!-- Right Column: Theme Mode & Accent Palette (md:col-span-6) -->
      <div :class="['md:col-span-6 flex flex-col gap-3']">
        <!-- Card 1: Theme Mode (Light / Dark) -->
        <div
          :class="[
            'rounded-2xl border p-4 backdrop-blur-md transition-all',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60',
          ]"
        >
          <!-- Header -->
          <div :class="['flex items-center justify-between pb-2.5 border-b border-neutral-100 dark:border-neutral-800/80 mb-3']">
            <div :class="['flex items-center gap-2']">
              <div :class="[isDark ? 'i-solar:moon-bold-duotone text-indigo-400' : 'i-solar:sun-2-bold-duotone text-amber-500', 'text-lg']" />
              <div>
                <h2 :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                  Theme Mode
                </h2>
                <p :class="['text-[11px] text-neutral-400']">
                  Select daylight clarity or nighttime contrast
                </p>
              </div>
            </div>
            <span :class="['text-[10px] font-mono px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50']">
              {{ isDark ? 'Dark Mode' : 'Light Mode' }}
            </span>
          </div>

          <!-- Dual Mode Toggle Buttons -->
          <div :class="['grid grid-cols-2 gap-2.5']">
            <!-- Dark Mode Card -->
            <button
              type="button"
              :class="[
                'group flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer',
                isDark
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500/30'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="isDark = true"
            >
              <div :class="['h-8 w-8 rounded-lg flex items-center justify-center bg-indigo-500/15 text-indigo-400 shrink-0']">
                <div :class="['i-solar:moon-bold-duotone text-base']" />
              </div>
              <div :class="['min-w-0']">
                <div :class="['text-xs font-bold', isDark ? 'text-indigo-400' : 'text-neutral-800 dark:text-neutral-200']">
                  Dark Mode
                </div>
                <div :class="['text-[10px] text-neutral-400 truncate']">
                  Deep slate & OLED blacks
                </div>
              </div>
            </button>

            <!-- Light Mode Card -->
            <button
              type="button"
              :class="[
                'group flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer',
                !isDark
                  ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="isDark = false"
            >
              <div :class="['h-8 w-8 rounded-lg flex items-center justify-center bg-amber-500/15 text-amber-500 shrink-0']">
                <div :class="['i-solar:sun-2-bold-duotone text-base']" />
              </div>
              <div :class="['min-w-0']">
                <div :class="['text-xs font-bold', !isDark ? 'text-amber-500' : 'text-neutral-800 dark:text-neutral-200']">
                  Light Mode
                </div>
                <div :class="['text-[10px] text-neutral-400 truncate']">
                  Crisp & bright daylight
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Card 2: Primary Accent Palette -->
        <div
          :class="[
            'flex-1 rounded-2xl border p-4 backdrop-blur-md transition-all',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60',
          ]"
        >
          <!-- Header with Theme Header Widget parity -->
          <div :class="['flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800/80 mb-2.5']">
            <div :class="['flex items-center gap-2']">
              <div :class="['i-solar:palette-bold-duotone text-lg text-primary-500']" />
              <div>
                <h2 :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                  Signature Accent Color
                </h2>
                <p :class="['text-[11px] text-neutral-400']">
                  Active: <span :class="['text-primary-500 font-semibold']">{{ activeColorName }}</span>
                </p>
              </div>
            </div>

            <!-- Header Controls: Parity Widget + Reset -->
            <div :class="['flex items-center gap-2']">
              <button
                type="button"
                :class="['flex items-center gap-1 text-[10px] text-neutral-400 hover:text-primary-500 font-medium transition-colors cursor-pointer']"
                title="Reset to Signature AIRI Cyan"
                @click="resetColorToDefault"
              >
                <div :class="['i-solar:restart-linear text-xs']" />
                <span>Reset</span>
              </button>
              <SettingsThemeHeaderWidget shrink-0 />
            </div>
          </div>

          <!-- 24-Color Spectrum Preset Grid (4 Groups x 6 Swatches) -->
          <div :class="['flex flex-col gap-2 mt-1']">
            <div
              v-for="row in colorSpectrumRows"
              :key="row.group"
              :class="['flex items-center gap-2']"
            >
              <span :class="['w-18 text-[10px] font-medium text-neutral-400 dark:text-neutral-500 truncate shrink-0']">
                {{ row.group }}
              </span>
              <div :class="['grid grid-cols-6 gap-1.5 flex-1']">
                <button
                  v-for="swatch in row.swatches"
                  :key="swatch.name"
                  type="button"
                  :title="swatch.name"
                  :class="[
                    'relative h-6 w-full rounded-lg transition-all duration-150 cursor-pointer',
                    'hover:scale-110 hover:z-10 hover:shadow-md focus:outline-none',
                    settingsTheme.isColorSelectedForPrimary(swatch.color)
                      ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-neutral-900 scale-105 z-5 shadow-xs'
                      : 'ring-1 ring-black/10 dark:ring-white/10',
                  ]"
                  :style="{
                    backgroundColor: swatch.color || 'oklch(65% 0.18 220.44)',
                  }"
                  @click="selectColor(swatch.color)"
                >
                  <!-- Active Dot Indicator -->
                  <div
                    v-if="settingsTheme.isColorSelectedForPrimary(swatch.color)"
                    :class="['shadow-xs absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-white']"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Action Bar -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="250"
      :class="['flex items-center justify-between pt-3 border-t border-neutral-200/80 dark:border-white/5']"
    >
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>Back to Welcome</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        Environment configured · Ready for architecture
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
          'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
        ]"
        @click="props.onNext"
      >
        <span>Continue to Triage</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>
  </div>
</template>

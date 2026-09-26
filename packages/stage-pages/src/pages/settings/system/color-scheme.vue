<script setup lang="ts">
import { ColorPalette, Section } from '@proj-airi/stage-ui/components'
import { DEFAULT_THEME_COLORS_CHROMA_MULTIPLIER, DEFAULT_THEME_COLORS_HUE, useSettings } from '@proj-airi/stage-ui/stores/settings'
import { ColorHueRange, FieldRange } from '@proj-airi/ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import COLOR_PRESETS from './color-presets.json'

const settings = useSettings()
const { t, tm } = useI18n()

const themePresetOrder = ['warm', 'flora', 'ocean', 'bloom'] as const

const themePresets = computed(() => {
  const presets = tm('settings.pages.system.sections.section.theme-presets.presets') as Record<
    (typeof themePresetOrder)[number],
    {
      title: string
      description: string
      colors?: Record<string, string>
    }
  >

  if (!presets || typeof presets !== 'object') {
    return []
  }

  return themePresetOrder
    .map((key) => {
      const preset = presets[key]
      if (!preset)
        return null

      const presetColors = (COLOR_PRESETS as Record<string, Record<string, string | null>>)[key] || {}
      const colors = Object.entries(preset.colors ?? {}).map(([colorKey, name]) => {
        const hex = presetColors[colorKey]

        return {
          key: colorKey,
          name,
          hex: typeof hex === 'string' && hex.length ? hex : undefined,
        }
      })

      return {
        key,
        title: preset.title,
        description: preset.description,
        colors,
      }
    })
    .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset))
})

const vibrancyLabel = computed(() => {
  const mult = settings.themeColorsChromaMultiplier ?? 1.0
  if (mult <= 0.05)
    return t('settings.pages.system.sections.section.custom-color.fields.field.vibrancy.monochrome')
  if (mult < 0.75)
    return t('settings.pages.system.sections.section.custom-color.fields.field.vibrancy.muted')
  if (mult <= 1.15)
    return t('settings.pages.system.sections.section.custom-color.fields.field.vibrancy.balanced')
  return t('settings.pages.system.sections.section.custom-color.fields.field.vibrancy.vivid')
})

function resetToDefault() {
  settings.setThemeColorsHue(DEFAULT_THEME_COLORS_HUE)
  settings.setThemeColorsChromaMultiplier(DEFAULT_THEME_COLORS_CHROMA_MULTIPLIER)
}
</script>

<template>
  <Section
    v-motion
    mb-4
    :title="t('settings.pages.system.sections.section.custom-color.title')"
    icon="i-solar:pallete-2-bold-duotone"
    :initial="{ opacity: 0, y: 10 }"
    :enter="{ opacity: 1, y: 0 }"
    :duration="250 + (4 * 10)"
    :delay="4 * 50"
    transition="all ease-in-out duration-250"
  >
    <div
      v-motion
      :class="['flex', 'items-center', 'justify-between', 'gap-2', 'mb-3']"
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="250 + (5 * 10)"
      :delay="5 * 50"
      transition="all ease-in-out duration-250"
    >
      <div :class="['flex', 'items-center', 'gap-2']">
        <span :class="['text-base', 'font-medium']">
          {{ $t('settings.pages.system.sections.section.custom-color.fields.field.primary-color.label') }}
        </span>
        <button
          type="button"
          :class="[
            'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200',
            'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700',
            'text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 cursor-pointer',
          ]"
          @click="resetToDefault"
        >
          <div :class="['i-solar:restart-bold-duotone', 'text-sm', 'text-primary-500']" />
          {{ $t('settings.pages.system.sections.section.theme-presets.reset') }}
        </button>
      </div>

      <label :class="['relative', 'flex', 'cursor-pointer', 'items-center', 'gap-2', 'text-sm']">
        <input
          v-model="settings.themeColorsHueDynamic"
          type="checkbox"
          class="peer sr-only"
        >
        <div
          :class="[
            'h-6 w-11 rounded-full bg-neutral-200 dark:bg-neutral-600',
            'after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white',
            'after:transition-all after:content-empty',
            'peer-checked:bg-primary-500 peer-checked:after:translate-x-full peer-checked:after:border-white',
          ]"
        />
        {{ $t('settings.pages.system.sections.section.custom-color.fields.field.primary-color.rgb-on.title') }}
      </label>
    </div>

    <!-- Rainbow Hue Slider -->
    <ColorHueRange
      v-model="settings.themeColorsHue"
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="250 + (6 * 10)"
      :delay="6 * 50"
      :disabled="settings.themeColorsHueDynamic"
    />

    <!-- Vibrancy / Saturation (Chroma) Slider -->
    <div
      v-motion
      :class="['mt-4', 'p-3.5', 'rounded-lg', 'bg-neutral-50', 'dark:bg-neutral-800/50', 'border', 'border-neutral-200/60', 'dark:border-neutral-700/60']"
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="250 + (7 * 10)"
      :delay="7 * 50"
      transition="all ease-in-out duration-250"
    >
      <div :class="['flex', 'items-center', 'justify-between', 'mb-2']">
        <div :class="['flex', 'items-center', 'gap-2']">
          <div :class="['i-solar:tuning-square-2-bold-duotone', 'text-primary-500', 'text-lg']" />
          <span :class="['text-sm', 'font-medium']">
            {{ $t('settings.pages.system.sections.section.custom-color.fields.field.vibrancy.label') }}
          </span>
        </div>
        <div :class="['flex', 'items-center', 'gap-1.5']">
          <span :class="['text-xs', 'px-2.5', 'py-0.5', 'rounded-full', 'bg-primary-500/15', 'text-primary-600', 'dark:text-primary-400', 'font-medium']">
            {{ Math.round((settings.themeColorsChromaMultiplier ?? 1.0) * 100) }}% — {{ vibrancyLabel }}
          </span>
        </div>
      </div>

      <FieldRange
        v-model="settings.themeColorsChromaMultiplier"
        :min="0"
        :max="1.5"
        :step="0.05"
        :default-value="1.0"
        as="div"
      />

      <div :class="['flex', 'items-center', 'justify-between', 'gap-1.5', 'mt-2.5']">
        <button
          v-for="preset in [
            { label: '0% Mono', val: 0.0 },
            { label: '50% Pastel', val: 0.5 },
            { label: '100% Balanced', val: 1.0 },
            { label: '150% Vivid', val: 1.5 },
          ]"
          :key="preset.label"
          type="button"
          :class="[
            'px-2.5 py-1 text-xs rounded-md transition-all duration-150 cursor-pointer',
            Math.abs((settings.themeColorsChromaMultiplier ?? 1.0) - preset.val) < 0.03
              ? 'bg-primary-500 text-white font-medium shadow-sm'
              : 'bg-neutral-200/70 dark:bg-neutral-700/70 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600',
          ]"
          @click="settings.setThemeColorsChromaMultiplier(preset.val)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>

    <!-- Live OKLCH Shade Ramp -->
    <div
      v-motion
      :class="['color-bar', 'text-[10px]', 'md:text-base', 'sm:text-xs', 'mt-4']"
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="250 + (8 * 10)"
      :delay="8 * 50"
      transition="all ease-in-out duration-250"
    >
      <span bg-primary-50>50</span>
      <span bg-primary-100>100</span>
      <span bg-primary-200>200</span>
      <span bg-primary-300>300</span>
      <span bg-primary-400>400</span>
      <span bg-primary-500>500</span>
      <div
        v-motion
        text-white
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250 + (9 * 10)"
        :delay="9 * 50"
        transition="all ease-in-out duration-250"
      >
        <span bg-primary-600>600</span>
        <span bg-primary-700>700</span>
        <span bg-primary-800>800</span>
        <span bg-primary-900>900</span>
        <span bg-primary-950>950</span>
      </div>
    </div>

    <!-- Opacity Ramp -->
    <div
      v-motion
      :class="['color-bar', 'transparency-grid', 'text-[10px]', 'md:text-base', 'sm:text-xs', 'mt-2']"
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="250 + (10 * 10)"
      :delay="10 * 50"
      transition="all ease-in-out duration-250"
    >
      <span bg="primary-500/5">500/5</span>
      <span bg="primary-500/10">500/10</span>
      <span bg="primary-500/20">500/20</span>
      <span bg="primary-500/30">500/30</span>
      <span bg="primary-500/40">500/40</span>
      <span bg="primary-500/50">500/50</span>
      <span bg="primary-500/60">500/60</span>
      <span bg="primary-500/70">500/70</span>
      <span bg="primary-500/80">500/80</span>
      <span bg="primary-500/90">500/90</span>
      <span bg="primary-500">500</span>
    </div>
  </Section>

  <!-- Accent Presets (24 Spectrum Swatches) -->
  <Section
    v-motion
    mb-2
    :title="t('settings.pages.system.sections.section.theme-presets.title')"
    icon="i-solar:magic-stick-2-bold-duotone"
    :initial="{ opacity: 0, y: 10 }"
    :enter="{ opacity: 1, y: 0 }"
    :duration="250 + (11 * 10)"
    :delay="11 * 50"
    transition="all ease-in-out duration-250"
  >
    <div :class="['text-xs', 'text-neutral-500', 'dark:text-neutral-400', 'mb-3', 'px-1']">
      {{ $t('settings.pages.system.sections.section.theme-presets.description') }}
    </div>

    <div :class="['flex', 'flex-col', 'gap-2.5']">
      <div
        v-for="(preset, i) in themePresets"
        :key="preset.key"
        v-motion
        :class="[
          'w-full flex flex-col items-start justify-between gap-3 rounded-lg px-4 py-3.5',
          'bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/40 dark:border-neutral-700/40',
          'transition-all duration-200 md:flex-row md:items-center md:gap-4',
        ]"
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250 + (12 * 10) + (i * 10)"
        :delay="12 * 50 + (i * 50)"
        transition="all ease-in-out duration-250"
      >
        <div :class="['flex-1']">
          <div :class="['font-medium', 'text-sm', 'text-neutral-800', 'dark:text-neutral-100']">
            {{ $rt(preset.title) }}
          </div>
          <div :class="['text-xs', 'text-neutral-500', 'dark:text-neutral-400', 'mt-0.5']">
            {{ $rt(preset.description) }}
          </div>
        </div>
        <ColorPalette :colors="preset.colors.map(({ hex, name }) => ({ hex, name: $rt(name) }))" />
      </div>
    </div>
  </Section>

  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20"
    pointer-events-none
    fixed
    top="[65dvh]"
    right--15
    z--1
    :initial="{ scale: 0.9, opacity: 0, rotate: 30 }"
    :enter="{ scale: 1, opacity: 1, rotate: 0 }"
    :duration="250"
    flex
    items-center
    justify-center
  >
    <div text="60" i-solar:pallete-2-bold-duotone />
  </div>
</template>

<style scoped>
.color-bar {
  --at-apply: flex of-hidden rounded-lg lh-10 text-center text-black;

  * {
    flex: 1;
  }

  div {
    display: contents;
  }
}

.transparency-grid {
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: #fff;
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.system.color-scheme.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

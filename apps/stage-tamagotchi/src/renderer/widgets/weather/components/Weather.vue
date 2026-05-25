<script setup lang="ts">
import { computed } from 'vue'

import Skeleton from './Skeleton.vue'

type WeatherEffect = 'rain' | 'snow' | 'thunder' | 'fog' | 'cloudy' | 'none'
type SizePreset = 's' | 'm' | 'l' | { cols?: number; rows?: number }

const props = withDefaults(
  defineProps<{
    propsLoading?: boolean

    city?: string
    temperature?: string
    condition?: string
    icon?: string
    conditionCode?: string
    isNight?: boolean
    effect?: WeatherEffect
    size?: SizePreset
    high?: string
    low?: string
    feelsLike?: string
    humidity?: string
    wind?: string
    precipitation?: string
  }>(),
  {
    isNight: false,
    propsLoading: false,
  },
)

const weatherIconMap = {
  'clear-day': { effect: 'none', icon: 'i-iconify-meteocons:clear-day-fill', nightKey: 'clear-night' },
  'clear-night': { effect: 'none', icon: 'i-iconify-meteocons:clear-night-fill' },
  cloudy: { effect: 'cloudy', icon: 'i-iconify-meteocons:cloudy-fill' },
  drizzle: { effect: 'rain', icon: 'i-iconify-meteocons:drizzle-fill' },
  dust: { effect: 'fog', icon: 'i-iconify-meteocons:dust-fill' },
  'extreme-rain': { effect: 'rain', icon: 'i-iconify-meteocons:extreme-rain-fill' },
  'extreme-snow': { effect: 'snow', icon: 'i-iconify-meteocons:extreme-snow-fill' },
  fog: { effect: 'fog', icon: 'i-iconify-meteocons:fog-fill' },
  hail: { effect: 'snow', icon: 'i-iconify-meteocons:hail-fill' },
  haze: { effect: 'fog', icon: 'i-iconify-meteocons:haze-fill' },
  hurricane: { effect: 'thunder', icon: 'i-iconify-meteocons:hurricane-fill' },
  mist: { effect: 'fog', icon: 'i-iconify-meteocons:mist-fill' },
  overcast: { effect: 'cloudy', icon: 'i-iconify-meteocons:overcast-fill' },
  'partly-cloudy-day': {
    effect: 'cloudy',
    icon: 'i-iconify-meteocons:partly-cloudy-day-fill',
    nightKey: 'partly-cloudy-night',
  },
  'partly-cloudy-night': { effect: 'cloudy', icon: 'i-iconify-meteocons:partly-cloudy-night-fill' },
  rain: { effect: 'rain', icon: 'i-iconify-meteocons:rain-fill' },
  sleet: { effect: 'snow', icon: 'i-iconify-meteocons:sleet-fill' },
  smoke: { effect: 'fog', icon: 'i-iconify-meteocons:smoke-fill' },
  snow: { effect: 'snow', icon: 'i-iconify-meteocons:snow-fill' },
  thunderstorm: { effect: 'thunder', icon: 'i-iconify-meteocons:thunderstorms-fill' },
  tornado: { effect: 'thunder', icon: 'i-iconify-meteocons:tornado-fill' },
  wind: { effect: 'cloudy', icon: 'i-iconify-meteocons:wind-fill' },
} as Record<string, { icon: string; effect?: WeatherEffect; nightKey?: string }>

const normalizedCondition = computed(() => (props.condition ?? '').toLowerCase().trim())
const normalizedCode = computed(() => (props.conditionCode ?? '').toLowerCase().trim())
const isLarge = computed(() => props.size === 'l')

const conditionMappings: Array<{ keywords: string[]; key: string }> = [
  { key: 'thunderstorm', keywords: ['thunder', 'storm', 'lightning'] },
  { key: 'hurricane', keywords: ['hurricane', 'typhoon', 'cyclone'] },
  { key: 'tornado', keywords: ['tornado'] },
  { key: 'hail', keywords: ['hail'] },
  { key: 'sleet', keywords: ['sleet', 'ice'] },
  { key: 'snow', keywords: ['snow', 'blizzard', 'flurries'] },
  { key: 'extreme-rain', keywords: ['extreme rain', 'heavy rain', 'downpour'] },
  { key: 'rain', keywords: ['rain', 'shower'] },
  { key: 'drizzle', keywords: ['drizzle', 'sprinkle'] },
  { key: 'fog', keywords: ['fog'] },
  { key: 'mist', keywords: ['mist'] },
  { key: 'haze', keywords: ['haze'] },
  { key: 'dust', keywords: ['dust', 'sand'] },
  { key: 'smoke', keywords: ['smoke'] },
  { key: 'overcast', keywords: ['overcast'] },
  { key: 'cloudy', keywords: ['cloud'] },
  { key: 'partly-cloudy-day', keywords: ['partly', 'mostly', 'scattered'] },
  { key: 'wind', keywords: ['wind', 'breezy', 'gust'] },
  { key: 'clear-day', keywords: ['clear', 'sun', 'fair'] },
]

function isWeatherIconKey(input: string): input is string {
  return input in weatherIconMap
}

const resolvedIconKey = computed<string>(() => {
  if (props.icon) return props.icon

  const direct = normalizedCode.value
  if (direct && isWeatherIconKey(direct)) return direct

  const match = conditionMappings.find(({ keywords }) =>
    keywords.some((keyword) => normalizedCondition.value.includes(keyword)),
  )
  const fallback: string = props.isNight ? 'clear-night' : 'clear-day'
  const baseKey = match?.key ?? fallback
  const config = weatherIconMap[baseKey]

  if (props.isNight && config.nightKey) return config.nightKey

  return baseKey
})

const resolvedIconClass = computed(() => weatherIconMap[resolvedIconKey.value].icon)
</script>

<template>
  <div :class="['relative', 'h-full', 'w-full', 'font-sans']">
    <Skeleton
      v-if="props.propsLoading"
      :class="['grid', 'grid-cols-4', 'grid-rows-3', 'max-h-35', 'gap-2', 'rounded-2xl', 'py-2', 'pl-3', 'pr-1']"
    >
      <Skeleton
        animation="wave"
        :class="['col-span-3', 'h-[1lh]', 'w-20%', 'rounded-2xl']"
      />
      <div
        :class="['col-span-1', 'row-span-2', 'h-20', 'w-20', 'justify-self-end']"
      />
      <Skeleton
        animation="wave"
        :class="['col-span-2', 'row-span-2', 'h-full', 'w-20%', 'inline-flex', 'items-end', 'rounded-2xl', 'text-gray-600', 'font-thin', 'dark:text-gray-300']"
      />
      <Skeleton
        animation="wave"
        :class="['col-span-2', 'row-span-1', 'h-full', 'w-20%', 'inline-flex', 'items-end', 'justify-self-end', 'rounded-2xl', 'pr-4', 'text-gray-500', 'dark:text-gray-400']"
      />
    </Skeleton>
    <!-- TODO: Yeah I know for Windows, rounded corner is not applied properly when background material used -->
    <!-- https://github.com/electron/electron/issues/48340 -->
    <!-- https://issues.chromium.org/issues/432457523 -->
    <div
      v-else
      :class="[
        'relative',
        'flex',
        'h-full',
        'flex-col',
        'justify-between',
        'gap-3',
        'overflow-x-hidden overflow-y-scroll scrollbar-none',
        'p-3',
        'rounded-2xl',
        'bg-gradient-to-br',
        'from-neutral-950/65',
        'via-neutral-900/65',
        'to-neutral-800/65',
        'text-white',
      ]"
    >
      <div
        aria-hidden="true"
        :class="[
          'pointer-events-none',
          'absolute',
          '-right-8',
          '-top-10',
          'size-32',
          'rounded-full',
          'bg-gradient-to-br',
          'from-white/30',
          'via-white/5',
          'to-transparent',
          'blur-xl',
        ]"
      />
      <div v-if="isLarge" :class="['relative', 'z-1', 'flex', 'h-full', 'flex-col', 'justify-between', 'gap-4']">
        <div :class="['flex', 'items-center', 'justify-center']">
          <div
            aria-hidden="true"
            :class="[
              'text-[6rem]',
              'leading-none',
              'text-white/95',
              'drop-shadow-[0_12px_30px_rgba(0,0,0,0.55)]',
              resolvedIconClass,
            ]"
          />
        </div>
        <div :class="['flex', 'flex-col', 'items-center', 'gap-2']">
          <div :class="['text-[4rem]', 'font-semibold', 'leading-none']">
            {{ props.temperature ?? '--' }}
          </div>
          <div :class="['text-lg', 'text-white/85']">
            {{ props.condition ?? '—' }}
          </div>
          <div :class="['text-sm', 'text-white/55']">
            {{ props.city ?? 'Unknown' }}
          </div>
        </div>
        <div :class="['h-px', 'w-full', 'bg-white/10']" />
        <div :class="['grid', 'grid-cols-3', 'gap-3', 'text-white/80']">
          <div :class="['flex', 'flex-col', 'items-center', 'gap-1']">
            <div :class="['text-4xl', 'leading-none', 'i-iconify-meteocons:wind-fill-static']" />
            <div :class="['text-sm', 'font-semibold']">
              {{ props.wind ?? '--' }}
            </div>
            <div :class="['text-xs', 'text-white/60']">
              Wind
            </div>
          </div>
          <div :class="['flex', 'flex-col', 'items-center', 'gap-1']">
            <div :class="['text-4xl', 'leading-none', 'i-iconify-meteocons:raindrops-fill-static']" />
            <div :class="['text-sm', 'font-semibold']">
              {{ props.precipitation ?? '--' }}
            </div>
            <div :class="['text-xs', 'text-white/60']">
              Chance of rain
            </div>
          </div>
          <div :class="['flex', 'flex-col', 'items-center', 'gap-1']">
            <div :class="['text-4xl', 'leading-none', 'i-iconify-meteocons:humidity-fill-static']" />
            <div :class="['text-sm', 'font-semibold']">
              {{ props.humidity ?? '--' }}
            </div>
            <div :class="['text-xs', 'text-white/60']">
              Humidity
            </div>
          </div>
        </div>
      </div>
      <div v-else :class="['relative', 'z-1', 'flex', 'flex-1', 'flex-col', 'gap-3']">
        <div :class="['flex', 'items-start', 'justify-between', 'gap-4', 'flex-1', 'p-2']">
          <div
            aria-hidden="true"
            :class="[
              'size-40 scale-120',
              'leading-none',
              'text-white/90',
              'drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)]',
              resolvedIconClass,
            ]"
          />
          <div :class="['flex', 'flex-col', 'items-end', 'gap-2']">
            <div :class="['text-sm', 'tracking-wide', 'text-white/80']">
              {{ props.condition ?? '—' }}
            </div>
            <div :class="['text-[3.5rem]', 'font-semibold', 'leading-none']">
              {{ props.temperature ?? '--' }}
            </div>
            <div :class="['text-xs', 'text-white/60']">
              {{ props.city ?? 'Unknown' }}
            </div>
          </div>
        </div>
        <div :class="['h-px', 'w-full', 'bg-white/10']" />
        <div :class="['grid', 'grid-cols-3', 'gap-2', 'text-white/80', 'flex-shrink-0', 'pb-4']">
          <div :class="['flex', 'flex-col', 'items-center', 'gap-1']">
            <div :class="['text-4xl scale-120', 'leading-none', 'i-iconify-meteocons:wind-fill-static']" />
            <div :class="['text-sm', 'font-semibold']">
              {{ props.wind ?? '--' }}
            </div>
            <div :class="['text-xs', 'text-white/60']">
              Wind
            </div>
          </div>
          <div :class="['flex', 'flex-col', 'items-center', 'gap-1']">
            <div :class="['text-4xl scale-120', 'leading-none', 'i-iconify-meteocons:raindrops-fill-static']" />
            <div :class="['text-sm', 'font-semibold']">
              {{ props.precipitation ?? '--' }}
            </div>
            <div :class="['text-xs', 'text-white/60']">
              Chance of rain
            </div>
          </div>
          <div :class="['flex', 'flex-col', 'items-center', 'gap-1']">
            <div :class="['text-4xl scale-120', 'leading-none', 'i-iconify-meteocons:humidity-fill-static']" />
            <div :class="['text-sm', 'font-semibold']">
              {{ props.humidity ?? '--' }}
            </div>
            <div :class="['text-xs', 'text-white/60']">
              Humidity
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>

<route lang="yaml">
meta:
  layout: plain
</route>

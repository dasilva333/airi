<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  square?: boolean
  colors?: string[]
  gazeX?: number
  gazeY?: number
}>(), {
  square: false,
  gazeX: 0,
  gazeY: 0,
})

const SIZE = 36
const maskId = `beam-avatar-mask-${useId()}`

const DEFAULT_PALETTE = [
  { color: 'oklch(0.75 0.14 var(--chromatic-hue, 220.44))', darkText: true },
  { color: 'oklch(0.60 0.17 calc(var(--chromatic-hue, 220.44) + 35))', darkText: false },
  { color: 'oklch(0.84 0.12 calc(var(--chromatic-hue, 220.44) + 75))', darkText: true },
  { color: 'oklch(0.52 0.16 calc(var(--chromatic-hue, 220.44) + 140))', darkText: false },
  { color: 'oklch(0.78 0.15 calc(var(--chromatic-hue, 220.44) + 210))', darkText: true },
]

function hashCode(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    const character = name.charCodeAt(i)
    hash = ((hash << 5) - hash) + character
    hash &= hash
  }
  return Math.abs(hash)
}

function getDigit(number: number, ntn: number): number {
  return Math.floor((number / 10 ** ntn) % 10)
}

function getBoolean(number: number, ntn: number): boolean {
  return !(getDigit(number, ntn) % 2)
}

function getUnit(number: number, range: number, index?: number): number {
  const value = number % range
  if (index && ((getDigit(number, index) % 2) === 0)) {
    return -value
  }
  return value
}

const data = computed(() => {
  const numFromName = hashCode(props.name || 'AIRI')
  const paletteLength = props.colors?.length || DEFAULT_PALETTE.length

  const wrapperColorIndex = numFromName % paletteLength
  const wrapperColor = props.colors
    ? props.colors[wrapperColorIndex]
    : DEFAULT_PALETTE[wrapperColorIndex].color

  const preTranslateX = getUnit(numFromName, 10, 1)
  const wrapperTranslateX = preTranslateX < 5 ? preTranslateX + SIZE / 9 : preTranslateX
  const preTranslateY = getUnit(numFromName, 10, 2)
  const wrapperTranslateY = preTranslateY < 5 ? preTranslateY + SIZE / 9 : preTranslateY

  const backgroundColorIndex = (numFromName + 2) % paletteLength
  const backgroundColor = props.colors
    ? props.colors[backgroundColorIndex]
    : DEFAULT_PALETTE[backgroundColorIndex].color

  const faceColorDarkText = props.colors
    ? true
    : DEFAULT_PALETTE[wrapperColorIndex].darkText

  return {
    wrapperColor,
    faceColor: faceColorDarkText ? '#111827' : '#FFFFFF',
    backgroundColor,
    wrapperTranslateX,
    wrapperTranslateY,
    wrapperRotate: getUnit(numFromName, 360),
    wrapperScale: 1 + getUnit(numFromName, SIZE / 12) / 10,
    isMouthOpen: getBoolean(numFromName, 2),
    isCircle: getBoolean(numFromName, 1),
    eyeSpread: getUnit(numFromName, 5),
    mouthSpread: getUnit(numFromName, 3),
    faceRotate: getUnit(numFromName, 10, 3),
    faceTranslateX: wrapperTranslateX > SIZE / 6 ? wrapperTranslateX / 2 : getUnit(numFromName, 8, 1),
    faceTranslateY: wrapperTranslateY > SIZE / 6 ? wrapperTranslateY / 2 : getUnit(numFromName, 7, 2),
  }
})
const gazeOffset = computed(() => {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v))
  return {
    x: clamp(props.gazeX ?? 0) * 2.2,
    y: clamp(props.gazeY ?? 0) * 1.8,
    faceX: clamp(props.gazeX ?? 0) * 1.1,
    faceY: clamp(props.gazeY ?? 0) * 0.9,
  }
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${SIZE} ${SIZE}`"
    fill="none"
    role="img"
    :aria-label="name"
    xmlns="http://www.w3.org/2000/svg"
    class="block h-full w-full"
  >
    <mask :id="maskId" maskUnits="userSpaceOnUse" x="0" y="0" :width="SIZE" :height="SIZE">
      <rect :width="SIZE" :height="SIZE" :rx="square ? undefined : SIZE * 2" fill="#FFFFFF" />
    </mask>
    <g :mask="`url(#${maskId})`">
      <rect :width="SIZE" :height="SIZE" :fill="data.backgroundColor" />
      <rect
        x="0"
        y="0"
        :width="SIZE"
        :height="SIZE"
        :transform="`translate(${data.wrapperTranslateX} ${data.wrapperTranslateY}) rotate(${data.wrapperRotate} ${SIZE / 2} ${SIZE / 2}) scale(${data.wrapperScale})`"
        :fill="data.wrapperColor"
        :rx="data.isCircle ? SIZE : SIZE / 6"
      />
      <g
        :transform="`translate(${data.faceTranslateX + gazeOffset.faceX} ${data.faceTranslateY + gazeOffset.faceY}) rotate(${data.faceRotate} ${SIZE / 2} ${SIZE / 2})`"
        class="transition-transform duration-150 ease-out"
      >
        <path
          v-if="data.isMouthOpen"
          :d="`M15 ${19 + data.mouthSpread}c2 1 4 1 6 0`"
          :stroke="data.faceColor"
          stroke-linecap="round"
        />
        <path
          v-else
          :d="`M13,${19 + data.mouthSpread} a1,0.75 0 0,0 10,0`"
          :fill="data.faceColor"
        />
        <g
          :transform="`translate(${gazeOffset.x} ${gazeOffset.y})`"
          class="transition-transform duration-100 ease-out"
        >
          <rect
            :x="14 - data.eyeSpread"
            y="14"
            width="1.5"
            height="2"
            rx="1"
            stroke="none"
            :fill="data.faceColor"
          />
          <rect
            :x="20 + data.eyeSpread"
            y="14"
            width="1.5"
            height="2"
            rx="1"
            stroke="none"
            :fill="data.faceColor"
          />
        </g>
      </g>
    </g>
  </svg>
</template>

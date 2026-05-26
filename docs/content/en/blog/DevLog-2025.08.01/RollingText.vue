<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import type { TextSplitter, Timeline } from 'animejs'
import { onMounted, shallowRef, useTemplateRef, watchEffect } from 'vue'

const animatedText = useTemplateRef('animatedText')
const shouldReduceMotion = useLocalStorage('docs:settings/reduce-motion', false) // A11y-friendly!

const animatedChars = shallowRef<TextSplitter['chars']>()
const timeline = shallowRef<Timeline>()

onMounted(async () => {
  const { createTimeline, stagger, text } = await import('animejs')

  const { chars } = text.split(animatedText.value!, {
    accessible: true,
    chars: { clone: 'bottom', wrap: 'clip' },
  })
  animatedChars.value = chars

  timeline.value = createTimeline({
    defaults: { duration: 650, ease: 'inOut(3)' },
    loop: true,
  })
    .add(
      chars,
      {
        duration: 1000,
        ease: 'inOut(2)',
        loop: true,
        loopDelay: 350,
        opacity: [1, 0, 1],
        y: '-100%',
      },
      stagger(150, { from: 'random' }),
    )
    .reset()
})

watchEffect(() => {
  if (shouldReduceMotion.value) {
    timeline.value?.reset()
  } else {
    timeline.value?.play()
  }
})
</script>

<template>
  <slot name="before" :motion-reduced="shouldReduceMotion" />

  <div class="relative" v-bind="$attrs">
    <div ref="animatedText">
      <slot />
    </div>
    <div class="absolute left-0 top-0 op-20" aria-hidden>
      <slot />
    </div>
  </div>

  <slot name="after" :motion-reduced="shouldReduceMotion" />
</template>

<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { animate, createDraggable, createSpring, utils } from 'animejs'
import { onMounted } from 'vue'

onMounted(() => {
  const [$logo] = utils.$('.logo.js')
  const [$button] = utils.$('button')
  let rotations = 0

  // Created a bounce animation loop
  animate('.logo.js', {
    loop: true,
    loopDelay: 250,
    scale: [
      { duration: 200, ease: 'inOut(3)', to: 1.25 },
      { ease: createSpring({ stiffness: 300 }), to: 1 },
    ],
  })

  // Make the logo draggable around its center
  createDraggable('.logo.js', {
    container: [0, 0, 0, 0],
    releaseEase: createSpring({ stiffness: 200 }),
  })

  // Animate logo rotation on click
  function rotateLogo() {
    rotations++

    $button.textContent = `rotations: ${rotations}`

    animate($logo, {
      duration: 1500,
      ease: 'out(4)',
      rotate: rotations * 360,
    })
  }

  $button.addEventListener('click', rotateLogo)
})
</script>

<template>
  <div class="large centered row mb-4">
    <div class="logo js i-simple-icons:javascript" h-30 w-30 />
  </div>
  <div class="row medium">
    <fieldset class="controls">
      <Button>rotations: 0</Button>
    </fieldset>
  </div>
</template>

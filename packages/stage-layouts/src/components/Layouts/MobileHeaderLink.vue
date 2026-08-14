<script setup lang="ts">
import { useTheme } from '@proj-airi/ui'
import { RouterLink } from 'vue-router'

import LogoDark from '../../assets/logo-dark.svg'
import Logo from '../../assets/logo.svg'

const { isDark: dark } = useTheme()
</script>

<template>
  <RouterLink
    to="/"
    class="flex items-center gap-2 outline-none transition-transform active:scale-95"
    title="AIRI Home"
  >
    <img
      :src="dark ? LogoDark : Logo"
      class="theme-colored h-7 w-7 object-contain opacity-90 transition-opacity hover:opacity-100"
      alt="AIRI"
    >
  </RouterLink>
</template>

<style scoped>
.theme-colored {
  filter: hue-rotate(calc(var(--chromatic-hue, 0) * 1deg));
}
</style>

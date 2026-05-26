<script setup lang="ts">
import { useFactorioStore } from '../../stores/modules/gaming-factorio'
import GamingModuleSettings from './GamingModuleSettings.vue'

const factorioStore = useFactorioStore()
</script>

<template>
  <GamingModuleSettings
    :store="factorioStore"
    i18n-key-prefix="settings.pages.modules.gaming-factorio"
  />
</template>

<script setup lang="ts">
import { useMinecraftStore } from '../../stores/modules/gaming-minecraft'
import GamingModuleSettings from './GamingModuleSettings.vue'

const minecraftStore = useMinecraftStore()
</script>

<template>
  <GamingModuleSettings
    :store="minecraftStore"
    i18n-key-prefix="settings.pages.modules.gaming-minecraft"
  />
</template>

<script setup lang="ts">
import { AboutContent } from '../about'
import type { AboutBuildInfo, AboutLink } from '../about/types'
import AboutDialogBase from './about/about-dialog.vue'

withDefaults(
  defineProps<{
    title?: string
    highlight?: string
    subtitle?: string
    buildInfo?: AboutBuildInfo
    links?: AboutLink[]
  }>(),
  {
    highlight: 'AIRI',
    links: undefined,
    subtitle: '',
    title: 'Project',
  },
)

const showDialog = defineModel({ default: false, required: false, type: Boolean })
</script>

<template>
  <AboutDialogBase v-model="showDialog">
    <AboutContent
      :title="title"
      :highlight="highlight"
      :subtitle="subtitle"
      :build-info="buildInfo"
      :links="links"
    />
  </AboutDialogBase>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CardEditorForm from './components/CardEditorForm.vue'

const route = useRoute()
const router = useRouter()

const cardId = computed(() => {
  return (route.query.id as string) || (route.query.cardId as string) || undefined
})

function handleCancel() {
  if (window.history.length > 1) {
    router.back()
  }
  else {
    router.push('/settings/airi-card')
  }
}

function handleSave() {
  if (window.history.length > 1) {
    router.back()
  }
  else {
    router.push('/settings/airi-card')
  }
}

function handleStudio(targetCardId: string) {
  router.push({
    path: '/settings/airi-card',
    query: { cardId: targetCardId, tab: 'studio' },
  })
}
</script>

<template>
  <div class="mx-auto max-w-5xl w-full pb-20 pt-1">
    <CardEditorForm
      :card-id="cardId"
      mode="page"
      @cancel="handleCancel"
      @save="handleSave"
      @studio="handleStudio"
    />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.card.edit_card
  subtitleKey: settings.pages.card.title
  descriptionKey: settings.pages.card.description
  icon: i-solar:user-speak-bold-duotone
  settingsEntry: false
  order: 1
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>

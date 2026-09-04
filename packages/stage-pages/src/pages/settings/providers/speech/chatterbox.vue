<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.replace('/settings/providers/speech/airi-audio-server')
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 p-12 text-center">
    <span class="i-solar:restart-bold animate-spin text-2xl text-amber-500" />
    <span class="text-xs text-neutral-500 font-medium">
      Chatterbox has been upgraded to AIRI Audio Server. Redirecting...
    </span>
  </div>
</template>

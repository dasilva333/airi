<script setup lang="ts">
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { Button, Select } from '@proj-airi/ui'
import { computed, ref } from 'vue'

import VoiceCreatorModal from '../airi-card/components/VoiceCreatorModal.vue'

const userProfileStore = useSettingsUserProfile()
const speechStore = useSpeechStore()

const showVoiceCreator = ref(false)

const voiceOptions = computed(() => {
  const list = [
    { value: '', label: 'No Vocal Profile' },
  ]
  speechStore.savedVoiceProfiles
    .filter(p => p.id !== 'voice_profile_auto_preview')
    .forEach((p) => {
      list.push({ value: p.id, label: p.name })
    })
  return list
})
</script>

<template>
  <div rounded-lg bg-neutral-50 p-6 dark:bg-neutral-800 flex="~ col gap-6">
    <!-- User Name -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">User Display Name</label>
      <input
        v-model="userProfileStore.name"
        type="text"
        placeholder="e.g. Manager"
        class="w-full border border-neutral-200 rounded-xl bg-white px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
      >
      <p class="text-[10px] text-neutral-400 italic">
        The default nickname used by imported cards and creator story scripts unless overridden.
      </p>
    </div>

    <!-- Narrative Description -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Narrative Description</label>
      <textarea
        v-model="userProfileStore.description"
        rows="3"
        placeholder="A quiet manager who coordinates the cast..."
        class="w-full border border-neutral-200 rounded-xl bg-white px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
      />
      <p class="text-[10px] text-neutral-400 italic">
        A short prose summary helping the cognitive/storyline models understand your visual description and personality role.
      </p>
    </div>

    <!-- Image Prompt Tags -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Visual Prompt Tags</label>
      <textarea
        v-model="userProfileStore.prompt"
        rows="3"
        placeholder=", short dark hair, spectacles, formal grey business suit"
        class="w-full border border-neutral-200 rounded-xl bg-white px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
      />
      <p class="text-[10px] text-neutral-400 italic">
        Stable Diffusion / ComfyUI prompt tags injected when generating scene graphics representing you.
      </p>
    </div>

    <!-- Speech Vocal Profile Select -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Speech Voice Profile</label>
      <div class="flex items-center gap-2">
        <Select v-model="userProfileStore.voiceProfileId" :options="voiceOptions" class="flex-1" />
        <Button
          variant="secondary"
          type="button"
          class="h-[38px] flex items-center gap-1.5 border border-neutral-200 px-3 text-xs font-bold dark:border-neutral-700"
          title="Create custom voice profile"
          @click.prevent="showVoiceCreator = true"
        >
          <span class="i-solar:music-notes-bold-duotone text-sm" />
          Create Custom Voice
        </Button>
      </div>
      <p class="text-[10px] text-neutral-400 italic">
        The vocal profile used to speak/narrate Producer choice suggestions in the overlay view.
      </p>
    </div>

    <!-- Background Decoration -->
    <div
      v-motion
      text="neutral-200/50 dark:neutral-600/20" pointer-events-none
      fixed top="[65dvh]" right--15 z--1
      :initial="{ scale: 0.9, opacity: 0, rotate: 30 }"
      :enter="{ scale: 1, opacity: 1, rotate: 0 }"
      :duration="250"
      flex items-center justify-center
    >
      <div text="60" i-solar:user-bold-duotone />
    </div>

    <!-- Voice Creator Modal -->
    <VoiceCreatorModal
      v-model="showVoiceCreator"
      character-name="User"
      @save="(payload) => {
        userProfileStore.voiceProfileId = typeof payload === 'string' ? payload : payload.baseVoice
      }"
    />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: User Profile
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

<script setup lang="ts">
import CompanionBubble from '../components/companion-bubble.vue'

import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'

// V2 onboarding scaffold — Step 3: User Profile & Identity.
// Fields bind to the real `useSettingsUserProfile` store (localStorage-backed).
const userProfileStore = useSettingsUserProfile()
</script>

<template>
  <div class="h-full flex flex-col gap-5 overflow-y-auto px-1 pb-2">
    <div>
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Who Are You?
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Before choosing her soul, tell her who she's talking to — the AI card creators use this.
      </p>
    </div>

    <CompanionBubble
      tone="purple"
      message="Tell her who you are! What should she call you? After all, she's not a mind reader, right?"
    />

    <div :class="['p-5 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-5']">
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

      <div class="flex flex-col gap-2">
        <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Narrative Description</label>
        <textarea
          v-model="userProfileStore.description"
          rows="3"
          placeholder="A quiet manager who coordinates the cast..."
          class="w-full border border-neutral-200 rounded-xl bg-white px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
        />
        <p class="text-[10px] text-neutral-400 italic">
          A short prose summary helping the cognitive/storyline models understand your role.
        </p>
      </div>

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
    </div>
  </div>
</template>

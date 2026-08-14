<script setup lang="ts">
import { ref, watch } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'
import { useOnboardingV2Draft } from '../draft-store'

// V2 onboarding scaffold — Step 3: User Profile & Identity.
// Fields bind to the real `useSettingsUserProfile` store and sync to draft.
const userProfileStore = useSettingsUserProfile()
const draft = useOnboardingV2Draft()

interface UserArchetype {
  id: string
  name: string
  gender: 'male' | 'female'
  label: string
  subtitle: string
  icon: string
  description: string
  prompt: string
}

const USER_ARCHETYPES: UserArchetype[] = [
  {
    id: 'rustic-craftsman',
    name: 'Richie',
    gender: 'male',
    label: 'Rustic Craftsman',
    subtitle: 'Rugged workwear & suspenders',
    icon: 'i-solar:sledgehammer-bold-duotone',
    description: 'This is the user. He is wearing dark leather Y-back suspenders over a collarless henley grandfather shirt with rolled-up sleeves.',
    prompt: ', (1man, solo, messy brown hair, dark leather Y-back suspenders, olive green collarless henley shirt, rolled-up sleeves, dark canvas work trousers, casual rustic workwear style)',
  },
  {
    id: 'modern-specialist',
    name: 'Dave',
    gender: 'male',
    label: 'Tech Specialist',
    subtitle: 'Sharp suit & wireframe glasses',
    icon: 'i-solar:laptop-bold-duotone',
    description: 'An observant tech producer wearing a clean charcoal blazer over a crewneck shirt with sleek spectacles.',
    prompt: ', (1man, solo, short dark hair, spectacles, dark charcoal blazer, dark crewneck t-shirt, modern casual techwear, minimalist aesthetic)',
  },
  {
    id: 'creative-artist',
    name: 'Maya',
    gender: 'female',
    label: 'Creative Artist',
    subtitle: 'Cozy cardigan & relaxed aesthetic',
    icon: 'i-solar:palette-bold-duotone',
    description: 'A warm and imaginative creative director wearing an oversized beige knit cardigan over a linen top with delicate earrings.',
    prompt: ', (1woman, solo, wavy chestnut hair in loose ponytail, oversized cream knit cardigan, white linen camisole, relaxed aesthetic, delicate jewelry)',
  },
  {
    id: 'studio-director',
    name: 'Elena',
    gender: 'female',
    label: 'Studio Director',
    subtitle: 'Navy blazer & executive style',
    icon: 'i-solar:case-round-bold-duotone',
    description: 'An ambitious, poised project director wearing a tailored navy blazer, crisp white button-up shirt, and minimalist watch.',
    prompt: ', (1woman, solo, straight dark hair, shoulder-length, tailored navy blue blazer, crisp white collared shirt, elegant smart-casual office style)',
  },
]

const selectedArchetypeId = ref<string | null>(null)

function applyArchetype(archetype: UserArchetype) {
  selectedArchetypeId.value = archetype.id
  userProfileStore.name = archetype.name
  userProfileStore.description = archetype.description
  userProfileStore.prompt = archetype.prompt
  draft.setUserProfile({
    name: archetype.name,
    description: archetype.description,
    prompt: archetype.prompt,
  })
}

// Watch inputs and keep draft updated
watch(
  [() => userProfileStore.name, () => userProfileStore.description, () => userProfileStore.prompt],
  ([name, description, prompt]) => {
    draft.setUserProfile({ name, description, prompt })
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-y-auto px-1 pb-2">
    <div>
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Who Are You?
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Before choosing her soul, tell her who she's talking to — the AI card creators and image generators use this.
      </p>
    </div>

    <CompanionBubble
      tone="purple"
      message="Tell her who you are! Pick a ready-to-use persona archetype or customize your identity and appearance tags below."
    />

    <!-- Quick Archetype Presets -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <div class="flex items-center justify-between">
        <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
          Archetype Templates
        </span>
        <span class="text-[11px] text-neutral-400">Tap to auto-fill</span>
      </div>

      <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          v-for="archetype in USER_ARCHETYPES"
          :key="archetype.id"
          type="button"
          :class="[
            'relative flex items-center gap-3 border-2 rounded-xl p-3 text-left transition-all duration-200',
            selectedArchetypeId === archetype.id
              ? 'border-primary-500 bg-primary-500/10 shadow-sm dark:border-primary-400'
              : 'border-neutral-200/60 bg-white/60 dark:border-neutral-800/80 dark:bg-neutral-900/60 hover:border-primary-500/40',
          ]"
          @click="applyArchetype(archetype)"
        >
          <div
            :class="[
              'h-9 w-9 flex flex-shrink-0 items-center justify-center rounded-lg',
              selectedArchetypeId === archetype.id
                ? 'bg-primary-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
            ]"
          >
            <div :class="[archetype.icon, 'h-5 w-5']" />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-neutral-800 font-bold dark:text-neutral-100">
                {{ archetype.label }}
              </span>
              <span
                :class="[
                  'rounded px-1.5 py-0.2 text-[9px] font-bold uppercase',
                  archetype.gender === 'male'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                ]"
              >
                {{ archetype.gender }}
              </span>
            </div>
            <p class="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
              {{ archetype.subtitle }}
            </p>
          </div>
        </button>
      </div>
    </div>

    <!-- Manual / Customized Profile Inputs -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-4']">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-neutral-700 font-bold dark:text-neutral-300">User Display Name</label>
        <input
          v-model="userProfileStore.name"
          type="text"
          placeholder="e.g. Manager"
          class="w-full border border-neutral-200 rounded-xl bg-white px-3.5 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
        >
        <p class="text-[10px] text-neutral-400 italic">
          The default nickname used by imported cards and creator story scripts unless overridden.
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Narrative Description</label>
        <textarea
          v-model="userProfileStore.description"
          rows="3"
          placeholder="A quiet manager who coordinates the cast..."
          class="w-full border border-neutral-200 rounded-xl bg-white px-3.5 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
        />
        <p class="text-[10px] text-neutral-400 italic">
          A short prose summary helping the cognitive/storyline models understand your role.
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Visual Prompt Tags</label>
        <textarea
          v-model="userProfileStore.prompt"
          rows="3"
          placeholder=", short dark hair, spectacles, formal grey business suit"
          class="w-full border border-neutral-200 rounded-xl bg-white px-3.5 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
        />
        <p class="text-[10px] text-neutral-400 italic">
          Stable Diffusion / ComfyUI prompt tags injected when generating scene graphics representing you.
        </p>
      </div>
    </div>
  </div>
</template>

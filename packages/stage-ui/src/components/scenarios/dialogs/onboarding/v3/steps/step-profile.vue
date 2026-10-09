<script setup lang="ts">
import { useOnboardingDisplayText } from '../composables/use-onboarding-display-text'


import { Button } from '@proj-airi/ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CompanionBubble from '../components/companion-bubble.vue'

import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const { displayText } = useOnboardingDisplayText()


const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

// V3 onboarding step 4 — User Profile & Identity.
// Fields bind strictly to `useOnboardingV3Draft` (Rule 1 Draft Isolation).
// Persisted atomically to `useSettingsUserProfile` on finale completion.
const draft = useOnboardingV3Draft()
const userProfileStore = useSettingsUserProfile()

const DEFAULT_NAMES = new Set(['Richy', 'Richie', 'Dave', 'Maya', 'Elena', 'User', ''])

// Seed draft if not already initialized
if (!draft.state.userName) {
  draft.state.userName = userProfileStore.name || 'Richy'
}
if (!draft.state.userDescription) {
  draft.state.userDescription = userProfileStore.description || 'A hands-on, down-to-earth creator who loves building things from scratch. Prefers honest, direct conversation and cozy downtime after a long day of work.'
}
if (draft.state.userPrompt === undefined) {
  draft.state.userPrompt = userProfileStore.prompt || ''
}

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

const selectedArchetypeId = ref<string | null>(draft.state.selectedUserArchetypeId || null)
const selectedGender = ref<'male' | 'female' | 'non-binary'>(draft.state.userGender || 'male')

const localizedArchetypes = computed(() => USER_ARCHETYPES.map(archetype => ({
  ...archetype,
  label: t(`onboarding.steps.profile.archetypes.${archetype.id}.label`),
  subtitle: t(`onboarding.steps.profile.archetypes.${archetype.id}.subtitle`),
})))

function selectGender(gender: 'male' | 'female' | 'non-binary') {
  selectedGender.value = gender
  if (draft.state) {
    draft.state.userGender = gender
  }
}

function applyArchetype(archetype: UserArchetype) {
  selectedArchetypeId.value = archetype.id

  // Smart name preservation: only overwrite if the name has not been custom-typed
  const currentName = (draft.state.userName || '').trim()
  if (DEFAULT_NAMES.has(currentName)) {
    draft.state.userName = archetype.name
  }

  draft.state.userDescription = archetype.description
  draft.state.userPrompt = archetype.prompt
  draft.state.selectedUserArchetypeId = archetype.id
  selectGender(archetype.gender)
}
</script>

<template>
  <div :class="['h-full w-full max-w-4xl mx-auto flex flex-col justify-between gap-4 select-none animate-fadeIn']">
    <!-- Header -->
    <div
      v-motion
      :initial="{ opacity: 0, y: -6 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :class="['flex-shrink-0']"
    >
      <div :class="['flex items-center justify-between text-xs text-neutral-400 mb-1']">
        <span :class="['text-primary-500 font-semibold']">{{ t('onboarding.steps.profile.step', { current: 5, total: 16 }) }}</span>
        <span :class="['font-medium tracking-wide uppercase']">{{ t('onboarding.steps.profile.eyebrow') }}</span>
      </div>
      <h2 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
        {{ t('onboarding.steps.profile.title') }}
      </h2>
      <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1']">
        {{ t('onboarding.steps.profile.description') }}
      </p>
    </div>

    <!-- Scrollable Workspace -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4']">
      <!-- Companion Advice Bubble -->
      <CompanionBubble
        tone="purple"
        :message="t('onboarding.steps.profile.advice')"
      />

      <!-- Quick Archetype Presets -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="350"
        :delay="100"
        :class="[
          'p-4 rounded-2xl border transition-all',
          'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md flex flex-col gap-3',
        ]"
      >
        <div :class="['flex items-center justify-between']">
          <span :class="['text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400']">
            {{ t('onboarding.steps.profile.archetypeTemplates') }}
          </span>
          <span :class="['text-[11px] text-neutral-400']">{{ t('onboarding.steps.profile.tapToAutofill') }}</span>
        </div>

        <div :class="['grid grid-cols-1 gap-2.5 sm:grid-cols-2']">
          <button
            v-for="archetype in localizedArchetypes"
            :key="archetype.id"
            type="button"
            :class="[
              'relative flex items-center gap-3 border-2 rounded-xl p-3 text-left transition-all duration-200 cursor-pointer',
              selectedArchetypeId === archetype.id
                ? 'border-primary-500 bg-primary-500/10 shadow-sm dark:border-primary-400'
                : 'border-neutral-200/60 bg-white/60 dark:border-neutral-800/80 dark:bg-neutral-900/60 hover:border-primary-500/40',
            ]"
            @click="applyArchetype(archetype)"
          >
            <div
              :class="[
                'h-9 w-9 flex flex-shrink-0 items-center justify-center rounded-lg transition-colors',
                selectedArchetypeId === archetype.id
                  ? 'bg-primary-500 text-white shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
              ]"
            >
              <div :class="[archetype.icon, 'h-5 w-5']" />
            </div>

            <div :class="['min-w-0 flex-1']">
              <div :class="['flex items-center gap-1.5']">
                <span :class="['text-xs text-neutral-800 font-bold dark:text-neutral-100']">
                  {{ displayText(archetype.label) }}
                </span>
                <span
                  :class="[
                    'rounded px-1.5 py-0.2 text-[9px] font-bold uppercase',
                    archetype.gender === 'male'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                  ]"
                >
                  {{ t(`onboarding.steps.profile.gender.${archetype.gender}`) }}
                </span>
              </div>
              <p :class="['truncate text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5']">
                {{ displayText(archetype.subtitle) }}
              </p>
            </div>
          </button>
        </div>
      </div>

      <!-- Manual / Customized Profile Inputs -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="350"
        :delay="150"
        :class="[
          'p-4 rounded-2xl border transition-all',
          'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md flex flex-col gap-4',
        ]"
      >
        <div :class="['flex flex-col gap-1.5']">
          <label :class="['text-xs text-neutral-700 font-bold dark:text-neutral-300']">{{ t('onboarding.steps.profile.userName.label') }}</label>
          <input
            v-model="draft.state.userName"
            type="text"
            :placeholder="t('onboarding.steps.profile.userName.placeholder')"
            :class="[
              'w-full border border-neutral-200 rounded-xl bg-white px-3.5 py-2 text-sm text-neutral-800 outline-none',
              'dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200 transition-colors',
            ]"
          >
          <p :class="['text-[10px] text-neutral-400 italic']">
            {{ t('onboarding.steps.profile.userName.help') }}
          </p>
        </div>

        <div :class="['flex flex-col gap-1.5']">
          <label :class="['text-xs text-neutral-700 font-bold dark:text-neutral-300']">{{ t('onboarding.steps.profile.pronouns.label') }}</label>
          <div :class="['grid grid-cols-3 gap-2']">
            <button
              v-for="opt in [
                { id: 'male', label: t('onboarding.steps.profile.pronouns.he'), sub: 'he/him', icon: 'i-solar:user-bold-duotone' },
                { id: 'female', label: t('onboarding.steps.profile.pronouns.she'), sub: 'she/her', icon: 'i-solar:user-heart-rounded-bold-duotone' },
                { id: 'non-binary', label: t('onboarding.steps.profile.pronouns.they'), sub: 'they/them', icon: 'i-solar:users-group-two-rounded-bold-duotone' },
              ] as const"
              :key="opt.id"
              type="button"
              :class="[
                'flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer text-left',
                selectedGender === opt.id
                  ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold shadow-xs'
                  : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="selectGender(opt.id)"
            >
              <div :class="[opt.icon, 'h-4 w-4 shrink-0']" />
              <div :class="['min-w-0 flex flex-col']">
                <span :class="['text-xs leading-tight']">{{ displayText(opt.label) }}</span>
                <span :class="['text-[10px] font-normal text-neutral-400']">{{ displayText(opt.sub) }}</span>
              </div>
            </button>
          </div>
          <p :class="['text-[10px] text-neutral-400 italic']">
            {{ t('onboarding.steps.profile.pronouns.help') }}
          </p>
        </div>

        <div :class="['flex flex-col gap-1.5']">
          <label :class="['text-xs text-neutral-700 font-bold dark:text-neutral-300']">{{ t('onboarding.steps.profile.userBio.label') }}</label>
          <textarea
            v-model="draft.state.userDescription"
            rows="3"
            :placeholder="t('onboarding.steps.profile.userBio.placeholder')"
            :class="[
              'w-full border border-neutral-200 rounded-xl bg-white px-3.5 py-2 text-sm text-neutral-800 outline-none resize-none',
              'dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200 transition-colors',
            ]"
          />
          <p :class="['text-[10px] text-neutral-400 italic']">
            {{ t('onboarding.steps.profile.userBio.help') }}
          </p>
        </div>

        <div :class="['flex flex-col gap-1.5']">
          <label :class="['text-xs text-neutral-700 font-bold dark:text-neutral-300']">{{ t('onboarding.steps.profile.visualPrompt.label') }}</label>
          <textarea
            v-model="draft.state.userPrompt"
            rows="3"
            :placeholder="t('onboarding.steps.profile.visualPrompt.placeholder')"
            :class="[
              'w-full border border-neutral-200 rounded-xl bg-white px-3.5 py-2 text-sm text-neutral-800 outline-none resize-none font-mono text-xs',
              'dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200 transition-colors',
            ]"
          />
          <p :class="['text-[10px] text-neutral-400 italic']">
            {{ t('onboarding.steps.profile.visualPrompt.help') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <div
      :class="[
        'h-14 border-t border-neutral-200/80 dark:border-neutral-800/80',
        'flex items-center justify-between flex-shrink-0 pt-2',
      ]"
    >
      <button
        type="button"
        :class="[
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer',
          'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          'hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors',
        ]"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        {{ t('onboarding.steps.profile.displayingAs') }} <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ draft.state.userName || 'Richy' }}</span>
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
          'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
        ]"
        @click="props.onNext"
      >
        <span>{{ t('onboarding.shell.next') }}</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>

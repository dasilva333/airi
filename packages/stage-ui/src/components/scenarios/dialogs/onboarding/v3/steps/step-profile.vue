<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AssistantBubble from '../components/assistant-bubble.vue'

import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

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
    icon: 'i-solar:sledgehammer-bold',
    description: 'This is the user. He is wearing dark leather Y-back suspenders over a collarless henley grandfather shirt with rolled-up sleeves.',
    prompt: '(1man, solo, messy brown hair, dark leather Y-back suspenders, olive green collarless henley shirt, rolled-up sleeves, dark canvas work trousers, casual rustic workwear style)',
  },
  {
    id: 'modern-specialist',
    name: 'Dave',
    gender: 'male',
    label: 'Tech Specialist',
    subtitle: 'Sharp suit & wireframe glasses',
    icon: 'i-solar:laptop-bold',
    description: 'An observant tech producer wearing a clean charcoal blazer over a crewneck shirt with sleek spectacles.',
    prompt: '(1man, solo, short dark hair, spectacles, dark charcoal blazer, dark crewneck t-shirt, modern casual techwear, minimalist aesthetic)',
  },
  {
    id: 'creative-artist',
    name: 'Maya',
    gender: 'female',
    label: 'Creative Artist',
    subtitle: 'Cozy cardigan & relaxed aesthetic',
    icon: 'i-solar:palette-bold',
    description: 'A warm and imaginative creative director wearing an oversized beige knit cardigan over a linen top with delicate earrings.',
    prompt: '(1woman, solo, wavy chestnut hair in loose ponytail, oversized cream knit cardigan, white linen camisole, relaxed aesthetic, delicate jewelry)',
  },
  {
    id: 'studio-director',
    name: 'Elena',
    gender: 'female',
    label: 'Studio Director',
    subtitle: 'Navy blazer & executive style',
    icon: 'i-solar:case-round-bold',
    description: 'An ambitious, poised project director wearing a tailored navy blazer, crisp white button-up shirt, and minimalist watch.',
    prompt: '(1woman, solo, straight dark hair, shoulder-length, tailored navy blue blazer, crisp white collared shirt, elegant smart-casual office style)',
  },
]

// Seed draft if not already initialized
if (!draft.state.selectedUserArchetypeId) {
  draft.state.selectedUserArchetypeId = USER_ARCHETYPES[0].id
}
if (!draft.state.userName || draft.state.userName === 'Richy') {
  draft.state.userName = userProfileStore.name === 'Richy' ? 'Richie' : (userProfileStore.name || 'Richie')
}
if (!draft.state.userDescription || draft.state.userDescription.startsWith('A hands-on, down-to-earth creator')) {
  draft.state.userDescription = userProfileStore.description && !userProfileStore.description.startsWith('A hands-on')
    ? userProfileStore.description
    : USER_ARCHETYPES[0].description
}
if (draft.state.userPrompt === undefined || draft.state.userPrompt === '') {
  draft.state.userPrompt = userProfileStore.prompt || USER_ARCHETYPES[0].prompt
}

const selectedArchetypeId = ref<string | null>(draft.state.selectedUserArchetypeId || USER_ARCHETYPES[0].id)
const selectedGender = ref<'male' | 'female' | 'non-binary'>(draft.state.userGender || 'male')

const PRONOUN_OPTIONS = [
  { id: 'male' as const, label: 'he/him', icon: 'i-solar:user-bold' },
  { id: 'female' as const, label: 'she/her', icon: 'i-solar:user-heart-rounded-bold' },
  { id: 'non-binary' as const, label: 'they/them', icon: 'i-solar:users-group-two-rounded-bold' },
]

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

const displayName = computed(() => draft.state.userName?.trim() || 'Richie')
</script>

<template>
  <div :class="['w-full max-w-[1280px] mx-auto h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4']">
      <!-- Shared Centered Header -->
      <div :class="['flex flex-col items-center text-center gap-3']">
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            {{ t('onboarding.steps.profile.title') }}
          </h1>
        </div>

        <AssistantBubble
          :message="t('onboarding.steps.profile.companionGreeting')"
          step-key="profile"
          sticker-id="airi-affectionate"
          tone="primary"
        />
      </div>

      <!-- Centered Two-Column Content Container (~1280px wide) -->
      <div :class="['w-full grid grid-cols-1 lg:grid-cols-[minmax(0,34fr)_minmax(0,66fr)] gap-4 lg:gap-5 items-stretch']">
        <!-- Left Panel: Quick templates -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="300"
          :delay="100"
          :class="[
            'rounded-[20px] border p-5 sm:p-6 transition-all flex flex-col',
            'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <!-- Header -->
          <div>
            <h2 :class="['text-base sm:text-lg font-bold text-neutral-900 dark:text-white']">
              Quick templates
            </h2>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
              Select to fill your profile.
            </p>
          </div>

          <!-- Template Rows -->
          <div :class="['flex flex-col gap-2.5 mt-3.5']">
            <button
              v-for="archetype in USER_ARCHETYPES"
              :key="archetype.id"
              type="button"
              :class="[
                'group relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer',
                selectedArchetypeId === archetype.id
                  ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/25 ring-1 ring-primary-500/50 shadow-xs'
                  : 'border-neutral-200/70 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="applyArchetype(archetype)"
            >
              <!-- Icon Tile -->
              <div
                :class="[
                  'h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-xl transition-colors',
                  selectedArchetypeId === archetype.id
                    ? 'bg-neutral-800 text-white shadow-xs'
                    : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white',
                ]"
              >
                <div :class="[archetype.icon, 'h-5 w-5']" />
              </div>

              <!-- Details -->
              <div :class="['min-w-0 flex-1']">
                <div :class="['flex items-center gap-1.5']">
                  <span :class="['text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate']">
                    {{ archetype.label }}
                  </span>
                  <span
                    :class="[
                      'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                      archetype.gender === 'male'
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                    ]"
                  >
                    {{ archetype.gender }}
                  </span>
                </div>
                <p :class="['truncate text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
                  {{ archetype.subtitle }}
                </p>
              </div>

              <!-- Selection Checkmark -->
              <div
                v-if="selectedArchetypeId === archetype.id"
                :class="['flex items-center justify-center shrink-0 text-primary-500']"
              >
                <div :class="['i-solar:check-circle-bold text-primary-500 h-5 w-5']" />
              </div>
            </button>
          </div>

          <!-- Bottom Helper Note -->
          <p :class="['text-[11px] text-neutral-400 dark:text-neutral-500 italic mt-auto pt-4']">
            Templates are a starting point. Edit any field.
          </p>
        </div>

        <!-- Right Panel: Your profile -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="300"
          :delay="150"
          :class="[
            'rounded-[20px] border p-5 sm:p-6 transition-all flex flex-col',
            'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <!-- Title -->
          <div>
            <h2 :class="['text-base sm:text-lg font-bold text-neutral-900 dark:text-white']">
              Your profile
            </h2>
          </div>

          <!-- Form Fields -->
          <div :class="['flex flex-col gap-4 sm:gap-5 mt-3.5']">
            <!-- Row 1: Name and Pronouns -->
            <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-4 items-start']">
              <!-- Name Input -->
              <div :class="['flex flex-col gap-1.5']">
                <div :class="['flex items-center gap-1.5']">
                  <label for="profile-user-name" :class="['text-sm font-semibold text-neutral-800 dark:text-neutral-200']">
                    {{ t('onboarding.steps.profile.userName.label') }}
                  </label>
                  <PopoverRoot>
                    <PopoverTrigger
                      type="button"
                      :class="[
                        'inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer',
                        'rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500',
                      ]"
                      aria-label="Name information"
                    >
                      <div :class="['i-solar:info-circle-linear h-3.5 w-3.5']" />
                    </PopoverTrigger>
                    <PopoverPortal>
                      <PopoverContent
                        side="top"
                        :side-offset="6"
                        :class="[
                          'z-50 max-w-xs rounded-xl p-3 text-xs leading-relaxed shadow-lg backdrop-blur-md',
                          'border border-neutral-200/90 dark:border-neutral-800/90',
                          'bg-white/95 dark:bg-neutral-900/95 text-neutral-600 dark:text-neutral-300',
                          'animate-in fade-in-0 zoom-in-95',
                        ]"
                      >
                        The default nickname used by imported cards and creator story scripts unless overridden.
                      </PopoverContent>
                    </PopoverPortal>
                  </PopoverRoot>
                </div>

                <input
                  id="profile-user-name"
                  v-model="draft.state.userName"
                  type="text"
                  :placeholder="t('onboarding.steps.profile.userName.placeholder')"
                  :class="[
                    'h-11 w-full border border-neutral-200/90 dark:border-neutral-700/80 rounded-xl bg-white dark:bg-neutral-950/60',
                    'px-3.5 text-sm sm:text-base text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 outline-none',
                    'focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all',
                  ]"
                >
              </div>

              <!-- Pronouns Segmented Control -->
              <div :class="['flex flex-col gap-1.5']">
                <div :class="['flex items-center gap-1.5']">
                  <span :class="['text-sm font-semibold text-neutral-800 dark:text-neutral-200']">
                    Preferred pronouns
                  </span>
                  <PopoverRoot>
                    <PopoverTrigger
                      type="button"
                      :class="[
                        'inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer',
                        'rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500',
                      ]"
                      aria-label="Pronouns information"
                    >
                      <div :class="['i-solar:info-circle-linear h-3.5 w-3.5']" />
                    </PopoverTrigger>
                    <PopoverPortal>
                      <PopoverContent
                        side="top"
                        :side-offset="6"
                        :class="[
                          'z-50 max-w-xs rounded-xl p-3 text-xs leading-relaxed shadow-lg backdrop-blur-md',
                          'border border-neutral-200/90 dark:border-neutral-800/90',
                          'bg-white/95 dark:bg-neutral-900/95 text-neutral-600 dark:text-neutral-300',
                          'animate-in fade-in-0 zoom-in-95',
                        ]"
                      >
                        Shapes third-person narrative pronouns and relationship lore in companion card generation.
                      </PopoverContent>
                    </PopoverPortal>
                  </PopoverRoot>
                </div>

                <div
                  :class="[
                    'h-11 w-full border border-neutral-200/90 dark:border-neutral-700/80 rounded-xl bg-white dark:bg-neutral-950/60 p-1',
                    'flex items-stretch gap-1',
                  ]"
                >
                  <button
                    v-for="opt in PRONOUN_OPTIONS"
                    :key="opt.id"
                    type="button"
                    :class="[
                      'flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      selectedGender === opt.id
                        ? 'border border-primary-500 bg-primary-500/15 text-primary-600 dark:text-primary-300 shadow-xs'
                        : 'border border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5',
                    ]"
                    @click="selectGender(opt.id)"
                  >
                    <div :class="[opt.icon, 'h-3.5 w-3.5 shrink-0']" />
                    <span>{{ opt.label }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Row 2: About you -->
            <div :class="['flex flex-col gap-1.5']">
              <div :class="['flex items-center gap-1.5']">
                <label for="profile-user-bio" :class="['text-sm font-semibold text-neutral-800 dark:text-neutral-200']">
                  About you
                </label>
                <span :class="['text-[11px] text-neutral-400 dark:text-neutral-500 font-medium']">
                  Optional
                </span>
                <PopoverRoot>
                  <PopoverTrigger
                    type="button"
                    :class="[
                      'inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer',
                      'rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500',
                    ]"
                    aria-label="About you information"
                  >
                    <div :class="['i-solar:info-circle-linear h-3.5 w-3.5']" />
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent
                      side="top"
                      :side-offset="6"
                      :class="[
                        'z-50 max-w-xs rounded-xl p-3 text-xs leading-relaxed shadow-lg backdrop-blur-md',
                        'border border-neutral-200/90 dark:border-neutral-800/90',
                        'bg-white/95 dark:bg-neutral-900/95 text-neutral-600 dark:text-neutral-300',
                        'animate-in fade-in-0 zoom-in-95',
                      ]"
                    >
                      A short prose summary helping the cognitive/storyline models understand your role.
                    </PopoverContent>
                  </PopoverPortal>
                </PopoverRoot>
              </div>

              <textarea
                id="profile-user-bio"
                v-model="draft.state.userDescription"
                :placeholder="t('onboarding.steps.profile.userBio.placeholder')"
                :class="[
                  'h-24 w-full border border-neutral-200/90 dark:border-neutral-700/80 rounded-xl bg-white dark:bg-neutral-950/60',
                  'p-3 text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 outline-none resize-none',
                  'focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all leading-relaxed',
                ]"
              />
            </div>

            <!-- Row 3: Visual prompt tags -->
            <div :class="['flex flex-col gap-1.5']">
              <div :class="['flex items-center gap-1.5']">
                <label for="profile-user-prompt" :class="['text-sm font-semibold text-neutral-800 dark:text-neutral-200']">
                  Visual prompt tags
                </label>
                <PopoverRoot>
                  <PopoverTrigger
                    type="button"
                    :class="[
                      'inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer',
                      'rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500',
                    ]"
                    aria-label="Visual prompt tags information"
                  >
                    <div :class="['i-solar:info-circle-linear h-3.5 w-3.5']" />
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent
                      side="top"
                      :side-offset="6"
                      :class="[
                        'z-50 max-w-xs rounded-xl p-3 text-xs leading-relaxed shadow-lg backdrop-blur-md',
                        'border border-neutral-200/90 dark:border-neutral-800/90',
                        'bg-white/95 dark:bg-neutral-900/95 text-neutral-600 dark:text-neutral-300',
                        'animate-in fade-in-0 zoom-in-95',
                      ]"
                    >
                      Stable Diffusion / ComfyUI prompt tags injected when generating scene graphics representing you.
                    </PopoverContent>
                  </PopoverPortal>
                </PopoverRoot>
              </div>

              <textarea
                id="profile-user-prompt"
                v-model="draft.state.userPrompt"
                placeholder="(1man, solo, short dark hair, spectacles, dark charcoal blazer, dark crewneck t-shirt)"
                :class="[
                  'h-24 w-full border border-neutral-200/90 dark:border-neutral-700/80 rounded-xl bg-white dark:bg-neutral-950/60',
                  'p-3 font-mono text-xs sm:text-[13px] text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 outline-none resize-none',
                  'focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all leading-relaxed',
                ]"
              />

              <p :class="['text-[11px] text-neutral-400 dark:text-neutral-500 italic mt-0.5']">
                Used when generating images that represent you.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pinned Navigation Action Bar -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="200"
      :class="[
        'flex-shrink-0 pt-4 flex items-center justify-between border-t border-neutral-200/80 dark:border-white/5',
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

      <div :class="['text-xs text-neutral-400 font-medium']">
        Displaying as: <span :class="['text-neutral-800 dark:text-neutral-100 font-semibold']">{{ displayName }}</span>
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

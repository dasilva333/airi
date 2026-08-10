<script setup lang="ts">
import { ref } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

// V2 onboarding scaffold — Step 4: Soul & Persona. 3-tier picker, all mock.

type TierId = 'presets' | 'hub' | 'wizard'

const activeTier = ref<TierId>('presets')
const selectedPreset = ref('relu')

const tiers: { id: TierId, label: string, icon: string }[] = [
  { id: 'presets', label: 'Starter Cards', icon: 'i-solar:stars-line-bold-duotone' },
  { id: 'hub', label: 'Community Hub', icon: 'i-solar:planet-bold-duotone' },
  { id: 'wizard', label: 'AI Creator', icon: 'i-solar:magic-stick-3-bold-duotone' },
]

const presets = [
  { id: 'relu', name: 'ReLU', tag: 'Empathetic Companion', desc: 'Playful, warm, and devoted — your energetic everyday soul mate.', accent: 'text-pink-500', ring: 'border-pink-500' },
  { id: 'aria', name: 'Dr. Aria', tag: 'Analytical Scientist', desc: 'Scientific precision with a touch of academic flair. Challenges assumptions.', accent: 'text-sky-500', ring: 'border-sky-500' },
  { id: 'lupin', name: 'Lupin', tag: 'Fierce Guardian', desc: 'Loyal, sharp-tongued protector. Keeps you safe and focused.', accent: 'text-amber-500', ring: 'border-amber-500' },
]

const archetypes = ['Tsundere', 'Kuudere', 'Yandere', 'Dandere', 'Deredere']

const hubSources = ['JannyAI', 'Chub AI', 'JanitorAI', 'Risu Realm', 'DataCat']
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-hidden">
    <div class="flex-shrink-0">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Soul & Persona
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Pure personality — bodies come next, and any soul pairs with any form.
      </p>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      message="Well, this is where you choose your companion's personality! This layer isn't permanent — it just changes how she expresses herself."
    />

    <!-- Tier tabs -->
    <div class="flex flex-shrink-0 items-center gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
      <button
        v-for="tier in tiers"
        :key="tier.id"
        :class="[
          'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
          activeTier === tier.id
            ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
        ]"
        @click="activeTier = tier.id"
      >
        <div :class="tier.icon" class="h-4 w-4" />
        {{ tier.label }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      <!-- Tier 1: presets -->
      <div v-if="activeTier === 'presets'" class="flex flex-col gap-3 pb-2">
        <button
          v-for="preset in presets"
          :key="preset.id"
          :class="[
            'flex items-center gap-3 border-2 rounded-xl p-4 text-left transition-all duration-300',
            selectedPreset === preset.id
              ? `${preset.ring} bg-white/60 shadow-lg dark:bg-neutral-900/60`
              : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/40',
          ]"
          @click="selectedPreset = preset.id"
        >
          <div class="h-11 w-11 flex flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div class="i-solar:user-heart-rounded-bold-duotone h-6 w-6" :class="preset.accent" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ preset.name }}</span>
              <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 font-medium dark:bg-neutral-800 dark:text-neutral-400">{{ preset.tag }}</span>
            </div>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {{ preset.desc }}
            </p>
          </div>
          <div
            class="h-5 w-5 flex flex-shrink-0 items-center justify-center border-2 rounded-full"
            :class="selectedPreset === preset.id ? preset.ring : 'border-neutral-300 dark:border-neutral-600'"
          >
            <div v-if="selectedPreset === preset.id" class="h-2.5 w-2.5 rounded-full bg-current" :class="preset.accent" />
          </div>
        </button>

        <!-- Archetype presets (net-new seeds, sourced from the AnimaDex catalog) -->
        <div :class="['p-3 rounded-xl', 'border border-dashed border-neutral-300/80 dark:border-neutral-700/80', 'flex flex-wrap items-center gap-2']">
          <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Anime Archetypes</span>
          <span
            v-for="arch in archetypes"
            :key="arch"
            class="rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] text-purple-600 font-semibold dark:text-purple-400"
          >
            {{ arch }}
          </span>
          <span class="w-full text-[10px] text-neutral-400 italic">Mockup — archetype cards will seed from the AnimaDex catalog.</span>
        </div>
      </div>

      <!-- Tier 2: community hub -->
      <div v-else-if="activeTier === 'hub'" class="flex flex-col gap-3 pb-2">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          Paste a card link or browse sources — downloads are intercepted and imported automatically.
        </p>
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Paste a character card URL…"
            class="flex-1 border border-neutral-200 rounded-xl bg-white px-4 py-2 text-sm outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
          >
          <button class="rounded-xl bg-primary-500 px-4 text-sm text-white font-semibold opacity-60" disabled>
            Import
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div
            v-for="source in hubSources"
            :key="source"
            :class="['flex items-center gap-2', 'border border-neutral-200/60 rounded-xl px-3 py-3', 'bg-white/40 dark:bg-neutral-900/40', 'backdrop-blur-md']"
          >
            <div class="i-solar:download-minimalistic-bold-duotone h-4 w-4 text-indigo-500" />
            <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">{{ source }}</span>
          </div>
        </div>
      </div>

      <!-- Tier 3: AI guided wizard -->
      <div v-else :class="['flex flex-col gap-3 pb-2']">
        <div :class="['p-5 rounded-xl', 'bg-gradient-to-br from-purple-500/10 to-pink-500/10', 'border border-purple-500/20', 'backdrop-blur-md', 'flex flex-col gap-3']">
          <div class="flex items-center gap-2">
            <div class="i-solar:magic-stick-3-bold-duotone h-6 w-6 text-purple-500" />
            <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">AnimaDex Guided Creator</span>
            <span class="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-600 font-bold dark:text-purple-400">USES STEP 2 BRAIN</span>
          </div>
          <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
            Answer a few guided questions and the active LLM synthesizes a complete character card — lore, greeting, and prompts — pre-filled with your Step 3 profile.
          </p>
          <div class="flex flex-col gap-2">
            <div class="border border-purple-500/20 rounded-lg bg-white/50 px-3 py-2 text-xs text-neutral-500 italic dark:bg-neutral-900/50 dark:text-neutral-400">
              "What world does your companion come from?"
            </div>
            <div class="border border-purple-500/20 rounded-lg bg-white/50 px-3 py-2 text-xs text-neutral-500 italic dark:bg-neutral-900/50 dark:text-neutral-400">
              "How does she react when you succeed?"
            </div>
          </div>
          <button class="self-start rounded-lg bg-purple-500 px-4 py-2 text-sm text-white font-semibold opacity-60" disabled>
            Summon Persona (Mock)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

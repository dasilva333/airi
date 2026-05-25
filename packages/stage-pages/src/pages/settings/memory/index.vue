<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { useRouter } from 'vue-router'

const router = useRouter()

const memorySections = [
  {
    accent: 'from-cyan-500/20 to-sky-500/10',
    bullets: [
      'Preserve high quality situational awareness from recent days',
      'Seamless character reload by clearing history while retaining context',
      'Updates daily for active characters to maintain the current window',
      'Powers intelligent context compaction as your conversation grows',
    ],
    description: 'Retains high-quality awareness and rich memories from the last few days—even after a session reset.',
    icon: 'i-solar:alarm-bold-duotone',
    id: 'ephemeral',
    route: '/settings/modules/memory-short-term',
    status: 'Active - 16 turns',
    subtitle: 'Short-Term Memory (STMM)',
    title: 'The Active Pulse',
  },
  {
    accent: 'from-violet-500/20 to-indigo-500/10',
    bullets: [
      'Generates flavor tags and mood highlights when the character is idle',
      'Uses AFK gating so proactive runs do not interrupt active conversation',
      'Distills highlights after the 1-hour session timeout threshold',
      'Processes up to 4 core conversation sessions per day',
    ],
    description: "AIRI consolidates long conversations into interpretive tags and highlights while you're away.",
    icon: 'i-solar:bolt-bold-duotone',
    id: 'signals',
    route: '/settings/modules/memory-signals',
    status: 'Idle-Gated',
    subtitle: 'The Dream State (Chips)',
    title: 'The Echoes',
  },
  {
    accent: 'from-emerald-500/20 to-teal-500/10',
    bullets: [
      'A dedicated tool you can ask the character to use on-demand',
      'Record and search through durable, high-fidelity narrative memories',
      'Powerhouse for deep semantic recall and relational grounding',
      'Stores your personal "Sacred Records" in a human-readable format',
    ],
    description:
      'The Sacred Records. Ask your character to use their "text_journal" to preserve meaningful moments forever.',
    icon: 'i-solar:notebook-bookmark-bold-duotone',
    id: 'episodic',
    route: '/settings/modules/memory-long-term',
    status: '9 Records Stored',
    subtitle: 'Episodic Records (LTMM)',
    title: "The Sentinel's Journal",
  },
  {
    accent: 'from-amber-500/20 to-orange-500/10',
    bullets: [
      'Stable base for long-horizon memory',
      'Incremental updates from new durable events',
      'Updates from a base plus daily changes',
      'Preserves relationship identity across resets',
    ],
    description:
      'The long-term memory of the relationship. It keeps the bond stable across resets and slowly updates as new durable moments arrive.',
    icon: 'i-solar:dna-bold-duotone',
    id: 'relational',
    route: '/settings/modules/memory-lifetime',
    status: 'Base Stable',
    subtitle: 'Relational Essence (Lifetime)',
    title: 'The Eternal Thread',
  },
]
</script>

<template>
  <div class="font-urbanist flex flex-col gap-6">
    <!-- Neurological Header -->
    <div class="border border-neutral-200 rounded-3xl bg-neutral-100/40 p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="mb-5 flex flex-col gap-4 md:flex-row md:items-center">
        <div class="h-16 w-16 flex items-center justify-center rounded-2xl bg-primary-500/10 shadow-inner">
          <div class="i-solar:star-bold-duotone inline-block text-4xl text-primary-500" />
        </div>
        <div>
          <h1 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
            Memory Hub
          </h1>
          <p class="max-w-2xl text-sm text-neutral-500 line-height-relaxed dark:text-neutral-400">
            AIRI’s nervous system is split into four distinct temporal quadrants. By segmenting ephemeral reactions from the eternal relational thread, we ensure identity stays stable even as the conversation flows.
          </p>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-4">
        <div class="border border-neutral-200/50 rounded-2xl bg-white/50 p-4 transition-all dark:border-neutral-700/50 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50">
          <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            System Integrity
          </div>
          <div class="flex items-center gap-2 text-sm text-neutral-700 font-semibold dark:text-neutral-200">
            <div class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            98.4%
          </div>
        </div>
        <div class="border border-neutral-200/50 rounded-2xl bg-white/50 p-4 transition-all dark:border-neutral-700/50 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50">
          <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            Total Depth
          </div>
          <div class="text-sm text-neutral-700 font-semibold dark:text-neutral-200">
            42,109 Tokens
          </div>
        </div>
        <div class="border border-neutral-200/50 rounded-2xl bg-white/50 p-4 transition-all dark:border-neutral-700/50 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50">
          <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            Update Logic
          </div>
          <div class="text-sm text-neutral-700 font-semibold dark:text-neutral-200">
            Base + Daily Diffs
          </div>
        </div>
        <div class="border border-neutral-200/50 rounded-2xl bg-white/50 p-4 transition-all dark:border-neutral-700/50 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50">
          <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            Architecture
          </div>
          <div class="text-sm text-neutral-700 font-semibold dark:text-neutral-200">
            Character-Centric
          </div>
        </div>
      </div>
    </div>

    <!-- The Four Quads -->
    <div class="grid gap-4 lg:grid-cols-2 md:grid-cols-2">
      <section
        v-for="section in memorySections"
        :key="section.id"
        class="group relative overflow-hidden border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm transition-all dark:border-neutral-800 dark:bg-neutral-900/60 hover:shadow-xl"
      >
        <!-- Background Accent Glow -->
        <div :class="['absolute -right-4 -top-4 h-32 w-32 rounded-full bg-gradient-to-br blur-3xl opacity-20 transition-all group-hover:opacity-40', section.accent]" />

        <div class="relative z-10 h-full flex flex-col">
          <div class="mb-6 flex items-start justify-between">
            <div :class="['h-12 w-12 flex items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm', section.accent]">
              <div :class="[section.icon, 'text-2xl text-primary-500 inline-block']" />
            </div>
            <div :class="['flex items-center gap-1.5 border border-neutral-200/50 rounded-full bg-neutral-50 px-3 py-1 text-[10px] font-bold tracking-tight uppercase dark:border-neutral-700/50 dark:bg-neutral-800/50', section.id === 'ephemeral' ? 'text-cyan-500' : section.id === 'relational' ? 'text-amber-500' : section.id === 'signals' ? 'text-violet-500' : 'text-emerald-500']">
              <div :class="['h-1.5 w-1.5 rounded-full', section.id === 'ephemeral' ? 'animate-ping bg-cyan-500' : section.id === 'relational' ? 'bg-amber-500' : section.id === 'signals' ? 'bg-violet-500' : 'bg-emerald-500']" />
              {{ section.status }}
            </div>
          </div>

          <div class="mb-4">
            <h3 class="text-xs text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
              {{ section.subtitle }}
            </h3>
            <h2 class="mb-1 text-xl text-neutral-800 font-bold dark:text-neutral-100">
              {{ section.title }}
            </h2>
            <p class="text-sm text-neutral-500 line-height-relaxed dark:text-neutral-400">
              {{ section.description }}
            </p>
          </div>

          <div class="mb-8 flex-grow">
            <ul class="grid gap-2.5">
              <li
                v-for="bullet in section.bullets"
                :key="bullet"
                class="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-300"
              >
                <div class="i-solar:check-circle-bold-duotone text-lg text-primary-500/60" />
                {{ bullet }}
              </li>
            </ul>
          </div>

          <div class="mt-auto border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <Button
              :label="`Explore ${section.title}`"
              icon="i-solar:arrow-right-up-bold-duotone"
              variant="secondary"
              block
              class="group/btn"
              @click="router.push(section.route)"
            />
          </div>
        </div>
      </section>
    </div>

    <!-- Handoff Note (Review Goal) -->
    <div class="mt-4 border border-primary-500/20 rounded-3xl border-dashed bg-primary-500/5 p-6 dark:border-primary-400/20 dark:bg-primary-400/5">
      <div class="mb-3 flex items-center gap-3">
        <div class="i-solar:star-bold-duotone text-xl text-primary-500" />
        <h3 class="text-sm text-primary-600 font-bold tracking-wide uppercase dark:text-primary-400">
          Core Handoff Note
        </h3>
      </div>
      <p class="max-w-3xl text-sm text-neutral-700 line-height-relaxed dark:text-neutral-200">
        This quadrant redesign validates the "Face" of the memory engine architecture. It segments fluid session context (Pulse) from relationship-wide essence (Eternal Thread). The Signal quadrant is explicitly gated by AFK proactivity rules to ensure semantic drift doesn't occur during active dialogue.
      </p>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.memory.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.memory.description
  icon: i-solar:leaf-bold-duotone
  settingsEntry: true
  order: 5
  stageTransition:
    name: slide
</route>

<script setup lang="ts">
import type { SpeechCapabilitiesInfo } from '@proj-airi/stage-ui/stores/providers'

import { FieldInput } from '@proj-airi/ui'

const props = defineProps<{
  actingModelEmotionOptions: string[]
  actingModelMotionOptions: string[]
  actingGroupedExpressionTags: { category: string, tags: { tag: string, description?: string }[] }[]
  actingMannerismOptions: NonNullable<SpeechCapabilitiesInfo['mannerisms']>
  actingSpeechCapabilitiesLoading: boolean
  selectedSpeechProviderLabel: string
  isVrmaExpression: (name: string) => boolean
  isLive2d: boolean
  insertModelEmotion: (name: string) => void
  insertModelMotion: (name: string) => void
  insertModelVfx?: (name: string) => void
  insertSpeechTag: (tag: string, description?: string) => void
  insertSpeechMannerism: (id: string) => void
  actingIdleAnimationOptions: { label: string, value: string }[]
}>()

const emit = defineEmits<{
  (e: 'sparkle-click', fieldId: string): void
}>()

const selectedActingModelExpressionPrompt = defineModel<string>('selectedActingModelExpressionPrompt', { required: true })
const selectedActingSpeechExpressionPrompt = defineModel<string>('selectedActingSpeechExpressionPrompt', { required: true })
const selectedActingSpeechMannerismPrompt = defineModel<string>('selectedActingSpeechMannerismPrompt', { required: true })
const selectedActingIdleAnimations = defineModel<string[]>('selectedActingIdleAnimations', { required: true })

function toggleIdleAnimation(name: string) {
  if (selectedActingIdleAnimations.value.includes(name)) {
    selectedActingIdleAnimations.value = selectedActingIdleAnimations.value.filter(n => n !== name)
  }
  else {
    selectedActingIdleAnimations.value = [...selectedActingIdleAnimations.value, name]
  }
}

const FALLBACK_MOOD_TAGS = [
  { tag: 'happy', description: 'Happy / Joy / Laugh / Grin / Smile' },
  { tag: 'flustered', description: 'Flustered / Blush / Shy / Heart-Curl Tail' },
  { tag: 'angry', description: 'Angry / Mad / Annoy / Jagged Starburst & Anger Mark 💢' },
  { tag: 'surprised', description: 'Surprise / Shock / Gasp / Impact Flash' },
  { tag: 'thinking', description: 'Thinking / Ponder / Cloud Bubble & Thought Dots' },
  { tag: 'sad', description: 'Sad / Cry / Sorrow / Drooping Tail & Raindrops' },
  { tag: 'yandere', description: 'Yandere / Possessive / Vignette & Heartbeat Pulse' },
  { tag: 'sleepy', description: 'Sleepy / Tired / Yawn / Floating Fireflies' },
]

const CAPTION_FX_STRUCTURAL_TAGS = [
  { snippet: 'u-um...', tag: 'Stutter', description: 'Flustered ➔ Blush Wash, Sweat Drop & Wobble' },
  { snippet: '(hmm... what if...)', tag: 'Parenthetical Aside', description: 'Inner Monologue ➔ Scalloped Cloud & Thought Dots' },
  { snippet: 'WHAT?! No way!!', tag: 'Punctuation Spike', description: 'Shock ➔ Impact Burst & Spring Scale Punch' },
  { snippet: 'Nya~ meow!', tag: 'Cat Speech', description: 'Playful ➔ Dynamic Wagging Tail' },
  { snippet: 'belong to me... 🖤', tag: 'Yandere Cue', description: 'Possessive ➔ Dark Vignette & Heartbeat Outline Pulse' },
]

const ELEMENTAL_VFX_OPTIONS = [
  { key: 'fire', label: '🔥 Fire Boost', token: '<|ACT:vfx="fire"|>', desc: 'Molten cinder fracture ground decal, bone-tethered ascending flame tongues & rising ember sparks.' },
  { key: 'electric', label: '⚡ Electric Boost', token: '<|ACT:vfx="electric"|>', desc: 'Concentric high-voltage discharge ground ring, biological Fresnel rim & crackling arc sparks.' },
  { key: 'magic', label: '✨ Magic Boost', token: '<|ACT:vfx="magic"|>', desc: 'Rotating arcane rune seal, ascending double-helical ribbons & floating starlight motes.' },
  { key: 'verdant', label: '🍃 Verdant Boost', token: '<|ACT:vfx="verdant"|>', desc: 'Sacred 8-fold lotus blossom mandala, creeping vine field & drifting bio-spores.' },
]

function onInsertVfx(vfxKey: string) {
  if (props.insertModelVfx) {
    props.insertModelVfx(vfxKey)
  }
  else {
    const line = `- <|ACT:vfx="${vfxKey}"|>`
    if (selectedActingModelExpressionPrompt.value?.includes(line))
      return
    const suffix = selectedActingModelExpressionPrompt.value?.endsWith('\n') || !selectedActingModelExpressionPrompt.value ? '' : '\n'
    selectedActingModelExpressionPrompt.value = `${selectedActingModelExpressionPrompt.value || ''}${suffix}${line}\n`
  }
}
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95%">
    <p class="mb-3 text-sm text-neutral-500">
      Author helper-backed prompt instructions for model expressions, speech tags, and speech mannerisms. These fields are injected into AIRI's prompt builder, while the helpers below reflect the currently loaded model and selected speech provider.
    </p>

    <div class="input-list ml-auto mr-auto w-90% flex flex-col gap-8">
      <div class="border border-neutral-200 rounded-xl p-4 dark:border-neutral-700">
        <div class="mb-1 text-sm text-neutral-800 font-medium dark:text-neutral-200">
          Idle Loop / Cycle Animations
        </div>
        <div class="mb-3 text-xs text-neutral-500">
          Pick from the animations available which ones you would like for your character to cycle through automatically. You may pick just one if you want it to have a default set idle loop.
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in actingIdleAnimationOptions"
              :key="opt.value"
              class="flex items-center gap-1 border rounded-full px-3 py-1 text-xs outline-none transition-colors"
              :class="[
                selectedActingIdleAnimations.includes(opt.value)
                  ? 'bg-primary-50/50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 border-primary-200/50'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-primary-400 hover:text-primary-500',
              ]"
              @click="toggleIdleAnimation(opt.value)"
            >
              <div class="i-solar:running-bold-duotone text-[10px]" />
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="border border-neutral-200 rounded-xl p-4 dark:border-neutral-700">
        <div class="max-w-full">
          <label class="flex flex-col gap-4">
            <div>
              <div class="flex items-center gap-1 text-sm font-medium">
                ACT / Model Expressions & Capabilities
              </div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400">
                Teach AIRI how to emit ACT tokens for avatar emotions/outfits and motion cues.
              </div>
            </div>
            <div class="relative w-full">
              <textarea
                v-model="selectedActingModelExpressionPrompt"
                rows="6"
                placeholder="ACT / Model Expressions"
                class="focus:primary-300 dark:focus:primary-400/50 text-disabled:neutral-400 dark:text-disabled:neutral-600 cursor-disabled:not-allowed w-full border-2 border-neutral-100 rounded-lg border-solid bg-neutral-50 py-1.5 pl-2 pr-9 text-sm shadow-sm outline-none transition-all duration-200 ease-in-out dark:border-neutral-900 dark:bg-neutral-950 focus:bg-neutral-50 dark:focus:bg-neutral-900"
              />
              <button
                type="button"
                style="position: absolute; top: 8px; right: 8px; z-index: 50; display: flex; height: 32px; width: 32px; align-items: center; justify-content: center; border-radius: 8px; border: none; cursor: pointer; background: transparent;"
                class="text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary-500 dark:hover:bg-neutral-800 dark:hover:text-primary-400"
                title="Optimize with AI"
                @click.prevent="emit('sparkle-click', 'actingModelExpression')"
              >
                <span i-ph:sparkle class="i-ph:sparkle animate-pulse text-lg" style="display: inline-block; width: 1.2em; height: 1.2em;" />
              </button>
            </div>
          </label>
        </div>
        <div class="mt-4 flex flex-col gap-4">
          <!-- Emotions & Outfits Section -->
          <div class="flex flex-col gap-2">
            <div class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
              🎨 Emotions & Outfits <span v-if="actingModelEmotionOptions.length">({{ actingModelEmotionOptions.length }})</span>
            </div>
            <div v-if="actingModelEmotionOptions.length" class="flex flex-wrap gap-2">
              <button
                v-for="name in actingModelEmotionOptions"
                :key="name"
                class="flex items-center gap-1 border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                @click="insertModelEmotion(name)"
              >
                <div class="i-solar:palette-bold-duotone text-[10px]" />
                {{ name }}
              </button>
            </div>
            <div v-else class="text-xs text-neutral-400 italic">
              No emotion/outfit variants surfaced for this model.
            </div>
          </div>

          <!-- Motions & Animations Section -->
          <div class="flex flex-col gap-2">
            <div class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
              🏃 Motions & Animations <span v-if="actingModelMotionOptions.length">({{ actingModelMotionOptions.length }})</span>
            </div>
            <div v-if="actingModelMotionOptions.length" class="flex flex-wrap gap-2">
              <button
                v-for="name in actingModelMotionOptions"
                :key="name"
                class="flex items-center gap-1 border border-primary-200/50 rounded-full bg-primary-50/50 px-3 py-1 text-xs text-primary-700 transition-colors dark:border-primary-900/40 hover:border-primary-400 dark:bg-primary-900/20 dark:text-primary-300 hover:text-primary-500"
                @click="insertModelMotion(name)"
              >
                <div class="i-solar:running-bold-duotone text-[10px]" />
                {{ name }}
              </button>
            </div>
            <div v-else class="text-xs text-neutral-400 italic">
              No motion cues surfaced for this model.
            </div>
          </div>

          <!-- Elemental VFX & Auras Section -->
          <div v-if="!isLive2d" class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs text-neutral-600 font-medium dark:text-neutral-300">
              <div class="flex items-center gap-1.5">
                <div class="i-solar:fire-bold-duotone text-orange-500" />
                <span>✨ Elemental VFX & Auras (3D / VRM / MMD)</span>
              </div>
              <span class="text-[10px] text-neutral-400 font-normal">Kinetic Auras & Ground Decals</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="vfx in ELEMENTAL_VFX_OPTIONS"
                :key="vfx.key"
                class="flex cursor-pointer items-center gap-1.5 border border-orange-200/50 rounded-full bg-orange-50/40 px-3 py-1 text-xs text-orange-800 transition-colors dark:border-orange-900/40 hover:border-orange-400 dark:bg-orange-950/20 dark:text-orange-300 hover:text-orange-600"
                :title="vfx.desc"
                @click="onInsertVfx(vfx.key)"
              >
                <span>{{ vfx.label }}</span>
                <span class="text-[10px] font-mono opacity-70">{{ vfx.token }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="border border-neutral-200 rounded-xl p-4 dark:border-neutral-700">
        <div class="max-w-full">
          <label class="flex flex-col gap-4">
            <div>
              <div class="flex items-center gap-1 text-sm font-medium">
                Speech Tags / Audio Expressions
              </div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400">
                Teach AIRI how to use provider-side vocal tags when the selected speech provider supports them.
              </div>
            </div>
            <div class="relative w-full">
              <textarea
                v-model="selectedActingSpeechExpressionPrompt"
                rows="6"
                placeholder="Speech Tags / Audio Expressions"
                class="focus:primary-300 dark:focus:primary-400/50 text-disabled:neutral-400 dark:text-disabled:neutral-600 cursor-disabled:not-allowed w-full border-2 border-neutral-100 rounded-lg border-solid bg-neutral-50 py-1.5 pl-2 pr-9 text-sm shadow-sm outline-none transition-all duration-200 ease-in-out dark:border-neutral-900 dark:bg-neutral-950 focus:bg-neutral-50 dark:focus:bg-neutral-900"
              />
              <button
                type="button"
                style="position: absolute; top: 8px; right: 8px; z-index: 50; display: flex; height: 32px; width: 32px; align-items: center; justify-content: center; border-radius: 8px; border: none; cursor: pointer; background: transparent;"
                class="text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary-500 dark:hover:bg-neutral-800 dark:hover:text-primary-400"
                title="Optimize with AI"
                @click.prevent="emit('sparkle-click', 'actingSpeechExpression')"
              >
                <span i-ph:sparkle class="i-ph:sparkle animate-pulse text-lg" style="display: inline-block; width: 1.2em; height: 1.2em;" />
              </button>
            </div>
          </label>
        </div>
        <div class="mt-3 flex flex-col gap-3">
          <div class="text-xs text-neutral-500">
            Speech tag helpers for provider
            <span class="text-neutral-700 font-medium dark:text-neutral-200">{{ selectedSpeechProviderLabel }}</span>
          </div>
          <div v-if="actingSpeechCapabilitiesLoading" class="text-xs text-neutral-400">
            Loading speech capability helpers...
          </div>
          <div v-else-if="actingGroupedExpressionTags.length" class="flex flex-col gap-3">
            <div v-for="group in actingGroupedExpressionTags" :key="group.category" class="flex flex-col gap-2">
              <div class="text-xs text-neutral-500 tracking-wide uppercase">
                {{ group.category }}
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tag in group.tags"
                  :key="`${group.category}:${tag.tag}`"
                  class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                  :title="tag.description || tag.tag"
                  @click="insertSpeechTag(tag.tag, tag.description)"
                >
                  [{{ tag.tag }}]
                </button>
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col gap-3">
            <div class="border border-primary-200/60 rounded-lg bg-primary-50/40 p-2.5 text-xs text-primary-900/80 dark:border-primary-800/40 dark:bg-primary-950/30 dark:text-primary-200">
              💡 <strong>Head-Tethered Caption FX:</strong> AIRI's live speech bubble dynamically morphs its vector shape, wags its tail, and renders WebGL ambient effects (hearts, rain, scanlines, starbursts) from these cues!
            </div>

            <div class="flex flex-col gap-1.5">
              <div class="text-xs text-neutral-400 font-medium">
                Bracket Mood Tags
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="item in FALLBACK_MOOD_TAGS"
                  :key="item.tag"
                  class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                  :title="item.description"
                  @click="insertSpeechTag(item.tag, item.description)"
                >
                  [{{ item.tag }}]
                </button>
              </div>
            </div>

            <div class="mt-1 flex flex-col gap-1.5">
              <div class="text-xs text-neutral-400 font-medium">
                Structural & Punctuation Cues
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="item in CAPTION_FX_STRUCTURAL_TAGS"
                  :key="item.tag"
                  class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                  :title="item.description"
                  @click="insertSpeechTag(item.snippet, item.description)"
                >
                  {{ item.tag }}: <span class="font-mono opacity-80">{{ item.snippet }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="border border-neutral-200 rounded-xl p-4 dark:border-neutral-700">
        <FieldInput
          v-model="selectedActingSpeechMannerismPrompt"
          label="Speech Mannerisms"
          description="Teach AIRI when to use provider-supported speech mannerisms without exposing the raw transformation internals."
          :single-line="false"
        />
        <div class="mt-3 flex flex-col gap-3">
          <div class="text-xs text-neutral-500">
            Insert helper blurbs from the current speech provider
          </div>
          <div v-if="actingMannerismOptions.length" class="flex flex-wrap gap-2">
            <button
              v-for="item in actingMannerismOptions"
              :key="item.id"
              class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
              :title="item.description || item.label"
              @click="insertSpeechMannerism(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
          <div v-else class="text-xs text-neutral-400">
            No provider-side mannerism helpers are currently available for this speech provider.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

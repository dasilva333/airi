<script setup lang="ts">
import type { Live2dCapabilities } from '../../interpreter'

import { useIntervalFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useLive2dTranslator } from '../../composables/use-live2d-translator'
import { introspectCapabilities } from '../../interpreter'

interface Props {
  model?: any
  modelId?: string
  modelTitle?: string
  modelFormat?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelId: 'model',
  modelTitle: 'Active Model',
  modelFormat: 'model3',
  disabled: false,
})

const modelIdRef = computed(() => props.modelId || 'model')
const { languageMode, isTranslating, resolve, translateMissing } = useLive2dTranslator(modelIdRef)

const activeCostume = ref<string>('Default')
const dslState = ref<any>(null)
const localSliderValues = ref<Record<string, number>>({})
const toastMessage = ref<{ title: string, body: string } | null>(null)
let toastTimer: any = null

function showToast(title: string, body: string) {
  if (toastTimer)
    clearTimeout(toastTimer)
  toastMessage.value = { title, body }
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 3500)
}

// Poll DSL state from the model instance
useIntervalFn(() => {
  if (props.model?.getDslState) {
    dslState.value = props.model.getDslState()
  }
}, 200)

// Introspected capabilities
const capabilities = computed<Live2dCapabilities>(() => {
  const groups = props.model?.getCapturedDslGroups?.() || []
  const rawSettings = props.model?.getRawSettings?.() || undefined
  const currentVars = dslState.value?.varFloats || {}
  const intimacyRaw = dslState.value?.intimacyRaw || 0

  return introspectCapabilities(groups, rawSettings, currentVars, intimacyRaw)
})

// Initialize slider values when capabilities update
watch(() => capabilities.value.parts, (parts) => {
  for (const part of parts) {
    if (localSliderValues.value[part.name] === undefined) {
      localSliderValues.value[part.name] = part.value
    }
  }
}, { immediate: true })

// Action handlers
function handleCostumeSelect(costumeFile: string) {
  activeCostume.value = costumeFile
  if (props.model?.dispatchDsl) {
    props.model.dispatchDsl(`change_cos ${costumeFile}`)
  }
  showToast('Costume Changed', `Selected wardrobe: ${costumeFile}`)
}

function handleSwitchToggle(varName: string, currentVal: number) {
  const nextVal = currentVal > 0 ? 0 : 1
  if (props.model?.setVarFloat) {
    props.model.setVarFloat(varName, nextVal)
  }
  showToast('Switch Toggled', `${varName} = ${nextVal}`)
}

function handleSliderInput(partName: string, id: string, val: number) {
  localSliderValues.value[partName] = val
  if (props.model?.setParamValue) {
    props.model.setParamValue(id, val)
  }
}

function handleChoiceSelect(idx: number, optText: string, nextMtn?: string) {
  if (props.model?.selectDslChoice) {
    props.model.selectDslChoice(idx)
  }
  else if (nextMtn && props.model?.dispatchDsl) {
    props.model.dispatchDsl(nextMtn)
  }
  showToast('Choice Selected', `Dispatched option: "${optText}"`)
}

function handleReactionTrigger(reaction: any) {
  if (props.model?.dispatchDsl) {
    props.model.dispatchDsl(reaction.group)
  }
  showToast('Reaction Triggered', `"${resolve(reaction.text).main}"`)
}

// Translate all strings currently discovered on this model
async function handleTranslateAll() {
  const stringsToTranslate: string[] = []
  for (const r of capabilities.value.reactions) {
    if (r.text)
      stringsToTranslate.push(r.text)
  }
  for (const c of capabilities.value.choices) {
    if (c.text)
      stringsToTranslate.push(c.text)
    for (const opt of c.choices) {
      if (opt.text)
        stringsToTranslate.push(opt.text)
    }
  }
  for (const p of capabilities.value.parts) {
    if (p.name)
      stringsToTranslate.push(p.name)
  }
  for (const s of capabilities.value.switches) {
    if (s.name)
      stringsToTranslate.push(s.name)
  }

  const count = await translateMissing(stringsToTranslate)
  showToast('Translation Complete', `Translated ${count} new labels to English.`)
}
</script>

<template>
  <div class="text-xs space-y-4">
    <!-- Header Controls: Title & Language Toggle -->
    <div class="flex flex-wrap items-center justify-between gap-2 border border-neutral-800 rounded-lg bg-neutral-900/80 p-3">
      <div>
        <div class="flex items-center gap-1.5">
          <span class="rounded bg-primary-500/20 px-1.5 py-0.5 text-[10px] text-primary-300 font-semibold uppercase">
            Gimmick Deck
          </span>
          <span class="text-[10px] text-neutral-400 font-mono">
            {{ modelFormat.toUpperCase() }}
          </span>
        </div>
        <h3 class="mt-0.5 text-sm text-neutral-100 font-bold">
          {{ modelTitle }}
        </h3>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- Language Segmented Picker -->
        <div class="flex border border-neutral-700 rounded bg-neutral-950 p-0.5 text-[10px]">
          <button
            :class="['px-2 py-0.5 rounded font-medium transition-colors', languageMode === 'bilingual' ? 'bg-neutral-800 text-cyan-300' : 'text-neutral-400 hover:text-neutral-200']"
            @click="languageMode = 'bilingual'"
          >
            Bilingual
          </button>
          <button
            :class="['px-2 py-0.5 rounded font-medium transition-colors', languageMode === 'en_only' ? 'bg-neutral-800 text-cyan-300' : 'text-neutral-400 hover:text-neutral-200']"
            @click="languageMode = 'en_only'"
          >
            EN
          </button>
          <button
            :class="['px-2 py-0.5 rounded font-medium transition-colors', languageMode === 'raw' ? 'bg-neutral-800 text-cyan-300' : 'text-neutral-400 hover:text-neutral-200']"
            @click="languageMode = 'raw'"
          >
            Raw
          </button>
        </div>

        <!-- Translate Button -->
        <button
          class="flex items-center gap-1 border border-cyan-500/30 rounded bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300 font-medium transition-colors hover:bg-cyan-500/20 disabled:opacity-40"
          :disabled="isTranslating"
          @click="handleTranslateAll"
        >
          <div v-if="isTranslating" class="i-svg-spinners:ring-resize text-xs" />
          <div v-else class="i-solar:global-bold text-xs" />
          <span>{{ isTranslating ? 'Translating...' : 'Translate' }}</span>
        </button>
      </div>
    </div>

    <!-- Wardrobe & Costumes -->
    <section v-if="capabilities.costumes.length" class="border border-neutral-800 rounded-lg bg-neutral-900/50 p-3">
      <div class="mb-2 flex items-center justify-between text-purple-400">
        <h4 class="flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
          <span>👗</span>
          <span>Wardrobe &amp; Costumes ({{ capabilities.costumes.length }})</span>
        </h4>
        <span class="text-[9px] text-neutral-500 font-mono">change_cos</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="cos in capabilities.costumes"
          :key="cos.file"
          :class="[
            'px-2.5 py-1 rounded text-xs transition-colors border flex items-center gap-1 font-mono',
            activeCostume === cos.file
              ? 'bg-purple-500/20 border-purple-500/60 text-purple-200 font-semibold'
              : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:border-purple-400',
          ]"
          @click="handleCostumeSelect(cos.file)"
        >
          <span class="text-[9px]">{{ activeCostume === cos.file ? '●' : '○' }}</span>
          <span>{{ cos.file }}</span>
        </button>
      </div>
    </section>

    <!-- Switches & Feature Flags (VarFloats) -->
    <section v-if="capabilities.switches.length" class="border border-neutral-800 rounded-lg bg-neutral-900/50 p-3">
      <div class="mb-2 flex items-center justify-between text-sky-400">
        <h4 class="flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
          <span>🎛️</span>
          <span>Feature Switches ({{ capabilities.switches.length }})</span>
        </h4>
        <span class="text-[9px] text-neutral-500 font-mono">VarFloats</span>
      </div>
      <div class="divide-y divide-neutral-800/60">
        <div
          v-for="sw in capabilities.switches"
          :key="sw.name"
          class="flex items-center justify-between py-1.5"
        >
          <div>
            <div class="text-xs text-neutral-200 font-medium">
              {{ resolve(sw.name).main }}
            </div>
            <div v-if="resolve(sw.name).sub" class="text-[10px] text-neutral-500">
              ({{ resolve(sw.name).sub }})
            </div>
            <div v-if="sw.code" class="text-[9px] text-neutral-500 font-mono">
              {{ sw.code }}
            </div>
          </div>

          <button
            :class="[
              'w-9 h-5 rounded-full relative transition-colors border',
              (dslState?.varFloats?.[sw.name] ?? sw.currentValue) > 0
                ? 'bg-sky-500 border-sky-400'
                : 'bg-neutral-800 border-neutral-700',
            ]"
            @click="handleSwitchToggle(sw.name, dslState?.varFloats?.[sw.name] ?? sw.currentValue)"
          >
            <span
              :class="[
                'absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform',
                (dslState?.varFloats?.[sw.name] ?? sw.currentValue) > 0 ? 'translate-x-4' : 'translate-x-0',
              ]"
            />
          </button>
        </div>
      </div>
    </section>

    <!-- Part Controllers & Sliders -->
    <section v-if="capabilities.parts.length" class="border border-neutral-800 rounded-lg bg-neutral-900/50 p-3">
      <div class="mb-2 flex items-center justify-between text-amber-400">
        <h4 class="flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
          <span>🎚️</span>
          <span>Accessories &amp; Parts ({{ capabilities.parts.length }})</span>
        </h4>
        <span class="text-[9px] text-neutral-500 font-mono">ParamValue</span>
      </div>
      <div class="space-y-2.5">
        <div
          v-for="part in capabilities.parts"
          :key="part.name"
          class="space-y-1"
        >
          <div class="flex items-baseline justify-between text-xs">
            <span class="text-neutral-200 font-medium">
              {{ resolve(part.name).main }}
              <span v-if="resolve(part.name).sub" class="text-[10px] text-neutral-500">
                ({{ resolve(part.name).sub }})
              </span>
            </span>
            <span class="text-xs text-amber-400 font-bold font-mono">
              {{ (localSliderValues[part.name] ?? part.value).toFixed(2) }}
            </span>
          </div>
          <input
            type="range"
            :min="part.min"
            :max="part.max"
            :step="part.step"
            :value="localSliderValues[part.name] ?? part.value"
            class="h-1.5 w-full cursor-pointer accent-amber-500"
            @input="handleSliderInput(part.name, part.ids[0] || part.name, parseFloat(($event.target as HTMLInputElement).value))"
          >
        </div>
      </div>
    </section>

    <!-- Interactive Dialogue Menus (Choices) -->
    <section v-if="capabilities.choices.length" class="border border-neutral-800 rounded-lg bg-neutral-900/50 p-3">
      <div class="mb-2 flex items-center justify-between text-indigo-400">
        <h4 class="flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
          <span>🌳</span>
          <span>Dialogue Menus ({{ capabilities.choices.length }})</span>
        </h4>
        <span class="text-[9px] text-neutral-500 font-mono">Choices</span>
      </div>
      <div class="space-y-3">
        <div
          v-for="(tree, tIdx) in capabilities.choices"
          :key="tIdx"
          class="rounded bg-neutral-950/60 p-2 space-y-1.5"
        >
          <div v-if="tree.text" class="text-xs text-neutral-300 font-medium italic">
            "{{ resolve(tree.text).main }}"
            <span v-if="resolve(tree.text).sub" class="text-[10px] text-neutral-500 not-italic">
              ({{ resolve(tree.text).sub }})
            </span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="(opt, oIdx) in tree.choices"
              :key="oIdx"
              class="border border-neutral-700 rounded bg-neutral-900 px-2.5 py-1 text-xs text-neutral-200 transition-colors hover:border-indigo-400 hover:bg-indigo-500/10"
              @click="handleChoiceSelect(oIdx, resolve(opt.text).main, opt.nextMtn)"
            >
              <span>{{ resolve(opt.text).main }}</span>
              <span v-if="resolve(opt.text).sub" class="text-[9px] text-neutral-500">
                ({{ resolve(opt.text).sub }})
              </span>
              <span v-if="opt.nextMtn" class="text-[9px] text-neutral-500 font-mono">
                ➔ {{ opt.nextMtn }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Voice Lines & Cutscene Reactions -->
    <section v-if="capabilities.reactions.length" class="border border-neutral-800 rounded-lg bg-neutral-900/50 p-3">
      <div class="mb-2 flex items-center justify-between text-rose-400">
        <h4 class="flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
          <span>🎬</span>
          <span>Voice &amp; Reactions ({{ capabilities.reactions.length }})</span>
        </h4>
        <span class="text-[9px] text-neutral-500 font-mono">AIRI Sync</span>
      </div>
      <div class="max-h-64 overflow-y-auto pr-1 divide-y divide-neutral-800/60">
        <div
          v-for="(react, rIdx) in capabilities.reactions"
          :key="rIdx"
          class="flex items-center justify-between gap-2 py-2"
        >
          <div class="min-w-0 flex-1">
            <div class="text-xs text-neutral-100 font-medium leading-snug">
              "{{ resolve(react.text).main }}"
            </div>
            <div v-if="resolve(react.text).sub" class="text-[10px] text-neutral-500 leading-snug">
              "{{ resolve(react.text).sub }}"
            </div>
            <div v-if="react.sound" class="truncate text-[9px] text-neutral-500 font-mono">
              🔊 {{ react.sound }}
            </div>
          </div>
          <button
            class="flex items-center gap-1 border border-rose-500/40 rounded bg-rose-500/15 px-2.5 py-1 text-xs text-rose-200 font-semibold hover:bg-rose-500/30"
            @click="handleReactionTrigger(react)"
          >
            <div class="i-solar:play-bold text-[10px]" />
            <span>Trigger</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Intimacy & Affinity Gauge -->
    <section v-if="capabilities.intimacy.hasIntimacy" class="border border-neutral-800 rounded-lg bg-neutral-900/50 p-3">
      <div class="mb-1.5 flex items-center justify-between text-emerald-400">
        <h4 class="flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
          <span>💖</span>
          <span>Intimacy &amp; Affinity</span>
        </h4>
        <span class="text-[10px] text-neutral-400 font-bold font-mono">
          {{ dslState?.intimacyRaw ?? capabilities.intimacy.raw }} pts
        </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          class="h-full rounded-full from-emerald-500 to-teal-400 bg-gradient-to-r transition-all duration-300"
          :style="{ width: `${Math.min(100, Math.round(((dslState?.intimacyRaw ?? capabilities.intimacy.raw) / 1000) * 100))}%` }"
        />
      </div>
    </section>

    <!-- Empty State -->
    <div v-if="!capabilities.hasDsl" class="border border-neutral-800 rounded-lg border-dashed p-6 text-center text-neutral-500">
      <div class="i-solar:shield-warning-bold mx-auto mb-1.5 text-xl text-neutral-600" />
      <p class="text-xs">
        No creator state machines, custom menus, or gestures found in this model manifest.
      </p>
    </div>

    <!-- Feedback Toast -->
    <Transition name="fade">
      <div
        v-if="toastMessage"
        class="border border-cyan-500/40 rounded-lg bg-neutral-900/95 p-2.5 text-xs text-white shadow-black/60 shadow-lg"
      >
        <div class="text-[11px] text-cyan-300 font-bold">
          {{ toastMessage.title }}
        </div>
        <div class="text-neutral-300">
          {{ toastMessage.body }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>

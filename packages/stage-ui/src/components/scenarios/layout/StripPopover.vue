<script setup lang="ts">
/**
 * Shared chrome for every Control Strip popover.
 *
 * The strip's 13 popovers all repeat the same frame — a bordered header with an
 * uppercase title and a close button, inside a `flex flex-col` body. Pulling it
 * here is what lets each popover become its own component without re-deciding
 * the frame, and it gives the shell a single place to hang future shared
 * behaviour (keyboard dismissal, focus return).
 *
 * `gap` / `headerPadding` exist because the original markup was not quite
 * uniform across popovers (bodies use gap-2 / gap-2.5 / gap-3 and headers use
 * pb-2 / pb-1.5). They are mapped to static classes rather than interpolated so
 * UnoCSS can see the tokens.
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  gap?: '2' | '2.5' | '3'
  headerPadding?: '1.5' | '2'
}>(), {
  gap: '2',
  headerPadding: '2',
})

const emit = defineEmits<{ close: [] }>()

const BODY_GAP: Record<string, string> = {
  2: 'gap-2',
  2.5: 'gap-2.5',
  3: 'gap-3',
}

const HEADER_PADDING: Record<string, string> = {
  1.5: 'pb-1.5',
  2: 'pb-2',
}

const bodyClass = computed(() => ['flex flex-col', BODY_GAP[props.gap]])
const headerClass = computed(() => [
  'flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800',
  HEADER_PADDING[props.headerPadding],
])
</script>

<template>
  <div :class="bodyClass">
    <div :class="headerClass">
      <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">{{ title }}</span>
      <button
        class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        @click="emit('close')"
      >
        <span class="i-solar:close-circle-outline text-lg" />
      </button>
    </div>

    <slot />
  </div>
</template>

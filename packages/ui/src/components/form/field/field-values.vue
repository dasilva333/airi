<script setup lang="ts">
import { Input } from '../input'

const props = defineProps<{
  label?: string
  description?: string
  name?: string
  valuePlaceholder?: string
  required?: boolean
  inputClass?: string
}>()

const emit = defineEmits<{
  (e: 'remove', index: number): void
  (e: 'add'): void
}>()

const items = defineModel<string[]>({ required: true })

function addItem() {
  items.value.push('')
  emit('add')
}

function removeItem(index: number) {
  items.value.splice(index, 1)
  emit('remove', index)
}
</script>

<template>
  <div :class="['w-full', 'max-w-full']">
    <label :class="['flex', 'flex-col', 'gap-2']">
      <div>
        <div :class="['flex', 'items-center', 'gap-1', 'text-sm', 'font-medium']">
          <slot name="label">
            {{ props.label }}
          </slot>
          <span v-if="props.required !== false" :class="['text-red-500']">*</span>
        </div>
        <div :class="['text-xs', 'text-neutral-500', 'dark:text-neutral-400']">
          <slot name="description">
            {{ props.description }}
          </slot>
        </div>
      </div>

      <div v-auto-animate :class="['flex', 'flex-col', 'gap-2', 'w-full']">
        <div
          v-for="(_, index) in items"
          :key="index"
          :class="['w-full', 'flex', 'items-center', 'gap-2']"
        >
          <Input
            v-model="items[index]"
            :placeholder="props.valuePlaceholder"
            :class="['flex-1', 'min-w-0']"
          />
          <button
            type="button"
            :class="[
              'shrink-0 p-1.5 rounded-lg text-rose-500 hover:text-rose-600 dark:hover:text-rose-400',
              'hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors cursor-pointer',
              'flex items-center justify-center',
            ]"
            title="Remove item"
            @click="removeItem(index)"
          >
            <div i-solar:minus-circle-line-duotone :class="['text-xl']" />
          </button>
        </div>

        <button
          type="button"
          :class="[
            'mt-1 inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg text-xs font-medium',
            'text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 dark:hover:bg-primary-500/15',
            'transition-colors cursor-pointer border border-primary-500/20 hover:border-primary-500/40',
          ]"
          @click="addItem"
        >
          <div i-solar:add-circle-line-duotone :class="['text-base']" />
          <span>Add</span>
        </button>
      </div>
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  providerName?: string
  placeholder?: string
  required?: boolean
  label?: string
  description?: string
  consoleUrl?: string
}>()

const { t } = useI18n()

const modelValue = defineModel<string>({ required: false, default: '' })
const showPassword = ref(false)

function handleBlurOrChange() {
  if (typeof modelValue.value === 'string') {
    modelValue.value = modelValue.value.trim()
  }
}

function toggleVisibility() {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <div class="flex flex-col gap-1.5 w-full">
    <div class="flex items-center justify-between">
      <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
        {{ label || t('settings.pages.providers.common.fields.field.api-key.label') || 'API Key' }}
        <span v-if="required" class="text-red-500 ml-0.5">*</span>
      </label>

      <!-- Get API Key Endcap Link -->
      <a
        v-if="consoleUrl"
        :href="consoleUrl"
        target="_blank" rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
      >
        <span>{{ t('settings.pages.providers.common.getApiKey') || 'Get API Key' }}</span>
        <div class="i-solar:arrow-right-up-bold-duotone text-xs" />
      </a>
    </div>

    <div class="relative flex items-center w-full">
      <input
        v-model="modelValue"
        :type="showPassword ? 'text' : 'password'"
        :placeholder="placeholder || 'API Key'"
        class="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2 pr-10 text-sm text-neutral-800 outline-none transition-all dark:border-neutral-700 dark:bg-neutral-850 dark:text-neutral-100 focus:border-primary-500 dark:focus:border-primary-500"
        @blur="handleBlurOrChange"
        @change="handleBlurOrChange"
      >

      <!-- Password Visibility Toggle Button -->
      <button
        type="button"
        title="Toggle API Key visibility"
        class="absolute right-2.5 rounded-lg p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
        @click="toggleVisibility"
      >
        <div :class="showPassword ? 'i-solar:eye-bold-duotone' : 'i-solar:eye-closed-bold-duotone'" class="text-lg" />
      </button>
    </div>

    <p v-if="description || providerName" class="text-[11px] text-neutral-400">
      {{ description || `API Key for ${providerName}` }}
    </p>
  </div>
</template>

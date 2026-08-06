<script setup lang="ts">
import { DoubleCheckButton } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete'): void
}>()

const { t } = useI18n()

function handleDelete() {
  emit('delete')
}
</script>

<script lang="ts">
export default { name: 'ProviderDangerZone' }
</script>

<template>
  <div
    flex="~ col gap-2.5" w-full border border-red-200 rounded-lg bg-red-50 p-3
    class="dark:border-red-900/40 dark:bg-red-950/20"
  >
    <div class="text-sm text-red-600 font-medium dark:text-red-400">
      {{ t('settings.pages.providers.common.section.dangerZone.title') }}
    </div>
    <div class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
      {{ t('settings.pages.providers.common.section.dangerZone.description') }}
    </div>

    <DoubleCheckButton variant="danger" block :disabled="props.disabled" @confirm="handleDelete">
      <template>{{ t('settings.pages.providers.common.section.dangerZone.deleteCredentials') }}</template>
      <template #confirm>
        {{ t('settings.pages.providers.common.section.dangerZone.confirmDelete') }}
      </template>
    </DoubleCheckButton>
  </div>
</template>

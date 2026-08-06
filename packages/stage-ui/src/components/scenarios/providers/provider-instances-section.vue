<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useProvidersStore } from '../../../stores/providers'

const props = defineProps<{
  providerId: string
}>()

const emit = defineEmits<{
  (e: 'add'): void
}>()

const { t } = useI18n()
const providersStore = useProvidersStore()

function instances() {
  return providersStore.listInstances(props.providerId)
}

function removeInstance(instanceId: string) {
  providersStore.removeInstance(props.providerId, instanceId)
}

function setPrimary(instanceId: string) {
  providersStore.setPrimaryInstance(props.providerId, instanceId)
}
</script>

<template>
  <div flex="~ col gap-3" rounded-xl p-1>
    <div flex="~ row" items-center justify-between>
      <h3 class="text-sm text-neutral-500 font-medium dark:text-neutral-400">
        {{ t('settings.pages.providers.common.section.instances.title') }}
      </h3>
      <button
        type="button"
        flex items-center gap-1 border border-neutral-200 rounded px-2 py-12 text-xs text-neutral-500 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-400 disabled:opacity-50
        @click="emit('add')"
      >
        <div i-solar:add-circle-bold-duotone text-sm />
        {{ t('settings.pages.providers.common.section.instances.addInstance') }}
      </button>
    </div>

    <div flex="~ col gap-2">
      <div
        v-for="inst in instances()"
        :key="inst.id"
        flex="~ row" items-center justify-between rounded-lg px-2.5 py-1.5
        class="bg-neutral-100 dark:bg-neutral-800/40"
      >
        <span :class="inst.isPrimary ? 'font-medium text-neutral-700 dark:text-neutral-200' : 'text-neutral-600 dark:text-neutral-300'" class="monospace truncate text-sm">
          {{ inst.label || inst.id }}
        </span>

        <div flex="~ row" items-center gap-1.5>
          <span v-if="inst.isPrimary" class="text-xs text-amber-500 font-semibold">
            {{ t('settings.pages.providers.common.section.instances.primary') }}
          </span>
          <button
            v-else
            type="button"
            :title="t('settings.pages.providers.common.section.instances.makePrimary')"
            @click="setPrimary(inst.id)"
          >
            <div i-solar:star-bold-duotone text-base text-neutral-400 transition-colors hover:text-amber-400 />
          </button>
          <button
            type="button"
            :title="t('settings.pages.providers.common.section.instances.remove')"
            class="text-neutral-400 hover:text-red-500"
            @click="removeInstance(inst.id)"
          >
            <div i-solar:trash-bin-trash-bold-duotone text-base />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

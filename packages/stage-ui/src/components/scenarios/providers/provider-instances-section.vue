<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useProvidersStore } from '../../../stores/providers'

const props = defineProps<{
  providerId: string
}>()

const { t } = useI18n()
const providersStore = useProvidersStore()

const showAddModal = ref(false)
const newInstanceLabel = ref('')

const instanceToDelete = ref<{ id: string, label: string } | null>(null)

const instanceList = computed(() => {
  return providersStore.listInstances(props.providerId)
})

function handleOpenAddModal() {
  newInstanceLabel.value = ''
  showAddModal.value = true
}

function handleConfirmAddInstance() {
  const label = newInstanceLabel.value.trim()
  providersStore.addInstance(props.providerId, label)
  showAddModal.value = false
}

function handleRequestRemove(inst: { id: string, label: string }) {
  instanceToDelete.value = inst
}

function handleConfirmRemove() {
  if (instanceToDelete.value) {
    providersStore.removeInstance(props.providerId, instanceToDelete.value.id)
    instanceToDelete.value = null
  }
}

function setPrimary(instanceId: string) {
  providersStore.setPrimaryInstance(props.providerId, instanceId)
}
</script>

<template>
  <div flex="~ col gap-3" class="border border-neutral-200/80 rounded-2xl bg-white/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-900/50">
    <div flex="~ row" items-center justify-between>
      <div>
        <h3 class="text-base text-neutral-800 font-semibold dark:text-neutral-200">
          {{ t('settings.pages.providers.common.section.instances.title') || 'Provider Instances' }}
        </h3>
        <p class="text-xs text-neutral-400">
          Manage multiple API keys or endpoints for this provider
        </p>
      </div>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl bg-primary-500/10 px-3 py-1.5 text-xs text-primary-600 font-medium transition-colors dark:bg-primary-500/20 hover:bg-primary-500/20 dark:text-primary-300 dark:hover:bg-primary-500/30"
        @click="handleOpenAddModal"
      >
        <div i-solar:add-circle-bold-duotone text-sm />
        <span>{{ t('settings.pages.providers.common.section.instances.addInstance') || 'Add Instance' }}</span>
      </button>
    </div>

    <!-- Instances List -->
    <div flex="~ col gap-2" class="mt-1">
      <div
        v-for="inst in instanceList"
        :key="inst.id"
        flex="~ row" items-center justify-between rounded-xl px-3 py-2.5
        class="border border-neutral-200/80 bg-white/70 transition-colors dark:border-neutral-800/80 dark:bg-neutral-900/60"
      >
        <div flex="~ row items-center gap-2.5" min-w-0 flex-1>
          <div
            :class="inst.isPrimary ? 'text-amber-500' : 'text-neutral-400'"
            class="text-base shrink-0"
          >
            <div :class="inst.isPrimary ? 'i-solar:star-bold' : 'i-solar:star-linear'" />
          </div>

          <span class="truncate text-xs font-semibold text-neutral-700 dark:text-neutral-200">
            {{ inst.label || inst.id }}
          </span>

          <span
            v-if="inst.isPrimary"
            class="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold tracking-wider uppercase dark:text-amber-400"
          >
            Primary
          </span>
        </div>

        <div flex="~ row" items-center gap-1 shrink-0>
          <button
            v-if="!inst.isPrimary"
            type="button"
            title="Set as Primary"
            class="rounded-lg p-1.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-200/60 hover:text-amber-500 dark:hover:bg-neutral-750"
            @click="setPrimary(inst.id)"
          >
            Set Primary
          </button>

          <button
            type="button"
            title="Delete Instance"
            class="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:hover:bg-red-500/20"
            @click="handleRequestRemove(inst)"
          >
            <div class="i-solar:trash-bin-trash-bold-duotone text-base" />
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Add New Instance -->
    <DialogRoot :open="showAddModal" @update:open="val => showAddModal = val">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
        <DialogContent class="fixed left-1/2 top-1/2 z-[9999] max-w-md w-[92dvw] flex flex-col transform border border-neutral-200 rounded-2xl bg-white p-6 shadow-xl outline-none backdrop-blur-md -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-800 dark:bg-neutral-900">
          <div class="mb-4 flex items-center justify-between">
            <DialogTitle class="text-lg text-neutral-800 font-bold dark:text-neutral-100">
              Add Provider Instance
            </DialogTitle>
            <button
              class="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              @click="showAddModal = false"
            >
              <div class="i-solar:close-circle-bold-duotone text-xl" />
            </button>
          </div>

          <div flex="~ col gap-4">
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Enter a label for your new instance (e.g., "Personal Key", "Work Key", or "Backup Endpoint").
            </p>

            <input
              v-model="newInstanceLabel"
              type="text"
              placeholder="e.g. Personal Key"
              class="w-full border border-neutral-300 rounded-xl bg-white px-3.5 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 dark:bg-neutral-800 focus:border-primary-500 dark:text-neutral-100"
              @keyup.enter="handleConfirmAddInstance"
            >

            <div flex="~ row" justify-end gap-2 class="mt-2">
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-xs text-neutral-600 font-medium transition-colors dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                @click="showAddModal = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl bg-primary-500 px-4 py-2 text-xs text-white font-semibold shadow-xs transition-all hover:bg-primary-600 active:scale-95"
                @click="handleConfirmAddInstance"
              >
                Add Instance
              </button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Modal: Confirm Delete Instance -->
    <DialogRoot :open="!!instanceToDelete" @update:open="val => { if (!val) instanceToDelete = null }">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
        <DialogContent class="fixed left-1/2 top-1/2 z-[9999] max-w-md w-[92dvw] flex flex-col transform border border-neutral-200 rounded-2xl bg-white p-6 shadow-xl outline-none backdrop-blur-md -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-800 dark:bg-neutral-900">
          <div class="mb-3 flex items-center justify-between">
            <DialogTitle class="text-lg text-red-600 font-bold dark:text-red-400 flex items-center gap-2">
              <div class="i-solar:danger-triangle-bold-duotone text-xl" />
              Delete Instance
            </DialogTitle>
            <button
              class="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              @click="instanceToDelete = null"
            >
              <div class="i-solar:close-circle-bold-duotone text-xl" />
            </button>
          </div>

          <div flex="~ col gap-4">
            <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
              Are you sure you want to delete <strong class="text-neutral-900 dark:text-neutral-100">"{{ instanceToDelete?.label }}"</strong>? Credentials stored for this instance will be permanently removed.
            </p>

            <div flex="~ row" justify-end gap-2 class="mt-2">
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-xs text-neutral-600 font-medium transition-colors dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                @click="instanceToDelete = null"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl bg-red-600 px-4 py-2 text-xs text-white font-semibold shadow-xs transition-all hover:bg-red-700 active:scale-95"
                @click="handleConfirmRemove"
              >
                Delete Instance
              </button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>

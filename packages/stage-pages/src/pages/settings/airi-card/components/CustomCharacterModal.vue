<script setup lang="ts">
import type { CustomCharacterEntry } from '@proj-airi/stage-ui/stores/custom-characters'

import { useCustomCharactersStore } from '@proj-airi/stage-ui/stores/custom-characters'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button } from '@proj-airi/ui'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

interface Props {
  modelValue: boolean
  editCharacter?: CustomCharacterEntry | null
  initialName?: string
  copyrights?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  editCharacter: null,
  initialName: '',
  copyrights: () => [],
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', character: CustomCharacterEntry): void
}>()

const customStore = useCustomCharactersStore()
const providersStore = useProvidersStore()

const copyright = ref('')
const name = ref('')
const trigger = ref('')
const tags = ref('')
const isCopyrightFocused = ref(false)

// Image Vision Auto-Tagging State
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedImageFile = ref<File | null>(null)
const selectedImageName = ref<string>('')
const isTaggingImage = ref(false)

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function handleFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedImageFile.value = target.files[0]
    selectedImageName.value = target.files[0].name
  }
}

async function runTagExtraction() {
  if (!selectedImageFile.value) {
    toast.error('Please select an image file first')
    return
  }

  isTaggingImage.value = true
  const providerId = 'blip-local'
  let tempObjectUrl = ''

  try {
    tempObjectUrl = URL.createObjectURL(selectedImageFile.value)

    providersStore.initializeProvider(providerId)
    if (!providersStore.addedProviders[providerId]) {
      providersStore.markProviderAdded(providerId)
    }
    if (providersStore.providerRuntimeState[providerId]) {
      providersStore.providerRuntimeState[providerId].isConfigured = true
    }

    const providerInstance = await providersStore.getProviderInstance<any>(providerId)
    if (!providerInstance) {
      throw new Error('BLIP local vision provider unavailable')
    }

    await providerInstance.loadModel()

    const extracted = await providerInstance.captionImage(tempObjectUrl)
    if (extracted && extracted.trim()) {
      if (tags.value.trim()) {
        tags.value = `${tags.value.trim()}, ${extracted.trim()}`
      }
      else {
        tags.value = extracted.trim()
      }
      toast.success('Extracted visual tags from image!')
    }
    else {
      toast.warning('No visual tags detected in image')
    }
  }
  catch (err: any) {
    console.error('[CustomCharacterModal] Vision tagging error:', err)
    toast.error(`Tag extraction failed: ${err.message || err}`)
  }
  finally {
    if (tempObjectUrl) {
      URL.revokeObjectURL(tempObjectUrl)
    }
    isTaggingImage.value = false
  }
}

// Initialize/Reset form on open or editCharacter change
watch(
  () => [props.modelValue, props.editCharacter, props.initialName],
  () => {
    if (props.modelValue) {
      selectedImageFile.value = null
      selectedImageName.value = ''
      isTaggingImage.value = false
      if (props.editCharacter) {
        copyright.value = props.editCharacter.copyright || ''
        name.value = props.editCharacter.name || ''
        trigger.value = props.editCharacter.trigger || ''
        tags.value = props.editCharacter.tags || ''
      }
      else {
        copyright.value = ''
        name.value = props.initialName || ''
        trigger.value = ''
        tags.value = ''
      }
    }
  },
  { immediate: true },
)

// Autocomplete suggestions for Copyright field
const copyrightSuggestions = computed(() => {
  const query = copyright.value.trim().toLowerCase()
  if (!query)
    return props.copyrights.slice(0, 8)

  return props.copyrights
    .filter(c => c.toLowerCase().includes(query))
    .slice(0, 8)
})

function selectCopyright(cp: string) {
  copyright.value = cp
  isCopyrightFocused.value = false
}

function handleCopyrightBlur() {
  window.setTimeout(() => {
    isCopyrightFocused.value = false
  }, 200)
}

// Automatically generate trigger suggestion from name and copyright if trigger is empty
function handleNameBlur() {
  if (!trigger.value.trim() && name.value.trim()) {
    const cleanName = name.value.trim().toLowerCase()
    const cleanCp = copyright.value.trim().toLowerCase()
    trigger.value = cleanCp ? `${cleanName}, ${cleanCp}` : cleanName
  }
}

function handleSave() {
  if (!name.value.trim()) {
    toast.error('Character Name is required')
    return
  }
  if (!copyright.value.trim()) {
    toast.error('Copyright / Series Name is required')
    return
  }
  if (!trigger.value.trim()) {
    toast.error('Generation Trigger is required')
    return
  }

  if (props.editCharacter) {
    customStore.updateCustomCharacter(props.editCharacter.id, {
      copyright: copyright.value.trim(),
      name: name.value.trim(),
      trigger: trigger.value.trim(),
      tags: tags.value.trim(),
    })
    toast.success(`Updated ${name.value}`)
    const updated = {
      ...props.editCharacter,
      copyright: copyright.value.trim(),
      name: name.value.trim(),
      trigger: trigger.value.trim(),
      tags: tags.value.trim(),
    }
    emit('saved', updated)
  }
  else {
    const newEntry = customStore.addCustomCharacter({
      copyright: copyright.value.trim(),
      name: name.value.trim(),
      trigger: trigger.value.trim(),
      tags: tags.value.trim(),
    })
    toast.success(`Added ${name.value} to custom roster`)
    emit('saved', newEntry)
  }

  emit('update:modelValue', false)
}

function handleClone() {
  if (!props.editCharacter)
    return
  const cloned = customStore.cloneCustomCharacter(props.editCharacter.id)
  if (cloned) {
    toast.success(`Cloned as ${cloned.name}`)
    emit('saved', cloned)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="val => emit('update:modelValue', val)">
    <DialogPortal>
      <DialogOverlay class="animate-in fade-in fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <DialogContent
        class="animate-in fade-in zoom-in-95 fixed left-1/2 top-1/2 z-50 max-w-md w-full border border-neutral-200/80 rounded-2xl bg-white p-6 shadow-2xl backdrop-blur-xl -translate-x-1/2 -translate-y-1/2 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div class="flex items-center justify-between border-b border-neutral-200/60 pb-3 dark:border-neutral-800">
          <DialogTitle class="flex items-center gap-2 text-base text-neutral-800 font-bold dark:text-neutral-100">
            <span class="i-solar:user-plus-bold-duotone text-primary-500" />
            {{ editCharacter ? 'Edit Custom Character' : 'Add Custom Character' }}
          </DialogTitle>
          <button
            class="text-neutral-400 transition hover:text-neutral-600 dark:hover:text-neutral-200"
            @click="emit('update:modelValue', false)"
          >
            <span class="i-solar:close-circle-linear text-xl" />
          </button>
        </div>

        <div class="mt-4 space-y-4">
          <!-- Copyright / Series Field with Autocomplete -->
          <div class="relative flex flex-col gap-1.5">
            <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              Copyright / Series <span class="text-red-500">*</span>
            </label>
            <input
              v-model="copyright"
              type="text"
              placeholder="e.g. Puella Magi Madoka Magica"
              class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-800 outline-none transition dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-200"
              @focus="isCopyrightFocused = true"
              @blur="handleCopyrightBlur"
            >

            <!-- Autocomplete Dropdown -->
            <div
              v-if="isCopyrightFocused && copyrightSuggestions.length > 0"
              class="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto border border-neutral-200 rounded-xl bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div
                v-for="cp in copyrightSuggestions"
                :key="cp"
                class="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                @mousedown.prevent="selectCopyright(cp)"
              >
                {{ cp }}
              </div>
            </div>
          </div>

          <!-- Character Name Field -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              Character Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="name"
              type="text"
              placeholder="e.g. Homura Akemi"
              class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-800 outline-none transition dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-200"
              @blur="handleNameBlur"
            >
          </div>

          <!-- Generation Trigger Field -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                Generation Trigger <span class="text-red-500">*</span>
              </label>
              <span class="text-[10px] text-neutral-400">Core character tags</span>
            </div>
            <input
              v-model="trigger"
              type="text"
              placeholder="e.g. homura akemi, mahou shoujo madoka magica"
              class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-800 font-mono outline-none transition dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-200"
            >
            <span class="text-[10px] text-neutral-400 leading-tight">
              Identifies the character for prompt generation (e.g. <code class="text-primary-500">character_name, series_name</code>).
            </span>
          </div>

          <!-- Tags / Modifiers Field -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                Tags / Modifiers
              </label>

              <!-- Vision File Selector & Get Tags Button (Single Compact Header Line) -->
              <div class="flex items-center gap-1.5">
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleFileSelected"
                >
                <button
                  type="button"
                  class="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  @click="triggerFilePicker"
                >
                  <span class="i-solar:upload-minimalistic-linear text-xs" />
                  <span class="max-w-[90px] truncate">{{ selectedImageName || 'Pick Image' }}</span>
                </button>

                <Button
                  v-if="selectedImageFile"
                  variant="secondary"
                  class="h-[22px] flex items-center gap-1 border border-primary-500/30 px-2 text-[10px] font-semibold !text-primary-500 dark:!text-primary-400"
                  :disabled="isTaggingImage"
                  @click="runTagExtraction"
                >
                  <span v-if="isTaggingImage" class="i-solar:spinner-bold animate-spin text-xs" />
                  <span v-else class="i-solar:magic-stick-3-bold-duotone text-xs" />
                  <span>{{ isTaggingImage ? 'Tagging...' : 'Get Tags' }}</span>
                </Button>
              </div>
            </div>
            <input
              v-model="tags"
              type="text"
              placeholder="e.g. school uniform, purple eyes, long black hair"
              class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-800 font-mono outline-none transition dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-200"
            >
            <span class="text-[10px] text-neutral-400 leading-tight">
              Additional tags specifying outfit, hairstyle, or visual details.
            </span>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-end gap-2 border-t border-neutral-200/60 pt-4 dark:border-neutral-800">
          <Button
            variant="secondary"
            label="Cancel"
            @click="emit('update:modelValue', false)"
          />
          <Button
            v-if="editCharacter"
            variant="secondary"
            icon="i-solar:copy-bold-duotone"
            label="Clone"
            @click="handleClone"
          />
          <Button
            variant="primary"
            icon="i-solar:check-circle-bold"
            :label="editCharacter ? 'Save Changes' : 'Add Character'"
            @click="handleSave"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

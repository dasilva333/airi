<script lang="ts">
</script>

<script setup lang="ts">
import { CursorFloating } from '@proj-airi/stage-ui/components'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'activate'): void
  (e: 'delete'): void
  (e: 'edit'): void
  (e: 'exportJson'): void
  (e: 'exportPng'): void
}>()

const iconCache = new Map<string, string>()

interface Props {
  id: string
  name: string
  description?: string
  isActive: boolean
  isSelected: boolean
  version: string
  consciousnessModel: string
  voiceModel: string
  displayModelId?: string
}

const displayModelsStore = useDisplayModelsStore()
const backgroundStore = useBackgroundStore()

const latestSelfie = computed(() => {
  const entries = backgroundStore.getCharacterJournalEntries(props.id)
  const selfies = entries.filter(e => e.type === 'selfie')
  if (selfies.length === 0)
    return null

  // Sort by createdAt descending to get the absolute latest at index 0
  const sorted = [...selfies].sort((a, b) => b.createdAt - a.createdAt)
  const latest = sorted[0]
  return backgroundStore.getBackgroundUrl(latest.id)
})

const iconUrl = ref<string | null>(null)

watch(() => props.displayModelId, async (id) => {
  if (!id) {
    iconUrl.value = null
    return
  }

  if (iconCache.has(id)) {
    iconUrl.value = iconCache.get(id) || null
    return
  }

  const model = displayModelsStore.displayModels.find(m => m.id === id)
  if (!model) {
    iconUrl.value = null
    return
  }

  try {
    let zipData: Blob | File | null = null
    if (model.type === 'file') {
      zipData = model.file
    }
    else if (model.type === 'url') {
      const res = await fetch(model.url)
      zipData = await res.blob()
    }

    if (zipData) {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(zipData)
      const iconFileName = Object.keys(zip.files).find((name) => {
        const lower = name.toLowerCase()
        return lower.endsWith('icon.png') || lower.endsWith('icon.jpg')
      })
      if (iconFileName) {
        const fileData = await zip.files[iconFileName].async('blob')
        const url = URL.createObjectURL(fileData)
        iconCache.set(id, url)
        iconUrl.value = url
        return
      }
    }
    iconCache.set(id, '')
    iconUrl.value = null
  }
  catch (e) {
    console.error('[CardListItem] Failed to extract icon from model:', e)
    iconCache.set(id, '')
    iconUrl.value = null
  }
}, { immediate: true })

const portraitInfo = computed(() => {
  // Priority: Latest Selfie > Model Icon > Model Preview
  if (latestSelfie.value)
    return { url: latestSelfie.value, source: 'selfie' }

  if (iconUrl.value)
    return { url: iconUrl.value, source: 'icon' }

  if (!props.displayModelId)
    return { url: null, source: null }
  const model = displayModelsStore.displayModels.find(m => m.id === props.displayModelId)
  return { url: model?.previewImage || null, source: model?.previewImage ? 'preview' : null }
})

const portrait = computed(() => portraitInfo.value.url)
const portraitSource = computed(() => portraitInfo.value.source)
</script>

<template>
  <CursorFloating
    :class="[
      'relative h-[280px] flex flex-col cursor-pointer overflow-hidden rounded-xl transition-all ease-in-out duration-400',
      'group perspective-1000',
      isSelected
        ? 'border-2 border-primary-400 dark:border-primary-600'
        : 'border-2 border-neutral-100 dark:border-neutral-800/25',
      'bg-neutral-200/50 dark:bg-neutral-800/50',
      'drop-shadow-none hover:drop-shadow-[0px_4px_4px_rgba(220,220,220,0.4)] active:drop-shadow-[0px_0px_0px_rgba(220,220,220,0.25)] dark:hover:drop-shadow-none',
      'before:content-empty before:absolute before:inset-0 before:z-0 before:w-1/4 before:h-full before:transition-all before:duration-400 before:ease-in-out before:bg-gradient-to-r before:from-primary-500/0 before:to-primary-500/0 dark:before:from-primary-400/0 dark:before:to-primary-400/0 before:mask-image-[linear-gradient(120deg,white_100%)] before:opacity-0',
      'hover:before:opacity-100 hover:before:bg-gradient-to-r hover:before:from-primary-500/20 hover:before:via-primary-500/10 hover:before:to-transparent dark:hover:before:from-primary-400/20 dark:hover:before:via-primary-400/10 dark:hover:before:to-transparent',
    ]"
    @click="emit('select')"
  >
    <!-- Flip container -->
    <div
      :class="[
        'preserve-3d relative w-full flex-1 min-h-0 flex flex-col transition-transform duration-600 ease-in-out',
        'group-hover:rotate-y-180',
      ]"
    >
      <!-- Front side (Portrait/Square) -->
      <div :class="['backface-hidden absolute inset-0 flex flex-col overflow-hidden rounded-xl bg-white dark:bg-neutral-900']">
        <div
          v-if="portrait"
          :class="[
            'relative w-full aspect-square overflow-hidden transition-colors duration-200',
            portraitSource === 'preview'
              ? 'bg-[#faf9f6]'
              : 'bg-neutral-100 dark:bg-neutral-800/80',
          ]"
        >
          <img
            :src="portrait"
            :class="['h-full w-full object-cover object-[50%_15%]']"
            alt="Portrait"
          >
        </div>
        <div
          v-else
          :class="[
            'w-full aspect-square flex flex-col items-center justify-center gap-2 bg-neutral-100 text-neutral-400 dark:bg-neutral-800/80',
          ]"
        >
          <div
            i-solar:user-circle-bold-duotone
            :class="['text-5xl opacity-40']"
          />
        </div>

        <!-- Name overlay positioned absolute at the bottom of the front container (above toolbar) -->
        <div
          :class="[
            'absolute inset-x-0 bottom-0 p-3 flex flex-col gap-1 z-1 bg-gradient-to-t from-black/90 via-black/40 to-transparent',
          ]"
        >
          <div :class="['flex items-center justify-between']">
            <span
              :class="[
                'text-sm text-white font-semibold tracking-wide uppercase drop-shadow-sm truncate',
              ]"
            >{{ name }}</span>
            <div
              v-if="isActive"
              :class="['rounded-md p-0.5 bg-primary-500/80 text-white']"
            >
              <div
                i-solar:check-circle-bold-duotone
                :class="['text-xs']"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Back side (Card text details) -->
      <div
        :class="[
          'dark:bg-neutral-900 backface-hidden rotate-y-180 absolute inset-0 flex flex-col overflow-hidden rounded-xl bg-white shadow-xl border-2',
          'border-primary-500/20 dark:border-primary-400/10',
        ]"
      >
        <!-- Card content -->
        <div
          :class="[
            'relative flex flex-col flex-1 justify-between gap-3 overflow-hidden p-5 transition-all duration-400 ease-in-out',
            'after:content-empty after:absolute after:inset-0 after:z--2 after:w-full after:h-full after:bg-dotted-[neutral-200/80] after:bg-size-10px after:mask-image-[linear-gradient(165deg,white_30%,transparent_50%)] after:transition-all after:duration-400 after:ease-in-out',
            'hover:after:bg-dotted-[primary-300/50] dark:hover:after:bg-dotted-[primary-200/20] hover:text-primary-600/80 dark:hover:text-primary-300/80',
          ]"
        >
          <!-- Card header (name and badge) -->
          <div :class="['z-1 flex items-start justify-between gap-2']">
            <h3 :class="['flex-1 truncate text-lg font-normal']">
              {{ name }}
            </h3>
            <div :class="['flex shrink-0 items-center gap-2']">
              <div
                v-if="isActive"
                :class="['rounded-md p-1 bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400']"
              >
                <div
                  i-solar:check-circle-bold-duotone
                  :class="['text-sm']"
                />
              </div>
            </div>
          </div>

          <!-- Card description -->
          <p
            v-if="description"
            :class="['line-clamp-6 min-h-40px flex-1 text-sm text-neutral-500 dark:text-neutral-400']"
          >
            {{ description }}
          </p>
          <p
            v-else
            :class="['flex-1 text-sm italic text-neutral-400 dark:text-neutral-500']"
          >
            No description provided.
          </p>

          <!-- Card stats -->
          <div
            :class="[
              'z-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400',
            ]"
          >
            <div>v{{ version }}</div>
            <div :class="['flex items-center gap-1.5']">
              <div :class="['flex items-center gap-0.5']">
                <div
                  i-lucide:ghost
                  :class="['text-xs']"
                />
                <span>{{ consciousnessModel }}</span>
              </div>
              <div :class="['flex items-center gap-0.5']">
                <div
                  i-lucide:mic
                  :class="['text-xs']"
                />
                <span>{{ voiceModel }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fixed Actions Toolbar (outside flip) -->
    <div
      :class="[
        'relative z-10 flex items-center justify-end px-2 py-1.5 bg-neutral-50/50 dark:bg-neutral-800/30 border-t border-neutral-100 dark:border-neutral-800/50',
      ]"
    >
      <button
        :class="[
          'rounded-lg p-1.5 text-neutral-500 transition-colors dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700/50',
        ]"
        title="Edit card"
        @click.stop="emit('edit')"
      >
        <div
          i-solar:pen-2-bold-duotone
          :class="['text-sm']"
        />
      </button>

      <DropdownMenuRoot>
        <DropdownMenuTrigger
          :class="[
            'rounded-lg p-1.5 text-neutral-500 transition-colors dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700/50',
          ]"
          title="Export card"
          @click.stop
        >
          <div
            i-solar:export-bold-duotone
            :class="['text-sm']"
          />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            :class="[
              'z-10000 min-w-28 border border-neutral-200 rounded-lg bg-white p-1 text-sm text-neutral-800 shadow-xl outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200',
            ]"
            align="end"
            side="bottom"
            :side-offset="6"
          >
            <DropdownMenuItem
              :class="[
                'cursor-pointer rounded-md px-3 py-2 outline-none data-[highlighted]:bg-neutral-100 dark:data-[highlighted]:bg-neutral-800',
              ]"
              @click.stop="emit('exportJson')"
            >
              Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem
              :class="[
                'cursor-pointer rounded-md px-3 py-2 outline-none data-[highlighted]:bg-neutral-100 dark:data-[highlighted]:bg-neutral-800',
              ]"
              @click.stop="emit('exportPng')"
            >
              Export PNG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <button
        :class="['rounded-lg p-1.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700/50']"
        :disabled="isActive"
        @click.stop="emit('activate')"
      >
        <div
          :class="[
            isActive
              ? 'i-solar:check-circle-bold-duotone text-primary-500 dark:text-primary-400'
              : 'i-solar:play-circle-broken text-neutral-500 dark:text-neutral-400',
          ]"
        />
      </button>

      <button
        v-if="id !== 'default'"
        :class="['rounded-lg p-1.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700/50']"
        @click.stop="emit('delete')"
      >
        <div
          i-solar:trash-bin-trash-linear
          :class="['text-neutral-500 dark:text-neutral-400']"
        />
      </button>
    </div>
  </CursorFloating>
</template>

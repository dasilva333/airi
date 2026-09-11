<script setup lang="ts">
interface Props {
  rowCount?: number
  showTabs?: boolean
}

withDefaults(defineProps<Props>(), {
  rowCount: 7,
  showTabs: true,
})
</script>

<template>
  <div class="h-full min-h-0 w-full flex flex-col select-none overflow-hidden bg-transparent">
    <!-- Top Segment Pills: Universal Emotions | Motions -->
    <div v-if="showTabs" class="shrink-0 pb-1">
      <div class="flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
        <div class="flex flex-1 items-center justify-center rounded-md bg-white py-1.5 shadow-sm dark:bg-neutral-700">
          <div class="h-3.5 w-16 animate-pulse rounded bg-neutral-200/80 dark:bg-neutral-600/60" />
        </div>
        <div class="flex flex-1 items-center justify-center rounded-md py-1.5">
          <div class="h-3.5 w-14 animate-pulse rounded bg-neutral-200/50 dark:bg-neutral-700/40" />
        </div>
      </div>
    </div>

    <!-- Filter Bar Placeholder -->
    <div class="flex shrink-0 items-center justify-between py-2">
      <div class="h-3 w-12 animate-pulse rounded bg-neutral-200/60 dark:bg-neutral-700/50" />
      <div class="flex items-center gap-1.5">
        <div class="h-5 w-16 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
        <div class="h-5 w-14 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
      </div>
    </div>

    <!-- Shimmer Expression Rows -->
    <div class="min-w-0 w-full overflow-hidden border border-neutral-200/80 rounded-lg bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div
        v-for="idx in rowCount"
        :key="idx"
        class="min-w-0 w-full flex items-center justify-between border-b border-neutral-100 px-3 py-2.5 last:border-b-0 dark:border-neutral-800/80"
      >
        <!-- Left: Dot + Title + Key bar -->
        <div class="min-w-0 flex flex-1 items-center gap-2.5">
          <div class="size-2 shrink-0 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-600" />
          <div class="min-w-0 flex-1 space-y-1.5">
            <div
              class="h-3.5 animate-pulse rounded bg-neutral-200/90 dark:bg-neutral-700/70"
              :style="{ width: `${35 + ((idx * 17) % 35)}%` }"
            />
            <div
              class="h-2.5 animate-pulse rounded bg-neutral-100/90 dark:bg-neutral-800"
              :style="{ width: `${20 + ((idx * 11) % 25)}%` }"
            />
          </div>
        </div>

        <!-- Right: Action Button Shimmers -->
        <div class="ml-2 flex shrink-0 items-center gap-1">
          <div class="size-5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/80" />
          <div class="size-5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/80" />
          <div class="size-5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/80" />
        </div>
      </div>
    </div>
  </div>
</template>

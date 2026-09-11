<script setup lang="ts">
// Full-page shimmer skeleton matching ModelSettings layout for instant (< 30ms) navigation
</script>

<template>
  <div class="relative h-full w-full flex flex-col select-none gap-3 overflow-hidden md:flex-row">
    <!-- Controls Container (Left Column) -->
    <div
      class="z-10 order-2 min-h-0 w-full flex flex-1 flex-col gap-2 overflow-y-auto p-1 md:order-1 lg:w-[420px] md:w-[380px] xl:w-[440px] md:shrink-0"
    >
      <!-- Top Action Buttons: [Select Model] [Apply to Character...] -->
      <div class="w-full flex gap-2">
        <div class="h-9 flex-1 animate-pulse rounded-xl bg-neutral-200/70 dark:bg-neutral-800/80" />
        <div class="h-9 flex-1 animate-pulse rounded-xl bg-neutral-200/70 dark:bg-neutral-800/80" />
      </div>

      <!-- Character Customizations Section Container -->
      <div class="border border-neutral-200/40 rounded-xl bg-white/80 p-3 backdrop-blur-lg space-y-3 dark:border-neutral-800/40 dark:bg-black/75">
        <!-- Section Header -->
        <div class="flex items-center justify-between pb-1">
          <div class="flex items-center gap-2">
            <div class="size-4 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <div class="h-4 w-36 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700" />
          </div>
          <div class="h-3 w-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <!-- Sub-Header Controls -->
        <div class="flex items-center justify-between px-1">
          <div class="h-3 w-32 animate-pulse rounded bg-neutral-200/60 dark:bg-neutral-800/60" />
          <div class="h-5 w-14 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800" />
        </div>

        <!-- AI Expression Curation Banner Placeholder -->
        <div class="border border-primary-200/20 rounded-xl bg-primary-500/5 p-3 space-y-2">
          <div class="flex items-center gap-1.5">
            <div class="size-3.5 animate-pulse rounded bg-primary-300/40 dark:bg-primary-700/40" />
            <div class="h-3.5 w-32 animate-pulse rounded bg-primary-300/40 dark:bg-primary-700/40" />
          </div>
          <div class="h-2.5 w-48 animate-pulse rounded bg-neutral-200/60 dark:bg-neutral-800/60" />
          <div class="flex justify-end pt-1">
            <div class="h-6 w-28 animate-pulse rounded-lg bg-primary-500/20" />
          </div>
        </div>

        <!-- Top Segment Pills: Emotions | Motions | Outfits | VFX -->
        <div class="flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
          <div class="flex flex-1 items-center justify-center rounded-md bg-white py-1.5 shadow-sm dark:bg-neutral-700">
            <div class="h-3.5 w-16 animate-pulse rounded bg-neutral-200/80 dark:bg-neutral-600/60" />
          </div>
          <div class="flex flex-1 items-center justify-center rounded-md py-1.5">
            <div class="h-3.5 w-14 animate-pulse rounded bg-neutral-200/50 dark:bg-neutral-700/40" />
          </div>
          <div class="flex flex-1 items-center justify-center rounded-md py-1.5">
            <div class="h-3.5 w-12 animate-pulse rounded bg-neutral-200/50 dark:bg-neutral-700/40" />
          </div>
          <div class="flex flex-1 items-center justify-center rounded-md py-1.5">
            <div class="h-3.5 w-14 animate-pulse rounded bg-neutral-200/50 dark:bg-neutral-700/40" />
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="flex items-center justify-between px-1 py-1">
          <div class="h-3 w-12 animate-pulse rounded bg-neutral-200/60 dark:bg-neutral-700/50" />
          <div class="flex items-center gap-1.5">
            <div class="h-5 w-20 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
            <div class="h-5 w-16 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
            <div class="h-5 w-10 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>

        <!-- Shimmer Expression Rows (5 rows) -->
        <div class="min-w-0 w-full overflow-hidden border border-neutral-200/80 rounded-lg bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div
            v-for="idx in 5"
            :key="idx"
            class="min-w-0 w-full flex items-center justify-between border-b border-neutral-100 px-3 py-2.5 last:border-b-0 dark:border-neutral-800/80"
          >
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
            <div class="ml-2 flex shrink-0 items-center gap-1">
              <div class="size-5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/80" />
              <div class="size-5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/80" />
              <div class="size-5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/80" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Stage Viewport Container (Right Column) -->
    <div
      class="relative order-1 h-[36dvh] w-full flex shrink-0 items-center justify-center overflow-hidden border border-neutral-200/60 rounded-2xl bg-neutral-900/40 shadow-inner transition-all duration-300 ease-in-out md:order-2 md:h-full md:w-auto sm:h-[42dvh] md:flex-1 dark:border-neutral-800/60 md:rounded-none md:border-none dark:bg-neutral-950/60 md:shadow-none"
    >
      <!-- Format Badge Shimmer Placeholder -->
      <div class="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 border border-white/10 rounded-full bg-neutral-900/70 px-2.5 py-1 text-[10px] shadow-sm backdrop-blur-md">
        <div class="size-1.5 animate-pulse rounded-full bg-primary-400/50" />
        <div class="h-2.5 w-8 animate-pulse rounded bg-neutral-400/40" />
      </div>

      <!-- Center Avatar Silhouette Shimmer Placeholder -->
      <div class="flex flex-col animate-pulse items-center justify-center opacity-25">
        <div class="i-solar:user-bold-duotone text-7xl text-neutral-600 dark:text-neutral-500" />
      </div>
    </div>
  </div>
</template>

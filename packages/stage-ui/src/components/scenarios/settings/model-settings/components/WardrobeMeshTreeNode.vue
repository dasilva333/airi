<script setup lang="ts">
import type { DiscoveredMeshNode } from '@proj-airi/stage-ui-three'

import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  node: DiscoveredMeshNode
  selectedMeshes: Set<string>
  searchQuery?: string
  depth?: number
}>(), {
  searchQuery: '',
  depth: 0,
})

const emit = defineEmits<{
  (e: 'toggleMesh', meshName: string): void
  (e: 'toggleSubtree', node: DiscoveredMeshNode, shouldHide: boolean): void
}>()

const isExpanded = ref(true)

// Collect all concrete leaf mesh names under this node
function getAllLeafMeshNames(n: DiscoveredMeshNode): string[] {
  if (!n.children || n.children.length === 0)
    return [n.name]
  const list: string[] = []
  for (const c of n.children) {
    list.push(...getAllLeafMeshNames(c))
  }
  return list
}

const leafMeshNames = computed(() => getAllLeafMeshNames(props.node))
const isContainer = computed(() => Boolean(props.node.children && props.node.children.length > 0))

// Tri-state selection status
const selectionState = computed<'all' | 'none' | 'some'>(() => {
  const leaves = leafMeshNames.value
  if (leaves.length === 0)
    return 'none'
  let count = 0
  for (const name of leaves) {
    if (props.selectedMeshes.has(name))
      count++
  }
  if (count === leaves.length)
    return 'all'
  if (count > 0)
    return 'some'
  return 'none'
})

// Search matching
function checkMatch(n: DiscoveredMeshNode, q: string): boolean {
  if (!q)
    return true
  if (n.name.toLowerCase().includes(q))
    return true
  if (n.children) {
    return n.children.some((c: DiscoveredMeshNode) => checkMatch(c, q))
  }
  return false
}

const matchesSearch = computed(() => {
  const q = props.searchQuery.trim().toLowerCase()
  return checkMatch(props.node, q)
})

// Auto-expand if query matches
watch(() => props.searchQuery, (q) => {
  if (q.trim()) {
    isExpanded.value = true
  }
})

function handleCheckboxClick() {
  if (isContainer.value) {
    // If currently all selected (all hidden), unhide all. Otherwise, hide all.
    const shouldHide = selectionState.value !== 'all'
    emit('toggleSubtree', props.node, shouldHide)
  }
  else {
    emit('toggleMesh', props.node.name)
  }
}
</script>

<template>
  <div v-if="matchesSearch" class="flex flex-col select-none">
    <!-- Row Item -->
    <div
      class="group relative flex items-center justify-between gap-1.5 border border-transparent rounded-lg border-solid px-2 py-1 text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      :class="[
        selectionState === 'all'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
          : selectionState === 'some'
            ? 'bg-amber-500/5 border-amber-500/20 text-neutral-800 dark:text-neutral-200'
            : 'text-neutral-700 dark:text-neutral-300',
      ]"
      :style="{ paddingLeft: `${props.depth * 16 + 8}px` }"
    >
      <!-- Left: Expand Chevron + Checkbox + Icon + Name -->
      <div class="min-w-0 flex flex-1 items-center gap-1.5">
        <!-- Expand Chevron for Containers -->
        <button
          v-if="isContainer"
          type="button"
          class="size-4 flex items-center justify-center text-neutral-400 transition-transform hover:text-neutral-700 dark:hover:text-neutral-200"
          @click.stop="isExpanded = !isExpanded"
        >
          <div
            :class="isExpanded ? 'i-solar:alt-arrow-down-bold' : 'i-solar:alt-arrow-right-bold'"
            class="size-3"
          />
        </button>
        <div v-else class="size-4" />

        <!-- Tri-State Checkbox / Visibility Toggle -->
        <button
          type="button"
          class="size-4 flex items-center justify-center border rounded-sm transition-colors"
          :class="[
            selectionState === 'all'
              ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
              : selectionState === 'some'
                ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-neutral-300 dark:border-neutral-600 text-neutral-400 hover:border-neutral-400',
          ]"
          :title="selectionState === 'all' ? 'Hidden (click to show)' : selectionState === 'some' ? 'Partially Hidden (click to hide all)' : 'Visible (click to hide)'"
          @click="handleCheckboxClick"
        >
          <div
            v-if="selectionState === 'all'"
            class="i-solar:eye-closed-bold-duotone size-2.5"
          />
          <div
            v-else-if="selectionState === 'some'"
            class="i-solar:minus-bold size-2.5"
          />
          <div
            v-else
            class="i-solar:eye-bold-duotone size-2.5 opacity-40 group-hover:opacity-100"
          />
        </button>

        <!-- Folder / Mesh Category Icon -->
        <div
          v-if="isContainer"
          class="i-solar:folder-bold-duotone size-3.5 text-amber-500/70"
        />
        <div
          v-else-if="node.isSkinned"
          class="i-solar:body-bold-duotone size-3.5 text-primary-500/70"
        />
        <div
          v-else
          class="i-solar:box-minimalistic-bold-duotone size-3.5 text-neutral-400"
        />

        <!-- Node Name -->
        <span
          class="truncate font-medium font-mono"
          :class="[isContainer ? 'text-neutral-900 dark:text-neutral-100 font-semibold' : '']"
          :title="node.name"
        >
          {{ node.name }}
        </span>
      </div>

      <!-- Right: Status Badge / Vertex Count -->
      <div class="flex shrink-0 items-center gap-1.5 text-[10px]">
        <span
          v-if="selectionState === 'all'"
          class="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] text-amber-600 font-bold uppercase dark:text-amber-400"
        >
          hidden
        </span>
        <span
          v-else-if="selectionState === 'some'"
          class="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-600 font-semibold uppercase dark:text-amber-400"
        >
          partial
        </span>
        <span class="text-neutral-400 font-mono">
          {{ node.vertexCount.toLocaleString() }}v
        </span>
      </div>
    </div>

    <!-- Recursive Nested Children -->
    <div v-if="isContainer && isExpanded" class="flex flex-col">
      <WardrobeMeshTreeNode
        v-for="child in node.children"
        :key="child.id || child.name"
        :node="child"
        :selected-meshes="selectedMeshes"
        :search-query="searchQuery"
        :depth="props.depth + 1"
        @toggle-mesh="(m) => emit('toggleMesh', m)"
        @toggle-subtree="(n, h) => emit('toggleSubtree', n, h)"
      />
    </div>
  </div>
</template>

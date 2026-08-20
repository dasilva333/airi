# Proposal: Partial Temporal Inheritance for AIRI Memory Isolation

This document outlines the detailed design for implementing **Partial Temporal Inheritance** in AIRI, mapping all **6 memory pillars** to the codebase and cataloging all user-facing UI component integration points, background processes, and the prompt construction pipeline.

---

## 1. The 6 Pillars of AIRI Memory

| Pillar | Storage / Key Location | Data Profile | Isolation & Query Strategy |
| :--- | :--- | :--- | :--- |
| **1. Chat Sessions** | `local:chat/sessions/{sessionId}` | Small/Med | **Forked copies**: Copies raw message entries up to the fork point. Associated with a `timelineId`. |
| **2. Text Journal / LTMM** | `local:memory/text-journal/{userId}` | Medium | **Inherited**: Tagged with `timelineId`. Filtered via ancestry chain queries. |
| **3. Short-Term Memory / STMM** | `local:memory/short-term/{userId}` | Medium | **Inherited**: Tagged with `timelineId`. Filtered via ancestry chain queries. |
| **4. Echo Chips** | `local:memory/echo-chips/{userId}` | Small | **Inherited**: Tagged with `timelineId`. Filtered via ancestry chain queries. |
| **5. Lifetime Artifact** | `local:memory/lifetime/{timelineId}` | Small | **Isolated with Ancestry Fallback**: Keyed by `timelineId`. Child timelines inherit parent artifacts until a new consolidation run generates a new blueprint. |
| **6. Image Journal** | `localforage` `bg-{nanoid}` | **Large** | **Inherited**: Tagged with `timelineId`. Filtered via ancestry chain queries. **Zero binary files duplicated.** |

---

## 2. Dynamic Ancestry Query Engine

```typescript
// Proposed: packages/stage-ui/src/types/timeline.ts
interface CharacterTimeline {
  id: string
  characterId: string
  name: string
  parentTimelineId: string | null
  forkTimestamp: number | null
  createdAt: number
}
```

### 2.1 The Ancestry Chain Helper
This helper retrieves the chain of ancestors for an active timeline, ordered from active to root.

```typescript
interface AncestorNode {
  timelineId: string
  forkTimestamp: number | null // The timestamp when the CHILD node split from this ancestor
}

export async function getAncestryChain(activeTimelineId: string): Promise<AncestorNode[]> {
  const chain: AncestorNode[] = []
  let currentId: string | null = activeTimelineId
  let childForkTimestamp: number | null = null

  while (currentId) {
    const timeline = await timelinesRepo.get(currentId)
    if (!timeline)
      break

    chain.push({
      timelineId: timeline.id,
      forkTimestamp: childForkTimestamp // Captured from the child in the previous iteration
    })

    childForkTimestamp = timeline.forkTimestamp
    currentId = timeline.parentTimelineId
  }
  return chain
}
```

### 2.2 Ancestry Filter Algorithm
When querying any array-backed memory (LTMM, STMM, Echo Chips, or Image Journal), we filter in-memory lists using the ancestry helper:

```typescript
export function filterEntriesByAncestry<T extends { timelineId?: string, createdAt: number }>(
  entries: T[],
  ancestry: AncestorNode[]
): T[] {
  return entries.filter((entry) => {
    // 1. Backward compatibility: if no timelineId exists, treat it as belonging to the "root" timeline
    const entryTimelineId = entry.timelineId || 'root'

    const ancestorIdx = ancestry.findIndex(a => a.timelineId === entryTimelineId)
    if (ancestorIdx === -1)
      return false // Not in this timeline's ancestry

    const node = ancestry[ancestorIdx]

    // 2. If it's a parent timeline, it must have been created BEFORE the child forked from it
    if (node.forkTimestamp !== null && entry.createdAt >= node.forkTimestamp) {
      return false
    }

    return true
  })
}
```

---

## 3. Catalog of User-Facing UI Touchpoints & Processes

These are the key frontend locations and daemons that must inherit from the new query/filtering methods:

### 3.1 The Input Composer / History Area
- **File**: [InteractiveArea.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue)
- **UI Element**: `<!-- Echo Group (2-story Ticker) -->` (Line 750)
  - **Current**: Filters `echoesStore.getCharacterChips(activeCardId.value)`
  - **Update**: Filter `echoEntries` using the active session's `timelineId` ancestry.
- **UI Element**: `<!-- Single Entries (DNA Snaps / Emerald Cards) -->` (Line 778)
  - **Current**: Filters `textJournalStore.entries` and `shortTermMemory.getCharacterBlocks(...)` purely by `characterId`.
  - **Update**: Update `latestTextEntries` computed property to filter both pools through the ancestry chain.
- **UI Element**: `<!-- Image Journal Chips -->` (Line 815)
  - **Current**: Returns `backgroundStore.journalEntries` slice.
  - **Update**: Update `latestImageEntries` to filter journal/selfie backgrounds by active timeline ancestry.
- **UI Element**: `<!-- Last 3 Days -->` and `<!-- Today -->`
  - **Current**: Evaluates if the active day has a daily recap block generated.
  - **Update**: Scope block check to blocks matching active timeline ancestry.

### 3.2 Search & Settings Modules
- **File**: [InteractiveArea.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue) & [memory-long-term.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/modules/memory-long-term.vue)

#### 3.2.1 Search Inputs / Dialogs (Keyword & Semantic)
- **Current**: `textJournalStore.searchEntries` and the local filters query all entries for the active character globally.
- **Update**: Pass the active `timelineId` into `searchEntries`. Ensure Orama search results and local regex matching filters post-filter against the active ancestry chain before rendering.

#### 3.2.2 The Sacred Records Display Grid (LTMM Page)
- **File**: [memory-long-term.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/modules/memory-long-term.vue)
- **Current**: `visibleEntries` filters items purely by `characterId`.
- **Update**: Fetch the active timeline index for the character, and filter `entries` using `filterEntriesByAncestry`.

#### 3.2.3 Daily Summary Blocks Grid (STMM Page)
- **File**: [memory-short-term.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/modules/memory-short-term.vue)
- **Current**: Queries daily blocks for the character globally.
- **Update**: Update the blocks query helper to filter the returned STMM array using the active timeline ancestry.

### 3.3 Stage Background Gallery Picker
- **File**: [StageBackgroundPicker.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/stage-background-picker/StageBackgroundPicker.vue)
- **UI Element**: `Stage Background` Header & Selection Grid (Preset/Journal/Selfies)
  - **Current**: Pulls character backgrounds using `backgroundStore.availableBackgrounds` (all items where `characterId === activeCardId`).
  - **Update**: Update `getCharacterBackgrounds` and `getCharacterJournalEntries` computed helpers inside [background.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/background.ts) to filter using the active timeline ancestry.

### 3.4 Chat Bubble Context Menu (Action Menu)
- **File**: [action-menu/index.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/components/action-menu/index.vue)
- **UI Element**: Context Menu Options (Fork to Background, Fork & Switch, Trim Timeline)
  - **Update**:
    - **Fork to Background**: Creates a new session/timeline pointing to the parent timeline up to the message's `createdAt` timestamp, leaving the active view on the current chat window.
    - **Fork & Switch**: Performs the same fork and redirects the active chat route/session selection to the new branch immediately.
    - **Trim Timeline**: Discards messages in the active session after the selected message's timestamp to prune dead ends.

### 3.5 Parallel Timelines Modal
- **File**: [ChatSessionModal.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/ChatSessionModal.vue)
- **UI Element**: Parallel Timelines list view
  - **Layout**: Keep the UI layout as a flat listing of sessions to avoid complex nested tree hierarchy structures.
  - **Update**: For sessions/timelines that are branches, render a simple parent badge or metadata subtext line (e.g., `Parent: Playful Operation Stardust` or `Forked from Main Story at 6/12`) to provide structural context to the user.

---

## 4. Background Processes & Prompt Construction

### 4.1 The Dreaming Daemon (Eternal Echoes Generation)
- **File**: [proactivity.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts#L357) (`evaluateDreamState`)
- **Current**: Calls `collectCharacterConversationMessages(characterId)` which merges raw messages from all character sessions globally to consolidate daily memories.
- **Update**: Update the message collector to query the chat session index and grab session logs only if they are associated with the active timeline's ancestry. This ensures dreaming is isolated to its respective narrative timeline.

### 4.2 System Prompt Builder
- **File**: [session-store.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts)
- **UI Elements**:
  - `buildShortTermMemoryContext()` (Line 199)
    - **Update**: Slices daily STMM blocks using the ancestry-filtered array rather than character-wide summaries.
  - `refreshActiveSystemMessage()` (Line 745)
    - **Update**: Resolves the **Lifetime Memory** by using the ancestry fallback getter (Section 5).

---

## 5. Lifetime Memory Inheritance (The Eternal Thread)

When forking a session, we avoid compiling a brand-new synthesis immediately (which causes redundant consolidation loops and wastes API tokens). Instead, the child timeline inherits the nearest ancestor's distilled profile:

```typescript
// Proposed: packages/stage-ui/src/stores/memory-lifetime.ts
export async function getLifetimeArtifactForTimeline(activeTimelineId: string): Promise<LifetimeMemoryArtifact | null> {
  const ancestry = await getAncestryChain(activeTimelineId)

  // Walk the ancestry chain from active to parent, looking for the first timeline that has an artifact
  for (const node of ancestry) {
    const key = `local:memory/lifetime/${node.timelineId}`
    const artifact = await storage.getItemRaw<LifetimeMemoryArtifact>(key)
    if (artifact) {
      return artifact
    }
  }
  return null // Fallback to root or empty
}
```

- **Inheritance Flow**:
  1. **On Fork**: The child timeline has no `local:memory/lifetime/{newTimelineId}` file.
  2. **Active State**: The system prompt builder retrieves the parent's synthesized artifact from IndexedDB via the ancestry fallback logic.
  3. **New Compilation**: When the user explicitly runs a new consolidation step (or the daily dream cycle invokes synthesis for the branch), the pipeline synthesizes and writes a new artifact specifically to `local:memory/lifetime/{newTimelineId}`.
  4. From that point on, the child timeline uses its own customized artifact, ignoring the parent's original one.

## Relevant Skills

- [[airi-memory-systems]]

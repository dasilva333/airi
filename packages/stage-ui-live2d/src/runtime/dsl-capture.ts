/**
 * Captures the pruned "special sauce" DSL entries from a raw Live2D manifest
 * (`settings.motions`) BEFORE the renderer's ZipLoader sanitize step strips them.
 *
 * The renderer drops motion entries without a `File`/`file` (they'd crash WebGL init).
 * Those exact entries are the DSL's `VarFloats` / `Choices` / `change_cos` payloads.
 * This module reads the same `settings.motions` object and re-expresses it as the
 * headless runtime's `DslMotionGroup[]`, so the DSL engine sees everything the
 * renderer discarded (plus the renderable entries, which can carry DSL fields too).
 */

import type { DslEntry, DslMotionGroup } from '@proj-airi/live2d-runtime'

/**
 * Latest DSL groups captured straight from a manifest's raw `FileReferences.Motions`,
 * stashed by `ZipLoader.createSettings` before `ZipLoader.unzip` sanitizes them away.
 * Model.vue consumes + clears this immediately after Live2DModel load.
 */
let pendingDslGroups: DslMotionGroup[] = []

/** Called by `ZipLoader.createSettings`. Stores the pre-sanitize motion groups. */
export function registerDslGroupsFromManifest(motions: unknown): void {
  pendingDslGroups = captureDslGroups(motions)
}

/** Returns the stashed groups and clears the stash (one-shot per model load). */
export function consumePendingDslGroups(): DslMotionGroup[] {
  const groups = pendingDslGroups
  pendingDslGroups = []
  return groups
}

/**
 * Convert one manifest motion entry into a `DslEntry`. Manifest keys are preserved
 * verbatim (PascalCase) since the runtime's DslEntry is structurally identical.
 * Returns undefined for `null`/non-object entries only — empty objects are kept as
 * pass-through entries (they still may define `NextMtn` via the group chain).
 */
function toDslEntry(raw: unknown): DslEntry | undefined {
  if (raw == null || typeof raw !== 'object')
    return undefined
  // The manifest shape already matches DslEntry (PascalCase keys + index signature).
  // Spread to detach from the renderer's mutable settings object.
  return { ...(raw as DslEntry) }
}

/**
 * Build DSL motion groups from a manifest's `motions` map.
 * `motions` is `{ [groupName]: entry[] }`. Order within a group is preserved (entries
 * are positional — `Next:idx` selects by index).
 */
export function captureDslGroups(motions: unknown): DslMotionGroup[] {
  if (motions == null || typeof motions !== 'object')
    return []

  const groups: DslMotionGroup[] = []
  for (const [name, entries] of Object.entries(motions as Record<string, unknown>)) {
    if (!Array.isArray(entries))
      continue
    const dslEntries = entries
      .map(toDslEntry)
      .filter((e): e is DslEntry => e !== undefined)
    groups.push({ name, entries: dslEntries })
  }
  return groups
}

/** Whether a group list carries any DSL payload beyond plain renderable motions. */
export function hasDslPayload(groups: readonly DslMotionGroup[]): boolean {
  return groups.some(g => g.entries.some(e =>
    e.VarFloats !== undefined
    || e.Choices !== undefined
    || e.Command !== undefined
    || e.PostCommand !== undefined
    || e.NextMtn !== undefined
    || e.Intimacy !== undefined
    || e.TimeLimit !== undefined,
  ))
}

import { vi } from 'vitest'

/**
 * Shared `layeredMemory` mock factory for stage-ui store suites.
 *
 * Convention mirrors `packages/nan0-runtime/src/test-utils/mock-system-one.ts`:
 * one factory whose output structurally matches the real module, plus a
 * contract test (`mock-layered-memory.test.ts`) that fails whenever the real
 * module gains or loses an export, so hand-rolled mock drift (e.g. a missing
 * `fetchStatus`, which previously caused 42 unhandled rejections) becomes a
 * failing test instead of stderr noise.
 *
 * `vi.mock` factories are hoisted — import this module lazily inside the
 * factory, never at the test file top level (exception to ts-no-dynamic-import:
 * a static top-level import is hoisted above `vi.mock` and crashes, so the
 * module specifier must be resolved inside the async factory):
 */

export const REAL_LAST_INDEXED_TURN_KEY = 'airi:search:last-indexed-turn'

export interface MockLayeredMemoryOverrides {
  lastIndexedTurnKey?: string
  layeredMemory?: Record<string, unknown>
  formatEvidenceContextBlock?: unknown
}

export function createMockLayeredMemoryModule(overrides: MockLayeredMemoryOverrides = {}): Record<string, unknown> {
  const layeredMemory: Record<string, unknown> = {
    lastTriage: null,
    lastSearchMode: 'baseline',
    lastIndexState: null,
    lastEmbedderStatus: null,
    isIndexing: false,
    isPersisting: false,
    init: vi.fn(async () => ({ stale: false, reason: null })),
    fetchStatus: vi.fn(async () => null),
    persist: vi.fn(async () => undefined),
    search: vi.fn(async () => []),
    indexDocuments: vi.fn(async () => undefined),
    removeDocument: vi.fn(async () => undefined),
    ...overrides.layeredMemory,
  }

  return {
    LAST_INDEXED_TURN_KEY: overrides.lastIndexedTurnKey ?? REAL_LAST_INDEXED_TURN_KEY,
    layeredMemory,
    formatEvidenceContextBlock: overrides.formatEvidenceContextBlock ?? vi.fn(() => ''),
  }
}

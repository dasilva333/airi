import type { TransportAdapter } from './transport'

/**
 * Runtime registry of transport adapters.
 *
 * The *interface* lives here (types only, consistent with `stage-shared`'s role);
 * the *implementation* (in-memory store, sovereign gate, lifecycle) lives in
 * the app that owns the runtime (stage-tamagotchi). Keeping the interface here
 * lets both the app and any future adapter package depend on the same contract
 * without a circular import.
 *
 * Sovereignty gate: `initialize(id, sovereign)` MUST throw (or reject) when the
 * named adapter has `capabilities.requiresExternalRelay === true` and
 * `sovereign === true`. This is what keeps Phase 1's Cloudflare purge from
 * being undone by the seam itself — a sovereign build simply cannot bring up a
 * cloud-relay adapter, even if one is registered.
 */
export interface TransportRegistry {
  /** Register an adapter. Re-registering the same `id` replaces the previous entry. */
  register: (adapter: TransportAdapter) => void
  /** Look up a registered adapter by id. */
  get: (id: string) => TransportAdapter | undefined
  /** Snapshot of all registered adapters (in registration order). */
  list: () => TransportAdapter[]
  /**
   * Initialize the named adapter. In sovereign mode (`sovereign === true`) an
   * adapter with `requiresExternalRelay === true` is refused.
   */
  initialize: (id: string, sovereign: boolean) => Promise<void>
}

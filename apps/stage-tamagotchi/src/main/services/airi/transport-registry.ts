import type { TransportAdapter, TransportRegistry } from '@proj-airi/stage-shared'

/**
 * In-memory implementation of {@link TransportRegistry}.
 *
 * Sovereignty gate: {@link TransportRegistry.initialize} refuses to bring up an
 * adapter whose `capabilities.requiresExternalRelay === true` when `sovereign`
 * is `true`. The refusal is a rejected `Promise` (not a synchronous throw) so
 * it matches the async signature and lets callers `await` uniformly.
 *
 * Unknown adapter ids and sovereign refusals are reported as distinct `Error`
 * messages so callers can tell them apart without parsing.
 */
export function createTransportRegistry(): TransportRegistry {
  const adapters = new Map<string, TransportAdapter>()
  // Snapshot of the sovereign-relevant flag captured at register() time, so a
  // later mutation of `adapter.capabilities` cannot bypass the gate.
  const relayFlags = new Map<string, boolean>()

  return {
    register(adapter: TransportAdapter): void {
      adapters.set(adapter.id, adapter)
      relayFlags.set(adapter.id, adapter.capabilities?.requiresExternalRelay ?? false)
    },

    get(id: string): TransportAdapter | undefined {
      return adapters.get(id)
    },

    list(): TransportAdapter[] {
      return [...adapters.values()]
    },

    async initialize(id: string, sovereign: boolean): Promise<void> {
      const adapter = adapters.get(id)
      if (!adapter) {
        throw new Error(`Unknown transport adapter: ${id}`)
      }
      if (sovereign && (relayFlags.get(id) ?? false)) {
        throw new Error(
          `Transport adapter '${id}' requires an external relay and is refused in sovereign mode`,
        )
      }
      if (adapter.initialize) {
        await adapter.initialize()
      }
      else {
        await adapter.start()
      }
    },
  }
}

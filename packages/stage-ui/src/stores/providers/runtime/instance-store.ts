import type { Ref, WritableComputedRef } from 'vue'

import type { ProviderInstanceConfig } from '../types'

import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

/**
 * Internal persisted shape for multi-instance provider options.
 *
 * instanceKey format: `${providerId}:${instanceId}`. The `'*'` record holds
 * the primary instance for each provider, so legacy single-instance callers
 * can keep addressing store state with the template providerId prefix.
 */
type PersistedProviderInstance = ProviderInstanceConfig

interface ProviderInstanceStoreSnapshot {
  version: 2
  instancesByInstanceKey: Record<string, PersistedProviderInstance>
}
const STORAGE_KEY = 'settings/credentials/providers'
const PRIMARY_INSTANCE_INFIX = '*'

type LegacyProviderCredentials = Record<string, Record<string, unknown>>

/**
 * Multi-instance persisted store adapter.
 *
 * The legacy Phase 1 shape was a single options dictionary per provider id.
 * Phase 3 normalizes storage into instance records (`providerId:instanceId`).
 * A single primary instance per provider (`providerId:*`) holds the options
 * that the entire legacy public surface reads and writes.
 */
export function createProviderInstanceStore() {
  const state = useLocalStorage<ProviderInstanceStoreSnapshot | LegacyProviderCredentials>(STORAGE_KEY, {
    version: 2,
    instancesByInstanceKey: {},
  }) as Ref<ProviderInstanceStoreSnapshot | LegacyProviderCredentials>

  function isLegacy(raw: any): raw is LegacyProviderCredentials {
    return !!raw && (raw.version !== 2 || typeof raw.instancesByInstanceKey !== 'object' || raw.instancesByInstanceKey === null)
  }

  function migrate() {
    if (!isLegacy(state.value))
      return

    const legacy = state.value as LegacyProviderCredentials
    const instancesByInstanceKey: ProviderInstanceStoreSnapshot['instancesByInstanceKey'] = {}

    for (const [providerId, options] of Object.entries(legacy)) {
      instancesByInstanceKey[`${providerId}:${PRIMARY_INSTANCE_INFIX}`] = normalizeInstance({
        id: PRIMARY_INSTANCE_INFIX,
        providerId,
        label: 'Default',
        options: options ?? {},
        isPrimary: true,
      }, providerId, PRIMARY_INSTANCE_INFIX)
    }

    state.value = { version: 2, instancesByInstanceKey }
  }

  function normalizeInstance(
    instance: Partial<ProviderInstanceConfig>,
    providerId: string,
    infix: string,
  ): PersistedProviderInstance {
    return {
      instanceId: `${providerId}:${infix}`,
      id: infix,
      providerId,
      label: instance.label ?? 'Default',
      options: instance.options ?? {},
      isPrimary: !!instance.isPrimary,
    }
  }

  function snapshot(): ProviderInstanceStoreSnapshot {
    migrate()
    return state.value as ProviderInstanceStoreSnapshot
  }

  function toStorageKey(providerId: string, instanceId?: string) {
    return `${providerId}:${instanceId ?? PRIMARY_INSTANCE_INFIX}`
  }

  function readRow(providerId: string, instanceId?: string) {
    const snap = snapshot()
    return snap.instancesByInstanceKey[toStorageKey(providerId, instanceId)]
  }

  function writeRow(instance: Omit<PersistedProviderInstance, 'instanceId'> & { instanceId?: string }) {
    const snap = snapshot()
    const rowForWrite = normalizeInstance(instance, instance.providerId, instance.id ?? PRIMARY_INSTANCE_INFIX)
    const storageKey = rowForWrite.instanceId
    snap.instancesByInstanceKey[storageKey] = rowForWrite
    return snap.instancesByInstanceKey[storageKey]
  }

  function getProviderInstanceConfig(providerId: string, instanceId?: string): PersistedProviderInstance {
    const existing = readRow(providerId, instanceId)
    if (existing)
      return existing
    const resolvedId = instanceId ?? PRIMARY_INSTANCE_INFIX
    const isDefault = resolvedId === PRIMARY_INSTANCE_INFIX
    return writeRow({
      id: resolvedId,
      providerId,
      label: 'Default',
      options: {},
      isPrimary: isDefault,
    })
  }

  function providerInstanceOptions(providerId: string, instanceId?: string) {
    return getProviderInstanceConfig(providerId, instanceId).options
  }

  function listInstances(providerId: string): ProviderInstanceConfig[] {
    const snap = snapshot()
    const prefix = `${providerId}:`
    const rows = Object.entries(snap.instancesByInstanceKey)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, row]) => row)
    return rows.slice().sort((a, b) => (a.isPrimary === b.isPrimary ? a.label.localeCompare(b.label) : a.isPrimary ? -1 : 1))
  }

  function setPrimaryInstance(providerId: string, instanceId: string) {
    const snap = snapshot()
    const prefix = `${providerId}:`
    for (const [key, row] of Object.entries(snap.instancesByInstanceKey)) {
      if (!key.startsWith(prefix))
        continue
      row.isPrimary = key === `${providerId}:${instanceId}`
    }
  }

  function setInstanceLabel(providerId: string, instanceId: string, label: string) {
    const row = getProviderInstanceConfig(providerId, instanceId)
    row.label = label
    writeRow(row)
  }

  function removeInstance(providerId: string, instanceId?: string) {
    const snap = snapshot()
    const key = `${providerId}:${instanceId ?? PRIMARY_INSTANCE_INFIX}`
    delete snap.instancesByInstanceKey[key]

    if (instanceId === undefined || instanceId === PRIMARY_INSTANCE_INFIX)
      return

    const remaining = listInstances(providerId)
    if (!remaining.some(row => row.id === PRIMARY_INSTANCE_INFIX)) {
      const fallback = remaining.find(row => row.isPrimary) ?? remaining[0]
      if (fallback) {
        snap.instancesByInstanceKey[toStorageKey(providerId, PRIMARY_INSTANCE_INFIX)] = normalizeInstance({
          ...fallback,
          id: PRIMARY_INSTANCE_INFIX,
          isPrimary: true,
        }, providerId, PRIMARY_INSTANCE_INFIX)
      }
    }
  }

  function removeAllInstances(providerId: string) {
    const snap = snapshot()
    const prefix = `${providerId}:`
    for (const key of Object.keys(snap.instancesByInstanceKey)) {
      if (key.startsWith(prefix))
        delete snap.instancesByInstanceKey[key]
    }
  }

  function ensurePrimaryInstance(providerId: string, template: Record<string, unknown> = {}) {
    const row = getProviderInstanceConfig(providerId, PRIMARY_INSTANCE_INFIX)
    if (Object.keys(row.options).length === 0 && Object.keys(template).length) {
      row.options = { ...template }
      writeRow(row)
    }
    return row
  }

  /**
   * Create a new named instance of a provider family.
   *
   * If no instances exist yet, materializes the implicit primary (`*`) from the
   * given template and returns it. Otherwise creates a second-record instance
   * keyed by the provided label.
   */
  function addInstance(providerId: string, label: string, template: Record<string, unknown> = {}) {
    const normalizedLabel = label.trim() || `Instance ${listInstances(providerId).length + 1}`
    const newId = `${providerId}:${normalizedLabel.toLowerCase().replace(/\W+/g, '-')}`

    const existing = snapshot().instancesByInstanceKey[newId]
    if (existing)
      return existing

    return writeRow({
      id: newId,
      providerId,
      label: normalizedLabel,
      options: { ...template },
      isPrimary: false,
    })
  }

  /**
   * Backward-compatible writable projection of the primary instance's options.
   *
   * Phase 1 shape: `providerCredentials.value[providerId] = { ... }`. External
   * callers (settings pages, composables) do nested sets such as
   * `credentials.value[id].apiKey = x` and occasional replacement
   * `credentials.value[id] = { ... }`. This computed ref preserves both forms
   * while storing data in the new per-instance shape.
   */
  const providerCredentials: WritableComputedRef<Record<string, Record<string, unknown>>> = computed({
    get: () => {
      const snap = snapshot()
      const out: Record<string, Record<string, unknown>> = {}
      for (const [key, row] of Object.entries(snap.instancesByInstanceKey)) {
        const providerId = key.split(':', 1)[0]
        const primaryKey = `${providerId}:${PRIMARY_INSTANCE_INFIX}`
        out[providerId] = snap.instancesByInstanceKey[primaryKey]?.options
          ?? (row.isPrimary ? row.options : undefined)
          ?? {}
      }
      return out
    },
    set: (next) => {
      const snap = snapshot()
      for (const [providerId, options] of Object.entries(next)) {
        snap.instancesByInstanceKey[`${providerId}:${PRIMARY_INSTANCE_INFIX}`] = normalizeInstance({
          instanceId: PRIMARY_INSTANCE_INFIX,
          providerId,
          label: 'Default',
          options: options ?? {},
          isPrimary: true,
        }, providerId, PRIMARY_INSTANCE_INFIX)
      }
    },
  })

  return {
    state,
    migrate,
    listInstances,
    getProviderInstanceConfig,
    providerInstanceOptions,
    addInstance,
    setPrimaryInstance,
    setInstanceLabel,
    removeInstance,
    removeAllInstances,
    ensurePrimaryInstance,
    providerCredentials,
  }
}

import type { ExternalFriend, Peer, SameAccountDevice, VaultDeviceMap } from '@proj-airi/stage-shared'

import { extractHandleAlias, mergeSameAccountDevices, toVaultDeviceMap } from '@proj-airi/stage-shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { peersRepo } from '../database/repos/peers.repo'

const PEERS_SYNC_CHANNEL = 'airi:peers-sync'
const MOCK_SEED_IDS = new Set(['peer-studio-mac', 'peer-macbook-air', 'ed25519-kirie-alex'])

export function getLocalMachineId(): string {
  if (typeof localStorage === 'undefined')
    return 'local-machine'
  const key = 'airi:peers:local-machine-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = `machine-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(key, id)
  }
  return id
}

export function getLocalDeviceAlias(): string {
  if (typeof window === 'undefined')
    return 'Desktop'

  const isElectron = Boolean((window as { electron?: unknown }).electron)
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''

  if (isElectron) {
    if (ua.includes('Macintosh') || ua.includes('Mac OS'))
      return 'Mac Desktop'
    if (ua.includes('Windows'))
      return 'Windows PC'
    return 'Desktop App'
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)
  if (isMobile)
    return 'Mobile Web'
  if (ua.includes('Macintosh') || ua.includes('Mac OS'))
    return 'Mac (Web Stage)'
  if (ua.includes('Windows'))
    return 'Windows (Web Stage)'
  return 'Web Stage'
}

export function createLocalDevice(): SameAccountDevice {
  const machineId = getLocalMachineId()
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')

  return {
    id: `peer-${machineId}`,
    alias: getLocalDeviceAlias(),
    characterName: 'AIRI',
    relationship: 'same-account',
    trustState: 'trusted',
    lastSeenTimestamp: Date.now(),
    endpoints: {},
    machineId,
    deviceType: isMobile ? 'pocket-mobile' : 'desktop',
  }
}

export const usePeersStore = defineStore('peers', () => {
  const roster = ref<Peer[]>([])
  const isInitialized = ref(false)

  const friends = computed(() => roster.value.filter(p => p.relationship === 'external-friend'))
  const devices = computed(() => roster.value.filter(p => p.relationship === 'same-account'))

  const currentMachineId = computed(() => getLocalMachineId())

  async function init() {
    if (isInitialized.value)
      return
    try {
      const stored = await peersRepo.getRoster()
      // Filter out any legacy prototype mock seeds if they were previously persisted
      const cleaned = (stored || []).filter(p => !MOCK_SEED_IDS.has(p.id))

      // Ensure local machine device is registered in the roster
      const machineId = getLocalMachineId()
      const existingIdx = cleaned.findIndex(p => p.relationship === 'same-account' && (p as SameAccountDevice).machineId === machineId)
      if (existingIdx < 0) {
        cleaned.unshift(createLocalDevice())
      }
      else {
        const local = cleaned[existingIdx] as SameAccountDevice
        if (!local.alias || local.alias === 'This device') {
          local.alias = getLocalDeviceAlias()
        }
      }

      roster.value = cleaned
      await peersRepo.saveRoster(roster.value)
    }
    catch {
      roster.value = [createLocalDevice()]
    }
    finally {
      isInitialized.value = true
    }
  }

  async function persist() {
    await peersRepo.saveRoster(roster.value)
    try {
      new BroadcastChannel(PEERS_SYNC_CHANNEL).postMessage({ type: 'peers-updated', at: Date.now() })
    }
    catch {
      // NOTICE: BroadcastChannel unavailable in some test / SSR contexts.
    }
  }

  async function upsertPeer(peer: Peer) {
    if (!isInitialized.value)
      await init()

    // If upserting a trusted external friend, clean up any placeholder/pending peer with matching handle/alias
    if (peer.relationship === 'external-friend' && peer.trustState === 'trusted') {
      const peerHandle = (peer as ExternalFriend).shareHandle?.toLowerCase()
      const peerAlias = (peer.alias || extractHandleAlias(peerHandle || ''))?.toLowerCase()

      roster.value = roster.value.filter((p) => {
        if (p.id === peer.id)
          return true
        if (p.relationship === 'external-friend' && p.trustState === 'pending') {
          const pFriend = p as ExternalFriend
          const pHandle = pFriend.shareHandle?.toLowerCase()
          const pAlias = (pFriend.alias || extractHandleAlias(pHandle || ''))?.toLowerCase()
          if (peerHandle && pHandle && (peerHandle === pHandle || peerHandle.includes(pHandle) || pHandle.includes(peerHandle)))
            return false
          if (peerAlias && pAlias && peerAlias === pAlias)
            return false
        }
        return true
      })
    }

    const idx = roster.value.findIndex(p => p.id === peer.id)
    if (idx >= 0)
      roster.value[idx] = peer
    else roster.value.push(peer)
    await persist()
  }

  async function removePeer(id: string) {
    if (!isInitialized.value)
      await init()
    roster.value = roster.value.filter(p => p.id !== id && (p as SameAccountDevice).machineId !== id)
    await persist()
  }

  async function renameLocalDevice(newAlias: string) {
    if (!isInitialized.value)
      await init()
    const trimmed = newAlias.trim()
    if (!trimmed)
      return
    const machineId = getLocalMachineId()
    const local = roster.value.find(p => p.relationship === 'same-account' && (p as SameAccountDevice).machineId === machineId) as SameAccountDevice | undefined
    if (local) {
      local.alias = trimmed
      await persist()
    }
  }

  function toVaultDeviceMapForSync(): VaultDeviceMap {
    return toVaultDeviceMap(roster.value.filter(p => p.relationship === 'same-account') as SameAccountDevice[])
  }

  async function mergeVaultDevices(vaultDevices: VaultDeviceMap) {
    if (!isInitialized.value)
      await init()
    const localDevices = roster.value.filter(p => p.relationship === 'same-account') as SameAccountDevice[]
    const mergedDevices = mergeSameAccountDevices(localDevices, vaultDevices)
    const friends = roster.value.filter(p => p.relationship !== 'same-account')
    roster.value = [...mergedDevices, ...friends]
    await persist()
  }

  return {
    roster,
    friends,
    devices,
    isInitialized,
    currentMachineId,
    init,
    upsertPeer,
    removePeer,
    renameLocalDevice,
    toVaultDeviceMapForSync,
    mergeVaultDevices,
  }
})

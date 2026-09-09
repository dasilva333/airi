// Merges two voice-profiles arrays stored in localStorage bridge objects.
export function mergeVoiceProfiles(localVal: any, remoteVal: any): any {
  if (!localVal)
    return remoteVal
  if (!remoteVal)
    return localVal

  try {
    const localRaw = typeof localVal === 'string' ? localVal : (localVal.value || '[]')
    const remoteRaw = typeof remoteVal === 'string' ? remoteVal : (remoteVal.value || '[]')

    let localArr: any[] = []
    let remoteArr: any[] = []

    try {
      localArr = typeof localRaw === 'string' ? JSON.parse(localRaw) : localRaw
    }
    catch (e) {
      console.error('[SyncEngine] Failed to parse local voice-profiles:', e)
    }

    try {
      remoteArr = typeof remoteRaw === 'string' ? JSON.parse(remoteRaw) : remoteRaw
    }
    catch (e) {
      console.error('[SyncEngine] Failed to parse remote voice-profiles:', e)
    }

    if (!Array.isArray(localArr))
      localArr = []
    if (!Array.isArray(remoteArr))
      remoteArr = []

    const mergedMap = new Map<string, any>()

    for (const item of localArr) {
      if (item && item.id) {
        mergedMap.set(item.id, item)
      }
    }

    for (const item of remoteArr) {
      if (item && item.id) {
        const existing = mergedMap.get(item.id)
        if (existing) {
          const existingTime = existing.updatedAt || existing.createdAt || 0
          const remoteTime = item.updatedAt || item.createdAt || 0
          if (remoteTime > existingTime) {
            mergedMap.set(item.id, item)
          }
        }
        else {
          mergedMap.set(item.id, item)
        }
      }
    }

    const mergedList = Array.from(mergedMap.values())
    const mergedValueStr = JSON.stringify(mergedList)

    return {
      value: mergedValueStr,
      originalKey: localVal.originalKey || remoteVal.originalKey || 'settings/speech/voice-profiles',
    }
  }
  catch (e) {
    console.error('[SyncEngine] Failed to merge voice profiles:', e)
    return localVal || remoteVal
  }
}

/**
 * Extracts allowed session IDs for characters selected in selective sync.
 * Prevents having to download remote chat and director session files just to inspect metadata.
 *
 * @param chatIndices Array of ChatSessionsIndex objects
 * @param selectiveCheckedIds Array of checked tree node IDs (e.g. ['chat-sylvia', 'metadata'])
 */
export function extractAllowedSessionIds(
  chatIndices: any[],
  selectiveCheckedIds: string[],
): Set<string> {
  const allowed = new Set<string>()
  const checkedSet = new Set(selectiveCheckedIds)
  const allChatsAllowed = checkedSet.has('chats')

  for (const rawIndex of chatIndices) {
    if (!rawIndex)
      continue
    let index = rawIndex
    if (typeof index === 'string') {
      try {
        index = JSON.parse(index)
      }
      catch {
        continue
      }
    }
    if (!index || typeof index !== 'object')
      continue

    const characters = index.characters || {}
    for (const [charId, charData] of Object.entries(characters)) {
      if (allChatsAllowed || checkedSet.has(`chat-${charId}`)) {
        const data = charData as any
        if (data?.sessions && typeof data.sessions === 'object') {
          for (const sessionId of Object.keys(data.sessions)) {
            if (sessionId)
              allowed.add(sessionId)
          }
        }
        if (data?.activeSessionId) {
          allowed.add(data.activeSessionId)
        }
      }
    }
  }

  return allowed
}

/**
 * Determines whether a mergeable key (e.g. airi-cards, memory, voice-profiles) can safely
 * skip remote download during reconciliation.
 *
 * Skips if:
 * 1. Outbox has no pending local mutations for this key.
 * 2. ETag matches remote ETag, OR local timestamp is at least as new as remote mtime.
 */
export function shouldSkipMergeableKey(
  localTime: number | undefined,
  remoteMtime: number,
  hasPendingOutbox: boolean,
  storedEtag?: string | null,
  remoteEtag?: string | null,
): boolean {
  if (hasPendingOutbox)
    return false
  if (storedEtag && remoteEtag && storedEtag === remoteEtag)
    return true
  if (localTime !== undefined && localTime >= remoteMtime)
    return true
  return false
}

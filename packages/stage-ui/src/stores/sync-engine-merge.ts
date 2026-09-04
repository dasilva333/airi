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

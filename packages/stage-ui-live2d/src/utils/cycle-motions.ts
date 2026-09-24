export interface Live2DAnimationDescriptor {
  motionName: string
  motionIndex: number
  fileName: string
  sound?: string
  text?: string
  language?: string
}

export interface ParsedLive2DCycleMotion {
  group: string
  index: number
}

/**
 * Parses card idleAnimations entries for Live2D models.
 *
 * Supports two key formats:
 * 1. Legacy/explicit index: `live2d:<group>:<index>` (e.g. `live2d:Idle:0`)
 * 2. Customizer file-path/key: `live2d:<filePath>` (e.g. `live2d:motions/idle_01.motion3.json`)
 *    which resolves against the model's available motion definitions.
 */
export function parseCycleMotions(
  idleAnimations: string[] | undefined,
  motionsList: Live2DAnimationDescriptor[] = [],
): ParsedLive2DCycleMotion[] {
  if (!idleAnimations || idleAnimations.length === 0)
    return []

  return idleAnimations
    .filter(k => typeof k === 'string' && k.startsWith('live2d:'))
    .map((k) => {
      const payload = k.slice('live2d:'.length)
      const parts = payload.split(':')
      // Format 1: live2d:<group>:<index>
      if (parts.length === 2 && !Number.isNaN(Number.parseInt(parts[1]))) {
        return {
          group: parts[0],
          index: Number.parseInt(parts[1]),
        }
      }

      // Format 2: live2d:<fileNameOrKey>
      const targetBase = payload.split(/[\\/]/).pop()?.toLowerCase()
      const matched = motionsList.find((m) => {
        if (m.fileName === payload || m.motionName === payload)
          return true
        const mBase = m.fileName?.split(/[\\/]/).pop()?.toLowerCase()
        return !!targetBase && targetBase === mBase
      })

      if (matched) {
        return {
          group: matched.motionName,
          index: matched.motionIndex,
        }
      }

      return null
    })
    .filter((m): m is ParsedLive2DCycleMotion => m !== null && Boolean(m.group) && !Number.isNaN(m.index))
}

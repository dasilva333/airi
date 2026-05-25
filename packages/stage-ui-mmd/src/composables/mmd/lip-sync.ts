import type { MMD } from '@moeru/three-mmd'
import { useAsyncState } from '@vueuse/core'
import type { Ref } from 'vue'
import { onUnmounted, watch } from 'vue'
import type { Profile } from 'wlipsync'
import { createWLipSyncNode } from 'wlipsync'

import profile from '../../assets/lip-sync-profile.json' with { type: 'json' }

/**
 * MMD morph target names for Japanese lip sync vowels.
 *
 * Before:
 * - wLipSync output keys: A, E, I, O, U
 *
 * After:
 * - MMD morph target names: あ, え, い, お, う
 */
const MMD_LIP_MORPH_MAP: Record<string, string> = {
  A: 'あ',
  E: 'え',
  I: 'い',
  O: 'お',
  U: 'う',
}

// Fallback English morph names used by some MMD models
const MMD_LIP_MORPH_MAP_EN: Record<string, string> = {
  A: 'a',
  E: 'e',
  I: 'i',
  O: 'o',
  U: 'u',
}

type LipKey = 'A' | 'E' | 'I' | 'O' | 'U'
const LIP_KEYS: LipKey[] = ['A', 'E', 'I', 'O', 'U']
const RAW_KEYS = ['A', 'E', 'I', 'O', 'U', 'S'] as const
const RAW_TO_LIP: Record<(typeof RAW_KEYS)[number], LipKey> = {
  A: 'A',
  E: 'E',
  I: 'I',
  O: 'O',
  S: 'I',
  U: 'U',
}

/**
 * MMD lip sync composable using wLipSync for real-time audio-driven mouth animation.
 *
 * Use when:
 * - Driving MMD model morph targets from an audio source
 *
 * Expects:
 * - The Web Audio AudioContext to use for the wLipSync node
 * - An audio source ref and a loaded MMD model with morph targets
 */
export function useMMDLipSync(audioContext: AudioContext, audioNode: Ref<AudioBufferSourceNode | undefined>) {
  const { state: lipSyncNode, isReady } = useAsyncState(createWLipSyncNode(audioContext, profile as Profile), undefined)

  const smoothState: Record<LipKey, number> = { A: 0, E: 0, I: 0, O: 0, U: 0 }
  const ATTACK = 50
  const RELEASE = 30
  const CAP = 0.7
  const SILENCE_VOL = 0.04
  const SILENCE_GAIN = 0.05
  const IDLE_MS = 160
  let lastActiveAt = 0

  watch(
    [isReady, audioNode],
    ([ready, newAudioNode], [, oldAudioNode]) => {
      if (oldAudioNode && oldAudioNode !== newAudioNode) {
        try {
          oldAudioNode.disconnect()
        } catch {}
      }
      if (!ready || !newAudioNode || !lipSyncNode.value) return
      try {
        newAudioNode.connect(lipSyncNode.value)
      } catch {}
    },
    { immediate: true },
  )

  onUnmounted(() => {
    try {
      audioNode.value?.disconnect()
    } catch {}
  })

  function resolveMorphIndex(mmd: MMD, lipKey: LipKey): number | undefined {
    const dict = mmd.mesh.morphTargetDictionary
    if (!dict) return undefined

    // Try Japanese name first, then English fallback
    const jpName = MMD_LIP_MORPH_MAP[lipKey]
    if (jpName && dict[jpName] != null) return dict[jpName]

    const enName = MMD_LIP_MORPH_MAP_EN[lipKey]
    if (enName && dict[enName] != null) return dict[enName]

    return undefined
  }

  function update(mmd?: MMD, delta = 0.016) {
    const node = lipSyncNode.value
    if (!mmd?.mesh.morphTargetInfluences || !node) return

    const vol = node.volume ?? 0
    const amp = Math.min(vol * 0.9, 1) ** 0.7

    const projected: Record<LipKey, number> = { A: 0, E: 0, I: 0, O: 0, U: 0 }
    for (const raw of RAW_KEYS) {
      const lip = RAW_TO_LIP[raw]
      const rawVal = node.weights[raw] ?? 0
      projected[lip] = Math.max(projected[lip], rawVal * amp)
    }

    // Winner + runner approach (same as VRM lip sync)
    let winner: LipKey = 'I'
    let runner: LipKey = 'E'
    let winnerVal = -Infinity
    let runnerVal = -Infinity
    for (const key of LIP_KEYS) {
      const val = projected[key]
      if (val > winnerVal) {
        runnerVal = winnerVal
        runner = winner
        winnerVal = val
        winner = key
      } else if (val > runnerVal) {
        runnerVal = val
        runner = key
      }
    }

    const now = performance.now()
    let silent = amp < SILENCE_VOL || winnerVal < SILENCE_GAIN
    if (!silent) lastActiveAt = now
    if (now - lastActiveAt > IDLE_MS) silent = true

    const target: Record<LipKey, number> = { A: 0, E: 0, I: 0, O: 0, U: 0 }
    if (!silent) {
      target[winner] = Math.min(CAP, winnerVal)
      target[runner] = Math.min(CAP, runnerVal * 0.6)
    }

    const dtMs = delta * 1000
    for (const key of LIP_KEYS) {
      const t = target[key]
      const speed = t > smoothState[key] ? ATTACK : RELEASE
      const step = (t - smoothState[key]) * Math.min(1, dtMs / (1000 / speed))
      smoothState[key] += step

      const morphIndex = resolveMorphIndex(mmd, key)
      if (morphIndex != null && mmd.mesh.morphTargetInfluences) {
        mmd.mesh.morphTargetInfluences[morphIndex] = smoothState[key]
      }
    }
  }

  return { update }
}

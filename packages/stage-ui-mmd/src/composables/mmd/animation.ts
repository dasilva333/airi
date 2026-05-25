import type { MMD } from '@moeru/three-mmd'
import { buildAnimation, VMDLoader } from '@moeru/three-mmd'
import type { AnimationClip } from 'three'

// Reuse a single VMDLoader instance across calls — it is stateless after loading.
const vmdLoader = new VMDLoader()

/**
 * Load a VMD animation file and build an AnimationClip for the given MMD model.
 *
 * Use when:
 * - Applying a VMD motion file to a loaded MMD model
 *
 * Expects:
 * - A valid VMD file URL and a loaded MMD instance with a skinned mesh
 *
 * Returns:
 * - An AnimationClip ready to be used with AnimationMixer, or undefined on failure
 */
export async function loadVMDAnimation(url: string, mmd: MMD): Promise<AnimationClip | undefined> {
  try {
    const vmdData = await vmdLoader.loadAsync(url)
    if (!vmdData) return undefined

    const clip = buildAnimation(vmdData, mmd.mesh)
    return clip
  } catch (error) {
    console.warn('[MMD] Failed to load VMD animation:', error)
    return undefined
  }
}

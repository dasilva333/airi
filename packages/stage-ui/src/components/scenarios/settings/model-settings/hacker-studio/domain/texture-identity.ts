/**
 * Texture identity/matching logic. The adapter supplies the glTF image index
 * and a stable fingerprint; this module owns precedence and the empty-
 * fingerprint guard that prevents unrelated textures from matching.
 */

export interface TextureMatchRef {
  index: number | null
  fingerprint: string | null
}

export function textureKeyForIdentity(ref: TextureMatchRef): number | string | null {
  if (ref.index !== null)
    return ref.index
  return ref.fingerprint
}

export function textureIdentitiesMatch(slot: TextureMatchRef, target: TextureMatchRef): boolean {
  if (target.index !== null && slot.index !== null)
    return slot.index === target.index
  if (!target.fingerprint)
    return false
  return slot.fingerprint === target.fingerprint
}

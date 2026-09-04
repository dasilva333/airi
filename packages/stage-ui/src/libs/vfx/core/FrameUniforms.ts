import { Color, Vector2, Vector3 } from 'three'

/**
 * Uniform objects shared by *every* custom VFX material, by identity.
 *
 * Because Three.js stores uniforms as `{ value }` objects, handing the same reference
 * to multiple materials means a single write per frame updates all of them.
 */
export const frame = {
  uTime: { value: 0 },
  uDelta: { value: 0 },
  uResolution: { value: new Vector2(1, 1) },
  /** Packed-RGBA depth of the opaque scene — drives soft particles. */
  uSceneDepth: { value: null as any },
  uCameraNear: { value: 0.1 },
  uCameraFar: { value: 400 },
  /** Equirectangular HDR used for cheap reflections in custom shaders. */
  uEnvMap: { value: null as any },
  /**
   * World-space direction toward the primary light source.
   */
  uLightDir: { value: new Vector3(0.45, 0.78, 0.44).normalize() },
  /** Global multipliers for shaders and glow */
  uShaderIntensity: { value: 1.0 },
  uGlobalGlow: { value: 1.0 },
}

/** Convenience helper: returns the shared uniform block every VFX material expects. */
export function sharedUniforms(extra: Record<string, { value: any }> = {}): Record<string, { value: any }> {
  return {
    uTime: frame.uTime,
    uResolution: frame.uResolution,
    uSceneDepth: frame.uSceneDepth,
    uCameraNear: frame.uCameraNear,
    uCameraFar: frame.uCameraFar,
    uLightDir: frame.uLightDir,
    uShaderIntensity: frame.uShaderIntensity,
    uGlobalGlow: frame.uGlobalGlow,
    ...extra,
  }
}

/** Shared color helper parsing hex, rgb, or Color instance. */
export function parseVfxColor(input: string | number | Color, fallback = 0xFFFFFF): Color {
  if (input instanceof Color)
    return input
  try {
    return new Color(input as any)
  }
  catch {
    return new Color(fallback)
  }
}

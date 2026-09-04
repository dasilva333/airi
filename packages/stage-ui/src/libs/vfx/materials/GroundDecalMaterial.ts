import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
} from 'three'

import { parseVfxColor, sharedUniforms } from '../core/FrameUniforms'
import { commonGLSL } from '../shaders/common.glsl'
import { noiseGLSL } from '../shaders/noise.glsl'

export const GroundDecalType = {
  FIRE: 0,
  ELECTRIC: 1,
  MAGIC: 2,
} as const

export type GroundDecalStyle = typeof GroundDecalType[keyof typeof GroundDecalType]

export interface GroundDecalSyncState {
  fade: number
  radius: number
  seed?: number
  palette?: {
    char?: string | Color
    crack?: string | Color
    ring?: string | Color
    core?: string | Color
  }
}

export function createGroundDecalMaterial(style: GroundDecalStyle = GroundDecalType.FIRE): ShaderMaterial {
  const defines: Record<string, string> = {}
  if (style === GroundDecalType.FIRE)
    defines.DECAL_FIRE = '1'
  else if (style === GroundDecalType.ELECTRIC)
    defines.DECAL_ELECTRIC = '1'
  else if (style === GroundDecalType.MAGIC)
    defines.DECAL_MAGIC = '1'

  const material = new ShaderMaterial({
    defines,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    toneMapped: false,
    uniforms: sharedUniforms({
      uFade: { value: 0.0 },
      uRadius: { value: 1.5 },
      uSeed: { value: 0.0 },
      uGlow: { value: 2.2 },

      // Colors
      uColorChar: { value: new Color('#0a0503') },
      uColorCrack: { value: new Color('#ff5a10') },
      uColorRing: { value: new Color('#ff7a1e') },
      uColorCore: { value: new Color('#fff2bf') },
    }),
    vertexShader: GROUND_VERTEX,
    fragmentShader: GROUND_FRAGMENT,
  })

  material.userData.sync = (state: GroundDecalSyncState) => {
    const u = material.uniforms
    u.uFade.value = state.fade
    u.uRadius.value = state.radius
    if (state.seed !== undefined)
      u.uSeed.value = state.seed

    if (state.palette) {
      if (state.palette.char)
        (u.uColorChar.value as Color).set(parseVfxColor(state.palette.char))
      if (state.palette.crack)
        (u.uColorCrack.value as Color).set(parseVfxColor(state.palette.crack))
      if (state.palette.ring)
        (u.uColorRing.value as Color).set(parseVfxColor(state.palette.ring))
      if (state.palette.core)
        (u.uColorCore.value as Color).set(parseVfxColor(state.palette.core))
    }
  }

  return material
}

const GROUND_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const GROUND_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform float uRadius;
  uniform float uSeed;
  uniform float uGlow;

  uniform vec3 uColorChar;
  uniform vec3 uColorCrack;
  uniform vec3 uColorRing;
  uniform vec3 uColorCore;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  ${noiseGLSL}
  ${commonGLSL}

  void main() {
    if (uFade <= 0.002) discard;

    // Centered coordinates from -1 to 1
    vec2 p = vUv * 2.0 - 1.0;
    float dist = length(p);
    if (dist > 1.0) discard;

    float angle = atan(p.y, p.x);
    vec3 color = vec3(0.0);
    float alpha = 0.0;

#ifdef DECAL_FIRE
    // Organic torn boundary
    float tear = snoise(vec3(p * 3.5, uSeed + 1.2)) * 0.12;
    float boundary = smoothstep(0.95 + tear, 0.65, dist);

    // Glowing crack veins using cellular / domain-warped noise
    vec2 warp = vec2(
      snoise(vec3(p * 4.0, uTime * 0.2)),
      snoise(vec3(p * 4.0 + 17.3, uTime * 0.2))
    ) * 0.35;
    float cracks = abs(snoise(vec3((p + warp) * 5.0, uSeed + 3.1)));
    cracks = pow(1.0 - clamp(cracks, 0.0, 1.0), 3.5);

    // Outer molten ring
    float ring = smoothstep(0.08, 0.0, abs(dist - 0.72 + tear * 0.5));

    // Burnt char base with burning cracks
    vec3 charColor = mix(uColorChar, uColorCrack, cracks * 1.5);
    color = mix(charColor, uColorRing, ring * 0.85);
    color = mix(color, uColorCore, cracks * ring * 1.8);

    alpha = boundary * uFade * (0.6 + cracks * 0.7 + ring * 0.8);
#endif

#ifdef DECAL_ELECTRIC
    // High-voltage concentric discharge rings
    float ring1 = smoothstep(0.04, 0.0, abs(dist - 0.55));
    float ring2 = smoothstep(0.03, 0.0, abs(dist - 0.82));

    // Radial lightning sparks around circle
    float spokes = sin(angle * 14.0 + uTime * 6.0 + snoise(vec3(p * 8.0, uTime * 4.0)) * 3.0);
    spokes = pow(clamp(spokes, 0.0, 1.0), 4.0);

    float boundary = smoothstep(1.0, 0.8, dist);
    color = mix(uColorCrack, uColorRing, dist);
    color = mix(color, uColorCore, (ring1 + ring2 + spokes * 0.7) * 1.2);

    alpha = boundary * uFade * ((ring1 + ring2) * 1.2 + spokes * 0.8 + 0.15);
#endif

#ifdef DECAL_MAGIC
    // Rotating concentric mystic rings
    float r1 = smoothstep(0.025, 0.0, abs(dist - 0.88));
    float r2 = smoothstep(0.018, 0.0, abs(dist - 0.78));
    float r3 = smoothstep(0.022, 0.0, abs(dist - 0.42));

    // Arcane glyph hash divisions
    float glyphRot = angle + uTime * 0.4;
    float glyphSegments = sin(glyphRot * 12.0);
    float glyphMask = smoothstep(0.3, 0.35, abs(glyphSegments)) * smoothstep(0.06, 0.0, abs(dist - 0.83));

    // Inner rotating triangle / star pattern
    float innerStar = sin(angle * 3.0 - uTime * 0.6) * 0.15 + 0.35;
    float innerRing = smoothstep(0.02, 0.0, abs(dist - innerStar));

    float boundary = smoothstep(0.98, 0.85, dist);
    color = mix(uColorRing, uColorCrack, dist);
    color = mix(color, uColorCore, (r1 + r2 + r3 + glyphMask + innerRing) * 1.4);

    alpha = boundary * uFade * ((r1 + r2 + r3 + glyphMask * 1.3 + innerRing) * 1.1 + 0.1);
#endif

    color *= uGlow;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`

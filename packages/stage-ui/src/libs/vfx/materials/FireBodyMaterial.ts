import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector3,
  Vector4,
} from 'three'

import { parseVfxColor, sharedUniforms } from '../core/FrameUniforms'
import { commonGLSL } from '../shaders/common.glsl'
import { noiseGLSL } from '../shaders/noise.glsl'

export const FlamePass = {
  FLAME: 0,
  GLOW: 1,
} as const

export type FlamePassType = typeof FlamePass[keyof typeof FlamePass]

export const MAX_FLAME_BONES = 40

export interface FireBodySyncState {
  strength: number
  seed?: number
  right?: Vector3
  forward?: Vector3
  height?: number
  flameHeight?: number
  boneA?: Vector4[]
  boneB?: Vector4[]
  boneCount?: number
  palette?: {
    core?: string | Color
    flame?: string | Color
    ember?: string | Color
    smoke?: string | Color
  }
}

export function createFireBodyMaterial(pass: FlamePassType = FlamePass.FLAME): ShaderMaterial {
  const glow = pass === FlamePass.GLOW

  const material = new ShaderMaterial({
    defines: glow
      ? { FLAME_GLOW: '', FLAME_BONES: MAX_FLAME_BONES }
      : { FLAME_BONES: MAX_FLAME_BONES },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    uniforms: sharedUniforms({
      uSeed: { value: 0 },
      uStrength: { value: 0 },

      uRight: { value: new Vector3(1, 0, 0) },
      uForward: { value: new Vector3(0, 0, 1) },
      uBoneA: { value: Array.from({ length: MAX_FLAME_BONES }, () => new Vector4()) },
      uBoneB: { value: Array.from({ length: MAX_FLAME_BONES }, () => new Vector4()) },
      uBoneCount: { value: 0 },
      uThickness: { value: 1.0 },
      uOffset: { value: 0.02 },
      uLimbRef: { value: 0.15 },
      uLimbTaper: { value: 0.85 },
      uBend: { value: 1.9 },
      uWrap: { value: 1.1 },

      uRate: { value: 1.35 },
      uLife: { value: 0.95 },
      uSprout: { value: 0.35 },
      uLength: { value: 0.62 },
      uLengthVary: { value: 0.5 },
      uLean: { value: 0.16 },
      uClimb: { value: 0.35 },

      uSway: { value: 0.13 },
      uSwayPower: { value: 1.4 },
      uSwayScale: { value: 2.1 },
      uSwaySpeed: { value: 1.6 },

      uWidth: { value: 0.11 },
      uWidthScale: { value: glow ? 2.2 : 1.0 },
      uWidthVary: { value: 0.4 },
      uTaper: { value: 1.2 },
      uRootPinch: { value: 0.12 },
      uBank: { value: 0.55 },

      uSharp: { value: 1.8 },
      uGlowFalloff: { value: 2.2 },
      uTear: { value: 0.72 },
      uTearScale: { value: 5.5 },
      uTearCross: { value: 1.6 },
      uTearSpeed: { value: 3.2 },
      uTearBias: { value: 0.38 },
      uHeatBias: { value: 1.1 },
      uCoreSize: { value: 0.8 },
      uSmoke: { value: 0.6 },

      uFlicker: { value: 0.25 },
      uFlickerSpeed: { value: 18.0 },
      uStrandFade: { value: 0.5 },
      uPassOpacity: { value: glow ? 0.38 : 0.92 },
      uOpacity: { value: 1.0 },
      uGlow: { value: glow ? 1.4 : 2.2 },
      uSoftFade: { value: 0.25 },

      uColorCore: { value: new Color(1, 0.95, 0.75) },
      uColorFlame: { value: new Color(1, 0.45, 0.08) },
      uColorEmber: { value: new Color(0.65, 0.12, 0.02) },
      uColorSmoke: { value: new Color(0.08, 0.05, 0.05) },
    }),
    vertexShader: FLAME_VERTEX,
    fragmentShader: FLAME_FRAGMENT,
  })

  material.userData.sync = (state: FireBodySyncState) => {
    const u = material.uniforms
    u.uStrength.value = state.strength
    if (state.seed !== undefined)
      u.uSeed.value = state.seed
    if (state.right)
      u.uRight.value.copy(state.right)
    if (state.forward)
      u.uForward.value.copy(state.forward)
    if (state.height)
      u.uLimbRef.value = state.height * 0.085
    if (state.flameHeight !== undefined)
      u.uLength.value = state.flameHeight

    if (state.boneA && state.boneB && state.boneCount !== undefined) {
      u.uBoneA.value = state.boneA
      u.uBoneB.value = state.boneB
      u.uBoneCount.value = state.boneCount
    }

    if (state.palette) {
      if (state.palette.core)
        (u.uColorCore.value as Color).set(parseVfxColor(state.palette.core))
      if (state.palette.flame)
        (u.uColorFlame.value as Color).set(parseVfxColor(state.palette.flame))
      if (state.palette.ember)
        (u.uColorEmber.value as Color).set(parseVfxColor(state.palette.ember))
      if (state.palette.smoke)
        (u.uColorSmoke.value as Color).set(parseVfxColor(state.palette.smoke))
    }
  }

  return material
}

const FLAME_VERTEX = /* glsl */ `
  #define PI  3.141592653589793
  #define TAU 6.283185307179586

  uniform float uTime;
  uniform float uSeed;
  uniform float uStrength;

  uniform vec3  uRight;
  uniform vec3  uForward;
  uniform vec4  uBoneA[FLAME_BONES];
  uniform vec4  uBoneB[FLAME_BONES];
  uniform float uBoneCount;
  uniform float uThickness;
  uniform float uOffset;
  uniform float uLimbRef;
  uniform float uLimbTaper;
  uniform float uBend;
  uniform float uWrap;

  uniform float uRate;
  uniform float uLife;
  uniform float uSprout;
  uniform float uLength;
  uniform float uLengthVary;
  uniform float uLean;
  uniform float uClimb;

  uniform float uSway;
  uniform float uSwayPower;
  uniform float uSwayScale;
  uniform float uSwaySpeed;

  uniform float uWidth;
  uniform float uWidthScale;
  uniform float uWidthVary;
  uniform float uTaper;
  uniform float uRootPinch;
  uniform float uBank;

  attribute float aStrand;

  varying float vT;
  varying float vSide;
  varying float vStrand;
  varying float vSeed;
  varying float vLive;
  varying float vHeat;
  varying float vViewZ;

  ${noiseGLSL}

  vec3 bonePoint(float slot, float along, float a, float outward,
                 out vec3 away, out vec3 limbUp, out vec3 n1, out vec3 n2,
                 out float radius) {
    float top = max(uBoneCount - 1.0, 0.0);
    int idx = int(clamp(floor(slot), 0.0, top));
    vec4 head = uBoneA[idx];
    vec4 tail = uBoneB[idx];

    vec3 axis = tail.xyz - head.xyz;
    float len = length(axis);
    vec3 dir = len > 1e-5 ? axis / len : vec3(0.0, 1.0, 0.0);

    vec3 ref = abs(dot(dir, uRight)) > 0.9 ? uForward : uRight;
    n1 = normalize(cross(dir, ref));
    n2 = cross(dir, n1);

    limbUp = dir * (dot(dir, vec3(0.0, 1.0, 0.0)) >= 0.0 ? 1.0 : -1.0);
    radius = head.w;

    away = n1 * cos(a) + n2 * sin(a);
    return mix(head.xyz, tail.xyz, clamp(along, 0.0, 1.0))
         + away * (head.w * uThickness + outward);
  }

  vec3 tonguePoint(float t, vec3 root, vec3 away, vec3 limbUp, vec3 n1, vec3 n2,
                   float a, float len, float scale, float seed) {
    float k = clamp(t, 0.0, 1.0);
    float bend = pow(k, max(uBend, 0.05));
    vec3 climb = normalize(mix(limbUp, vec3(0.0, 1.0, 0.0), bend));
    vec3 p = root + climb * (k * len);

    float wound = a + uWrap * k;
    vec3 radial = n1 * cos(wound) + n2 * sin(wound);
    p += mix(away, radial, smoothstep(0.0, 0.5, k)) * uLean * k * k;

    float sway = uSway * pow(k, max(uSwayPower, 0.05)) * scale;
    float y = k * uSwayScale - uTime * uSwaySpeed;
    p += uRight * snoise(vec3(seed, y, 0.0)) * sway;
    p += uForward * snoise(vec3(seed + 31.7, y, 5.13)) * sway;
    return p;
  }

  void main() {
    float t = position.x;
    float side = position.y;
    vT = t;
    vSide = side;

    float phase = hash11(aStrand * 3.71 + uSeed * 0.13);
    float cycle = uTime * max(uRate, 0.01) + phase;
    float born = floor(cycle);
    float k = fract(cycle);
    float seed = hash11(aStrand * 7.13 + born * 3.77 + uSeed) * 97.0;
    vSeed = seed;

    float life = clamp(uLife, 0.05, 1.0);
    vLive = smoothstep(0.0, life * 0.22, k) * (1.0 - smoothstep(life * 0.45, life, k));

    vec3 away, limbUp, n1, n2;
    float radius;
    float bearing = hash11(seed + 4.7) * TAU;
    vec3 root = bonePoint(
      hash11(seed + 1.7) * uBoneCount,
      hash11(seed + 2.3),
      bearing,
      uOffset,
      away, limbUp, n1, n2, radius
    );

    float grow = mix(clamp(uSprout, 0.0, 1.0), 1.0, smoothstep(0.0, life * 0.55, k));
    float limb = mix(1.0, clamp(radius / max(uLimbRef, 1e-4), 0.35, 1.5), clamp(uLimbTaper, 0.0, 1.0));
    float vary = mix(1.0 - clamp(uLengthVary, 0.0, 0.95), 1.0, hash11(seed + 3.1));
    float scale = limb * vary;
    float len = uLength * scale * grow;
    root.y += uClimb * (k / max(uRate, 0.01));

    vec3 here = tonguePoint(t, root, away, limbUp, n1, n2, bearing, len, scale, seed);

    float step_ = 0.03;
    float ahead = t + step_;
    float flip = 1.0;
    if (ahead > 1.0) { ahead = t - step_; flip = -1.0; }
    vec3 next = tonguePoint(ahead, root, away, limbUp, n1, n2, bearing, len, scale, seed);
    vec3 tangent = (next - here) * flip;
    tangent = length(tangent) > 1e-5 ? normalize(tangent) : vec3(0.0, 1.0, 0.0);

    vec3 toCamera = normalize(cameraPosition - here);
    vec3 billboard = cross(tangent, toCamera);
    billboard = length(billboard) > 1e-4 ? normalize(billboard) : away;
    vec3 sheet = cross(tangent, away);
    sheet = length(sheet) > 1e-4 ? normalize(sheet) : billboard;
    vec3 binormal = normalize(mix(billboard, sheet, clamp(uBank, 0.0, 1.0)));

    vStrand = hash11(seed + 8.4);
    float taper = pow(1.0 - t, max(uTaper, 0.05)) * smoothstep(0.0, max(uRootPinch, 1e-3), t);
    float halfWidth = uWidth * uWidthScale * taper;
    halfWidth *= mix(1.0 - clamp(uWidthVary, 0.0, 0.95), 1.0, vStrand);
    halfWidth *= mix(1.0, limb, clamp(uLimbTaper, 0.0, 1.0));
    halfWidth *= vLive * uStrength;

    vHeat = (1.0 - t) * mix(0.55, 1.0, vLive);

    vec4 mv = viewMatrix * vec4(here + binormal * side * halfWidth, 1.0);
    vViewZ = mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uStrength;

  uniform float uSharp;
  uniform float uGlowFalloff;
  uniform float uTear;
  uniform float uTearScale;
  uniform float uTearCross;
  uniform float uTearSpeed;
  uniform float uTearBias;
  uniform float uHeatBias;
  uniform float uCoreSize;
  uniform float uSmoke;

  uniform float uFlicker;
  uniform float uFlickerSpeed;
  uniform float uStrandFade;
  uniform float uPassOpacity;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uSoftFade;

  uniform vec3  uColorCore;
  uniform vec3  uColorFlame;
  uniform vec3  uColorEmber;
  uniform vec3  uColorSmoke;

  uniform float uGlobalGlow;
  uniform vec2  uResolution;
  uniform sampler2D uSceneDepth;
  uniform float uCameraNear;
  uniform float uCameraFar;

  varying float vT;
  varying float vSide;
  varying float vStrand;
  varying float vSeed;
  varying float vLive;
  varying float vHeat;
  varying float vViewZ;

  ${noiseGLSL}
  ${commonGLSL}

  void main() {
    if (vLive <= 0.002) discard;

    float v = clamp(abs(vSide), 0.0, 1.0);

    float field = fbm3(vec3(
      vT * uTearScale - uTime * uTearSpeed,
      vSide * uTearCross,
      vSeed * 2.7
    )) * 0.5 + 0.5;

    #ifdef FLAME_GLOW
      float profile = pow(1.0 - v, max(uGlowFalloff, 0.05));
      float alpha = profile * mix(1.0, 0.35, vT);
      float heat = clamp(vHeat * uHeatBias * profile, 0.0, 1.0);
      vec3 color = mix(uColorEmber, uColorFlame, heat);
    #else
      float profile = pow(1.0 - v, max(uSharp, 0.05));
      float cut = mix(uTearBias * 0.35, uTearBias, vT) * clamp(uTear, 0.0, 1.0);
      float burn = smoothstep(cut, cut + 0.22, field);

      float alpha = profile * burn;
      float heat = clamp(field * profile * vHeat * uHeatBias, 0.0, 1.0);
      vec3 color = gradient4(uColorSmoke, uColorEmber, uColorFlame, uColorCore,
                             pow(heat, max(uCoreSize, 0.05)));
      color = mix(color, uColorSmoke, clamp((1.0 - burn) * uSmoke, 0.0, 1.0));
    #endif

    float flicker = 1.0 - uFlicker * hash11(floor(uTime * uFlickerSpeed) + uSeed);
    flicker *= 1.0 - uFlicker * 0.5 * hash11(floor(uTime * uFlickerSpeed * 1.7) + vSeed);

    alpha *= vLive * flicker * uStrength * uPassOpacity * uOpacity;
    alpha *= mix(1.0, clamp(uStrandFade, 0.0, 1.0), vStrand);

    vec2 screenUV = gl_FragCoord.xy / uResolution;
    alpha *= softFade(uSceneDepth, screenUV, vViewZ, uCameraNear, uCameraFar, uSoftFade);
    if (alpha < 0.003) discard;

    color *= uGlow * uGlobalGlow;
    gl_FragColor = vec4(color, alpha);
  }
`

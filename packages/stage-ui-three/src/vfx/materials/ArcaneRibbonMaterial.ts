import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector3,
} from 'three'

import { parseVfxColor, sharedUniforms } from '../core/FrameUniforms'
import { commonGLSL } from '../shaders/common.glsl'
import { noiseGLSL } from '../shaders/noise.glsl'

export const RibbonPass = {
  BAND: 0,
  GLOW: 1,
} as const

export type RibbonPassType = typeof RibbonPass[keyof typeof RibbonPass]

export interface ArcaneRibbonSyncState {
  base: Vector3
  right: Vector3
  forward: Vector3
  height: number
  strength: number
  seed?: number
  count?: number
  palette?: {
    core?: string | Color
    inner?: string | Color
    outer?: string | Color
    halo?: string | Color
  }
}

export function createArcaneRibbonMaterial(pass: RibbonPassType = RibbonPass.BAND): ShaderMaterial {
  const glow = pass === RibbonPass.GLOW

  const material = new ShaderMaterial({
    defines: glow ? { RIBBON_GLOW: '' } : {},
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    uniforms: sharedUniforms({
      uSeed: { value: 0 },
      uStrength: { value: 0 },
      uCount: { value: 7 },

      uBase: { value: new Vector3() },
      uRight: { value: new Vector3(1, 0, 0) },
      uForward: { value: new Vector3(0, 0, 1) },
      uHeight: { value: 1.8 },

      uRadius: { value: 1.15 },
      uRadiusVary: { value: 0.22 },
      uDepth: { value: 1 },
      uFlare: { value: 0.65 },
      uLow: { value: -0.05 },
      uHigh: { value: 1.15 },
      uScatter: { value: 1.4 },

      uTurns: { value: 1.15 },
      uTurnVary: { value: 0.35 },
      uSpin: { value: 0.28 },
      uSpinVary: { value: 0.3 },
      uCounter: { value: 0.25 },
      uClimb: { value: 0.35 },

      uWobble: { value: 0.16 },
      uWobbleScale: { value: 2.2 },
      uWave: { value: 0.18 },
      uWaveScale: { value: 1.8 },
      uCrawl: { value: 0.35 },

      uRate: { value: 0.32 },
      uLife: { value: 0.92 },

      uWidth: { value: 0.42 },
      uWidthScale: { value: glow ? 2.4 : 1 },
      uWidthVary: { value: 0.4 },
      uTaper: { value: 0.75 },
      uBank: { value: 0.35 },

      uFill: { value: 0.35 },
      uFillFalloff: { value: 1.6 },
      uEdge: { value: 0.9 },
      uEdgeWidth: { value: 0.34 },
      uGlowFalloff: { value: 2.2 },

      uWisp: { value: 0.75 },
      uWispScale: { value: 3.4 },
      uWispCross: { value: 0.9 },
      uWispSpeed: { value: 0.5 },
      uWispSharp: { value: 1.4 },
      uEndFade: { value: 0.22 },

      uFlicker: { value: 0.12 },
      uFlickerSpeed: { value: 9 },
      uStrandFade: { value: 0.55 },
      uPassOpacity: { value: glow ? 0.35 : 1 },
      uOpacity: { value: 1 },
      uGlow: { value: 2.2 },
      uSoftFade: { value: 0.5 },

      uColorCore: { value: new Color(1, 0.86, 1) },
      uColorInner: { value: new Color(0.85, 0.35, 1) },
      uColorOuter: { value: new Color(0.45, 0.09, 0.85) },
      uColorHalo: { value: new Color(0.16, 0.02, 0.36) },
    }),
    vertexShader: RIBBON_VERTEX,
    fragmentShader: RIBBON_FRAGMENT,
  })

  material.userData.sync = (state: ArcaneRibbonSyncState) => {
    const u = material.uniforms
    u.uBase.value.copy(state.base)
    u.uRight.value.copy(state.right)
    u.uForward.value.copy(state.forward)
    u.uHeight.value = state.height
    u.uStrength.value = state.strength
    if (state.seed !== undefined)
      u.uSeed.value = state.seed
    if (state.count !== undefined)
      u.uCount.value = state.count

    if (state.palette) {
      if (state.palette.core)
        (u.uColorCore.value as Color).set(parseVfxColor(state.palette.core))
      if (state.palette.inner)
        (u.uColorInner.value as Color).set(parseVfxColor(state.palette.inner))
      if (state.palette.outer)
        (u.uColorOuter.value as Color).set(parseVfxColor(state.palette.outer))
      if (state.palette.halo)
        (u.uColorHalo.value as Color).set(parseVfxColor(state.palette.halo))
    }
  }

  return material
}

const RIBBON_VERTEX = /* glsl */ `
  #define PI  3.141592653589793
  #define TAU 6.283185307179586

  uniform float uTime;
  uniform float uSeed;
  uniform float uStrength;
  uniform float uCount;

  uniform vec3  uBase;
  uniform vec3  uRight;
  uniform vec3  uForward;
  uniform float uHeight;

  uniform float uRadius;
  uniform float uRadiusVary;
  uniform float uDepth;
  uniform float uFlare;
  uniform float uLow;
  uniform float uHigh;
  uniform float uScatter;

  uniform float uTurns;
  uniform float uTurnVary;
  uniform float uSpin;
  uniform float uSpinVary;
  uniform float uCounter;
  uniform float uClimb;

  uniform float uWobble;
  uniform float uWobbleScale;
  uniform float uWave;
  uniform float uWaveScale;
  uniform float uCrawl;

  uniform float uRate;
  uniform float uLife;

  uniform float uWidth;
  uniform float uWidthScale;
  uniform float uWidthVary;
  uniform float uTaper;
  uniform float uBank;

  attribute float aStrand;

  varying float vT;
  varying float vSide;
  varying float vStrand;
  varying float vSeed;
  varying float vLive;
  varying float vViewZ;

  ${noiseGLSL}

  vec3 ribbonPoint(float t, float a0, float radius, float turns, float spin, float lift, float seed) {
    float k = clamp(t, 0.0, 1.0);
    float a = a0 + k * turns * TAU + spin;

    float profile = mix(1.0, 0.55 + 0.72 * sin(k * PI), clamp(uFlare, 0.0, 1.0));
    float r = radius * profile + uWobble * snoise(vec3(k * uWobbleScale, seed, uTime * uCrawl));
    float h = mix(uLow, uHigh, k) * uHeight + lift +
              uWave * snoise(vec3(k * uWaveScale + 11.7, seed * 1.7, uTime * uCrawl * 0.8));

    return uBase
      + vec3(0.0, h, 0.0)
      + uRight * (cos(a) * r)
      + uForward * (sin(a) * r * uDepth);
  }

  void main() {
    float t = position.x;
    float side = position.y;
    vT = t;
    vSide = side;

    float phase = hash11(aStrand * 5.17 + uSeed * 0.19);
    float cycle = uTime * max(uRate, 0.001) + phase;
    float turn = floor(cycle);
    float k = fract(cycle);
    float seed = hash11(aStrand * 9.31 + turn * 4.13 + uSeed) * 83.0;
    vSeed = seed;

    float life = clamp(uLife, 0.05, 1.0);
    vLive = smoothstep(0.0, life * 0.45, k) * (1.0 - smoothstep(life * 0.55, life, k));

    float a0 = (aStrand / max(uCount, 1.0)) * TAU + hash11(seed + 1.3) * uScatter;
    float radius = uRadius * (1.0 + (hash11(seed + 2.7) - 0.5) * 2.0 * uRadiusVary);
    float turns = uTurns * (1.0 + (hash11(seed + 3.9) - 0.5) * 2.0 * uTurnVary);

    float dir = mix(1.0, -1.0, step(hash11(seed + 4.5), clamp(uCounter, 0.0, 1.0)));
    float rate = uSpin * (1.0 + (hash11(seed + 5.1) - 0.5) * 2.0 * uSpinVary);
    float spin = uTime * rate * TAU * dir;
    float lift = uClimb * (k / max(uRate, 0.001));

    vec3 here = ribbonPoint(t, a0, radius, turns, spin, lift, seed);

    float step_ = 0.02;
    float ahead = t + step_;
    float flip = 1.0;
    if (ahead > 1.0) { ahead = t - step_; flip = -1.0; }
    vec3 next = ribbonPoint(ahead, a0, radius, turns, spin, lift, seed);
    vec3 tangent = (next - here) * flip;
    tangent = length(tangent) > 1e-5 ? normalize(tangent) : vec3(0.0, 1.0, 0.0);

    vec3 spine = uBase + vec3(0.0, here.y - uBase.y, 0.0);
    vec3 radial = here - spine;
    radial = length(radial) > 1e-4 ? normalize(radial) : uRight;

    vec3 geo = cross(tangent, radial);
    geo = length(geo) > 1e-4 ? normalize(geo) : vec3(0.0, 1.0, 0.0);

    vec3 toCamera = normalize(cameraPosition - here);
    vec3 billboard = cross(tangent, toCamera);
    billboard = length(billboard) > 1e-4 ? normalize(billboard) : geo;

    vec3 binormal = mix(billboard, geo, clamp(uBank, 0.0, 1.0));
    binormal = length(binormal) > 1e-4 ? normalize(binormal) : billboard;

    vStrand = hash11(seed + 6.8);
    float taper = pow(max(sin(t * PI), 0.0), max(uTaper, 0.01));
    float halfWidth = uWidth * uWidthScale * taper;
    halfWidth *= mix(1.0 - clamp(uWidthVary, 0.0, 0.95), 1.0, vStrand);
    halfWidth *= vLive * uStrength;

    vec4 mv = viewMatrix * vec4(here + binormal * side * halfWidth, 1.0);
    vViewZ = mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const RIBBON_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uStrength;

  uniform float uFill;
  uniform float uFillFalloff;
  uniform float uEdge;
  uniform float uEdgeWidth;
  uniform float uGlowFalloff;

  uniform float uWisp;
  uniform float uWispScale;
  uniform float uWispCross;
  uniform float uWispSpeed;
  uniform float uWispSharp;
  uniform float uEndFade;

  uniform float uFlicker;
  uniform float uFlickerSpeed;
  uniform float uStrandFade;
  uniform float uPassOpacity;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uSoftFade;

  uniform vec3  uColorCore;
  uniform vec3  uColorInner;
  uniform vec3  uColorOuter;
  uniform vec3  uColorHalo;

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
  varying float vViewZ;

  ${noiseGLSL}
  ${commonGLSL}

  void main() {
    if (vLive <= 0.002) discard;

    float v = clamp(abs(vSide), 0.0, 1.0);

    float field = snoise(vec3(
      vT * uWispScale - uTime * uWispSpeed,
      vSide * uWispCross,
      vSeed * 3.1
    )) * 0.5 + 0.5;
    float wisp = mix(1.0, pow(clamp(field, 0.0, 1.0), max(uWispSharp, 0.05)) * 1.6, clamp(uWisp, 0.0, 1.0));

    #ifdef RIBBON_GLOW
      float profile = pow(1.0 - v, max(uGlowFalloff, 0.05));
      vec3 color = mix(uColorHalo, uColorOuter, profile);
      float alpha = profile;
    #else
      float fill = pow(1.0 - v, max(uFillFalloff, 0.05));
      float edge = smoothstep(1.0 - clamp(uEdgeWidth, 0.01, 1.0), 1.0, v);
      vec3 color = mix(uColorOuter, uColorInner, fill);
      color = mix(color, uColorCore, smoothstep(0.2, 1.0, edge) * clamp(uEdge, 0.0, 1.0));
      float alpha = fill * uFill + edge * uEdge;
    #endif

    float ends = smoothstep(0.0, max(uEndFade, 1e-3), vT) *
                 smoothstep(0.0, max(uEndFade, 1e-3), 1.0 - vT);

    float flicker = 1.0 - uFlicker * hash11(floor(uTime * uFlickerSpeed) + uSeed);

    alpha *= wisp * ends * vLive * flicker * uStrength * uPassOpacity * uOpacity;
    alpha *= mix(1.0, clamp(uStrandFade, 0.0, 1.0), vStrand);

    vec2 screenUV = gl_FragCoord.xy / uResolution;
    alpha *= softFade(uSceneDepth, screenUV, vViewZ, uCameraNear, uCameraFar, uSoftFade);
    if (alpha < 0.003) discard;

    color *= uGlow * uGlobalGlow;
    gl_FragColor = vec4(color, alpha);
  }
`

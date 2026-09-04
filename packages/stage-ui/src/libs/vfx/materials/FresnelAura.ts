import type { Material } from 'three'

import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three'

import { frame, parseVfxColor } from '../core/FrameUniforms'
import { noiseGLSL } from '../shaders/noise.glsl'

export interface AuraConfig {
  fresnel?: number
  fresnelPower?: number
  fresnelBias?: number
  fresnelGlow?: number
  fresnelPulse?: number
  fresnelPulseSpeed?: number
  fresnelFlicker?: number
  fresnelFlickerSpeed?: number

  veins?: number
  veinScale?: number
  veinSpeed?: number
  veinSharp?: number

  scan?: number
  scanSpeed?: number
  scanWidth?: number

  colorRim?: string | Color
  colorCore?: string | Color
  colorVein?: string | Color
}

export const defaultAuraConfig: Required<AuraConfig> = {
  fresnel: 1.0,
  fresnelPower: 2.5,
  fresnelBias: 0.06,
  fresnelGlow: 2.6,
  fresnelPulse: 0.22,
  fresnelPulseSpeed: 3.2,
  fresnelFlicker: 0.2,
  fresnelFlickerSpeed: 20,

  veins: 0.6,
  veinScale: 5.5,
  veinSpeed: 1.3,
  veinSharp: 0.6,

  scan: 0.45,
  scanSpeed: 0.5,
  scanWidth: 0.18,

  colorRim: new Color(0.5, 0.79, 1.0),
  colorCore: new Color(0.92, 0.97, 1.0),
  colorVein: new Color(0.29, 0.57, 1.0),
}

export const auraUniforms = {
  uTime: frame.uTime,
  uAuraStrength: { value: 0 },
  uAuraPower: { value: 2.5 },
  uAuraBias: { value: 0.06 },
  uAuraGlow: { value: 2.6 },
  uAuraPulse: { value: 0.22 },
  uAuraPulseSpeed: { value: 3.2 },
  uAuraFlicker: { value: 0.2 },
  uAuraFlickerSpeed: { value: 20 },

  uAuraVeins: { value: 0.6 },
  uAuraVeinScale: { value: 5.5 },
  uAuraVeinSpeed: { value: 1.3 },
  uAuraVeinSharp: { value: 0.6 },

  uAuraScan: { value: 0.45 },
  uAuraScanSpeed: { value: 0.5 },
  uAuraScanWidth: { value: 0.18 },

  uAuraBaseY: { value: 0 },
  uAuraHeight: { value: 1.8 },

  uAuraColorRim: { value: new Color(0.5, 0.79, 1.0) },
  uAuraColorCore: { value: new Color(0.92, 0.97, 1.0) },
  uAuraColorVein: { value: new Color(0.29, 0.57, 1.0) },
}

interface AuraClaim {
  strength: number
  baseY: number
  height: number
  config: AuraConfig
}

const claims = new Map<string, AuraClaim>()

export function syncFresnelAura(
  strength: number,
  baseY = 0,
  height = 1.8,
  config: AuraConfig = defaultAuraConfig,
  key = 'boost',
) {
  let claim = claims.get(key)
  if (!claim) {
    claim = { strength: 0, baseY, height, config }
    claims.set(key, claim)
  }
  claim.strength = Math.max(0, strength)
  claim.baseY = baseY
  claim.height = height
  claim.config = config

  let winner = claim
  for (const other of claims.values()) {
    if (other.strength > winner.strength)
      winner = other
  }
  applyClaim(winner)
}

function applyClaim({ strength, baseY, height, config }: AuraClaim) {
  const c = { ...defaultAuraConfig, ...config }

  auraUniforms.uAuraStrength.value = Math.max(0, strength) * (c.fresnel ?? 1.0)
  auraUniforms.uAuraPower.value = c.fresnelPower ?? 2.5
  auraUniforms.uAuraBias.value = c.fresnelBias ?? 0.06
  auraUniforms.uAuraGlow.value = c.fresnelGlow ?? 2.6
  auraUniforms.uAuraPulse.value = c.fresnelPulse ?? 0.22
  auraUniforms.uAuraPulseSpeed.value = c.fresnelPulseSpeed ?? 3.2
  auraUniforms.uAuraFlicker.value = c.fresnelFlicker ?? 0.2
  auraUniforms.uAuraFlickerSpeed.value = c.fresnelFlickerSpeed ?? 20

  auraUniforms.uAuraVeins.value = c.veins ?? 0.6
  auraUniforms.uAuraVeinScale.value = c.veinScale ?? 5.5
  auraUniforms.uAuraVeinSpeed.value = c.veinSpeed ?? 1.3
  auraUniforms.uAuraVeinSharp.value = c.veinSharp ?? 0.6

  auraUniforms.uAuraScan.value = c.scan ?? 0.45
  auraUniforms.uAuraScanSpeed.value = c.scanSpeed ?? 0.5
  auraUniforms.uAuraScanWidth.value = c.scanWidth ?? 0.18

  auraUniforms.uAuraBaseY.value = baseY
  auraUniforms.uAuraHeight.value = height

  auraUniforms.uAuraColorRim.value.copy(parseVfxColor(c.colorRim))
  auraUniforms.uAuraColorCore.value.copy(parseVfxColor(c.colorCore))
  auraUniforms.uAuraColorVein.value.copy(parseVfxColor(c.colorVein))
}

/**
 * Creates a standalone aura overlay material suitable for rendering an avatar's
 * outer shell with additive blending without mutating existing model materials.
 */
export function createFresnelOverlayMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    uniforms: {
      ...auraUniforms,
    },
    vertexShader: /* glsl */ `
      varying vec3 vAuraWorld;
      varying vec3 vAuraNormal;
      varying vec3 vViewPosition;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vAuraWorld = worldPos.xyz;
        vAuraNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = viewMatrix * worldPos;
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAuraStrength;
      uniform float uAuraPower;
      uniform float uAuraBias;
      uniform float uAuraGlow;
      uniform float uAuraPulse;
      uniform float uAuraPulseSpeed;
      uniform float uAuraFlicker;
      uniform float uAuraFlickerSpeed;
      uniform float uAuraVeins;
      uniform float uAuraVeinScale;
      uniform float uAuraVeinSpeed;
      uniform float uAuraVeinSharp;
      uniform float uAuraScan;
      uniform float uAuraScanSpeed;
      uniform float uAuraScanWidth;
      uniform float uAuraBaseY;
      uniform float uAuraHeight;
      uniform vec3  uAuraColorRim;
      uniform vec3  uAuraColorCore;
      uniform vec3  uAuraColorVein;

      varying vec3 vAuraWorld;
      varying vec3 vAuraNormal;
      varying vec3 vViewPosition;

      ${noiseGLSL}

      void main() {
        if (uAuraStrength < 0.001) discard;

        vec3 N = normalize(vAuraNormal);
        vec3 V = normalize(vViewPosition);
        float ndv = clamp(dot(N, V), 0.0, 1.0);

        float rim = pow(1.0 - ndv, max(uAuraPower, 0.05)) + uAuraBias;
        rim = clamp(rim, 0.0, 2.0);

        vec3 vp = vAuraWorld * uAuraVeinScale + vec3(0.0, -uTime * uAuraVeinSpeed, uTime * 0.27);
        float field = fbm3(vp);
        float width = mix(0.42, 0.045, clamp(uAuraVeinSharp, 0.0, 1.0));
        float vein = 1.0 - smoothstep(0.0, width, abs(field));

        float h = (vAuraWorld.y - uAuraBaseY) / max(uAuraHeight, 0.01);
        float scanPos = fract(uTime * uAuraScanSpeed) * 1.4 - 0.2;
        float scan = smoothstep(uAuraScanWidth, 0.0, abs(h - scanPos));

        float pulse = 1.0 + uAuraPulse * sin(uTime * uAuraPulseSpeed);
        float flicker = 1.0 - uAuraFlicker * hash11(floor(uTime * uAuraFlickerSpeed));

        vec3 color = mix(uAuraColorRim, uAuraColorCore, clamp(rim * 0.5, 0.0, 1.0));
        color += uAuraColorVein * (vein * uAuraVeins);
        color += uAuraColorCore * (scan * uAuraScan);
        color *= (pulse * flicker * uAuraGlow * uAuraStrength);

        float alpha = clamp(rim + vein * 0.5 + scan * 0.5, 0.0, 1.0) * uAuraStrength;
        if (alpha < 0.005) discard;

        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
}

/**
 * Patches a standard Three.js MeshStandardMaterial with the Fresnel Aura shader hook.
 */
export function patchStandardMaterialWithAura(material: Material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, auraUniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vAuraWorld;\n',
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvAuraWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n',
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uAuraStrength;
        uniform float uAuraPower;
        uniform float uAuraBias;
        uniform float uAuraGlow;
        uniform float uAuraPulse;
        uniform float uAuraPulseSpeed;
        uniform float uAuraFlicker;
        uniform float uAuraFlickerSpeed;
        uniform float uAuraVeins;
        uniform float uAuraVeinScale;
        uniform float uAuraVeinSpeed;
        uniform float uAuraVeinSharp;
        uniform float uAuraScan;
        uniform float uAuraScanSpeed;
        uniform float uAuraScanWidth;
        uniform float uAuraBaseY;
        uniform float uAuraHeight;
        uniform vec3  uAuraColorRim;
        uniform vec3  uAuraColorCore;
        uniform vec3  uAuraColorVein;
        varying vec3  vAuraWorld;
        ${noiseGLSL}
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uAuraStrength > 0.001) {
          vec3 N = normalize(normal);
          vec3 V = normalize(vViewPosition);
          float ndv = clamp(dot(N, V), 0.0, 1.0);
          float rim = clamp(pow(1.0 - ndv, max(uAuraPower, 0.05)) + uAuraBias, 0.0, 2.0);
          vec3 vp = vAuraWorld * uAuraVeinScale + vec3(0.0, -uTime * uAuraVeinSpeed, uTime * 0.27);
          float field = fbm3(vp);
          float width = mix(0.42, 0.045, clamp(uAuraVeinSharp, 0.0, 1.0));
          float vein = 1.0 - smoothstep(0.0, width, abs(field));
          float h = (vAuraWorld.y - uAuraBaseY) / max(uAuraHeight, 0.01);
          float scanPos = fract(uTime * uAuraScanSpeed) * 1.4 - 0.2;
          float scan = smoothstep(uAuraScanWidth, 0.0, abs(h - scanPos));
          float pulse = 1.0 + uAuraPulse * sin(uTime * uAuraPulseSpeed);
          float flicker = 1.0 - uAuraFlicker * hash11(floor(uTime * uAuraFlickerSpeed));
          vec3 auraCol = mix(uAuraColorRim, uAuraColorCore, clamp(rim * 0.5, 0.0, 1.0));
          auraCol += uAuraColorVein * (vein * uAuraVeins);
          auraCol += uAuraColorCore * (scan * uAuraScan);
          totalEmissiveRadiance += auraCol * (pulse * flicker * uAuraGlow * uAuraStrength);
        }
        `,
      )
  }
}

import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Sphere,
  Vector3,
} from 'three'

import { sharedUniforms } from '../core/FrameUniforms'
import { commonGLSL } from '../shaders/common.glsl'
import { noiseGLSL } from '../shaders/noise.glsl'

/** Fragment silhouettes. 100% procedural — no sprite textures. */
export const ParticleShape = {
  SOFT: 0, // round, feathered — embers, droplets, dust
  SMOKE: 1, // fbm-eroded puff
  STREAK: 2, // velocity aligned spark
  LEAF: 3, // tapered leaf silhouette
  CHIP: 4, // angular rock fragment
  RING: 5, // thin expanding ring — shockwaves
} as const

export type ParticleShapeType = typeof ParticleShape[keyof typeof ParticleShape]

const FLOATS: Record<string, number> = {
  start: 3,
  origin: 3,
  velocity: 3,
  color: 3,
  spawn: 1,
  life: 1,
  size: 1,
  seed: 1,
  spin: 1,
}

const _tmpVec = new Vector3()

export interface ParticleSystemOptions {
  name: string
  capacity?: number
  shape?: ParticleShapeType
  additive?: boolean
  curl?: boolean
  stretch?: boolean
  swirl?: boolean
  lit?: boolean
  softFade?: number
}

export interface ParticleEmitParams {
  position: Vector3
  radius?: number
  direction?: Vector3 | null
  speed?: number
  speedVariance?: number
  spread?: number
  inherit?: Vector3 | null
  anchor?: Vector3 | null
  size?: number
  sizeVariance?: number
  life?: number
  lifeVariance?: number
  spin?: number
  tint?: Color | null
  time: number
}

export class ParticleSystem {
  public name: string
  public capacity: number
  public cursor = 0
  public geometry: InstancedBufferGeometry
  public material: ShaderMaterial
  public mesh: Mesh
  public data: Record<string, Float32Array> = {}
  public attributes: Record<string, InstancedBufferAttribute> = {}

  private _ranges: [number, number][] = []
  private _dirty = false

  constructor({
    name,
    capacity = 2000,
    shape = ParticleShape.SOFT,
    additive = true,
    curl = false,
    stretch = false,
    swirl = false,
    lit = false,
    softFade = 0.6,
  }: ParticleSystemOptions) {
    this.name = name
    this.capacity = capacity

    const geometry = new InstancedBufferGeometry()
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3),
    )
    geometry.setAttribute(
      'uv',
      new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
    )
    geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))

    for (const [key, itemSize] of Object.entries(FLOATS)) {
      const array = new Float32Array(capacity * itemSize)
      const attribute = new InstancedBufferAttribute(array, itemSize).setUsage(DynamicDrawUsage)
      this.data[key] = array
      this.attributes[key] = attribute
      geometry.setAttribute(`a${key[0].toUpperCase()}${key.slice(1)}`, attribute)
    }

    this.data.life.fill(0)
    geometry.instanceCount = capacity
    geometry.boundingSphere = new Sphere(new Vector3(), 1e4)
    this.geometry = geometry

    const defines: Record<string, any> = { SHAPE: shape }
    if (curl)
      defines.USE_CURL = ''
    if (stretch)
      defines.USE_STRETCH = ''
    if (swirl)
      defines.USE_SWIRL = ''
    if (lit)
      defines.USE_LIT = ''

    this.material = new ShaderMaterial({
      defines,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: additive ? AdditiveBlending : NormalBlending,
      side: DoubleSide,
      toneMapped: false,
      uniforms: sharedUniforms({
        uGravity: { value: new Vector3(0, -4.5, 0) },
        uDrag: { value: 0.9 },
        uTurbulence: { value: 0.6 },
        uTurbFrequency: { value: 0.45 },
        uTurbSpeed: { value: 0.35 },
        uSwirl: { value: 0 },
        uSwirlExpand: { value: 0.4 },
        uSpeedScale: { value: 1 },
        uSizeScale: { value: 1 },
        uLifeScale: { value: 1 },
        uEndSize: { value: 0.4 },
        uSizeIn: { value: 0.08 },
        uFadeIn: { value: 0.08 },
        uFadeOut: { value: 0.55 },
        uOpacity: { value: 1 },
        uGlow: { value: 1 },
        uStretch: { value: 0.15 },
        uSoftFade: { value: softFade },
        uColor0: { value: new Color(1, 1, 1) },
        uColor1: { value: new Color(1, 0.7, 0.3) },
        uColor2: { value: new Color(0.6, 0.15, 0.05) },
        uColor3: { value: new Color(0.08, 0.06, 0.06) },
        uLightDir: { value: new Vector3(0.4, 0.8, 0.35).normalize() },
        uSoftness: { value: 1 },
      }),
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
    })

    this.mesh = new Mesh(geometry, this.material)
    this.mesh.frustumCulled = false
    this.mesh.matrixAutoUpdate = false
    this.mesh.renderOrder = additive ? 12 : 10
    this.mesh.name = `Particles:${name}`
  }

  get uniforms() {
    return this.material.uniforms
  }

  emit(count: number, p: ParticleEmitParams) {
    if (count <= 0)
      return
    count = Math.min(count, this.capacity)

    const {
      position,
      radius = 0,
      direction = null,
      speed = 1,
      speedVariance = 0.35,
      spread = 0.5,
      inherit = null,
      anchor = null,
      size = 0.2,
      sizeVariance = 0.4,
      life = 1,
      lifeVariance = 0.3,
      spin = 0,
      tint = null,
      time = 0,
    } = p

    const d = this.data

    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.capacity
      this._markDirty(i)

      const i3 = i * 3

      let ox = 0
      let oy = 0
      let oz = 0
      if (radius > 0) {
        const u = Math.random()
        const r = radius * Math.cbrt(u)
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const s = Math.sin(phi)
        ox = r * s * Math.cos(theta)
        oy = r * Math.cos(phi)
        oz = r * s * Math.sin(theta)
      }
      d.start[i3 + 0] = position.x + ox
      d.start[i3 + 1] = position.y + oy
      d.start[i3 + 2] = position.z + oz

      const a = anchor ?? position
      d.origin[i3 + 0] = a.x
      d.origin[i3 + 1] = a.y
      d.origin[i3 + 2] = a.z

      if (direction)
        _tmpVec.copy(direction)
      else
        _tmpVec.set(0, 1, 0)

      if (spread > 0) {
        _tmpVec.x += (Math.random() - 0.5) * 2 * spread
        _tmpVec.y += (Math.random() - 0.5) * 2 * spread
        _tmpVec.z += (Math.random() - 0.5) * 2 * spread
      }
      _tmpVec.normalize().multiplyScalar(speed * (1 + (Math.random() - 0.5) * 2 * speedVariance))
      if (inherit)
        _tmpVec.add(inherit)

      d.velocity[i3 + 0] = _tmpVec.x
      d.velocity[i3 + 1] = _tmpVec.y
      d.velocity[i3 + 2] = _tmpVec.z

      d.spawn[i] = time
      d.life[i] = Math.max(0.05, life * (1 + (Math.random() - 0.5) * 2 * lifeVariance))
      d.size[i] = Math.max(0.001, size * (1 + (Math.random() - 0.5) * 2 * sizeVariance))
      d.seed[i] = Math.random()
      d.spin[i] = (Math.random() - 0.5) * 2 * spin

      if (tint) {
        d.color[i3 + 0] = tint.r
        d.color[i3 + 1] = tint.g
        d.color[i3 + 2] = tint.b
      }
      else {
        d.color[i3 + 0] = 1
        d.color[i3 + 1] = 1
        d.color[i3 + 2] = 1
      }
    }
  }

  countLive(time: number): number {
    const { spawn, life } = this.data
    const lifeScale = this.uniforms.uLifeScale.value
    let live = 0
    for (let i = 0; i < this.capacity; i++) {
      const age = time - spawn[i]
      if (age >= 0 && age <= life[i] * lifeScale)
        live++
    }
    return live
  }

  private _markDirty(index: number) {
    this._dirty = true
    const ranges = this._ranges
    const last = ranges[ranges.length - 1]
    if (last && index === last[0] + last[1])
      last[1]++
    else
      ranges.push([index, 1])
  }

  flush() {
    if (!this._dirty)
      return
    for (const [key, itemSize] of Object.entries(FLOATS)) {
      const attribute = this.attributes[key]
      attribute.needsUpdate = true
      attribute.clearUpdateRanges?.()
      for (const [start, count] of this._ranges)
        attribute.addUpdateRange?.(start * itemSize, count * itemSize)
    }
    this._ranges.length = 0
    this._dirty = false
  }

  setGradient(c0: Color, c1: Color, c2: Color, c3?: Color) {
    const u = this.uniforms
    u.uColor0.value.copy(c0)
    u.uColor1.value.copy(c1)
    u.uColor2.value.copy(c2)
    u.uColor3.value.copy(c3 ?? c2)
  }

  reset() {
    this.data.life.fill(0)
    this.data.spawn.fill(-1e4)
    for (const key of Object.keys(FLOATS))
      this.attributes[key].needsUpdate = true
    this._ranges.length = 0
    this._dirty = false
    this.cursor = 0
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}

const PARTICLE_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec3  uGravity;
  uniform float uDrag;
  uniform float uTurbulence;
  uniform float uTurbFrequency;
  uniform float uTurbSpeed;
  uniform float uSwirl;
  uniform float uSwirlExpand;
  uniform float uSpeedScale;
  uniform float uSizeScale;
  uniform float uLifeScale;
  uniform float uEndSize;
  uniform float uSizeIn;
  uniform float uStretch;

  attribute vec3  aStart;
  attribute vec3  aOrigin;
  attribute vec3  aVelocity;
  attribute vec3  aColor;
  attribute float aSpawn;
  attribute float aLife;
  attribute float aSize;
  attribute float aSeed;
  attribute float aSpin;

  varying vec2  vUv;
  varying float vT;
  varying float vSeed;
  varying vec3  vTint;
  varying float vViewZ;
  varying vec3  vNormalish;

  ${noiseGLSL}

  void main() {
    vUv = uv;
    vSeed = aSeed;
    vTint = aColor;

    float life = aLife * uLifeScale;
    float age = uTime - aSpawn;
    float t = age / max(life, 1e-4);
    vT = t;

    if (age < 0.0 || t > 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec3 vel = aVelocity * uSpeedScale;
    float k = max(uDrag, 1e-3);
    float travel = (1.0 - exp(-k * age)) / k;
    vec3 pos = aStart + vel * travel + 0.5 * uGravity * age * age;

    #ifdef USE_SWIRL
      vec3 anchor = aOrigin + vel * travel;
      vec3 rel = aStart - aOrigin;
      float ang = uSwirl * age + aSeed * 6.2831;
      float c = cos(ang), s = sin(ang);
      vec3 rotated = vec3(rel.x * c - rel.z * s, rel.y, rel.x * s + rel.z * c);
      rotated *= 1.0 + uSwirlExpand * t;
      pos = anchor + rotated + vec3(0.0, 0.5 * uGravity.y * age * age, 0.0);
    #endif

    #ifdef USE_CURL
      pos += curlNoise(aStart * uTurbFrequency + vec3(0.0, uTime * uTurbSpeed, 0.0) + aSeed * 4.0)
             * uTurbulence * age;
    #else
      vec3 wobble = vec3(
        sin(age * 3.1 + aSeed * 41.0),
        cos(age * 2.3 + aSeed * 17.0),
        sin(age * 2.7 + aSeed * 73.0)
      );
      pos += wobble * uTurbulence * age * 0.55;
    #endif

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewZ = mvPosition.z;

    float grow = smoothstep(0.0, max(uSizeIn, 1e-3), t);
    float size = aSize * uSizeScale * mix(1.0, uEndSize, t) * grow;
    vec2 corner = position.xy * size;

    #ifdef USE_STRETCH
      vec3 velView = (modelViewMatrix * vec4(vel, 0.0)).xyz;
      vec2 dir = normalize(velView.xy + vec2(1e-5));
      vec2 perp = vec2(-dir.y, dir.x);
      float stretch = 1.0 + uStretch * length(vel);
      corner = dir * (position.y * size * stretch) + perp * (position.x * size);
      vNormalish = vec3(dir, 0.0);
    #else
      float rot = aSpin * age + aSeed * 6.2831;
      corner = rot2(rot) * corner;
      vNormalish = normalize(vec3(position.xy, 0.75));
    #endif

    mvPosition.xy += corner;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const PARTICLE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uFadeIn;
  uniform float uFadeOut;
  uniform float uSoftFade;
  uniform float uSoftness;
  uniform vec3  uColor0;
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;
  uniform vec3  uLightDir;
  uniform vec2  uResolution;
  uniform sampler2D uSceneDepth;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uGlobalGlow;

  varying vec2  vUv;
  varying float vT;
  varying float vSeed;
  varying vec3  vTint;
  varying float vViewZ;
  varying vec3  vNormalish;

  ${noiseGLSL}
  ${commonGLSL}

  float shapeMask(vec2 uv) {
    vec2 c = (uv - 0.5) * 2.0;
    float d = length(c);

    #if SHAPE == 0                       // SOFT
      return smoothstep(1.0, 0.0, d);
    #elif SHAPE == 1                     // SMOKE
      float n = fbm3(vec3(c * 1.6, vSeed * 21.0 + uTime * 0.25));
      return smoothstep(1.0, 0.05, d + n * 0.42) * 0.9;
    #elif SHAPE == 2                     // STREAK
      float core = smoothstep(1.0, 0.0, abs(c.x) * 3.4);
      float len = smoothstep(1.0, 0.0, abs(c.y));
      return core * len;
    #elif SHAPE == 3                     // LEAF
      float w = max(0.0, 1.0 - c.y * c.y);
      float body = smoothstep(w * 0.62, w * 0.30, abs(c.x));
      float vein = smoothstep(0.06, 0.0, abs(c.x)) * 0.35;
      return clamp(body - vein * 0.4, 0.0, 1.0);
    #elif SHAPE == 4                     // CHIP
      float ang = atan(c.y, c.x);
      float r = 0.62 + 0.24 * sin(ang * 5.0 + vSeed * 30.0) + 0.1 * sin(ang * 9.0 - vSeed * 11.0);
      return smoothstep(r, r - 0.14, d);
    #else                                // RING
      return smoothstep(0.14, 0.0, abs(d - 0.82));
    #endif
  }

  void main() {
    if (vT < 0.0 || vT > 1.0) discard;

    float mask = shapeMask(vUv);
    if (mask <= 0.004) discard;

    float fade = smoothstep(0.0, max(uFadeIn, 1e-3), vT) *
                 (1.0 - smoothstep(clamp(uFadeOut, 0.0, 0.999), 1.0, vT));
    float alpha = mask * fade * uOpacity;

    vec3 color = gradient4(uColor0, uColor1, uColor2, uColor3, vT) * vTint;

    #ifdef USE_LIT
      float ndl = dot(normalize(vNormalish), uLightDir) * 0.5 + 0.5;
      color *= mix(0.45, 1.25, ndl);
    #endif

    color *= uGlow * uGlobalGlow;
    gl_FragColor = vec4(color, alpha);
  }
`

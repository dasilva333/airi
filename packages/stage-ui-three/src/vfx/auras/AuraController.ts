import type { Scene } from 'three'

import type { ParticleEmitParams } from '../particles/ParticleSystem'
import type { AvatarSocketResolver } from '../sockets/types'

import { Color, Group, Mesh, PlaneGeometry, Vector3, Vector4 } from 'three'

import { frame } from '../core/FrameUniforms'
import { createBoltRibbonGeometry } from '../effects/RibbonGeometry'
import { createArcaneRibbonMaterial, RibbonPass } from '../materials/ArcaneRibbonMaterial'
import { createFireBodyMaterial, FlamePass, MAX_FLAME_BONES } from '../materials/FireBodyMaterial'
import { syncFresnelAura } from '../materials/FresnelAura'
import { createGroundDecalMaterial, GroundDecalType } from '../materials/GroundDecalMaterial'
import { ParticleEngine, RateEmitter } from '../particles/ParticleEngine'
import { ParticleShape } from '../particles/ParticleSystem'

export interface AuraControllerOptions {
  scene: Scene
  resolver?: AvatarSocketResolver
}

export interface AuraState {
  fire: {
    active: boolean
    keepActive?: boolean
    strength: number
    duration: number
    elapsed: number
    palette: { core: string, flame: string, ember: string, smoke: string }
    flameHeight: number
  }
  electric: {
    active: boolean
    keepActive?: boolean
    strength: number
    duration: number
    elapsed: number
    palette: { rim: string, core: string, vein: string }
  }
  magic: {
    active: boolean
    keepActive?: boolean
    strength: number
    duration: number
    elapsed: number
    palette: { core: string, inner: string, outer: string, halo: string }
  }
  verdant: {
    active: boolean
    keepActive?: boolean
    strength: number
    duration: number
    elapsed: number
    palette: { core: string, leaf: string, vine: string, base: string }
  }
}

export const DEFAULT_VFX_MAPPINGS: Record<string, string[]> = {
  fire: ['angry', 'anger', 'rage', 'furious', 'fire', 'burn'],
  electric: ['excited', 'focused', 'spark', 'electric', 'shocked', 'energetic'],
  magic: ['magic', 'mystic', 'arcane', 'wonder', 'spell', 'curious', 'think'],
  verdant: ['peaceful', 'calm', 'verdant', 'nature', 'healed', 'relax'],
}

export class AuraController {
  public scene: Scene
  public group: Group
  public particleEngine: ParticleEngine
  public resolver: AvatarSocketResolver | null = null

  public state: AuraState = {
    fire: {
      active: false,
      strength: 0,
      duration: 5.0,
      elapsed: 0,
      palette: {
        core: '#FFF2BF',
        flame: '#FF7314',
        ember: '#A61F05',
        smoke: '#140D0D',
      },
      flameHeight: 0.62,
    },
    electric: {
      active: false,
      strength: 0,
      duration: 4.0,
      elapsed: 0,
      palette: {
        rim: '#80C9FF',
        core: '#EBF7FF',
        vein: '#4A92FF',
      },
    },
    magic: {
      active: false,
      strength: 0,
      duration: 6.0,
      elapsed: 0,
      palette: {
        core: '#FFDCFF',
        inner: '#D959FF',
        outer: '#7317D9',
        halo: '#29055C',
      },
    },
    verdant: {
      active: false,
      strength: 0,
      duration: 6.0,
      elapsed: 0,
      palette: {
        core: '#A7F3D0',
        leaf: '#10B981',
        vine: '#059669',
        base: '#042F2E',
      },
    },
  }

  // Flame meshes & materials
  private _flameGeometry = createBoltRibbonGeometry(44, 64)
  private _flameGlowMat = createFireBodyMaterial(FlamePass.GLOW)
  private _flameSheetMat = createFireBodyMaterial(FlamePass.FLAME)
  private _flameGlowMesh: Mesh
  private _flameSheetMesh: Mesh

  // Magic ribbon meshes & materials
  private _magicGeometry = createBoltRibbonGeometry(64, 8)
  private _magicGlowMat = createArcaneRibbonMaterial(RibbonPass.GLOW)
  private _magicBandMat = createArcaneRibbonMaterial(RibbonPass.BAND)
  private _magicGlowMesh: Mesh
  private _magicBandMesh: Mesh

  // Verdant ribbon meshes & materials
  private _verdantGeometry = createBoltRibbonGeometry(48, 6)
  private _verdantGlowMat = createArcaneRibbonMaterial(RibbonPass.GLOW)
  private _verdantBandMat = createArcaneRibbonMaterial(RibbonPass.BAND)
  private _verdantGlowMesh: Mesh
  private _verdantBandMesh: Mesh

  // Ground Decal meshes & materials
  private _groundGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  private _fireGroundMat = createGroundDecalMaterial(GroundDecalType.FIRE)
  private _electricGroundMat = createGroundDecalMaterial(GroundDecalType.ELECTRIC)
  private _magicGroundMat = createGroundDecalMaterial(GroundDecalType.MAGIC)
  private _verdantGroundMat = createGroundDecalMaterial(GroundDecalType.VERDANT)
  private _fireGroundMesh: Mesh
  private _electricGroundMesh: Mesh
  private _magicGroundMesh: Mesh
  private _verdantGroundMesh: Mesh

  // Cached orientation vectors to prevent per-frame allocations
  private _staticRight = new Vector3(1, 0, 0)
  private _staticForward = new Vector3(0, 0, 1)

  // Pre-allocated bone segment arrays
  private _boneA: Vector4[] = Array.from({ length: MAX_FLAME_BONES }, () => new Vector4())
  private _boneB: Vector4[] = Array.from({ length: MAX_FLAME_BONES }, () => new Vector4())
  private _boneCount = 0

  // Emitters
  private _fireEmberEmitter = new RateEmitter(40)
  private _magicSparkEmitter = new RateEmitter(30)
  private _electricSparkEmitter = new RateEmitter(25)
  private _verdantSporeEmitter = new RateEmitter(30)

  private _tmpPos = new Vector3()
  private _tmpDir = new Vector3(0, 1, 0)
  private _emitScratch: ParticleEmitParams = {
    position: new Vector3(),
    direction: new Vector3(0, 1, 0),
    speed: 1,
    size: 0.1,
    life: 1,
    time: 0,
  }

  constructor({ scene, resolver }: AuraControllerOptions) {
    this.scene = scene
    this.resolver = resolver || null

    this.group = new Group()
    this.group.name = 'VFX_AuraController'
    this.scene.add(this.group)

    this.particleEngine = new ParticleEngine(this.scene)

    // Setup Flame Meshes
    this._flameGlowMesh = new Mesh(this._flameGeometry, this._flameGlowMat)
    this._flameGlowMesh.frustumCulled = false
    this._flameGlowMesh.renderOrder = 11

    this._flameSheetMesh = new Mesh(this._flameGeometry, this._flameSheetMat)
    this._flameSheetMesh.frustumCulled = false
    this._flameSheetMesh.renderOrder = 13

    this.group.add(this._flameGlowMesh)
    this.group.add(this._flameSheetMesh)

    // Setup Magic Meshes
    this._magicGlowMesh = new Mesh(this._magicGeometry, this._magicGlowMat)
    this._magicGlowMesh.frustumCulled = false
    this._magicGlowMesh.renderOrder = 12

    this._magicBandMesh = new Mesh(this._magicGeometry, this._magicBandMat)
    this._magicBandMesh.frustumCulled = false
    this._magicBandMesh.renderOrder = 14

    this.group.add(this._magicGlowMesh)
    this.group.add(this._magicBandMesh)

    // Setup Verdant Meshes
    this._verdantGlowMesh = new Mesh(this._verdantGeometry, this._verdantGlowMat)
    this._verdantGlowMesh.frustumCulled = false
    this._verdantGlowMesh.renderOrder = 12

    this._verdantBandMesh = new Mesh(this._verdantGeometry, this._verdantBandMat)
    this._verdantBandMesh.frustumCulled = false
    this._verdantBandMesh.renderOrder = 14

    this.group.add(this._verdantGlowMesh)
    this.group.add(this._verdantBandMesh)

    // Setup Ground Decals (seated just above floor grid to prevent z-fighting)
    this._fireGroundMesh = new Mesh(this._groundGeometry, this._fireGroundMat)
    this._fireGroundMesh.frustumCulled = false
    this._fireGroundMesh.renderOrder = 6
    this._fireGroundMesh.position.y = 0.005
    this._fireGroundMesh.visible = false

    this._electricGroundMesh = new Mesh(this._groundGeometry, this._electricGroundMat)
    this._electricGroundMesh.frustumCulled = false
    this._electricGroundMesh.renderOrder = 6
    this._electricGroundMesh.position.y = 0.005
    this._electricGroundMesh.visible = false

    this._magicGroundMesh = new Mesh(this._groundGeometry, this._magicGroundMat)
    this._magicGroundMesh.frustumCulled = false
    this._magicGroundMesh.renderOrder = 6
    this._magicGroundMesh.position.y = 0.005
    this._magicGroundMesh.visible = false

    this._verdantGroundMesh = new Mesh(this._groundGeometry, this._verdantGroundMat)
    this._verdantGroundMesh.frustumCulled = false
    this._verdantGroundMesh.renderOrder = 6
    this._verdantGroundMesh.position.y = 0.005
    this._verdantGroundMesh.visible = false

    this.group.add(this._fireGroundMesh)
    this.group.add(this._electricGroundMesh)
    this.group.add(this._magicGroundMesh)
    this.group.add(this._verdantGroundMesh)

    // Prepare Particle Pools
    const embers = this.particleEngine.get('aura_embers', {
      capacity: 1500,
      shape: ParticleShape.SOFT,
      additive: true,
    })
    embers.setGradient(
      new Color(1, 0.9, 0.5),
      new Color(1, 0.45, 0.1),
      new Color(0.7, 0.15, 0.02),
      new Color(0.1, 0.05, 0.05),
    )

    const starlight = this.particleEngine.get('aura_starlight', {
      capacity: 1000,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true,
    })
    starlight.setGradient(
      new Color(1, 0.95, 1),
      new Color(0.8, 0.4, 1),
      new Color(0.4, 0.1, 0.9),
      new Color(0.1, 0.02, 0.3),
    )

    const sparks = this.particleEngine.get('aura_sparks', {
      capacity: 800,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true,
    })
    sparks.setGradient(
      new Color(1, 1, 1),
      new Color(0.6, 0.85, 1),
      new Color(0.2, 0.5, 1),
      new Color(0.05, 0.1, 0.5),
    )

    const spores = this.particleEngine.get('aura_verdant_spores', {
      capacity: 1200,
      shape: ParticleShape.SOFT,
      additive: true,
    })
    spores.setGradient(
      new Color(0.9, 1.0, 0.95),
      new Color(0.2, 0.9, 0.5),
      new Color(0.05, 0.6, 0.3),
      new Color(0.01, 0.15, 0.08),
    )
  }

  setResolver(resolver: AvatarSocketResolver | null) {
    this.resolver = resolver
  }

  triggerAura(type: 'fire' | 'electric' | 'magic' | 'verdant', duration?: number) {
    const aura = this.state[type]
    aura.active = true
    aura.elapsed = 0
    if (duration !== undefined)
      aura.duration = duration
  }

  stopAura(type: 'fire' | 'electric' | 'magic' | 'verdant') {
    this.state[type].active = false
  }

  update(dt: number) {
    const time = frame.uTime.value

    // Update resolver world matrices if available
    if (this.resolver) {
      this.resolver.update?.(dt)
      this._boneCount = this.resolver.writeBoneSegments(this._boneA, this._boneB)
    }

    const height = this.resolver?.height || 1.65
    const rootPos = this.resolver?.root ? this.resolver.root.position : this._tmpPos.set(0, 0, 0)

    // 1. Fire Boost Lifecycle & Sync
    this._updateFire(dt, time, rootPos, height)

    // 2. Electric Boost Lifecycle & Sync
    this._updateElectric(dt, rootPos, height)

    // 3. Magic Boost Lifecycle & Sync
    this._updateMagic(dt, time, rootPos, height)

    // 4. Verdant Boost Lifecycle & Sync
    this._updateVerdant(dt, time, rootPos, height)

    // Flush GPU particle buffers
    this.particleEngine.flush()
  }

  private _updateFire(dt: number, time: number, _rootPos: Vector3, height: number) {
    const f = this.state.fire
    if (f.keepActive) {
      f.strength = Math.min(1.0, f.strength + dt * 3.0)
    }
    else if (f.active) {
      f.elapsed += dt
      // Fade in fast (0.3s), hold, fade out on duration
      if (f.elapsed < 0.3)
        f.strength = f.elapsed / 0.3
      else if (f.elapsed > f.duration - 0.5)
        f.strength = Math.max(0, (f.duration - f.elapsed) / 0.5)
      else
        f.strength = 1.0

      if (f.elapsed >= f.duration) {
        f.active = false
        f.strength = 0
      }
    }
    else {
      f.strength = Math.max(0, f.strength - dt * 2.5)
    }

    const visible = f.strength > 0.005
    this._flameGlowMesh.visible = visible
    this._flameSheetMesh.visible = visible
    this._fireGroundMesh.visible = visible

    if (visible) {
      this._flameGlowMat.uniforms.uLength.value = f.flameHeight
      this._flameSheetMat.uniforms.uLength.value = f.flameHeight

      const syncState = {
        strength: f.strength,
        height,
        flameHeight: f.flameHeight,
        boneA: this._boneA,
        boneB: this._boneB,
        boneCount: this._boneCount,
        palette: f.palette,
      }
      this._flameGlowMat.userData.sync?.(syncState)
      this._flameSheetMat.userData.sync?.(syncState)

      // Sync circular burnt cinder ground decal
      this._fireGroundMesh.position.set(_rootPos.x, 0.005, _rootPos.z)
      this._fireGroundMesh.scale.set(3.0, 1, 3.0)
      this._fireGroundMat.userData.sync?.({
        fade: f.strength,
        radius: 1.5,
        palette: {
          char: '#0a0503',
          crack: f.palette.flame,
          ring: f.palette.flame,
          core: f.palette.core,
        },
      })

      // Emit rising flame embers from bones
      const emberCount = this._fireEmberEmitter.tick(dt, 45, f.strength)
      if (emberCount > 0 && this.resolver) {
        const sockets: ('leftWrist' | 'rightWrist' | 'chest')[] = ['leftWrist', 'rightWrist', 'chest']
        const chosenSocket = sockets[Math.floor(Math.random() * sockets.length)]
        const transform = this.resolver.getWorldTransform(chosenSocket)
        if (transform) {
          this._emitScratch.position = transform.position
          this._emitScratch.radius = 0.08
          this._emitScratch.direction = this._tmpDir.set(0, 1, 0)
          this._emitScratch.speed = 0.9
          this._emitScratch.speedVariance = 0.5
          this._emitScratch.spread = 0.4
          this._emitScratch.size = 0.14
          this._emitScratch.life = 0.8
          this._emitScratch.time = time
          this.particleEngine.get('aura_embers').emit(emberCount, this._emitScratch)
        }
      }
    }
  }

  private _updateElectric(dt: number, rootPos: Vector3, height: number) {
    const e = this.state.electric
    if (e.keepActive) {
      e.strength = Math.min(1.0, e.strength + dt * 3.0)
    }
    else if (e.active) {
      e.elapsed += dt
      if (e.elapsed < 0.2)
        e.strength = e.elapsed / 0.2
      else if (e.elapsed > e.duration - 0.4)
        e.strength = Math.max(0, (e.duration - e.elapsed) / 0.4)
      else
        e.strength = 1.0

      if (e.elapsed >= e.duration) {
        e.active = false
        e.strength = 0
      }
    }
    else {
      e.strength = Math.max(0, e.strength - dt * 3.0)
    }

    const eVisible = e.strength > 0.005
    this._electricGroundMesh.visible = eVisible

    if (eVisible) {
      syncFresnelAura(e.strength, rootPos.y, height, {
        colorRim: e.palette.rim,
        colorCore: e.palette.core,
        colorVein: e.palette.vein,
        fresnelGlow: 3.2,
        veinSpeed: 2.4,
        scanSpeed: 1.2,
      }, 'electric')

      // Sync electric ground surge ring
      this._electricGroundMesh.position.set(rootPos.x, 0.005, rootPos.z)
      this._electricGroundMesh.scale.set(2.4, 1, 2.4)
      this._electricGroundMat.userData.sync?.({
        fade: e.strength,
        radius: 1.2,
        palette: {
          crack: e.palette.vein,
          ring: e.palette.rim,
          core: e.palette.core,
        },
      })
    }

    // Emit crackling sparks from wrists
    if (e.strength > 0.1 && this.resolver) {
      const sparkCount = this._electricSparkEmitter.tick(dt, 30, e.strength)
      if (sparkCount > 0) {
        const socket = Math.random() > 0.5 ? 'leftWrist' : 'rightWrist'
        const tf = this.resolver.getWorldTransform(socket)
        if (tf) {
          this._emitScratch.position = tf.position
          this._emitScratch.radius = 0.05
          this._emitScratch.direction = this._tmpDir.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize()
          this._emitScratch.speed = 1.6
          this._emitScratch.size = 0.08
          this._emitScratch.life = 0.35
          this._emitScratch.time = frame.uTime.value
          this.particleEngine.get('aura_sparks').emit(sparkCount, this._emitScratch)
        }
      }
    }
  }

  private _updateMagic(dt: number, time: number, rootPos: Vector3, height: number) {
    const m = this.state.magic
    if (m.keepActive) {
      m.strength = Math.min(1.0, m.strength + dt * 3.0)
    }
    else if (m.active) {
      m.elapsed += dt
      if (m.elapsed < 0.5)
        m.strength = m.elapsed / 0.5
      else if (m.elapsed > m.duration - 0.8)
        m.strength = Math.max(0, (m.duration - m.elapsed) / 0.8)
      else
        m.strength = 1.0

      if (m.elapsed >= m.duration) {
        m.active = false
        m.strength = 0
      }
    }
    else {
      m.strength = Math.max(0, m.strength - dt * 1.5)
    }

    const visible = m.strength > 0.005
    this._magicGlowMesh.visible = visible
    this._magicBandMesh.visible = visible
    this._magicGroundMesh.visible = visible

    if (visible) {
      const syncState = {
        base: rootPos,
        right: this._staticRight,
        forward: this._staticForward,
        height,
        strength: m.strength,
        palette: m.palette,
      }
      this._magicGlowMat.userData.sync?.(syncState)
      this._magicBandMat.userData.sync?.(syncState)

      // Sync arcane rune seal ground decal
      this._magicGroundMesh.position.set(rootPos.x, 0.005, rootPos.z)
      this._magicGroundMesh.scale.set(3.6, 1, 3.6)
      this._magicGroundMat.userData.sync?.({
        fade: m.strength,
        radius: 1.8,
        palette: {
          crack: m.palette.inner,
          ring: m.palette.outer,
          core: m.palette.core,
        },
      })

      // Emit helical starlight particles
      const starCount = this._magicSparkEmitter.tick(dt, 20, m.strength)
      if (starCount > 0) {
        const ang = time * 2.5 + Math.random() * 6.28
        const r = 0.55
        this._tmpPos.set(
          rootPos.x + Math.cos(ang) * r,
          rootPos.y + height * (0.3 + Math.random() * 0.5),
          rootPos.z + Math.sin(ang) * r,
        )
        this._emitScratch.position = this._tmpPos
        this._emitScratch.radius = 0.04
        this._emitScratch.direction = this._tmpDir.set(0, 0.8, 0).normalize()
        this._emitScratch.speed = 0.5
        this._emitScratch.size = 0.12
        this._emitScratch.life = 1.2
        this._emitScratch.time = time
        this.particleEngine.get('aura_starlight').emit(starCount, this._emitScratch)
      }
    }
  }

  private _updateVerdant(dt: number, time: number, rootPos: Vector3, height: number) {
    const v = this.state.verdant
    if (v.keepActive) {
      v.strength = Math.min(1.0, v.strength + dt * 3.0)
    }
    else if (v.active) {
      v.elapsed += dt
      if (v.elapsed < 0.4)
        v.strength = v.elapsed / 0.4
      else if (v.elapsed > v.duration - 0.7)
        v.strength = Math.max(0, (v.duration - v.elapsed) / 0.7)
      else
        v.strength = 1.0

      if (v.elapsed >= v.duration) {
        v.active = false
        v.strength = 0
      }
    }
    else {
      v.strength = Math.max(0, v.strength - dt * 2.0)
    }

    const visible = v.strength > 0.005
    this._verdantGlowMesh.visible = visible
    this._verdantBandMesh.visible = visible
    this._verdantGroundMesh.visible = visible

    if (visible) {
      syncFresnelAura(v.strength, rootPos.y, height, {
        colorRim: v.palette.leaf,
        colorCore: v.palette.core,
        colorVein: v.palette.vine,
        fresnelGlow: 2.8,
        veinSpeed: 0.8,
        scanSpeed: 0.35,
        veins: 0.45,
      }, 'verdant')

      const syncState = {
        base: rootPos,
        right: this._staticRight,
        forward: this._staticForward,
        height,
        strength: v.strength,
        palette: {
          core: v.palette.core,
          inner: v.palette.leaf,
          outer: v.palette.vine,
          halo: v.palette.base,
        },
      }
      this._verdantGlowMat.userData.sync?.(syncState)
      this._verdantBandMat.userData.sync?.(syncState)

      // Sync sacred grove mandala ground decal
      this._verdantGroundMesh.position.set(rootPos.x, 0.005, rootPos.z)
      this._verdantGroundMesh.scale.set(3.4, 1, 3.4)
      this._verdantGroundMat.userData.sync?.({
        fade: v.strength,
        radius: 1.7,
        palette: {
          char: v.palette.base,
          crack: v.palette.vine,
          ring: v.palette.leaf,
          core: v.palette.core,
        },
      })

      // Emit rising bio-luminescent spore motes
      const sporeCount = this._verdantSporeEmitter.tick(dt, 28, v.strength)
      if (sporeCount > 0) {
        const ang = time * 1.2 + Math.random() * 6.28
        const r = 0.2 + Math.random() * 0.45
        this._tmpPos.set(
          rootPos.x + Math.cos(ang) * r,
          rootPos.y + height * (0.1 + Math.random() * 0.7),
          rootPos.z + Math.sin(ang) * r,
        )
        this._emitScratch.position = this._tmpPos
        this._emitScratch.radius = 0.06
        this._emitScratch.direction = this._tmpDir.set(
          Math.sin(time * 2.0 + this._tmpPos.y * 3.0) * 0.3,
          0.9,
          Math.cos(time * 2.0 + this._tmpPos.y * 3.0) * 0.3,
        ).normalize()
        this._emitScratch.speed = 0.4
        this._emitScratch.speedVariance = 0.2
        this._emitScratch.spread = 0.3
        this._emitScratch.size = 0.11
        this._emitScratch.life = 1.6
        this._emitScratch.time = time
        this.particleEngine.get('aura_verdant_spores').emit(sporeCount, this._emitScratch)
      }
    }
    else {
      syncFresnelAura(0, rootPos.y, height, undefined, 'verdant')
    }
  }

  dispose() {
    this.scene.remove(this.group)
    this._flameGeometry.dispose()
    this._flameGlowMat.dispose()
    this._flameSheetMat.dispose()
    this._magicGeometry.dispose()
    this._magicGlowMat.dispose()
    this._magicBandMat.dispose()
    this._verdantGeometry.dispose()
    this._verdantGlowMat.dispose()
    this._verdantBandMat.dispose()
    this._groundGeometry.dispose()
    this._fireGroundMat.dispose()
    this._electricGroundMat.dispose()
    this._magicGroundMat.dispose()
    this._verdantGroundMat.dispose()
    this.particleEngine.dispose()
  }
}

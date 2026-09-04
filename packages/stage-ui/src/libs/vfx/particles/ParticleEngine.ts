import type { Scene } from 'three'

import type { ParticleSystemOptions } from './ParticleSystem'

import { ParticleSystem } from './ParticleSystem'

/**
 * Owns and pools every particle system in the VFX scene.
 * Systems are created lazily by name and shared to prevent duplicate allocation.
 */
export class ParticleEngine {
  public scene: Scene
  public systems: Map<string, ParticleSystem> = new Map()

  constructor(scene: Scene) {
    this.scene = scene
  }

  /**
   * Fetch or lazily instantiate a shared particle system.
   */
  get(name: string, options: Omit<ParticleSystemOptions, 'name'> = {}): ParticleSystem {
    let system = this.systems.get(name)
    if (!system) {
      system = new ParticleSystem({ name, ...options })
      this.systems.set(name, system)
      this.scene.add(system.mesh)
    }
    return system
  }

  /** Upload all dirty particle slots to the GPU for this frame. */
  flush() {
    for (const system of this.systems.values())
      system.flush()
  }

  /** Number of particles alive across all pools. */
  countLive(time: number): number {
    let total = 0
    for (const system of this.systems.values())
      total += system.countLive(time)
    return total
  }

  reset() {
    for (const system of this.systems.values())
      system.reset()
  }

  dispose() {
    for (const system of this.systems.values()) {
      this.scene.remove(system.mesh)
      system.dispose()
    }
    this.systems.clear()
  }
}

/**
 * Fractional-rate emitter that accumulates fractional particle counts to stay
 * frame-rate independent.
 */
export class RateEmitter {
  public rate: number
  private _accumulator = 0

  constructor(rate = 30) {
    this.rate = rate
  }

  /**
   * Returns whole particles to spawn this frame based on dt.
   */
  tick(dt: number, rate = this.rate, rateMultiplier = 1.0): number {
    this._accumulator += rate * rateMultiplier * dt
    const count = Math.floor(this._accumulator)
    this._accumulator -= count
    // Clamped ceiling to prevent massive burst spikes on thread lag
    return Math.min(count, 240)
  }

  reset() {
    this._accumulator = 0
  }
}

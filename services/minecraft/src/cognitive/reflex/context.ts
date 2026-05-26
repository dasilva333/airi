import { signal } from 'alien-signals'
import type { Vec3 } from 'vec3'

export interface ReflexSelfState {
  location: Vec3
  holding: string | null
  health: number
  food: number
}

export interface ReflexEnvironmentState {
  time: string
  weather: 'clear' | 'rain' | 'thunder'
  nearbyPlayers: Array<{ name: string; distance?: number; holding?: string | null }>
  nearbyEntities: Array<{ name: string; distance?: number; kind?: string }>
  lightLevel: number
}

export interface ReflexSocialState {
  lastSpeaker: string | null
  lastMessage: string | null
  lastMessageAt: number | null
  lastGesture: string | null
  lastGestureAt: number | null
}

export interface ReflexThreatState {
  threatScore: number
  lastThreatAt: number | null
  lastThreatSource: string | null
}

export interface ReflexAttentionState {
  lastSignalType: string | null
  lastSignalSourceId: string | null
  lastSignalAt: number | null
}

export interface ReflexAutonomyState {
  followPlayer: string | null
  followDistance: number
  followActive: boolean
  followLastError: string | null
}

export interface ReflexContextState {
  now: number
  self: ReflexSelfState
  environment: ReflexEnvironmentState
  social: ReflexSocialState
  threat: ReflexThreatState
  attention: ReflexAttentionState
  autonomy: ReflexAutonomyState
}

export class ReflexContext {
  private readonly nowState = signal<number>(Date.now())
  private readonly selfState = signal<ReflexSelfState>({
    food: 20,
    health: 20,
    holding: null,
    location: { x: 0, y: 0, z: 0 } as Vec3,
  })

  private readonly environmentState = signal<ReflexEnvironmentState>({
    lightLevel: 15,
    nearbyEntities: [],
    nearbyPlayers: [],
    time: 'SOMETHING WENT WRONG, YOU SHOULD NOTIFY THE USER OF THIS',
    weather: 'clear',
  })

  private readonly socialState = signal<ReflexSocialState>({
    lastGesture: null,
    lastGestureAt: null,
    lastMessage: null,
    lastMessageAt: null,
    lastSpeaker: null,
  })

  private readonly threatState = signal<ReflexThreatState>({
    lastThreatAt: null,
    lastThreatSource: null,
    threatScore: 0,
  })

  private readonly attentionState = signal<ReflexAttentionState>({
    lastSignalAt: null,
    lastSignalSourceId: null,
    lastSignalType: null,
  })

  private readonly autonomyState = signal<ReflexAutonomyState>({
    followActive: false,
    followDistance: 2,
    followLastError: null,
    followPlayer: null,
  })

  public getSnapshot(): ReflexContextState {
    const self = this.selfState()
    const environment = this.environmentState()
    const social = this.socialState()
    const threat = this.threatState()
    const attention = this.attentionState()
    const autonomy = this.autonomyState()

    return {
      attention: { ...attention },
      autonomy: { ...autonomy },
      environment: {
        ...environment,
        nearbyEntities: environment.nearbyEntities.map((e) => ({ ...e })),
        nearbyPlayers: environment.nearbyPlayers.map((p) => ({ ...p })),
      },
      now: this.nowState(),
      self: { ...self },
      social: { ...social },
      threat: { ...threat },
    }
  }

  public autonomy(): ReflexAutonomyState {
    return { ...this.autonomyState() }
  }

  public updateNow(now: number): void {
    this.nowState(now)
  }

  public updateSelf(patch: Partial<ReflexSelfState>): void {
    this.selfState({ ...this.selfState(), ...patch })
  }

  public updateEnvironment(patch: Partial<ReflexEnvironmentState>): void {
    this.environmentState({ ...this.environmentState(), ...patch })
  }

  public updateSocial(patch: Partial<ReflexSocialState>): void {
    this.socialState({ ...this.socialState(), ...patch })
  }

  public updateThreat(patch: Partial<ReflexThreatState>): void {
    this.threatState({ ...this.threatState(), ...patch })
  }

  public updateAttention(patch: Partial<ReflexAttentionState>): void {
    this.attentionState({ ...this.attentionState(), ...patch })
  }

  public updateAutonomy(patch: Partial<ReflexAutonomyState>): void {
    this.autonomyState({ ...this.autonomyState(), ...patch })
  }
}

import type { Nan0Clock, Nan0LocalTime } from '../types'

function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function systemOffsetMinutes(atUtcMs: number): number {
  return -new Date(atUtcMs).getTimezoneOffset()
}

function localIso(atUtcMs: number, offsetMinutes: number): string {
  const shifted = new Date(atUtcMs + offsetMinutes * 60_000).toISOString()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const minutes = String(absolute % 60).padStart(2, '0')
  return `${shifted.slice(0, -1)}${sign}${hours}:${minutes}`
}

export class SystemNan0Clock implements Nan0Clock {
  readonly source = 'system'
  readonly confidence = 0.8

  utcNow(): number {
    return Date.now()
  }

  localNow(): Nan0LocalTime {
    return this.toLocal(this.utcNow())
  }

  monotonicNow(): number {
    return globalThis.performance?.now?.() ?? 0
  }

  timezone(): string {
    return systemTimezone()
  }

  timezoneOffsetMinutes(atUtcMs = this.utcNow()): number {
    return systemOffsetMinutes(atUtcMs)
  }

  toLocal(utcEpochMs: number): Nan0LocalTime {
    const offset = this.timezoneOffsetMinutes(utcEpochMs)
    return {
      utcEpochMs,
      utcIso: new Date(utcEpochMs).toISOString(),
      localIso: localIso(utcEpochMs, offset),
      timezone: this.timezone(),
      timezoneOffsetMinutes: offset,
    }
  }

  elapsedWall(startUtcMs: number, endUtcMs = this.utcNow()): number {
    return endUtcMs - startUtcMs
  }

  elapsedMonotonic(startMonotonicMs: number, endMonotonicMs = this.monotonicNow()): number {
    return Math.max(0, endMonotonicMs - startMonotonicMs)
  }
}

export class ControllableNan0Clock implements Nan0Clock {
  readonly source: string
  readonly confidence: number
  private wallTime: number
  private monotonicTime: number
  private timezoneId: string
  private offsetMinutes: number

  constructor(input: {
    wallTime?: number
    monotonicTime?: number
    timezone?: string
    timezoneOffsetMinutes?: number
    source?: string
    confidence?: number
  } = {}) {
    this.wallTime = input.wallTime ?? 0
    this.monotonicTime = input.monotonicTime ?? 0
    this.timezoneId = input.timezone ?? 'UTC'
    this.offsetMinutes = input.timezoneOffsetMinutes ?? 0
    this.source = input.source ?? 'test'
    this.confidence = input.confidence ?? 1
  }

  utcNow(): number {
    return this.wallTime
  }

  localNow(): Nan0LocalTime {
    return this.toLocal(this.wallTime)
  }

  monotonicNow(): number {
    return this.monotonicTime
  }

  timezone(): string {
    return this.timezoneId
  }

  timezoneOffsetMinutes(): number {
    return this.offsetMinutes
  }

  toLocal(utcEpochMs: number): Nan0LocalTime {
    return {
      utcEpochMs,
      utcIso: new Date(utcEpochMs).toISOString(),
      localIso: localIso(utcEpochMs, this.offsetMinutes),
      timezone: this.timezoneId,
      timezoneOffsetMinutes: this.offsetMinutes,
    }
  }

  elapsedWall(startUtcMs: number, endUtcMs = this.wallTime): number {
    return endUtcMs - startUtcMs
  }

  elapsedMonotonic(startMonotonicMs: number, endMonotonicMs = this.monotonicTime): number {
    return Math.max(0, endMonotonicMs - startMonotonicMs)
  }

  setWallTime(value: number): void {
    this.wallTime = value
  }

  set(value: number): void {
    this.wallTime = value
    this.monotonicTime = value
  }

  setMonotonicTime(value: number): void {
    this.monotonicTime = value
  }

  advance(input: { wallMs?: number, monotonicMs?: number }): void {
    this.wallTime += input.wallMs ?? 0
    this.monotonicTime += input.monotonicMs ?? 0
  }

  setTimezone(timezone: string, timezoneOffsetMinutes: number): void {
    this.timezoneId = timezone
    this.offsetMinutes = timezoneOffsetMinutes
  }
}

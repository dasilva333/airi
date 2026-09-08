import { describe, expect, it } from 'vitest'

import {
  checkIsPipeBusy,
  formatProactiveTailEnvelope,
  formatSensorPayload,
  isNoReplySentinel,
} from './proactivity-telemetry'

describe('proactivity telemetry, busy-pipe gating & prompt framing', () => {
  describe('checkIsPipeBusy', () => {
    it('returns false when all pipe channels are idle', () => {
      expect(checkIsPipeBusy({})).toBe(false)
      expect(
        checkIsPipeBusy({
          sending: false,
          activeSpokenText: null,
          isHeartbeatEvaluating: false,
          isDreamStateEvaluating: false,
          isUserTyping: false,
        }),
      ).toBe(false)
    })

    it('returns true when chat orchestrator is currently sending', () => {
      expect(checkIsPipeBusy({ sending: true })).toBe(true)
    })

    it('returns true when avatar has active spoken audio playback', () => {
      expect(checkIsPipeBusy({ activeSpokenText: 'Hello there!' })).toBe(true)
    })

    it('returns true when heartbeat evaluation is in flight', () => {
      expect(checkIsPipeBusy({ isHeartbeatEvaluating: true })).toBe(true)
    })

    it('returns true when dream state consolidation is in flight', () => {
      expect(checkIsPipeBusy({ isDreamStateEvaluating: true })).toBe(true)
    })

    it('returns true when user typing activity is detected', () => {
      expect(checkIsPipeBusy({ isUserTyping: true })).toBe(true)
    })
  })

  describe('isNoReplySentinel', () => {
    it('identifies exact NO_REPLY control sentinel', () => {
      expect(isNoReplySentinel('NO_REPLY')).toBe(true)
    })

    it('tolerates leading and trailing whitespace around NO_REPLY', () => {
      expect(isNoReplySentinel('  NO_REPLY\n')).toBe(true)
    })

    it('rejects ordinary assistant text and substrings', () => {
      expect(isNoReplySentinel('I decided to output NO_REPLY to you')).toBe(false)
      expect(isNoReplySentinel('')).toBe(false)
      expect(isNoReplySentinel(null)).toBe(false)
      expect(isNoReplySentinel(undefined)).toBe(false)
    })
  })

  describe('formatSensorPayload', () => {
    const baseInput = {
      idleTimeSec: 120,
      volLevel: 75,
      locTime: '14:30',
      resolvedDefaultBackgroundName: 'cozy_library',
    }

    it('formats user idle time, volume, local time, and default background', () => {
      const payload = formatSensorPayload(baseInput)
      expect(payload).toContain('User Idle: 120s')
      expect(payload).toContain('Volume Level: 75%')
      expect(payload).toContain('Current Local Time: 14:30')
      expect(payload).toContain('Active Character Default Background: cozy_library')
    })

    it('falls back to unknown when idleTimeSec or volume is undefined', () => {
      const payload = formatSensorPayload({
        ...baseInput,
        idleTimeSec: undefined,
        volLevel: undefined,
      })
      expect(payload).toContain('User Idle: unknown')
      expect(payload).toContain('Volume Level: unknown')
    })

    it('formats window history and active program when enabled', () => {
      const payload = formatSensorPayload({
        ...baseInput,
        winHistory: [
          {
            startTime: Date.now() - 60000,
            endTime: Date.now() - 30000,
            durationMs: 30000,
            window: { title: 'VSCode - Project', processName: 'Code' },
          },
          {
            startTime: Date.now() - 30000,
            endTime: Date.now(),
            durationMs: 30000,
            window: { title: 'YouTube - Anime Lofi', processName: 'Google Chrome' },
          },
        ],
      })
      expect(payload).toContain('Active Program: Google Chrome')
      expect(payload).toContain('Active Window Title: YouTube - Anime Lofi')
      expect(payload).toContain('[ Previous History ]')
      expect(payload).toContain('Code | VSCode - Project')
      expect(payload).toContain('[ 30s ]')
    })

    it('emits Window History: [DISABLED] when contextOptions.windowHistory is false', () => {
      const payload = formatSensorPayload({
        ...baseInput,
        contextOptions: { windowHistory: false },
      })
      expect(payload).toContain('Window History: [DISABLED]')
      expect(payload).not.toContain('Active Program:')
    })

    it('formats CPU and GPU load averages when provided', () => {
      const payload = formatSensorPayload({
        ...baseInput,
        sysLoad: {
          cpu: [1.25, 2.10, 1.85],
          gpuAvg: 34.5,
        },
      })
      expect(payload).toContain('CPU Load (1/5/15): 1.25 | 2.10 | 1.85')
      expect(payload).toContain('GPU Load (Avg): 34.50')
    })

    it('emits System Load: [DISABLED] when contextOptions.systemLoad is false', () => {
      const payload = formatSensorPayload({
        ...baseInput,
        contextOptions: { systemLoad: false },
      })
      expect(payload).toContain('System Load: [DISABLED]')
      expect(payload).not.toContain('CPU Load')
    })

    it('formats hourly usage metrics and next milestone target', () => {
      const payload = formatSensorPayload({
        ...baseInput,
        metrics: {
          recentTtsCount: 5,
          recentSttCount: 3,
          recentChatCount: 12,
          recentJournalEntryCount: 1,
          turnCount: 45,
          nextMilestone: 100,
        },
      })
      expect(payload).toContain('[Usage Metrics (Last Hr)]')
      expect(payload).toContain('TTS (Last Hr): 5')
      expect(payload).toContain('STT (Last Hr): 3')
      expect(payload).toContain('Chat (Last Hr): 12')
      expect(payload).toContain('Journal Entries (Last Hr): 1')
      expect(payload).toContain('Turn Count: 45 (Next Target: 100)')
    })

    it('emits [Metrics]: [DISABLED] when contextOptions.usageMetrics is false', () => {
      const payload = formatSensorPayload({
        ...baseInput,
        contextOptions: { usageMetrics: false },
      })
      expect(payload).toContain('[Metrics]: [DISABLED]')
      expect(payload).not.toContain('[Usage Metrics (Last Hr)]')
    })
  })

  describe('formatProactiveTailEnvelope', () => {
    it('assembles environmental awareness, event stream, and focus directive', () => {
      const result = formatProactiveTailEnvelope({
        sensorPayloadRaw: '[Sensor Data]\nUser Idle: 30s',
        recentLedgerEvents: 'User launched Chrome\nUser opened Discord',
        promptText: 'Check in on user status.',
      })

      expect(result).toContain('[ENVIRONMENTAL AWARENESS]')
      expect(result).toContain('User Idle: 30s')
      expect(result).toContain('[UNIFIED EVENT STREAM]')
      expect(result).toContain('User launched Chrome')
      expect(result).toContain('[FOCUS DIRECTIVE]\nCheck in on user status.')
    })

    it('omits environmental awareness when sensorPayloadRaw is empty', () => {
      const result = formatProactiveTailEnvelope({
        sensorPayloadRaw: '',
        promptText: 'Comment if appropriate.',
      })

      expect(result).not.toContain('[ENVIRONMENTAL AWARENESS]')
      expect(result).toBe('[FOCUS DIRECTIVE]\nComment if appropriate.')
    })

    it('uses default fallback directive when promptText is omitted', () => {
      const result = formatProactiveTailEnvelope({})
      expect(result).toContain(
        '[FOCUS DIRECTIVE]\nReview situational context. Comment on user progress if natural, or output NO_REPLY to remain silent.',
      )
    })
  })
})

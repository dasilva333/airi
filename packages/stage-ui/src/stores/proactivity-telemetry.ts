import type { ActiveWindowEntry, SystemLoadAverages } from '@proj-airi/stage-shared'

export interface PipeBusyState {
  sending?: boolean
  activeSpokenText?: string | null
  isHeartbeatEvaluating?: boolean
  isDreamStateEvaluating?: boolean
  isUserTyping?: boolean
}

export interface SensorPayloadInput {
  idleTimeSec?: number
  winHistory?: ActiveWindowEntry[]
  sysLoad?: SystemLoadAverages | null
  volLevel?: number
  locTime?: string
  resolvedDefaultBackgroundName?: string
  contextOptions?: {
    windowHistory?: boolean
    systemLoad?: boolean
    usageMetrics?: boolean
  }
  metrics?: {
    recentTtsCount?: number
    recentSttCount?: number
    recentChatCount?: number
    recentJournalEntryCount?: number
    turnCount?: number
    nextMilestone?: number
  }
}

export interface ProactiveTailInput {
  sensorPayloadRaw?: string
  recentLedgerEvents?: string
  promptText?: string
}

/**
 * Calculates whether the agent interaction/speech pipe is currently busy.
 * Gating prevents heartbeats, background dreaming, and unprompted turns from
 * speaking over the user or interrupting active model generation.
 */
export function checkIsPipeBusy(state: PipeBusyState): boolean {
  return Boolean(
    state.sending
    || state.activeSpokenText
    || state.isHeartbeatEvaluating
    || state.isDreamStateEvaluating
    || state.isUserTyping,
  )
}

/**
 * Checks if raw model response matches the NO_REPLY control sentinel.
 * Sentinel signifies that the model evaluated environmental context and decided
 * to remain silent, and must never be relayed to chat history or speech.
 */
export function isNoReplySentinel(reply: string | undefined | null): boolean {
  return (reply || '').trim() === 'NO_REPLY'
}

/**
 * Formats sensory telemetry and system state for situational awareness prompt injection.
 */
export function formatSensorPayload(input: SensorPayloadInput): string {
  const {
    idleTimeSec,
    winHistory = [],
    sysLoad,
    volLevel,
    locTime = 'unknown',
    resolvedDefaultBackgroundName = 'none',
    contextOptions,
    metrics,
  } = input

  let payload = '[Sensor Data]\n'

  payload += `User Idle: ${idleTimeSec !== undefined ? `${idleTimeSec}s` : 'unknown'}\n`

  if (contextOptions?.windowHistory !== false) {
    if (winHistory.length > 0) {
      const history = winHistory.slice(-6)
      const active = history.pop()

      if (active) {
        if (active.window.processName && active.window.processName !== 'Unknown') {
          payload += `Active Program: ${active.window.processName}\n`
        }
        payload += `Active Window Title: ${active.window.title}\n`
      }

      if (history.length > 0) {
        payload += '\n[ Previous History ]\n'
        history.reverse().forEach((entry) => {
          const start = new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          const end = new Date(entry.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          const durationSec = Math.floor(entry.durationMs / 1000)
          const durationStr = durationSec < 60 ? `${durationSec}s` : `${Math.floor(durationSec / 60)}m`

          const name = (entry.window.processName && entry.window.processName !== 'Unknown')
            ? `${entry.window.processName} | `
            : ''
          payload += `[ ${name}${entry.window.title} ] [ ${durationStr} ] [ ${start} - ${end} ]\n`
        })
      }
    }
  }
  else {
    payload += 'Window History: [DISABLED]\n'
  }

  if (contextOptions?.systemLoad !== false) {
    if (sysLoad) {
      payload += `CPU Load (1/5/15): ${sysLoad.cpu[0].toFixed(2)} | ${sysLoad.cpu[1].toFixed(2)} | ${sysLoad.cpu[2].toFixed(2)}\n`
      payload += `GPU Load (Avg): ${sysLoad.gpuAvg.toFixed(2)}\n`
    }
  }
  else {
    payload += 'System Load: [DISABLED]\n'
  }

  const volStr = volLevel !== undefined ? `${volLevel}%` : 'unknown'
  payload += `Volume Level: ${volStr}\n`
  payload += `Current Local Time: ${locTime || 'unknown'}\n`
  payload += `Active Character Default Background: ${resolvedDefaultBackgroundName}\n`

  if (contextOptions?.usageMetrics !== false) {
    const turnCount = metrics?.turnCount ?? 0
    const nextTarget = metrics?.nextMilestone ?? 100

    payload += '\n[Usage Metrics (Last Hr)]\n'
    payload += `TTS (Last Hr): ${metrics?.recentTtsCount ?? 0}\n`
    payload += `STT (Last Hr): ${metrics?.recentSttCount ?? 0}\n`
    payload += `Chat (Last Hr): ${metrics?.recentChatCount ?? 0}\n`
    payload += `Journal Entries (Last Hr): ${metrics?.recentJournalEntryCount ?? 0}\n`
    payload += `Turn Count: ${turnCount} (Next Target: ${nextTarget})\n`
  }
  else {
    payload += '\n[Metrics]: [DISABLED]\n'
  }

  return payload
}

/**
 * Formats the ephemeral tail directive for proactive turns, placing volatile telemetry
 * at the tail of the prompt to maximize KV prefix-cache hits across conversation history.
 */
export function formatProactiveTailEnvelope(input: ProactiveTailInput): string {
  let tailDirective = ''

  if (input.sensorPayloadRaw) {
    tailDirective += '[ENVIRONMENTAL AWARENESS]\n'
      + 'The following telemetry describes your current environmental context. '
      + 'Use it to stay grounded in the user\x27s reality and inform your response. '
      + 'You may reference specific values (like time or active applications) if relevant '
      + 'to the conversation, but avoid a dry, technical recitation of the data.\n'
      + '---\n'
      + `${input.sensorPayloadRaw}\n\n`
  }

  if (input.recentLedgerEvents) {
    tailDirective += '[UNIFIED EVENT STREAM]\n'
      + 'Recent activity across the environment:\n'
      + `${input.recentLedgerEvents}\n\n`
  }

  const promptText = input.promptText || 'Review situational context. Comment on user progress if natural, or output NO_REPLY to remain silent.'
  tailDirective += `[FOCUS DIRECTIVE]\n${promptText}`

  return tailDirective.trim()
}

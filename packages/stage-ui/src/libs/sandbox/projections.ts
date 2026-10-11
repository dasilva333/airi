import type {
  SandboxVfsCognitionProjection,
  SandboxVfsMessageItem,
  SandboxVfsSessionProjection,
  SandboxVfsTelemetryProjection,
} from './types'

import { useChatSessionStore } from '../../stores/chat/session-store'
import { useAiriCardStore } from '../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../stores/modules/consciousness'
import { useProactivityStore } from '../../stores/proactivity'

export function buildSessionProjection(): SandboxVfsSessionProjection {
  try {
    const sessionStore = useChatSessionStore()
    const cardStore = useAiriCardStore()
    const activeSessionId = sessionStore.activeSessionId || ''
    const meta = activeSessionId ? sessionStore.getSessionMeta(activeSessionId) : null
    const messages = activeSessionId ? sessionStore.getSessionMessages(activeSessionId) : []

    let lastMessageAt: string | null = null
    let hoursSinceLastMessage: number | null = null

    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1] as any
      if (lastMsg?.createdAt) {
        lastMessageAt = new Date(lastMsg.createdAt).toISOString()
        const diffMs = Date.now() - new Date(lastMsg.createdAt).getTime()
        hoursSinceLastMessage = Math.max(0, Number((diffMs / 3600000).toFixed(2)))
      }
    }

    return {
      activeSessionId,
      characterName: cardStore.activeCard?.name || 'Airi',
      messageCount: messages ? messages.length : 0,
      lastMessageAt,
      hoursSinceLastMessage,
      createdAt: meta?.createdAt ? new Date(meta.createdAt).toISOString() : null,
    }
  }
  catch (err) {
    console.warn('[Sandbox] Error building session projection:', err)
    return {
      activeSessionId: '',
      characterName: 'Airi',
      messageCount: 0,
      lastMessageAt: null,
      hoursSinceLastMessage: null,
      createdAt: null,
    }
  }
}

export function buildCognitionProjection(): SandboxVfsCognitionProjection {
  try {
    const cardStore = useAiriCardStore()
    const consciousnessStore = useConsciousnessStore()

    return {
      character: {
        name: cardStore.activeCard?.name || 'Airi',
        description: cardStore.activeCard?.description || '',
      },
      consciousness: {
        activeProvider: consciousnessStore.activeProvider || '',
        activeModel: consciousnessStore.activeModel || '',
      },
    }
  }
  catch (err) {
    console.warn('[Sandbox] Error building cognition projection:', err)
    return {
      character: { name: 'Airi' },
      consciousness: { activeProvider: '', activeModel: '' },
    }
  }
}

export function buildTelemetryProjection(): SandboxVfsTelemetryProjection {
  try {
    const proactivity = useProactivityStore()
    const payload = proactivity.sensorPayload as any

    return {
      idleTimeSec: payload?.idleTimeSec ?? proactivity.idleTimeSec ?? 0,
      activeProgram: payload?.activeProgram ?? (proactivity.activeWinStr ? proactivity.activeWinStr.split(' - ')[0] : 'Unknown'),
      activeWindowTitle: payload?.activeWindowTitle ?? proactivity.activeWinStr ?? '',
      windowHistory: Array.isArray(proactivity.winHistory)
        ? proactivity.winHistory.slice(-6).map((item: any) => ({
            processName: item.window?.processName || 'Unknown',
            title: item.window?.title || '',
            durationMs: item.durationMs || 0,
          }))
        : [],
      cpuLoad: payload?.cpuLoad ?? proactivity.sysLoad?.cpu ?? [0, 0, 0],
      gpuAvg: payload?.gpuAvg ?? proactivity.sysLoad?.gpuAvg ?? 0,
      volumeLevel: payload?.volumeLevel ?? proactivity.volLevel ?? 100,
      localTime: payload?.localTime ?? proactivity.locTime ?? new Date().toLocaleTimeString(),
      usageMetrics: {
        ttsHourly: payload?.usageMetrics?.ttsHourly ?? 0,
        sttHourly: payload?.usageMetrics?.sttHourly ?? 0,
        chatHourly: payload?.usageMetrics?.chatHourly ?? 0,
        journalHourly: payload?.usageMetrics?.journalHourly ?? 0,
        turnCount: payload?.usageMetrics?.turnCount ?? 0,
      },
    }
  }
  catch (err) {
    console.warn('[Sandbox] Error building telemetry projection:', err)
    return {
      idleTimeSec: 0,
      activeProgram: 'Unknown',
      activeWindowTitle: '',
      windowHistory: [],
      cpuLoad: [0, 0, 0],
      gpuAvg: 0,
      volumeLevel: 100,
      localTime: new Date().toLocaleTimeString(),
      usageMetrics: {
        ttsHourly: 0,
        sttHourly: 0,
        chatHourly: 0,
        journalHourly: 0,
        turnCount: 0,
      },
    }
  }
}

export function buildMessagesProjection(): SandboxVfsMessageItem[] {
  try {
    const sessionStore = useChatSessionStore()
    const activeSessionId = sessionStore.activeSessionId
    if (!activeSessionId)
      return []

    const messages = sessionStore.getSessionMessages(activeSessionId) || []
    return messages.slice(-20).map((m: any) => ({
      id: m.id || '',
      role: m.role || 'user',
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }))
  }
  catch (err) {
    console.warn('[Sandbox] Error building messages projection:', err)
    return []
  }
}

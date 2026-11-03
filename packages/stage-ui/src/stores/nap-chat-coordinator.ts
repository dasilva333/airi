import type { Peer } from '@proj-airi/stage-shared'

import type { NapChatSessionRecord, NapEpisode, NapTurn } from './nap-chat'

import { defineStore, storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { useChatSessionStore } from './chat/session-store'
import { useAiriCardStore } from './modules/airi-card'
import { NAPCHAT_UNIVERSE_ID, useNapChatStore } from './nap-chat'
import { isUserAway } from './proactivity-telemetry'

export const NAP_COORDINATOR_MAX_TURNS = 5

export type NapSessionStatus = 'idle' | 'active' | 'consolidating' | 'done' | 'aborted'

export interface NapTriggerEvaluation {
  fire: boolean
  reason: 'ok' | 'disabled' | 'user-present' | 'no-candidates' | 'already-fired'
}

function stampNow(): string {
  try {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  catch {
    return ''
  }
}

/**
 * Autonomous nap-chat session coordinator (plumbing side).
 *
 * Owns trigger evaluation + the turn-taking state machine. Dialogue
 * generation (LLM) and journal write-back (text_journal tool) are injected
 * by the caller at a later step — this store never speaks or writes.
 * UI reads `latestEpisode` from useNapChatStore; this store is the engine.
 */
export const useNapChatCoordinatorStore = defineStore('nap-chat-coordinator', () => {
  const napChat = useNapChatStore()
  const airiCardStore = useAiriCardStore()

  const status = ref<NapSessionStatus>('idle')
  const activePeerId = ref<string | null>(null)
  const activeCompanionId = ref<string | null>(null)
  const sessionTopic = ref<string | null>(null)
  const turns = ref<NapTurn[]>([])
  const startedAt = ref<number | null>(null)

  function napChatStoreActiveCardName(): string {
    try {
      const { activeCard } = storeToRefs(airiCardStore)
      return activeCard.value?.name || 'AIRI'
    }
    catch {
      return 'AIRI'
    }
  }

  function localPeerIdSafe(): string {
    return 'local'
  }

  const isActive = computed(() => status.value === 'active')
  const turnCount = computed(() => turns.value.length)

  function evaluateTrigger(currentIdleSec: number | undefined, roster: Peer[], companionId: string): NapTriggerEvaluation {
    if (!napChat.napEnabled)
      return { fire: false, reason: 'disabled' }
    const candidates = napChat.selectCandidates(roster, companionId, currentIdleSec)
    if (candidates.length === 0) {
      const away = isUserAway(currentIdleSec, napChat.afkThresholdMinutes)
      return { fire: false, reason: away ? 'no-candidates' : 'user-present' }
    }
    if (napChat.firedForIdleSession)
      return { fire: false, reason: 'already-fired' }
    return { fire: true, reason: 'ok' }
  }

  function beginSession(peerId: string, companionId: string, topic?: string): boolean {
    if (status.value === 'active')
      return false
    napChat.markIdleSessionStarted()
    activePeerId.value = peerId
    activeCompanionId.value = companionId
    sessionTopic.value = topic ?? null
    turns.value = []
    startedAt.value = Date.now()
    status.value = 'active'
    return true
  }

  function recordTurn(speaker: string, text: string): boolean {
    if (status.value !== 'active')
      return false
    if (turns.value.length >= NAP_COORDINATOR_MAX_TURNS)
      return false
    turns.value.push({ speaker, text, time: stampNow() })
    return true
  }

  async function finishSession(summary: string): Promise<NapEpisode | null> {
    if (status.value !== 'active')
      return null
    status.value = 'consolidating'
    const peerId = activePeerId.value ?? 'unknown-peer'
    const now = Date.now()
    const started = startedAt.value ?? now
    const record: NapChatSessionRecord = {
      sessionId: `nap-${started}`,
      localPeerId: localPeerIdSafe(),
      peerPeerId: peerId,
      localCardName: napChatStoreActiveCardName(),
      peerCardName: peerId,
      turnCount: turns.value.length,
      startedAt: started,
      endedAt: now,
      closeReason: 'completed',
      recap: summary,
      turns: [...turns.value],
    }
    try {
      await napChat.recordNapChatCompletion(record)
    }
    catch {}
    status.value = 'done'
    return napChat.latestEpisode ?? {
      sessionId: record.sessionId,
      with: { characterName: record.peerCardName, alias: record.peerCardName },
      turnCount: record.turnCount,
      summary: record.recap,
      timestamp: record.endedAt,
      journalEntryId: '',
      turns: record.turns ?? [],
    }
  }

  /**
   * Per-pair dialog session in the `napchat` universe (one session per
   * companion↔peer pair; group chat can later key `napPeerId` by group id).
   * Created with `setActive: false` so nap traffic never hijacks the user's
   * active chat; universe scoping keeps it out of `global` memory grounding
   * until the user explicitly moves it. Best-effort: returns null when the
   * session layer is unavailable so previews keep working session-less.
   */
  async function ensureDialogSessionId(characterId: string, peerId: string, peerName: string): Promise<string | null> {
    try {
      const sessionStore = useChatSessionStore()
      const characterIndex = sessionStore.getCharacterIndex(characterId)
      const existing = characterIndex
        ? Object.values(characterIndex.sessions).find(s => s.universeId === NAPCHAT_UNIVERSE_ID && (s as { napPeerId?: string }).napPeerId === peerId)
        : undefined
      if (existing)
        return existing.sessionId
      return await sessionStore.createSession(characterId, {
        setActive: false,
        universeId: NAPCHAT_UNIVERSE_ID,
        napPeerId: peerId,
        title: `Nap-chat with ${peerName}`,
        messages: [{ role: 'system', content: `Nap-chat dialog with ${peerName}. Turns are inscribed automatically; only user/assistant turns count as dialog history.` } as any],
      })
    }
    catch {
      return null
    }
  }

  /**
   * Last `limit` dialog turns (user/assistant with text content only —
   * system notes, errors, and director messages are excluded).
   */
  function getDialogTurns(sessionId: string | null, limit: number): Array<{ role: 'user' | 'assistant', content: string }> {
    if (!sessionId)
      return []
    try {
      const sessionStore = useChatSessionStore()
      const messages = sessionStore.getSessionMessages(sessionId) as Array<{ role?: string, content?: unknown }>
      return messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
        .slice(-Math.max(1, limit))
        .map(m => ({ role: m.role as 'user' | 'assistant', content: (m.content as string).slice(0, 500) }))
    }
    catch {
      return []
    }
  }

  async function inscribeDialogTurn(sessionId: string | null, role: 'user' | 'assistant', text: string, peerId: string): Promise<void> {
    if (!sessionId || !text.trim())
      return
    try {
      const { nanoid } = await import('nanoid')
      const sessionStore = useChatSessionStore()
      sessionStore.inscribeTurn({
        id: nanoid(),
        role,
        content: text.slice(0, 2000),
        createdAt: Date.now(),
        slices: [],
        tool_results: [],
        metadata: { source: 'napchat', peerId },
      } as any, sessionId)
    }
    catch {}
  }

  function abortSession(): void {
    activePeerId.value = null
    activeCompanionId.value = null
    sessionTopic.value = null
    turns.value = []
    startedAt.value = null
    status.value = 'aborted'
  }

  function resetSession(): void {
    activePeerId.value = null
    activeCompanionId.value = null
    sessionTopic.value = null
    turns.value = []
    startedAt.value = null
    status.value = 'idle'
  }

  return {
    status,
    activePeerId,
    activeCompanionId,
    sessionTopic,
    turns,
    startedAt,
    isActive,
    turnCount,
    evaluateTrigger,
    beginSession,
    recordTurn,
    finishSession,
    abortSession,
    resetSession,
    ensureDialogSessionId,
    getDialogTurns,
    inscribeDialogTurn,
  }
})

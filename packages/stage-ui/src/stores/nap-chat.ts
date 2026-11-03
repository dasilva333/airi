import type { Peer } from '@proj-airi/stage-shared'

import { isCompanionAllowedForFriend, isNapChatEligible } from '@proj-airi/stage-shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { isUserAway } from './proactivity-telemetry'

export const NAP_CHAT_DEFAULT_THRESHOLD_MIN = 15

export const NAPCHAT_UNIVERSE_ID = 'napchat'

export const NAP_HISTORY_WINDOW_DEFAULT = 6

/**
 * Stable dialog-state markers. The prompt builder renders exactly one of
 * these fact lines per turn (never an empty `[]`); the guidance clauses
 * below key off them. Keep the marker strings in sync if either side changes.
 */
export const NAP_DIALOG_NO_HISTORY_MARKER = 'No prior episodes with this peer.'

export const DEFAULT_SOCIAL_PROMPT_GUIDANCE
  = 'Be casual, friendly, and enthusiastic. Discuss our shared creative and coding projects while keeping private user personal details confidential.\n'
    + 'If the dialog state says "No prior episodes with this peer", this is first contact: generate a friendly greeting mentioning them by name and probing for shared interests. Do not pretend a history you do not have.\n'
    + 'If prior dialog turns exist, continue the ongoing conversation naturally — do not re-greet or re-introduce yourself.'

export interface NapTurn {
  speaker: string
  text: string
  time: string
}

export interface NapEpisode {
  sessionId: string
  with: {
    characterName: string
    alias: string
    avatarUrl?: string
  }
  turnCount: number
  summary: string
  timestamp: number
  journalEntryId: string
  turns: NapTurn[]
}

export type NapChatCloseReason = 'completed' | 'user-present' | 'aborted' | 'model-gate'

export interface NapChatSessionRecord {
  sessionId: string
  localPeerId: string
  peerPeerId: string
  localCardName: string
  peerCardName: string
  turnCount: number
  startedAt: number
  endedAt: number
  closeReason: NapChatCloseReason
  recap: string
  turns?: NapTurn[]
}

export const useNapChatStore = defineStore('nap-chat', () => {
  const napEnabled = ref(true)
  const afkThresholdMinutes = ref(NAP_CHAT_DEFAULT_THRESHOLD_MIN)
  const welcomeBackRecapEnabled = ref(true)
  const firedForIdleSession = ref(false)
  const socialPromptGuidance = ref(DEFAULT_SOCIAL_PROMPT_GUIDANCE)
  // How many of the last dialog turns feed the prompt (workbench + live loop).
  // Surfaced in Friends & Companions > Nap-chat controls.
  const napHistoryWindow = ref(NAP_HISTORY_WINDOW_DEFAULT)
  // Public ambassador override. Empty = follow the active card. Picked in
  // Friends & Companions > companion address card; gates deploy identity,
  // draft persona, and dialog-session ownership.
  const ambassadorCompanionId = ref('')

  // NOTICE: No prototype seed. Episodes are recorded by the nap-chat coordinator
  // after a real autonomous session; the UI renders its empty state until then.
  const latestEpisode = ref<NapEpisode | null>(null)

  function selectCandidates(roster: Peer[], companionId: string, currentIdleSec?: number): Peer[] {
    if (!napEnabled.value)
      return []
    if (!isUserAway(currentIdleSec, afkThresholdMinutes.value))
      return []
    return roster.filter(peer => isNapChatEligible(peer) && isCompanionAllowedForFriend(peer, companionId))
  }

  function markIdleSessionStarted() {
    firedForIdleSession.value = false
  }

  function shouldDeliverRecap(): boolean {
    if (!welcomeBackRecapEnabled.value || firedForIdleSession.value)
      return false
    firedForIdleSession.value = true
    return true
  }

  function recordEpisode(episode: NapEpisode) {
    latestEpisode.value = episode
  }

  async function recordNapChatCompletion(record: NapChatSessionRecord): Promise<void> {
    latestEpisode.value = {
      sessionId: record.sessionId,
      with: { characterName: record.peerCardName, alias: record.peerCardName },
      turnCount: record.turnCount,
      summary: record.recap,
      timestamp: record.endedAt,
      journalEntryId: '',
      turns: record.turns ?? [],
    }
  }

  function formatWelcomeBackRecap(episode?: NapEpisode | null): string {
    const ep = episode !== undefined ? episode : latestEpisode.value
    if (!ep || !ep.with?.characterName)
      return 'NO_REPLY'
    return `While you were away, I had a brief chat with ${ep.with.characterName} about our project notes!`
  }

  return {
    napEnabled,
    afkThresholdMinutes,
    welcomeBackRecapEnabled,
    firedForIdleSession,
    socialPromptGuidance,
    napHistoryWindow,
    ambassadorCompanionId,
    latestEpisode,
    selectCandidates,
    markIdleSessionStarted,
    shouldDeliverRecap,
    recordEpisode,
    recordNapChatCompletion,
    formatWelcomeBackRecap,
  }
})

import type { ChatGroundingMetadata, ChatStreamEvent } from '../types/chat'
import type { TextJournalEntry, TextJournalEntrySource } from '../types/text-journal'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import * as v from 'valibot'

import { chatSessionsRepo } from '../database/repos/chat-sessions.repo'
import { echoChipsRepo } from '../database/repos/echo-chips.repo'
import { lifetimeMemoryRepo } from '../database/repos/lifetime-memory.repo'
import { shortTermMemoryRepo } from '../database/repos/short-term-memory.repo'
import { textJournalRepo } from '../database/repos/text-journal.repo'
import { LAST_INDEXED_TURN_KEY, layeredMemory } from '../libs/search/layered-memory'
import { chunkTurnText } from '../libs/search/turn-chunker'
import { shouldDegradeBackgroundWork } from '../utils/memory-sentinel'
import { useAuthStore } from './auth'
import { CHAT_STREAM_CHANNEL_NAME } from './chat/constants'
import { stageJournalIntrusion } from './chat/intrusion-staging'
import { useChatSessionStore } from './chat/session-store'
import { useEntityLedgerStore } from './entity-ledger'
import { useEventLogStore } from './event-log'
import { useLLM } from './llm'
import { useAiriCardStore } from './modules/airi-card'
import { useSystemOneStore } from './modules/system-one'
import { useProvidersStore } from './providers'

export interface VectorIndexRebuildProgress {
  phase: 'idle' | 'discovering' | 'chunking' | 'embedding' | 'persisting' | 'completed' | 'cancelled' | 'error'
  current: number
  total: number
  percent: number
  message?: string
}

/**
 * Background (non-destructive) index pass. Distinct from the explicit rebuild:
 * this one is resumable, walks oldest → newest, and checkpoints the coverage
 * frontier so a crash costs at most one checkpoint window.
 */
export interface BackgroundIndexProgress {
  phase: 'idle' | 'hot-set' | 'backfill' | 'delta' | 'checkpoint' | 'completed' | 'deferred' | 'error'
  indexed: number
  total: number
  /** Persisted coverage frontier: every doc at or below this time is embedded. */
  cursor: number
  percent: number
  message: string
  startedAt: number
  updatedAt: number
}

/**
 * Batch size for the background pass. Sized so the worker lock is held for a
 * few seconds at most on CPU-fp32: a 2s-debounced preflight search queues
 * behind one batch, never behind the whole corpus.
 */
const BACKGROUND_INDEX_BATCH_DOCS = 25
const BACKGROUND_INDEX_CHECKPOINT_DOCS = 250
/**
 * Active-session turns embedded before the cold backfill. Small on purpose:
 * this is the "the conversation in front of me works now" set, not a second
 * full pass.
 */
const BACKGROUND_INDEX_HOT_SET_DOCS = 150

function* chunkArray<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size)
    yield items.slice(i, i + size)
}

function yieldToMainThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function normalizeEntry(entry: TextJournalEntry): TextJournalEntry {
  return {
    id: String(entry.id),
    userId: String(entry.userId),
    characterId: String(entry.characterId),
    characterName: String(entry.characterName),
    title: String(entry.title ?? ''),
    content: String(entry.content ?? ''),
    source: entry.source ?? 'tool',
    type: entry.type ?? 'message',

    // FSRS
    stability: Number(entry.stability ?? 0),
    difficulty: Number(entry.difficulty ?? 0),
    elapsed_days: Number(entry.elapsed_days ?? 0),
    scheduled_days: Number(entry.scheduled_days ?? 0),
    last_review: Number(entry.last_review ?? entry.createdAt ?? Date.now()),
    surprise: entry.surprise !== undefined ? Number(entry.surprise) : undefined,

    // Search
    embedding: Array.isArray(entry.embedding) ? entry.embedding : undefined,
    version: entry.version,

    createdAt: Number.isFinite(entry.createdAt) ? Number(entry.createdAt) : Date.now(),
    updatedAt: Number.isFinite(entry.updatedAt) ? Number(entry.updatedAt) : Date.now(),
    universeId: entry.universeId,
    sessionId: entry.sessionId,
  }
}

function normalizeEntries(entries: TextJournalEntry[]) {
  return entries.map(normalizeEntry)
}

function toDocTime(value: unknown): number {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

// NOTICE: single time base for index ordering AND watermark deltas. `timestamp`
// stays creation-anchored (temporal scoring depends on it); `createdAt` is the
// wider index-recency key (max of creation/update), so edited or backfilled
// docs re-index instead of hiding below the watermark forever.
function docIndexTime(d: { createdAt?: unknown, timestamp?: unknown }): number {
  return Math.max(toDocTime(d.createdAt), toDocTime(d.timestamp))
}

function isMainWindow(): boolean {
  if (typeof window === 'undefined')
    return true
  if (!isStageTamagotchi())
    return true
  const hash = window.location.hash || ''
  return hash === '' || hash === '#/' || hash === '#' || hash === '#!/'
}

function isChatWindow(): boolean {
  if (typeof window === 'undefined')
    return false
  const hash = window.location.hash || ''
  return hash.startsWith('#/chat')
}

export const useTextJournalStore = defineStore('text-journal', () => {
  const { userId } = storeToRefs(useAuthStore())
  const { activeCard, activeCardId, cards } = storeToRefs(useAiriCardStore())

  const { post: broadcastStreamEvent, data: incomingStreamEvent } = useBroadcastChannel<ChatStreamEvent, ChatStreamEvent>({ name: CHAT_STREAM_CHANNEL_NAME })

  // BroadcastChannel for cross-window intrusion staging
  const { post: postIntrusionStaging } = useBroadcastChannel<
    { type: 'journal' | 'artistry', data: any },
    { type: 'journal' | 'artistry', data: any }
  >({ name: 'airi-intrusion-staging' })

  const entries = ref<TextJournalEntry[]>([])
  const loading = ref(false)
  const initializedForUserId = ref<string | null>(null)
  const lastSearchTriage = ref<any>(null)
  const lastSearchMode = ref<'pass11' | 'baseline'>('baseline')

  function getCurrentUserId() {
    return userId.value || 'local'
  }

  const sortedEntries = computed(() => {
    const chatSessionStore = useChatSessionStore()
    const targetCharacterId = activeCardId.value
    const activeSessionId = targetCharacterId
      ? (chatSessionStore.getCharacterIndex(targetCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
      : chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = activeSessionMeta?.universeId || 'global'

    return [...entries.value]
      .filter(e => (e.universeId || 'global') === currentUniverseId)
      .sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt)
  })

  async function load(force = false) {
    const currentUserId = getCurrentUserId()
    if ((!force && initializedForUserId.value === currentUserId) || loading.value)
      return

    loading.value = true
    try {
      entries.value = normalizeEntries(await textJournalRepo.getAll(currentUserId) ?? [])

      // Initialize layered memory index
      try {
        await layeredMemory.init()
      }
      catch (err) {
        console.warn('text_journal: layeredMemory.init skipped or failed:', err)
      }

      initializedForUserId.value = currentUserId

      // Fire-and-forget background indexing (primary stage window and desktop chat window)
      if (isMainWindow() || isChatWindow()) {
        backgroundIndexAll().catch(err => console.error('text_journal: background search indexing failed:', err))
      }
    }
    finally {
      loading.value = false
    }
  }

  function extractTextContent(content: any): string {
    if (typeof content === 'string')
      return content
    if (Array.isArray(content)) {
      return content.map((part) => {
        if (typeof part === 'string')
          return part
        if (part && typeof part === 'object' && 'text' in part)
          return String(part.text ?? '')
        return ''
      }).join('')
    }
    return ''
  }

  /**
   * Shared raw-turn fan-out for both index paths (background fast path and
   * explicit rebuild deep pass). Mega-turns split into overlapping windows
   * (turn-chunker.ts: 1500 chars / 200 overlap — the canonical sizes); short
   * turns keep their bare id/title so snapshots and worker reuse-by-content
   * stay stable. Stops once target reaches maxDocs.
   */
  function appendChunkedTurnDocs(
    target: Map<string, any>,
    input: {
      text: string
      messageId: string | undefined
      role: string
      sessionId: string | undefined
      cardId: string
      turnDate: string
      maxDocs: number
    },
  ): void {
    // NOTICE: mega-turns (novel chapters) fan out into overlapping windows
    // so no single forward faces an unconstrained attention tensor
    // (§7 D3, §5b ceiling).
    const baseTitle = `Chat ${input.role} turn — ${input.turnDate.slice(0, 10)} ${String(input.sessionId).slice(0, 8)}`
    for (const chunk of chunkTurnText(input.text)) {
      if (target.size >= input.maxDocs)
        break
      const chunkText = chunk.total === 1 ? input.text : chunk.text
      const chunkKey = chunk.total === 1 ? input.text : `${input.messageId}:c${chunk.index}:${chunk.text}`
      if (target.has(chunkKey))
        continue
      target.set(chunkKey, {
        id: chunk.total === 1 ? input.messageId : `${input.messageId}:c${chunk.index}`,
        characterId: input.cardId,
        // NOTICE: synthetic role+date title disambiguates
        // repeat one-liners across sessions (§7 D3).
        title: chunk.total === 1 ? baseTitle : `${baseTitle} [Part ${chunk.index + 1}/${chunk.total}]`,
        fact: chunkText,
        kind: 'raw_turn',
        createdAt: toDocTime(input.turnDate),
        timestamp: input.turnDate,
        source: `chat:${input.sessionId}`,
      })
    }
  }

  let indexingInProgress: Promise<void> | null = null
  // Set when backgroundIndexAll stands down for an active rebuild; the
  // rebuild consumes it in `finally` so skipped cycles are re-run, not lost.
  let needsBackgroundIndex = false

  const isRebuildingVectorIndex = ref(false)
  const vectorIndexProgress = ref<VectorIndexRebuildProgress | null>(null)
  const vectorIndexError = ref<string | null>(null)
  const lastVectorIndexRebuiltAt = ref<number | null>(null)
  const backgroundIndexProgress = ref<BackgroundIndexProgress | null>(null)
  const lastBackgroundIndexCompletedAt = ref<number | null>(null)
  let vectorIndexAbortController: AbortController | null = null

  async function backgroundIndexAll() {
    if (isRebuildingVectorIndex.value) {
      console.info('[TextJournal:Index] Vector index rebuild in progress; deferring backgroundIndexAll until it finishes.')
      needsBackgroundIndex = true
      return
    }
    if (indexingInProgress) {
      return indexingInProgress
    }

    indexingInProgress = (async () => {
      try {
        // NOTICE: stand down under memory pressure — bulk ONNX embeddings are
        // the most expensive background work per byte. Deferred, not dropped:
        // the next load/index call retries once pressure clears.
        if (shouldDegradeBackgroundWork()) {
          console.warn('[TextJournal:Index] Deferred background indexing under memory pressure.')
          backgroundIndexProgress.value = {
            phase: 'deferred',
            indexed: 0,
            total: 0,
            cursor: layeredMemory.lastIndexState?.lastIndexedTurnAt ?? 0,
            percent: 0,
            message: 'Background indexing deferred under memory pressure; retrying on the next pass.',
            startedAt: Date.now(),
            updatedAt: Date.now(),
          }
          return
        }
        const userId = getCurrentUserId()
        const cardId = activeCardId.value
        if (!userId || !cardId)
          return

        const chatSessionStore = useChatSessionStore()
        const activeSessionId = cardId
          ? (chatSessionStore.getCharacterIndex(cardId)?.activeSessionId || chatSessionStore.activeSessionId)
          : chatSessionStore.activeSessionId
        const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
        const currentUniverseId = activeSessionMeta?.universeId || 'global'

        // 1. LTMM
        // NOTICE: forward the real journal title — the worker formats
        // `title: ... | text: ...` and `title: none` is never used here
        // (design §7 D1). The 'Journal Entry' placeholder default backfills
        // from the content head so every vector keeps a title signal.
        const ltmm = entries.value.filter(e => e.characterId === cardId && (e.universeId || 'global') === currentUniverseId).map(e => ({
          id: e.id,
          characterId: cardId,
          title: (e.title && e.title.trim() && e.title !== 'Journal Entry')
            ? e.title
            : e.content.slice(0, 40),
          fact: e.content,
          kind: 'ltmm_entry',
          createdAt: Math.max(toDocTime(e.createdAt), toDocTime(e.updatedAt)),
          timestamp: new Date(e.createdAt).toISOString(),
          source: e.source,
          embedding: e.embedding,
        }))

        // 2. STMM
        let stmm: any[] = []
        try {
          const stmmRaw = await shortTermMemoryRepo.getAll(userId) ?? []
          stmm = stmmRaw.filter(b => b.characterId === cardId && (b.universeId || 'global') === currentUniverseId).map(b => ({
            id: b.id,
            characterId: cardId,
            // NOTICE: synthetic date title — STMM blocks have no title
            // field; the date is the load-bearing discriminator (§7 D2).
            title: b.characterName ? `Daily recap ${b.date} — ${b.characterName}` : `Daily recap ${b.date}`,
            fact: b.summary,
            kind: 'stmm_block',
            createdAt: Math.max(toDocTime(b.createdAt), toDocTime(b.updatedAt), toDocTime(b.date)),
            timestamp: b.date,
            source: b.source || 'stmm',
          }))
        }
        catch (err) {
          console.error('[TextJournal:Index] Failed to load STMM for indexing:', err)
        }

        // NOTICE: indexing raw turns is bounded to protect WebGPU/RAM, but
        // comfortably accommodates lore history across multi-session roleplays.
        // Caps count chunk docs (one mega-turn fans out to hundreds of windows).
        // Uses watermark tracking for delta updates, scanning all universe sessions once.
        const MAX_RAW_DOCS = 10000
        const raw: any[] = []
        try {
          const index = await chatSessionsRepo.getIndex(userId)
          if (index && index.characters[cardId]) {
            const characterSessions = index.characters[cardId]
            const sessions = Object.values(characterSessions.sessions)
              .filter(s => (s.universeId || 'global') === currentUniverseId)
              .sort((a: any, b: any) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))

            const uniqueRaw = new Map<string, any>()

            for (const s of sessions) {
              if (uniqueRaw.size >= MAX_RAW_DOCS)
                break
              const session = await chatSessionsRepo.getSession(s.sessionId)
              if (session) {
                const ordered = [...session.messages].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
                for (const m of ordered) {
                  if (uniqueRaw.size >= MAX_RAW_DOCS)
                    break
                  if (m.role === 'user' || m.role === 'assistant') {
                    const text = extractTextContent(m.content).trim()
                    if (text.length > 10) {
                      appendChunkedTurnDocs(uniqueRaw, {
                        text,
                        messageId: m.id,
                        role: m.role,
                        sessionId: s.sessionId,
                        cardId,
                        turnDate: new Date(m.createdAt || Date.now()).toISOString(),
                        maxDocs: MAX_RAW_DOCS,
                      })
                    }
                  }
                }
              }
            }
            raw.push(...uniqueRaw.values())
          }
        }
        catch (err) {
          console.error('[TextJournal:Index] Failed to load Chat Sessions for indexing:', err)
        }

        // 4. Echo Chips (Dreamstate)
        let echoes: any[] = []
        try {
          const echoRaw = await echoChipsRepo.getAll(userId) ?? []
          echoes = echoRaw.filter(c => c.characterId === cardId && (c.universeId || 'global') === currentUniverseId).map(c => ({
            id: c.id,
            characterId: cardId,
            // NOTICE: synthetic type+date title for the 2–5 word chip
            // bursts (§7 D4).
            title: `${c.type} chip ${c.date}`,
            fact: c.content,
            kind: 'echo_chip',
            createdAt: c.createdAt,
            timestamp: new Date(c.createdAt || Date.now()).toISOString(),
            source: `echo:${c.type}`,
          }))
        }
        catch (err) {
          console.error('[TextJournal:Index] Failed to load Echo Chips for indexing:', err)
        }

        // 5. Lifetime Memory (Eternal Thread)
        const lifetime: any[] = []
        try {
          const lifetimeRaw = await lifetimeMemoryRepo.getByCharacter(cardId, currentUniverseId)
          if (lifetimeRaw) {
            const consumedDay = (lifetimeRaw.metadata as { lastConsumedDay?: string } | undefined)?.lastConsumedDay
            lifetime.push({
              id: lifetimeRaw.id,
              characterId: cardId,
              // NOTICE: synthetic thread title keyed on the incremental
              // watermark so re-distills stay distinguishable (§7 D5).
              title: consumedDay ? `Eternal thread through ${consumedDay}` : 'Eternal thread',
              fact: lifetimeRaw.distilledContent,
              kind: 'lifetime_entry',
              createdAt: lifetimeRaw.updatedAt || lifetimeRaw.createdAt,
              timestamp: new Date(lifetimeRaw.updatedAt || Date.now()).toISOString(),
              source: 'lifetime',
            })
          }
        }
        catch (err) {
          console.error('[TextJournal:Index] Failed to load Lifetime Memory for indexing:', err)
        }

        console.info(`[TextJournal:Index] Indexing counts for ${cardId} in universe ${currentUniverseId}: LTMM=${ltmm.length}, STMM=${stmm.length}, Raw=${raw.length}, Echoes=${echoes.length}, Lifetime=${lifetime.length}`)

        // NOTICE: cap on total indexed docs per cycle matching worker memory
        // budget. Keep the cap recency-based (newest survive), then re-order the
        // survivors by coverage time below.
        const MAX_TOTAL_DOCS = 12000
        const cappedDocs = [...ltmm, ...stmm, ...raw, ...echoes, ...lifetime]
          .sort((a: any, b: any) => docIndexTime(b) - docIndexTime(a))
          .slice(0, MAX_TOTAL_DOCS)

        // NOTICE: coverage-frontier ordering. The persisted watermark means
        // "every document at or below this time is embedded", so the pass must
        // walk oldest → newest and advance the frontier monotonically. Ordering
        // by recency (as this used to) lets the first checkpoint leap over the
        // uncovered older tail, and the delta filter then hides that gap forever.
        const orderedDocs = cappedDocs.sort((a: any, b: any) => docIndexTime(a) - docIndexTime(b))

        const rawWatermark = layeredMemory.lastIndexState?.lastIndexedTurnAt
          ?? (typeof localStorage !== 'undefined' ? Number(localStorage.getItem(LAST_INDEXED_TURN_KEY) || 0) : 0)
        // NOTICE: a corrupted/legacy value must degrade to "backfill", never to
        // "every doc fails `time > NaN`, so the index is up to date".
        const watermark = Number.isFinite(rawWatermark) ? rawWatermark : 0
        // A stale snapshot has had its vectors stripped by the worker, so no
        // stored coverage can be trusted — rebuild it from zero.
        const isStale = layeredMemory.lastIndexState?.stale === true
        const isBackfill = isStale || watermark <= 0

        // NOTICE: fail open — a doc with no parseable time (0) is indexed,
        // never silently dropped. Only strictly-older docs skip.
        const pendingDocs = isBackfill
          ? orderedDocs
          : orderedDocs.filter((doc: any) => {
              const time = docIndexTime(doc)
              return time === 0 || time > watermark
            })

        const startedAt = Date.now()
        let indexed = 0
        let frontier = isBackfill ? 0 : watermark
        let lastCheckpointAt = 0
        const total = pendingDocs.length

        const publish = (
          phase: BackgroundIndexProgress['phase'],
          message: string,
        ) => {
          backgroundIndexProgress.value = {
            phase,
            indexed,
            total,
            cursor: frontier,
            percent: total > 0 ? Math.min(100, Math.round((indexed / total) * 100)) : 100,
            message,
            startedAt,
            updatedAt: Date.now(),
          }
        }

        // NOTICE: force=true is required — the 30s throttle would silently skip
        // a checkpoint and let a crash degrade into a full re-embed.
        const checkpoint = async () => {
          // Durable telemetry: this is the line that proves a resumed pass
          // picked up the previous frontier instead of starting over.
          console.info('[Telemetry:TextJournal:BackgroundIndex:Checkpoint]', {
            indexed,
            total,
            frontier,
            elapsedMs: Date.now() - startedAt,
          })
          await layeredMemory.persist(true, { watermark: frontier })
        }

        if (pendingDocs.length === 0) {
          console.info(`[TextJournal:Index] Index is up-to-date with watermark ${watermark}; skipping indexing.`)
          backgroundIndexProgress.value = {
            phase: 'completed',
            indexed: 0,
            total: 0,
            cursor: watermark,
            percent: 100,
            message: 'Vector index is up to date.',
            startedAt,
            updatedAt: Date.now(),
          }
          lastBackgroundIndexCompletedAt.value = Date.now()
          return
        }

        // Hot set (cold snapshot only): embed the active session's turns first
        // so the conversation in front of the user is searchable in seconds.
        // The frontier deliberately does NOT advance for these — they sit above
        // the uncovered tail, and the worker's max-of-batch tracker would strand
        // everything older if it were allowed to persist their timestamps.
        const hotSet = isBackfill && activeSessionId
          ? pendingDocs
              .filter((d: any) => d.source === `chat:${activeSessionId}`)
              .slice(-BACKGROUND_INDEX_HOT_SET_DOCS)
          : []
        const hotIds = new Set(hotSet.map((d: any) => d.id))
        const backfillDocs = hotSet.length > 0
          ? pendingDocs.filter((d: any) => !hotIds.has(d.id))
          : pendingDocs

        console.info(`[TextJournal:Index] Watermark ${watermark} (backfill=${isBackfill}): ${total} document(s) to embed, hot set ${hotSet.length}.`)

        try {
          if (hotSet.length > 0) {
            publish('hot-set', `Indexing the active conversation first (${hotSet.length} turn chunk${hotSet.length === 1 ? '' : 's'})...`)
            for (const batch of chunkArray(hotSet, BACKGROUND_INDEX_BATCH_DOCS)) {
              await layeredMemory.indexDocuments(batch, { persist: false })
              indexed += batch.length
              publish('hot-set', `Active conversation indexed: ${indexed}/${total} documents...`)
              await yieldToMainThread()
            }
            // Crash safety without moving the coverage frontier.
            await checkpoint()
          }

          const mode = isBackfill ? 'backfill' : 'delta'
          for (const batch of chunkArray(backfillDocs, BACKGROUND_INDEX_BATCH_DOCS)) {
            await layeredMemory.indexDocuments(batch, { persist: false })

            // Ascending walk: the newest document in the batch is a valid
            // frontier because every older document has already been sent.
            const batchFrontier = docIndexTime(batch[batch.length - 1])
            if (batchFrontier > frontier)
              frontier = batchFrontier
            indexed += batch.length

            publish(
              mode,
              mode === 'backfill'
                ? `Rebuilding vector index: ${indexed}/${total} documents...`
                : `Updating vector index: ${indexed}/${total} document(s)...`,
            )

            if (indexed - lastCheckpointAt >= BACKGROUND_INDEX_CHECKPOINT_DOCS) {
              publish('checkpoint', `Checkpoint: persisting ${indexed}/${total} documents...`)
              await checkpoint()
              lastCheckpointAt = indexed
            }

            // Hand the worker lock back between batches so a 2s-debounced
            // preflight search never queues behind thousands of embeddings.
            await yieldToMainThread()
          }

          // Every pending document is embedded now, including the hot set that
          // sat above the walking frontier. Publish the true frontier last so a
          // subsequent pass takes the cheap delta path.
          for (const doc of pendingDocs) {
            const time = docIndexTime(doc)
            if (time > frontier)
              frontier = time
          }

          publish('checkpoint', `Persisting vector index snapshot (${indexed}/${total} documents)...`)
          await checkpoint()

          indexed = total
          publish('completed', `Vector index up to date: ${total} document(s) embedded.`)
          lastBackgroundIndexCompletedAt.value = Date.now()
          console.info('[Telemetry:TextJournal:BackgroundIndex:Complete]', {
            total,
            hotSet: hotSet.length,
            watermark: frontier,
            durationMs: Date.now() - startedAt,
          })
        }
        catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[TextJournal:Index] Background indexing failed:', err)
          backgroundIndexProgress.value = {
            phase: 'error',
            indexed,
            total,
            cursor: frontier,
            percent: total > 0 ? Math.round((indexed / total) * 100) : 0,
            message: `Background indexing stopped at ${indexed}/${total}: ${message}`,
            startedAt,
            updatedAt: Date.now(),
          }
          // Best-effort checkpoint so the next pass resumes where this one
          // stopped instead of restarting from the old watermark.
          try {
            await checkpoint()
          }
          catch (persistErr) {
            console.error('[TextJournal:Index] Failed to persist indexing checkpoint:', persistErr)
          }
        }
      }
      finally {
        indexingInProgress = null
      }
    })()

    return indexingInProgress
  }

  /**
   * Explicit Deep Pass: Rebuilds the vector search index across all historical
   * dialogue turns, episodic journals, daily summaries, echo chips, and lifetime
   * memory without artificial 30-session caps or FIFO dropouts.
   *
   * Purely deterministic and local: chunks text via `turn-chunker.ts` and indexes
   * via `@huggingface/transformers` in the search worker. Does NOT invoke System 1
   * or LLM API calls, preserving API quota and running in parallel on-device.
   */
  async function rebuildVectorIndex(options?: {
    characterId?: string
    universeId?: string
    maxRawDocs?: number
    batchSize?: number
  }) {
    if (isRebuildingVectorIndex.value)
      return

    // Resolve identity before taking the mutex: an early return here must
    // not leave isRebuildingVectorIndex latched (that would stand down
    // backgroundIndexAll forever and no-op every future rebuild).
    const userId = getCurrentUserId()
    const cardId = options?.characterId || activeCardId.value
    if (!userId || !cardId)
      return

    isRebuildingVectorIndex.value = true
    vectorIndexError.value = null
    vectorIndexAbortController = new AbortController()
    const signal = vectorIndexAbortController.signal

    vectorIndexProgress.value = {
      phase: 'discovering',
      current: 0,
      total: 0,
      percent: 0,
      message: 'Discovering universe memory records and chat sessions...',
    }

    try {
      signal.throwIfAborted()

      // Serialize against any active backgroundIndexAll call
      if (indexingInProgress) {
        try {
          await indexingInProgress
        }
        catch {}
      }

      signal.throwIfAborted()

      // Hydrate entries before reading entries.value cold
      try {
        await load()
      }
      catch (err) {
        console.error('[TextJournal:RebuildVector] Failed to load entries before rebuild:', err)
      }

      signal.throwIfAborted()

      const chatSessionStore = useChatSessionStore()
      const activeSessionId = cardId
        ? (chatSessionStore.getCharacterIndex(cardId)?.activeSessionId || chatSessionStore.activeSessionId)
        : chatSessionStore.activeSessionId
      const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
      const currentUniverseId = options?.universeId || activeSessionMeta?.universeId || 'global'
      signal.throwIfAborted()

      // 1. LTMM (Episodic Sacred Records)
      const ltmm = entries.value
        .filter(e => e.characterId === cardId && (e.universeId || 'global') === currentUniverseId)
        .map(e => ({
          id: e.id,
          characterId: cardId,
          title: (e.title && e.title.trim() && e.title !== 'Journal Entry')
            ? e.title
            : e.content.slice(0, 40),
          fact: e.content,
          kind: 'ltmm_entry',
          timestamp: new Date(e.createdAt).toISOString(),
          source: e.source,
          embedding: e.embedding,
        }))

      signal.throwIfAborted()

      // 2. STMM (Daily Recaps)
      let stmm: any[] = []
      try {
        const stmmRaw = await shortTermMemoryRepo.getAll(userId) ?? []
        stmm = stmmRaw
          .filter(b => b.characterId === cardId && (b.universeId || 'global') === currentUniverseId)
          .map(b => ({
            id: b.id,
            characterId: cardId,
            title: b.characterName ? `Daily recap ${b.date} — ${b.characterName}` : `Daily recap ${b.date}`,
            fact: b.summary,
            kind: 'stmm_block',
            timestamp: b.date,
            source: b.source || 'stmm',
          }))
      }
      catch (err) {
        console.error('[TextJournal:RebuildVector] Failed to load STMM:', err)
      }

      signal.throwIfAborted()

      // 3. Echo Chips (Dreamstate)
      let echoes: any[] = []
      try {
        const echoRaw = await echoChipsRepo.getAll(userId) ?? []
        echoes = echoRaw
          .filter(c => c.characterId === cardId && (c.universeId || 'global') === currentUniverseId)
          .map(c => ({
            id: c.id,
            characterId: cardId,
            title: `${c.type} chip ${c.date}`,
            fact: c.content,
            kind: 'echo_chip',
            timestamp: new Date(c.createdAt || Date.now()).toISOString(),
            source: `echo:${c.type}`,
          }))
      }
      catch (err) {
        console.error('[TextJournal:RebuildVector] Failed to load Echo Chips:', err)
      }

      signal.throwIfAborted()

      // 4. Lifetime Memory (Eternal Thread)
      const lifetime: any[] = []
      try {
        const lifetimeRaw = await lifetimeMemoryRepo.getByCharacter(cardId, currentUniverseId)
        if (lifetimeRaw) {
          const consumedDay = (lifetimeRaw.metadata as { lastConsumedDay?: string } | undefined)?.lastConsumedDay
          lifetime.push({
            id: lifetimeRaw.id,
            characterId: cardId,
            title: consumedDay ? `Eternal thread through ${consumedDay}` : 'Eternal thread',
            fact: lifetimeRaw.distilledContent,
            kind: 'lifetime_entry',
            timestamp: new Date(lifetimeRaw.updatedAt || Date.now()).toISOString(),
            source: 'lifetime',
          })
        }
      }
      catch (err) {
        console.error('[TextJournal:RebuildVector] Failed to load Lifetime Memory:', err)
      }

      signal.throwIfAborted()

      // 5. Raw Dialogue Turns — Uncapped across ALL sessions in the universe!
      const MAX_RAW_DOCS = options?.maxRawDocs ?? 10000
      const raw: any[] = []
      try {
        const index = await chatSessionsRepo.getIndex(userId)
        if (index && index.characters[cardId]) {
          const characterSessions = index.characters[cardId]
          const sessions = Object.values(characterSessions.sessions)
            .filter(s => (s.universeId || 'global') === currentUniverseId)
            .sort((a: any, b: any) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))

          const uniqueRaw = new Map<string, any>()
          const totalSessions = sessions.length

          for (let sIdx = 0; sIdx < totalSessions; sIdx++) {
            signal.throwIfAborted()
            if (uniqueRaw.size >= MAX_RAW_DOCS)
              break

            const s = sessions[sIdx]
            const session = await chatSessionsRepo.getSession(s.sessionId)
            if (session) {
              const ordered = [...session.messages].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
              for (const m of ordered) {
                if (uniqueRaw.size >= MAX_RAW_DOCS)
                  break
                if (m.role === 'user' || m.role === 'assistant') {
                  const text = extractTextContent(m.content).trim()
                  if (text.length > 10) {
                    appendChunkedTurnDocs(uniqueRaw, {
                      text,
                      messageId: m.id,
                      role: m.role,
                      sessionId: s.sessionId,
                      cardId,
                      turnDate: new Date(m.createdAt || Date.now()).toISOString(),
                      maxDocs: MAX_RAW_DOCS,
                    })
                  }
                }
              }
            }

            vectorIndexProgress.value = {
              phase: 'chunking',
              current: sIdx + 1,
              total: totalSessions,
              percent: Math.round(((sIdx + 1) / totalSessions) * 25),
              message: `Scanned session ${sIdx + 1}/${totalSessions} (${uniqueRaw.size} dialogue chunks)...`,
            }
          }
          raw.push(...uniqueRaw.values())
        }
      }
      catch (err) {
        if ((err as Error)?.name === 'AbortError')
          throw err
        console.error('[TextJournal:RebuildVector] Failed to scan sessions for indexing:', err)
      }

      signal.throwIfAborted()

      // 6. Merge & Batch Indexing
      const allDocs = [...ltmm, ...stmm, ...raw, ...echoes, ...lifetime]
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      const totalDocs = allDocs.length
      const batchSize = options?.batchSize ?? 25
      let indexedSoFar = 0

      for (let i = 0; i < totalDocs; i += batchSize) {
        signal.throwIfAborted()
        const batch = allDocs.slice(i, i + batchSize)
        // NOTICE: no per-batch persist. The rebuild walks newest → oldest, so
        // the worker's max-of-batch watermark would claim coverage of an older
        // tail it has not reached yet; an interrupted rebuild must leave the
        // previous frontier intact. The single forced persist below owns it.
        await layeredMemory.indexDocuments(batch, { persist: false })
        indexedSoFar = Math.min(totalDocs, i + batch.length)

        vectorIndexProgress.value = {
          phase: 'embedding',
          current: indexedSoFar,
          total: totalDocs,
          percent: 25 + Math.round((indexedSoFar / totalDocs) * 70),
          message: `Embedded & indexed ${indexedSoFar} of ${totalDocs} documents (${raw.length} chunks)...`,
        }
      }

      signal.throwIfAborted()

      // 7. Force Persist snapshot to IndexedDB
      vectorIndexProgress.value = {
        phase: 'persisting',
        current: totalDocs,
        total: totalDocs,
        percent: 98,
        message: 'Persisting vector index snapshot to IndexedDB...',
      }
      await layeredMemory.persist(true)

      lastVectorIndexRebuiltAt.value = Date.now()
      vectorIndexProgress.value = {
        phase: 'completed',
        current: totalDocs,
        total: totalDocs,
        percent: 100,
        message: `Vector search index rebuild complete: ${totalDocs} documents (${raw.length} chunks, ${ltmm.length} journals, ${stmm.length} recaps).`,
      }
    }
    catch (err) {
      if ((err as Error)?.name === 'AbortError' || signal.aborted) {
        vectorIndexProgress.value = {
          phase: 'cancelled',
          current: 0,
          total: 0,
          percent: 0,
          message: 'Vector search index rebuild cancelled.',
        }
      }
      else {
        const msg = err instanceof Error ? err.message : String(err)
        vectorIndexError.value = msg
        vectorIndexProgress.value = {
          phase: 'error',
          current: 0,
          total: 0,
          percent: 0,
          message: `Rebuild failed: ${msg}`,
        }
        console.error('[TextJournal:RebuildVector] Failed:', err)
      }
    }
    finally {
      isRebuildingVectorIndex.value = false
      vectorIndexAbortController = null
      // Re-run any background cycles that stood down for this rebuild so
      // turns arriving mid-rebuild are not left unindexed.
      if (needsBackgroundIndex) {
        needsBackgroundIndex = false
        void backgroundIndexAll().catch(err => console.error('[TextJournal:RebuildVector] Deferred background indexing failed:', err))
      }
    }
  }

  function cancelRebuildVectorIndex() {
    if (vectorIndexAbortController) {
      vectorIndexAbortController.abort()
      vectorIndexProgress.value = {
        phase: 'cancelled',
        current: vectorIndexProgress.value?.current ?? 0,
        total: vectorIndexProgress.value?.total ?? 0,
        percent: vectorIndexProgress.value?.percent ?? 0,
        message: 'Cancelling vector search index rebuild after current batch...',
      }
    }
  }

  async function persist(nextEntries: TextJournalEntry[]) {
    const currentUserId = getCurrentUserId()
    const snapshot = normalizeEntries(JSON.parse(JSON.stringify(nextEntries)) as TextJournalEntry[])
    await textJournalRepo.saveAll(currentUserId, snapshot)
    entries.value = snapshot
    initializedForUserId.value = currentUserId
    broadcastStreamEvent({ type: 'journal-refreshed', userId: currentUserId })
  }

  async function createEntry(input: {
    title?: string
    content: string
    source?: TextJournalEntrySource
    characterId?: string
    universeId?: string
    sessionId?: string
  }) {
    try {
      await load()
    }
    catch (err) {
      throw new Error(`text_journal: failed to load entries before creating: ${err instanceof Error ? err.message : String(err)}`)
    }

    const targetCard = input.characterId
      ? cards.value.get(input.characterId)
      : activeCard.value

    if (!targetCard)
      throw new Error('No active character is available for text_journal.create.')

    const currentUserId = getCurrentUserId()
    const now = Date.now()
    const chatSessionStore = useChatSessionStore()
    const targetCharacterId = input.characterId ?? activeCardId.value ?? ''
    const activeSessionId = input.sessionId !== undefined
      ? input.sessionId
      : (targetCharacterId
          ? (chatSessionStore.getCharacterIndex(targetCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
          : chatSessionStore.activeSessionId)
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)

    const resolvedUniverseId = input.universeId !== undefined ? input.universeId : (activeSessionMeta?.universeId || 'global')
    const resolvedSessionId = input.sessionId !== undefined ? input.sessionId : activeSessionId

    const nextEntry: TextJournalEntry = {
      id: nanoid(),
      userId: currentUserId,
      characterId: input.characterId ?? activeCardId.value ?? '',
      characterName: targetCard.name,
      title: (input.title?.trim() || 'Journal Entry'),
      content: input.content.trim(),
      source: input.source ?? 'tool',
      universeId: resolvedUniverseId,
      sessionId: resolvedSessionId,

      // FSRS
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      last_review: now,

      createdAt: now,
      updatedAt: now,
    }

    if (!nextEntry.characterId)
      throw new Error('Active character could not be resolved for text journal entry creation.')

    // NOTICE: Deduplicate rapid duplicate createEntry calls (e.g. native tool call + fallback marker bridge double-firing)
    const recentDuplicate = entries.value.find(e =>
      e.characterId === nextEntry.characterId
      && e.title === nextEntry.title
      && e.content === nextEntry.content
      && Math.abs(now - (e.createdAt || 0)) <= 5000,
    )
    if (recentDuplicate) {
      console.warn('[TextJournal] Deduplicated rapid duplicate createEntry call:', nextEntry.title)
      return recentDuplicate
    }

    // Hook: If journal intrusion is enabled, stage the pending journal entry via BroadcastChannel + local call
    const injectJournalContext = targetCard.extensions?.airi?.textJournal?.injectJournalContext
    console.warn('[TextJournal Debug] injectJournalContext value:', injectJournalContext)
    if (injectJournalContext) {
      const stagingData = {
        entryText: nextEntry.content,
        timestamp: nextEntry.createdAt,
      }
      // Stage locally (works if createEntry runs in the same window as performSend, e.g. in-band tool call)
      stageJournalIntrusion(stagingData)
      // Broadcast to all windows (works if createEntry runs in a different window, e.g. out-of-band journal moment)
      postIntrusionStaging({ type: 'journal' as const, data: stagingData })
      console.warn('[TextJournal Debug] Staged pendingJournalMoment via local + broadcast:', nextEntry.content.substring(0, 50))
    }

    const nextEntries = [nextEntry, ...entries.value]
    try {
      await persist(nextEntries)

      // Emit event to Event Ledger
      const eventLogStore = useEventLogStore()
      void eventLogStore.appendEvent({
        category: 'memory',
        type: 'text_journal',
        source: nextEntry.characterName || 'AIRI',
        textSummary: `Saved text journal entry: "${nextEntry.title}"`,
        payload: {
          id: nextEntry.id,
          title: nextEntry.title,
          source: nextEntry.source,
          characterId: nextEntry.characterId,
        },
        inspectable: true,
      })
    }
    catch (err) {
      throw new Error(`text_journal: failed to persist new entry "${nextEntry.title}": ${err instanceof Error ? err.message : String(err)}`)
    }
    return nextEntry
  }

  async function seedActiveCharacterEntry() {
    const targetCard = activeCard.value
    if (!targetCard)
      throw new Error('No active character is available to seed the text journal.')

    return await createEntry({
      title: 'Seeded Journal Entry',
      source: 'seed',
      content: [
        `This is a seeded long-term journal entry for ${targetCard.name}.`,
        'It exists to verify that text_journal.create is wired, persisted, and scoped to the active character.',
      ].join('\n\n'),
    })
  }

  // NOTICE: single-flight search coalescing — a nan0 turn fans out to chat-tier
  // RAG + Nan0 memoryRetriever for the same query; without dedup each fires its
  // own EmbeddingGemma ONNX embedding + Jev triage/rerank, doubling WebGPU pressure.
  const inFlightSearches = new Map<string, Promise<(TextJournalEntry & { kind: string, score?: number })[]>>()

  async function searchEntries(input: {
    query: string
    limit?: number
    characterId?: string
    previousTurn?: string
    previousGrounding?: ChatGroundingMetadata
    anaphoraEnabled?: boolean
    signal?: AbortSignal
  }): Promise<(TextJournalEntry & { kind: string, score?: number })[]> {
    const query = input.query.trim()
    if (!query)
      return []

    const targetCharacterId = input.characterId ?? activeCardId.value
    const flightKey = `${targetCharacterId || ''}::${input.limit ?? 3}::${query}::${input.previousTurn || ''}::${input.previousGrounding?.entities?.join(',') || ''}`
    const inFlight = inFlightSearches.get(flightKey)
    if (inFlight)
      return inFlight

    const task = (async (): Promise<(TextJournalEntry & { kind: string, score?: number })[]> => {
      try {
        await load()
      }
      catch (err) {
        throw new Error(`text_journal: failed to load entries before searching: ${err instanceof Error ? err.message : String(err)}`)
      }

      let entityLedgerStore: ReturnType<typeof useEntityLedgerStore> | undefined
      let systemOneStore: ReturnType<typeof useSystemOneStore> | undefined
      try {
        entityLedgerStore = useEntityLedgerStore()
      }
      catch {}
      try {
        systemOneStore = useSystemOneStore()
      }
      catch {}

      let results: Awaited<ReturnType<typeof layeredMemory.search>> = []
      try {
        input.signal?.throwIfAborted?.()
        if (entityLedgerStore && targetCharacterId && entityLedgerStore.currentLoadedCharacterId !== targetCharacterId) {
          await entityLedgerStore.loadLedger(targetCharacterId)
        }

        const activeLedgerCharId = entityLedgerStore?.currentLoadedCharacterId
        const isLedgerForTargetChar = !activeLedgerCharId || !targetCharacterId || activeLedgerCharId === targetCharacterId

        console.log('[Telemetry:TextJournal:searchEntries:Start]', {
          query,
          targetCharacterId,
          activeCardId: activeCardId.value,
          hasLedgerStore: !!entityLedgerStore,
          activeLedgerCharId,
          isLedgerForTargetChar,
          ledgerEntitiesCount: entityLedgerStore?.activeLedger?.entities?.size ?? 0,
          ledgerClaimsCount: entityLedgerStore?.activeLedger?.claims?.size ?? 0,
          ledgerSourcesCount: entityLedgerStore?.activeLedger?.sources?.size ?? 0,
          hasSystemOneStore: !!systemOneStore,
        })

        results = await layeredMemory.search(query, input.limit ?? 3, targetCharacterId, {
          previousTurn: input.previousTurn,
          previousGrounding: input.previousGrounding,
          anaphoraEnabled: input.anaphoraEnabled,
          ledger: isLedgerForTargetChar ? entityLedgerStore?.activeLedger : undefined,
          systemOneStore,
          signal: input.signal,
        })

        console.log('[Telemetry:TextJournal:searchEntries:LayeredResults]', {
          query,
          targetCharacterId,
          resultsCount: results.length,
          resultsSummary: results.map(r => ({ id: r.id, kind: r.kind, score: r.score, isKgClaim: r.isKgClaim, title: (r as any).title })),
        })
      }
      catch (err) {
        if ((err as Error)?.name === 'AbortError')
          throw err
        console.warn('[TextJournal:Search] layeredMemory.search failed, using local ranking fallback:', err)
      }

      lastSearchTriage.value = layeredMemory.lastTriage
      lastSearchMode.value = layeredMemory.lastSearchMode

      if (results.length > 0) {
      // Log search results for developer review
        console.info(`[TextJournal:Search] Query: "${query}" | Results:`, results)

        // Map layered results back to the most relevant TextJournalEntry if it exists,
        // or provide surrogate entries for KG claims, STMM, or Raw.
        return results.map((res) => {
          if (res.isKgClaim) {
            return {
              id: res.id,
              userId: getCurrentUserId(),
              characterId: input.characterId ?? activeCardId.value ?? '',
              characterName: activeCard.value?.name ?? 'Unknown',
              title: res.title || (res.subject && res.predicate && res.object ? `[Knowledge Graph] ${res.subject} ${res.predicate} ${res.object}` : `[Knowledge Graph] Memory`),
              content: res.content,
              kind: res.kind || 'kg_claim',
              score: res.score,
              source: res.source ?? 'tool',
              type: 'message',
              createdAt: new Date(res.timestamp).getTime(),
              updatedAt: new Date(res.timestamp).getTime(),
              subject: res.subject,
              predicate: res.predicate,
              object: res.object,
              dateInfo: res.dateInfo,
              claimId: res.claimId,
              evidence: res.evidence,
              isKgClaim: true,
              triage: res.triage,
            } as unknown as TextJournalEntry & { kind: string, score?: number, isKgClaim?: boolean, subject?: string, predicate?: string, object?: string, dateInfo?: any, claimId?: string }
          }

          const existing = entries.value.find(e => e.id === res.id)
          if (existing) {
            return {
              ...existing,
              kind: res.kind,
              score: res.score,
              triage: res.triage,
              subGoal: res.subGoal,
            }
          }

          // Surrogate entry for STMM/Raw context
          return {
            id: res.id,
            userId: getCurrentUserId(),
            characterId: input.characterId ?? activeCardId.value ?? '',
            characterName: activeCard.value?.name ?? 'Unknown',
            title: `[${res.kind.toUpperCase()}] Memory`,
            content: res.content,
            kind: res.kind,
            score: res.score,
            source: res.source ?? 'tool',
            type: 'message',
            createdAt: new Date(res.timestamp).getTime(),
            updatedAt: new Date(res.timestamp).getTime(),
            timestamp: res.timestamp,
            triage: res.triage,
            subGoal: res.subGoal,
          } as unknown as TextJournalEntry & { kind: string, score?: number, triage?: any, subGoal?: string, timestamp?: string }
        })
      }

      // Fallback: local heuristic ranking on loaded entries (offline / headless fallback)
      const normalizedQuery = query.toLowerCase()
      const queryTokens = normalizedQuery
        .split(/[\s,.;:!?]+/)
        .map(t => t.trim())
        .filter(t => t.length > 2)

      const scopedEntries = entries.value.filter(entry => !targetCharacterId || entry.characterId === targetCharacterId)
      const ranked = scopedEntries
        .map((entry) => {
          const title = entry.title.toLowerCase()
          const content = entry.content.toLowerCase()
          const characterName = entry.characterName.toLowerCase()

          let score = 0
          if (title.includes(normalizedQuery))
            score += 4
          if (content.includes(normalizedQuery))
            score += 2
          if (characterName.includes(normalizedQuery))
            score += 1

          // Token-level matching for longer queries
          for (const token of queryTokens) {
            if (title.includes(token))
              score += 1.5
            if (content.includes(token))
              score += 1.0
            if (characterName.includes(token))
              score += 0.5
          }

          return { entry, score }
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ entry, score }) => ({ ...entry, kind: 'ltmm' as string, score: Number((score / 7).toFixed(3)) }))

      const limit = Math.max(1, Math.min(input.limit ?? 10, 10))
      const fallbackResult = ranked.slice(0, limit)

      console.log('[Telemetry:TextJournal:searchEntries:FallbackExecuted]', {
        query,
        targetCharacterId,
        totalEntries: entries.value.length,
        scopedEntriesCount: scopedEntries.length,
        rankedMatchesCount: ranked.length,
        fallbackResultCount: fallbackResult.length,
        topRanked: fallbackResult.map(r => ({ id: r.id, title: r.title, score: r.score })),
      })

      return fallbackResult
    })()
    inFlightSearches.set(flightKey, task)
    try {
      return await task
    }
    finally {
      inFlightSearches.delete(flightKey)
    }
  }

  watch(incomingStreamEvent, (event) => {
    if (!event)
      return
    if (event.type === 'journal-refreshed') {
      const currentUserId = getCurrentUserId()
      if (event.userId === currentUserId) {
        console.info('[TextJournal] Cross-window journal-refreshed, reloading LTMM entries')
        void load(true)
      }
    }
  })

  async function createJournalMoment(input: {
    messages: any[]
    instructions?: string
    promptTemplate?: string
    modelId: string
    providerId: string
  }) {
    console.info('[JournalMoment] Starting creation...', {
      messageCount: input.messages.length,
      modelId: input.modelId,
      providerId: input.providerId,
    })
    const providersStore = useProvidersStore()
    const llmStore = useLLM()
    const cardStore = useAiriCardStore()
    const { activeCard, activeCardId } = storeToRefs(cardStore)

    if (!activeCard.value || !activeCardId.value) {
      console.error('[JournalMoment] No active character found.')
      throw new Error('No active character')
    }

    const chatProvider = await providersStore.getProviderInstance(input.providerId) as any
    if (!chatProvider) {
      console.error(`[JournalMoment] Provider not found: ${input.providerId}`)
      throw new Error(`Provider not found: ${input.providerId}`)
    }

    // Resolve system prompt and context snapshot
    const chatContext = (await import('./chat/context-store')).useChatContextStore()
    const proactivityStore = (await import('./proactivity')).useProactivityStore()
    const { buildSystemPrompt } = await import('./modules/airi-card')

    const baseSystemPrompt = buildSystemPrompt(activeCard.value)

    // Environmental/Grounding context
    const contextsSnapshot = chatContext.getContextsSnapshot()
    const groundingEnabled = activeCard.value?.extensions?.airi?.groundingEnabled
    const sensorPayload = groundingEnabled ? proactivityStore.sensorPayload : ''

    const validModuleEntries = Object.entries(contextsSnapshot).map(([key, messages]) => {
      const messageTexts = (Array.isArray(messages) ? messages : [messages])
        .map(m => m && typeof m === 'object' && 'text' in m ? m.text : String(m))
        .filter(t => t && t.trim() && !t.includes('No special expressions or props currently active') && !t.includes('No stickers are currently available') && !t.includes('Current Scene: Unknown Location'))
      return [key, messageTexts] as const
    }).filter(([_, texts]) => texts.length > 0)

    let contextContent = ''
    if (validModuleEntries.length > 0) {
      contextContent += 'These are the contextual information retrieved or on-demand updated from other modules:\n'
        + `${validModuleEntries.map(([key, texts]) => `Module ${key}:\n${texts.map(t => `- ${t}`).join('\n')}`).join('\n')}\n`
    }

    if (sensorPayload) {
      contextContent += `${contextContent ? '\n---\n' : ''
      }[ENVIRONMENTAL AWARENESS]\n`
      + `The following telemetry describes your current environmental context. `
      + `Use it to stay grounded in the user's reality and inform your response. `
      + `You may reference specific values (like time or active applications) if relevant `
      + `to the conversation, but avoid a dry, technical recitation of the data.\n`
      + `---\n`
      + `${sensorPayload}\n`
    }

    // Build the system messages list
    const systemMessages: any[] = []
    if (baseSystemPrompt) {
      systemMessages.push({ role: 'system', content: baseSystemPrompt })
    }
    if (contextContent.trim()) {
      systemMessages.push({ role: 'system', content: contextContent.trim() })
    }

    // Format chat history turns accurately preserving raw tokens (RawContent)
    const formattedHistory = input.messages.map((m) => {
      let content = m.role === 'assistant' ? (m.rawContent || m.content) : m.content
      if (Array.isArray(content)) {
        content = content.map((part: any) => {
          if (typeof part === 'string')
            return part
          if (part && typeof part === 'object') {
            if ('text' in part)
              return String(part.text ?? '')
            if ('input' in part)
              return String(part.input ?? '')
            if ('output' in part)
              return String(part.output ?? '')
          }
          return ''
        }).join('')
      }
      return {
        role: m.role,
        content: String(content || ''),
      }
    })

    let instructionSuffix = ''
    if (input.promptTemplate) {
      const additionalIns = input.instructions ? `\nAdditional Instructions: ${input.instructions}\n` : ''
      instructionSuffix = input.promptTemplate
        .replaceAll('{characterName}', activeCard.value.name)
        .replaceAll('{instructions}', additionalIns)
    }
    else {
      instructionSuffix = `You are a cognitive memory system. Write a journal entry about the preceding conversation history in the first person as ${activeCard.value.name}. Reflect on the highlights, jokes, and relationship dynamics.
${input.instructions ? `\nAdditional Instructions: ${input.instructions}\n` : ''}`
    }

    // Always append the fixed JSON schema rules at the end to ensure syntax stability
    instructionSuffix += `\n\nReturn a JSON object with 'title' and 'content' for your journal entry. Ensure you strictly output in this JSON schema format:
{
  "title": "A short, narrative title for the journal entry",
  "content": "The actual journal entry content written in ${activeCard.value.name}'s natural voice."
}`

    const inputMessages = [
      ...systemMessages,
      ...formattedHistory,
      { role: 'user', content: instructionSuffix },
    ]

    console.info('[JournalMoment] Calling LLM generateObject with cache-aligned context...', {
      messagesCount: inputMessages.length,
    })
    try {
      const res = await llmStore.generateObject<{ title: string, content: string }>(
        input.modelId,
        chatProvider,
        {
          messages: inputMessages,
          schema: v.object({
            title: v.string(),
            content: v.string(),
          }),
        },
      )
      const object = res as unknown as { title: string, content: string }
      console.info('[JournalMoment] LLM returned object:', object)

      return await createEntry({
        title: object.title,
        content: object.content,
        characterId: activeCardId.value,
        source: 'user', // Manual trigger
      })
    }
    catch (err) {
      console.error('[JournalMoment] LLM or createEntry failed:', err)
      throw err
    }
  }

  async function deleteEntry(entryId: string): Promise<boolean> {
    try {
      await load()
    }
    catch (err) {
      throw new Error(`text_journal: failed to load entries before deleting: ${err instanceof Error ? err.message : String(err)}`)
    }

    const target = entries.value.find(e => e.id === entryId)
    if (!target)
      return false

    const nextEntries = entries.value.filter(e => e.id !== entryId)
    await persist(nextEntries)

    // Re-index search layer without the deleted entry
    if (isMainWindow()) {
      backgroundIndexAll().catch(err => console.error('text_journal: background search indexing failed after delete:', err))
    }

    // Emit deletion event to Event Ledger
    try {
      const eventLogStore = useEventLogStore()
      void eventLogStore.appendEvent({
        category: 'memory',
        type: 'text_journal',
        source: target.characterName || 'AIRI',
        textSummary: `Deleted text journal entry: "${target.title}"`,
        payload: {
          id: target.id,
          title: target.title,
          source: target.source,
          characterId: target.characterId,
        },
        inspectable: true,
      })
    }
    catch (e) {
      console.warn('[TextJournal] Failed to log delete event:', e)
    }

    return true
  }

  return {
    entries: sortedEntries,
    loading,
    load,
    createEntry,
    deleteEntry,
    seedActiveCharacterEntry,
    searchEntries,
    backgroundIndexAll,
    rebuildVectorIndex,
    cancelRebuildVectorIndex,
    isRebuildingVectorIndex,
    vectorIndexProgress,
    vectorIndexError,
    lastVectorIndexRebuiltAt,
    backgroundIndexProgress,
    lastBackgroundIndexCompletedAt,
    persist,
    createJournalMoment,
    lastSearchTriage,
    lastSearchMode,
  }
})

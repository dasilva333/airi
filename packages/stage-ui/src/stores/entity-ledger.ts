import type { ClaimRecord, EntityType, SourceRecord } from '../libs/search/entity-ledger'
import type { PCLClaim } from '../types/echo-chip'

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { chatSessionsRepo } from '../database/repos/chat-sessions.repo'
import { entityLedgerRepo } from '../database/repos/entity-ledger.repo'
import { textJournalRepo } from '../database/repos/text-journal.repo'
import { EntityLedger } from '../libs/search/entity-ledger'
import { collectUniqueCandidateMentions, extractTurnKnowledge } from '../libs/search/ledger-priming'
import { useAuthStore } from './auth'
import { useChatSessionStore } from './chat/session-store'
import { useSystemOneStore } from './modules/system-one'

export interface EntityLedgerTelemetry {
  universeId: string
  sessionsDiscovered: number
  canonicalSessionTitle: string
  canonicalSessionTurns: number
  branchSessionsCount: number
  totalRawTurnsScanned: number
  deduplicatedTurnsIngested: number
  duplicatedForkTurnsSkipped: number
  journalEntriesIngested: number
  entitiesExtracted: number
  claimsExtracted: number
  availableCharacterKeys: string[]
}

export const useEntityLedgerStore = defineStore('entity-ledger', () => {
  const activeLedger = ref<EntityLedger>(new EntityLedger())
  const isPriming = ref(false)
  const primingProgress = ref(0)
  const primingStatusText = ref('')
  const lastPrimedAt = ref<number | null>(null)
  const currentLoadedCharacterId = ref<string | null>(null)

  const telemetry = ref<EntityLedgerTelemetry>({
    universeId: 'global',
    sessionsDiscovered: 0,
    canonicalSessionTitle: '',
    canonicalSessionTurns: 0,
    branchSessionsCount: 0,
    totalRawTurnsScanned: 0,
    deduplicatedTurnsIngested: 0,
    duplicatedForkTurnsSkipped: 0,
    journalEntriesIngested: 0,
    entitiesExtracted: 0,
    claimsExtracted: 0,
    availableCharacterKeys: [],
  })

  const authStore = useAuthStore()
  const currentUserId = computed(() => authStore.userId || authStore.user?.id || 'local')

  const stats = computed(() => activeLedger.value.getSummaryStats())
  const entities = computed(() => Array.from(activeLedger.value.entities.values()))
  const claims = computed(() => Array.from(activeLedger.value.claims.values()))
  const sources = computed(() => Array.from(activeLedger.value.sources.values()))

  async function loadLedger(characterId: string) {
    if (!characterId)
      return
    currentLoadedCharacterId.value = characterId
    try {
      const data = await entityLedgerRepo.getLedger(characterId)
      if (data) {
        activeLedger.value = EntityLedger.fromJSON(data)
      }
      else {
        activeLedger.value = new EntityLedger()
      }
    }
    catch (err) {
      console.warn('[EntityLedgerStore] Failed to load ledger:', err)
      activeLedger.value = new EntityLedger()
    }
  }

  async function clearLedger(characterId: string) {
    if (!characterId)
      return
    activeLedger.value = new EntityLedger()
    await entityLedgerRepo.deleteLedger(characterId)
    lastPrimedAt.value = null
    telemetry.value = {
      universeId: 'global',
      sessionsDiscovered: 0,
      canonicalSessionTitle: '',
      canonicalSessionTurns: 0,
      branchSessionsCount: 0,
      totalRawTurnsScanned: 0,
      deduplicatedTurnsIngested: 0,
      duplicatedForkTurnsSkipped: 0,
      journalEntriesIngested: 0,
      entitiesExtracted: 0,
      claimsExtracted: 0,
      availableCharacterKeys: [],
    }
  }

  function getEntitySources(entityId: string): SourceRecord[] {
    const ent = activeLedger.value.entities.get(entityId)
    if (!ent)
      return []
    const results: SourceRecord[] = []
    for (const turnId of ent.mentions) {
      const src = activeLedger.value.sources.get(turnId)
      if (src)
        results.push(src)
    }
    return results
  }

  function getEntityClaims(entityId: string): ClaimRecord[] {
    const ent = activeLedger.value.entities.get(entityId)
    if (!ent)
      return []
    const subjectClaims = activeLedger.value.queryClaims(ent.label)
    const objectClaims: ClaimRecord[] = []
    const objectPredMap = activeLedger.value.byObjectPredicate.get(ent.label.toLowerCase())
    if (objectPredMap) {
      for (const claimIdSet of objectPredMap.values()) {
        for (const cId of claimIdSet) {
          const c = activeLedger.value.claims.get(cId)
          if (c && !subjectClaims.some(sc => sc.claimId === c.claimId))
            objectClaims.push(c)
        }
      }
    }
    return [...subjectClaims, ...objectClaims]
  }

  async function updateEntityType(entityId: string, newType: EntityType) {
    const ent = activeLedger.value.entities.get(entityId)
    if (!ent)
      return
    ent.type = newType
    activeLedger.value = EntityLedger.fromJSON(activeLedger.value.toJSON())
    if (currentLoadedCharacterId.value) {
      await entityLedgerRepo.saveLedger(currentLoadedCharacterId.value, activeLedger.value.toJSON())
    }
  }

  async function deleteEntity(entityId: string) {
    const ent = activeLedger.value.entities.get(entityId)
    if (!ent)
      return
    activeLedger.value.entities.delete(entityId)
    activeLedger.value.byAlias.delete(ent.label.toLowerCase())
    activeLedger.value = EntityLedger.fromJSON(activeLedger.value.toJSON())
    if (currentLoadedCharacterId.value) {
      await entityLedgerRepo.saveLedger(currentLoadedCharacterId.value, activeLedger.value.toJSON())
    }
  }

  async function reclassifyEntity(entityId: string) {
    const ent = activeLedger.value.entities.get(entityId)
    if (!ent)
      return null
    const systemOneStore = useSystemOneStore()
    const srcs = getEntitySources(entityId)
    const contextSnippet = srcs.slice(0, 3).map(s => `${s.speaker}: ${s.text}`).join('\n')

    const classificationMap = await systemOneStore.classifyEntities([
      { mention: ent.label, context: contextSnippet },
    ])

    const audit = classificationMap.get(ent.label) || classificationMap.get(ent.label.toLowerCase())
    if (audit) {
      const choice = typeof audit === 'object' && 'choice' in audit ? audit.choice : audit
      if (choice && choice !== 'conversational_artifact' && choice !== 'unknown') {
        ent.type = choice as EntityType
      }
      ent.attributes.systemOne = typeof audit === 'object'
        ? audit
        : {
            choice,
            model: systemOneStore.activeModel,
            provider: systemOneStore.activeProvider,
            timestamp: Date.now(),
          }
      activeLedger.value = EntityLedger.fromJSON(activeLedger.value.toJSON())
      if (currentLoadedCharacterId.value) {
        await entityLedgerRepo.saveLedger(currentLoadedCharacterId.value, activeLedger.value.toJSON())
      }
      return audit
    }
    return null
  }

  /**
   * Rebuild the Knowledge Graph for a character within the active Universe.
   * Follows the Flat Universe Architecture (docs/design-timeline-flat.md) and
   * the canonical timeline + fork deduplication algorithm from memory-lifetime.ts.
   */
  async function rebuildKnowledgeGraph(characterId: string, universeId?: string) {
    if (!characterId || isPriming.value)
      return

    isPriming.value = true
    primingProgress.value = 0.05
    primingStatusText.value = 'Resolving active universe and user credentials...'

    const userId = currentUserId.value
    const chatSessionStore = useChatSessionStore()
    const activeSessionMeta = chatSessionStore.activeSessionId ? chatSessionStore.getSessionMeta(chatSessionStore.activeSessionId) : null
    const targetUniverseId = universeId || activeSessionMeta?.universeId || 'global'

    console.log(`[EntityLedger:Rebuild] ========== Starting Universe Graph Rebuild ==========`)
    console.log(`[EntityLedger:Rebuild] Target Character ID: "${characterId}"`)
    console.log(`[EntityLedger:Rebuild] Target Universe ID:  "${targetUniverseId}"`)
    console.log(`[EntityLedger:Rebuild] Resolved User ID:    "${userId}"`)

    try {
      const ledger = new EntityLedger()

      // -------------------------------------------------------------
      // STEP 1: Ingest Sacred Journal Records
      // -------------------------------------------------------------
      primingStatusText.value = `Collecting Sacred Journal records in universe "${targetUniverseId}"...`

      // Try user repository, fallback to 'local' if needed
      let rawJournals = await textJournalRepo.getAll(userId) || []
      if (rawJournals.length === 0 && userId !== 'local') {
        const localJournals = await textJournalRepo.getAll('local') || []
        if (localJournals.length > 0)
          rawJournals = localJournals
      }

      console.log(`[EntityLedger:Rebuild] Discovered ${rawJournals.length} total journal entries in IndexedDB storage.`)

      const charJournalEntries = rawJournals.filter((entry) => {
        const matchesUniverse = (entry.universeId || 'global') === targetUniverseId
        if (!matchesUniverse)
          return false
        if (characterId === 'all')
          return true

        const cIdLower = characterId.toLowerCase()
        const entryCharIdLower = (entry.characterId || '').toLowerCase()
        const entryCharNameLower = (entry.characterName || '').toLowerCase()

        return entryCharIdLower === cIdLower
          || entryCharNameLower === cIdLower
          || entryCharIdLower.includes(cIdLower)
          || cIdLower.includes(entryCharIdLower)
      })

      console.log(`[EntityLedger:Rebuild] Found ${charJournalEntries.length} journal entries matching character "${characterId}" in universe "${targetUniverseId}".`)

      // -------------------------------------------------------------
      // STEP 2: Ingest Chat Sessions (Canonical + Branch Deduplication)
      // -------------------------------------------------------------
      primingStatusText.value = `Gathering dialogue sessions for universe "${targetUniverseId}"...`

      let sessionsIndex = await chatSessionsRepo.getIndex(userId)
      if (!sessionsIndex && userId !== 'local') {
        sessionsIndex = await chatSessionsRepo.getIndex('local')
      }
      if (!sessionsIndex && chatSessionStore.index) {
        sessionsIndex = chatSessionStore.index
      }

      const characters = sessionsIndex?.characters || {}
      const availableCharacterKeys = Object.keys(characters)
      console.log(`[EntityLedger:Rebuild] Chat sessions index found ${availableCharacterKeys.length} characters in storage:`, availableCharacterKeys)

      // Collect all sessions in the active universe matching characterId
      interface SessionTarget {
        sessionId: string
        characterId: string
        title: string
        messageCount: number
      }

      const matchingSessions: SessionTarget[] = []

      for (const [charKey, charIndex] of Object.entries(characters)) {
        const matchesChar = characterId === 'all'
          || charKey.toLowerCase() === characterId.toLowerCase()
          || charKey.toLowerCase().includes(characterId.toLowerCase())
          || characterId.toLowerCase().includes(charKey.toLowerCase())

        if (matchesChar && charIndex?.sessions) {
          for (const [sId, meta] of Object.entries(charIndex.sessions)) {
            if ((meta.universeId || 'global') === targetUniverseId) {
              matchingSessions.push({
                sessionId: sId,
                characterId: charKey,
                title: meta.title || 'Untitled Timeline',
                messageCount: meta.messageCount || 0,
              })
            }
          }
        }
      }

      console.log(`[EntityLedger:Rebuild] Discovered ${matchingSessions.length} session(s) in universe "${targetUniverseId}".`)

      // Sort by messageCount descending so the longest session is treated as Canonical Timeline
      matchingSessions.sort((a, b) => b.messageCount - a.messageCount)

      const canonicalSession = matchingSessions[0] || null
      const canonicalTitle = canonicalSession?.title || 'None'
      const canonicalTurns = canonicalSession?.messageCount || 0
      const branchCount = Math.max(0, matchingSessions.length - 1)

      let totalRawTurnsScanned = 0
      let duplicatedForkTurnsSkipped = 0

      // Deduplication set keyed by `${role}:${trimmedText}` (per memory-lifetime.ts)
      const uniqueContents = new Set<string>()
      const deduplicatedTurns: Array<{
        id: string
        speaker: string
        text: string
        timestamp: number
        sessionId: string
        sessionTitle: string
      }> = []

      for (let i = 0; i < matchingSessions.length; i++) {
        const sInfo = matchingSessions[i]
        const record = await chatSessionsRepo.getSession(sInfo.sessionId)
        if (!record?.messages?.length) {
          console.log(`[EntityLedger:Rebuild] Session "${sInfo.sessionId}" has no messages in storage.`)
          continue
        }

        totalRawTurnsScanned += record.messages.length

        record.messages.forEach((msg, idx) => {
          if (msg.role === 'system' || !msg.content)
            return

          let text = ''
          if (typeof msg.content === 'string') {
            text = msg.content
          }
          else if (Array.isArray(msg.content)) {
            text = msg.content
              .filter(part => part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part)
              .map((part: any) => String(part.text || ''))
              .join('\n')
          }

          const trimmed = text.trim()
          if (!trimmed)
            return

          const dedupKey = `${msg.role}:${trimmed}`

          // Deduplicate across parallel timeline branches
          if (uniqueContents.has(dedupKey)) {
            duplicatedForkTurnsSkipped++
            return
          }

          uniqueContents.add(dedupKey)

          deduplicatedTurns.push({
            id: (msg as any).id || `turn-${sInfo.sessionId}-${idx}`,
            speaker: msg.role === 'assistant' ? sInfo.characterId : 'User',
            text: trimmed,
            timestamp: (msg as any).createdAt || record.meta?.createdAt || Date.now(),
            sessionId: sInfo.sessionId,
            sessionTitle: sInfo.title,
          })
        })
      }

      console.log(`[EntityLedger:Rebuild] Raw turns scanned: ${totalRawTurnsScanned}. Deduplicated turns: ${deduplicatedTurns.length} (skipped ${duplicatedForkTurnsSkipped} duplicated fork turns).`)

      // Chronologically order deduplicated turns
      deduplicatedTurns.sort((a, b) => a.timestamp - b.timestamp)

      // -------------------------------------------------------------
      // STEP 2b: System 1 Entity Classification Pass
      // -------------------------------------------------------------
      const systemOneStore = useSystemOneStore()
      let classificationMap: Map<string, any> | undefined

      const candidateProposals = collectUniqueCandidateMentions(deduplicatedTurns, charJournalEntries)
      console.log(`[EntityLedger:Rebuild] Discovered ${candidateProposals.length} candidate entity spans across turns and journals.`)

      if (systemOneStore.configured && candidateProposals.length > 0) {
        primingProgress.value = 0.22
        primingStatusText.value = `Classifying ${candidateProposals.length} candidate entities via System 1 (${systemOneStore.activeModel})...`
        console.log(`[EntityLedger:Rebuild] Running System 1 (${systemOneStore.activeModel}) classification on ${candidateProposals.length} candidates...`)
        try {
          classificationMap = await systemOneStore.classifyEntities(candidateProposals)
          console.log(`[EntityLedger:Rebuild] System 1 classification completed for ${classificationMap.size} candidates.`)
        }
        catch (err) {
          console.warn(`[EntityLedger:Rebuild] System 1 classification failed:`, err)
        }
      }
      else {
        console.log(`[EntityLedger:Rebuild] System 1 not configured (${systemOneStore.activeProvider}); proceeding with neutral typing without greedy concept dump.`)
      }

      // -------------------------------------------------------------
      // STEP 2c: Ingest Sacred Journal Records
      // -------------------------------------------------------------
      for (const entry of charJournalEntries) {
        ledger.addSource({
          turnId: entry.id,
          text: entry.content,
          speaker: entry.characterName,
          timestamp: entry.createdAt,
        })

        const title = entry.title?.trim()
        if (title) {
          const classified = classificationMap?.get(title) || classificationMap?.get(title.toLowerCase())
          const resolvedType = (classified && classified !== 'conversational_artifact' && classified !== 'unknown')
            ? classified
            : 'concept'
          const entity = ledger.getOrCreateEntity(title, resolvedType)
          ledger.addMention({ span: title, turnId: entry.id, entityId: entity.entityId })
        }

        // Add journal content as a verified claim
        ledger.addClaim({
          subject: entry.characterName,
          predicate: 'journaled',
          object: entry.title || entry.content.slice(0, 40),
          qualifiers: { full_content: entry.content },
          evidence: [entry.id],
          dateInfo: { formatted_label: new Date(entry.createdAt).toLocaleDateString() },
        })
      }

      // -------------------------------------------------------------
      // STEP 2d: Ingest Dialogue Turns (3-Turn Sliding Window)
      // -------------------------------------------------------------
      for (let i = 0; i < deduplicatedTurns.length; i++) {
        const turn = deduplicatedTurns[i]
        const startIdx = Math.max(0, i - 2)
        const windowText = deduplicatedTurns.slice(startIdx, i + 1).map(t => `${t.speaker}: ${t.text}`).join('\n')

        extractTurnKnowledge(
          windowText,
          {
            id: turn.id,
            speaker: turn.speaker,
            text: turn.text,
            timestamp: turn.timestamp,
          },
          ledger,
          classificationMap,
        )

        if (deduplicatedTurns.length > 0) {
          primingProgress.value = 0.30 + (i / deduplicatedTurns.length) * 0.65
          primingStatusText.value = `Indexing dialogue turn ${i + 1}/${deduplicatedTurns.length}...`
        }
      }

      // -------------------------------------------------------------
      // STEP 3: Commit Knowledge Graph to Storage
      // -------------------------------------------------------------
      primingProgress.value = 0.95
      primingStatusText.value = 'Serializing Knowledge Graph to IndexedDB...'

      const serialized = ledger.toJSON()
      await entityLedgerRepo.saveLedger(characterId, serialized)

      activeLedger.value = ledger
      lastPrimedAt.value = Date.now()
      currentLoadedCharacterId.value = characterId

      // Record Telemetry
      telemetry.value = {
        universeId: targetUniverseId,
        sessionsDiscovered: matchingSessions.length,
        canonicalSessionTitle: canonicalTitle,
        canonicalSessionTurns: canonicalTurns,
        branchSessionsCount: branchCount,
        totalRawTurnsScanned,
        deduplicatedTurnsIngested: deduplicatedTurns.length,
        duplicatedForkTurnsSkipped,
        journalEntriesIngested: charJournalEntries.length,
        entitiesExtracted: ledger.entities.size,
        claimsExtracted: ledger.claims.size,
        availableCharacterKeys,
      }

      console.log(`[EntityLedger:Rebuild] ================= Rebuild Complete =================`)
      console.log(`[EntityLedger:Rebuild] Ingested Universe:     "${targetUniverseId}"`)
      console.log(`[EntityLedger:Rebuild] Sessions Discovered:   ${matchingSessions.length} (Canonical: "${canonicalTitle}")`)
      console.log(`[EntityLedger:Rebuild] Raw Dialogue Turns:    ${totalRawTurnsScanned} scanned, ${deduplicatedTurns.length} ingested, ${duplicatedForkTurnsSkipped} duplicated fork turns skipped.`)
      console.log(`[EntityLedger:Rebuild] Sacred Journals:       ${charJournalEntries.length} records.`)
      console.log(`[EntityLedger:Rebuild] Knowledge Graph Nodes: ${ledger.entities.size} Entities, ${ledger.claims.size} Claims, ${ledger.sources.size} Sources.`)
      console.log(`[EntityLedger:Rebuild] ========================================================`)

      primingProgress.value = 1.0
      primingStatusText.value = `Successfully indexed ${ledger.entities.size} entities & ${ledger.claims.size} claims across ${matchingSessions.length} session(s).`
    }
    catch (err: any) {
      console.error('[EntityLedgerStore] Rebuild failed with exception:', err)
      primingStatusText.value = `Rebuild error: ${err.message || String(err)}`
    }
    finally {
      setTimeout(() => {
        isPriming.value = false
      }, 1000)
    }
  }

  async function applyPCLClaims(characterId: string, claimsToApply: PCLClaim[], evidenceTurnId?: string) {
    if (!characterId || !claimsToApply || claimsToApply.length === 0)
      return []

    if (currentLoadedCharacterId.value !== characterId) {
      await loadLedger(characterId)
    }

    const results: Array<{ claimId: string, actionTaken: string }> = []
    for (const c of claimsToApply) {
      const res = activeLedger.value.applyPCLClaim({
        subject: c.subject,
        predicate: c.predicate,
        object: c.object,
        action: c.action,
        date: c.date,
        evidenceTurnId,
      })
      results.push(res)
    }

    // Persist updated ledger
    const serialized = activeLedger.value.toJSON()
    await entityLedgerRepo.saveLedger(characterId, serialized)

    return results
  }

  return {
    activeLedger,
    isPriming,
    primingProgress,
    primingStatusText,
    lastPrimedAt,
    currentLoadedCharacterId,
    telemetry,
    stats,
    entities,
    claims,
    sources,
    loadLedger,
    clearLedger,
    rebuildKnowledgeGraph,
    getEntitySources,
    getEntityClaims,
    updateEntityType,
    deleteEntity,
    reclassifyEntity,
    applyPCLClaims,
  }
})

import { debug, estimateTokens } from '@proj-airi/stage-shared'
import { defineStore, storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'

import { useShortTermMemoryStore } from '../memory-short-term'
import { useAiriCardStore } from '../modules/airi-card'
import { useConsciousnessStore } from '../modules/consciousness'
import { useProvidersStore } from '../providers'
import { useChatSessionStore } from './session-store'

export const useCompactionStore = defineStore('chat-compaction', () => {
  const chatSession = useChatSessionStore()
  const shortTermMemory = useShortTermMemoryStore()
  const airiCardStore = useAiriCardStore()
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()

  const { activeCard, activeCardId } = storeToRefs(airiCardStore)

  /**
   * Estimates total token count for a list of messages.
   */
  function estimateMessageListTokens(messages: any[]): number {
    return messages.reduce((sum, msg) => {
      let text = ''
      if (typeof msg.content === 'string') {
        text = msg.content
      }
      else if (Array.isArray(msg.content)) {
        text = msg.content
          .filter((part: any) => part && typeof part === 'object' && part.type === 'text')
          .map((part: any) => part.text)
          .join('\n')
      }
      return sum + estimateTokens(text || '')
    }, 0)
  }

  /**
   * Evaluates if compaction is needed based on active card settings.
   */
  function shouldCompact(sessionId: string): boolean {
    const card = activeCard.value
    if (!card)
      return false

    // If strategy is none/disabled, bypass compaction
    const strategy = card.extensions?.airi?.generation?.compaction?.strategy || 'none'
    const threshold = card.extensions?.airi?.generation?.known?.contextWidth

    debug('[Compaction] shouldCompact check:', {
      sessionId,
      strategy,
      threshold,
      hasCard: !!card,
    })

    if (strategy === 'none')
      return false

    // Context limit configured on the card (reused contextWidth)
    if (!threshold || threshold <= 0)
      return false

    const messages = chatSession.getSessionMessages(sessionId)
    const currentTokens = estimateMessageListTokens(messages)

    debug('[Compaction] comparing tokens:', {
      currentTokens,
      threshold,
      messageCount: messages.length,
      isTriggered: currentTokens >= threshold,
    })

    return currentTokens >= threshold
  }

  /**
   * Executes background forking and trims history, applying the chosen strategy.
   */
  async function executeCompaction(sessionId: string) {
    const card = activeCard.value
    if (!card)
      return

    const strategy = card.extensions?.airi?.generation?.compaction?.strategy || 'none'
    if (strategy === 'none')
      return

    const keepTurns = card.extensions?.airi?.generation?.compaction?.minKeepTurns ?? 15
    const originalMessages = chatSession.getSessionMessages(sessionId)

    // Ensure we don't compact if history is shorter than preserve size
    if (originalMessages.length <= keepTurns + 1) {
      return
    }

    const toastId = toast.loading('Compacting chat history to stay within context budget...')

    try {
      // 1. Create a background archive session containing all current messages
      const archiveTitle = `Archive: ${card.name} - ${new Date().toLocaleDateString()}`
      await chatSession.createSession(activeCardId.value || 'default', {
        setActive: false,
        messages: JSON.parse(JSON.stringify(originalMessages)),
        title: archiveTitle,
      })

      // 2. Split messages into to-preserve and to-compact
      // Keep system messages (role === 'system') plus the last N turns
      const systemMessages = originalMessages.filter(m => m.role === 'system')
      const chatMessagesOnly = originalMessages.filter(m => m.role !== 'system')

      const toPreserve = chatMessagesOnly.slice(-keepTurns)
      const toCompact = chatMessagesOnly.slice(0, chatMessagesOnly.length - keepTurns)

      const finalMessages = [...systemMessages, ...toPreserve]

      // 3. Apply distillation if requested
      if (strategy === 'distill') {
        const windowSize = card.extensions?.airi?.shortTermMemory?.windowSize ?? 3
        const tokenBudget = card.extensions?.airi?.shortTermMemory?.tokenBudgetPerDay ?? 1000

        const providerId = card.extensions?.airi?.modules?.consciousness?.provider || consciousnessStore.activeProvider
        const modelId = card.extensions?.airi?.modules?.consciousness?.model || consciousnessStore.activeModel
        const provider = await providersStore.getProviderInstance<any>(providerId!)

        if (provider && modelId) {
          // Window-bounded gap filling:
          // Generate day buckets only for completed days present in toCompact
          const buckets = new Map<string, { date: string, lines: string[], messageCount: number, sessionIds: Set<string> }>()
          const todayDateStr = new Date().toISOString().split('T')[0]

          for (const msg of toCompact) {
            if (!msg.createdAt || (msg.role !== 'user' && msg.role !== 'assistant'))
              continue

            const text = typeof msg.content === 'string' ? msg.content : ''
            if (!text.trim())
              continue

            const roleLabel = msg.role === 'user' ? 'User' : card.name
            const dateKey = new Date(msg.createdAt).toISOString().split('T')[0]

            const bucket = buckets.get(dateKey) ?? {
              date: dateKey,
              lines: [],
              messageCount: 0,
              sessionIds: new Set<string>([sessionId]),
            }

            bucket.lines.push(`${roleLabel}: ${text}`)
            bucket.messageCount += 1
            buckets.set(dateKey, bucket)
          }

          // Distill each bucket as an STMM block inside our configured windowSize
          const sortedDates = [...buckets.keys()].sort().slice(-windowSize)
          const newBlocks = []

          for (const dateKey of sortedDates) {
            const bucket = buckets.get(dateKey)!
            const isToday = dateKey === todayDateStr

            // Use memory store method to synthesize
            const block = await shortTermMemory.summarizeBucket(
              activeCardId.value || 'default',
              card,
              provider,
              modelId,
              bucket,
              isToday ? 'automatic' : 'rebuilt',
              { tokenBudgetPerDay: tokenBudget },
            )

            if (block) {
              newBlocks.push(block)
            }
          }

          if (newBlocks.length > 0) {
            const existingBlocks = [...shortTermMemory.blocks]
            for (const nextBlock of newBlocks) {
              const idx = existingBlocks.findIndex(b => b.characterId === nextBlock.characterId && b.date === nextBlock.date)
              if (idx >= 0) {
                existingBlocks.splice(idx, 1, nextBlock)
              }
              else {
                existingBlocks.push(nextBlock)
              }
            }
            await shortTermMemory.persist(existingBlocks)
          }
        }
      }

      // 4. Update the active session with the compacted timeline
      await chatSession.setSessionMessages(sessionId, finalMessages)

      toast.success('Compaction successful. Stale chat history archived.', { id: toastId })
    }
    catch (err) {
      console.error('[Compaction] Compaction failed:', err)
      toast.error('Compaction failed. Continuing session normally.', { id: toastId })
    }
  }

  return {
    shouldCompact,
    executeCompaction,
  }
})

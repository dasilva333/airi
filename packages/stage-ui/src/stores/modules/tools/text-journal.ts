import type { Tool } from '@xsai/shared-chat'

import { tool } from '@xsai/tool'
import { z } from 'zod'

import { useShortTermMemoryStore } from '../../memory-short-term'
import { useTextJournalStore } from '../../memory-text-journal'

export interface TextJournalEvidenceItem {
  id: string
  layer: 'long-term' | 'short-term' | 'dialogue' | 'knowledge-graph'
  date: string
  subject?: string
  fact: string
  observed_text: string
  relevanceScore?: number
}

export const textJournalParams = z.object({
  action: z.enum(['create', 'search']).describe('Choose one: "create" to log a new memory entry, or "search" to query memories.'),
  title: z.string().nullish().describe('Short human-readable label for the journal entry when creating.'),
  content: z.string().nullish().describe('The journal entry text to append for the active character when creating. Required when action is "create".'),
  entry: z.string().nullish().describe('Alias for content when action is "create".'),
  text: z.string().nullish().describe('Alias for content when action is "create".'),
  query: z.string().nullish().describe('Keyword or concept query to search within memories (dialogue history, recaps, knowledge graph, journal). Required when action is "search".'),
  limit: z.number().int().min(1).max(10).nullish().describe('Maximum number of search results to return (1-10, default 5).'),
})

export async function executeCreateTextJournalEntry(params: {
  title?: string
  content?: string
  entry?: string
  text?: string
}) {
  const contentCandidate = params.content?.trim() || params.entry?.trim() || params.text?.trim()
  const titleCandidate = params.title?.trim()
  const resolvedContent = contentCandidate || titleCandidate || ''

  if (!resolvedContent)
    return 'Error: content is required for text_journal.create. Please provide the content you wish to save.'

  const resolvedTitle = titleCandidate || resolvedContent.slice(0, 40)
  const store = useTextJournalStore()
  const entry = await store.createEntry({
    title: resolvedTitle,
    content: resolvedContent,
    source: 'tool',
  })

  return `Saved text journal entry "${entry.title}" for ${entry.characterName}.`
}

export async function executeSearchTextJournalEntries(params: { query?: string, limit?: number }) {
  if (!params.query?.trim())
    return 'Error: query is required for text_journal.search. Please provide a keyword query to search.'

  const longTermStore = useTextJournalStore()
  await longTermStore.load()

  const limit = Math.max(1, Math.min(params.limit ?? 5, 10))

  const entries = await longTermStore.searchEntries({
    query: params.query,
    limit,
  })

  if (entries.length > 0) {
    const evidenceList: TextJournalEvidenceItem[] = entries.map((entry) => {
      const isKg = (entry as any).isKgClaim || entry.kind === 'kg_claim'
      const layer: TextJournalEvidenceItem['layer'] = isKg
        ? 'knowledge-graph'
        : entry.kind === 'stmm'
          ? 'short-term'
          : entry.kind === 'raw'
            ? 'dialogue'
            : 'long-term'

      let date = ''
      const entryAny = entry as any
      if (entryAny.dateInfo?.timestamp)
        date = new Date(entryAny.dateInfo.timestamp).toISOString().split('T')[0]
      else if (entryAny.timestamp)
        date = entryAny.timestamp.includes('T') ? entryAny.timestamp.split('T')[0] : entryAny.timestamp
      else if (entry.createdAt)
        date = new Date(entry.createdAt).toISOString().split('T')[0]

      const rawSubject = (entry as any).subject || entry.title?.replace(/^\[.*?\]\s*/, '') || ''
      const fact = isKg
        ? `${(entry as any).subject || ''} ${(entry as any).predicate || ''} ${(entry as any).object || ''}`.trim()
        : (entry.title?.replace(/^\[.*?\]\s*/, '') || entry.content)

      return {
        id: entry.id,
        layer,
        date,
        subject: rawSubject || undefined,
        fact: fact || entry.content,
        observed_text: entry.content,
        relevanceScore: typeof entry.score === 'number' ? Number(entry.score.toFixed(3)) : undefined,
      }
    })

    return JSON.stringify(evidenceList, null, 2)
  }

  const shortTermStore = useShortTermMemoryStore()
  await shortTermStore.load()
  const shortTermBlocks = shortTermStore.searchBlocks({
    query: params.query,
    limit,
  })

  if (shortTermBlocks.length === 0)
    return JSON.stringify([])

  const fallbackList: TextJournalEvidenceItem[] = shortTermBlocks.map(block => ({
    id: block.id,
    layer: 'short-term',
    date: block.date || (block.createdAt ? new Date(block.createdAt).toISOString().split('T')[0] : ''),
    subject: `Recap: ${block.date}`,
    fact: block.summary,
    observed_text: block.summary,
  }))

  return JSON.stringify(fallbackList, null, 2)
}

export async function executeTextJournalAction(params: {
  action: 'create' | 'search'
  title?: string | null
  content?: string | null
  entry?: string | null
  text?: string | null
  query?: string | null
  limit?: number | null
}) {
  const normalizedParams = {
    action: params.action,
    title: params.title ?? undefined,
    content: params.content ?? undefined,
    entry: params.entry ?? undefined,
    text: params.text ?? undefined,
    query: params.query ?? undefined,
    limit: params.limit ?? undefined,
  }

  if (normalizedParams.action === 'create')
    return await executeCreateTextJournalEntry(normalizedParams)

  if (normalizedParams.action === 'search')
    return await executeSearchTextJournalEntries(normalizedParams)

  return 'No text journal action performed.'
}

export function createTextJournalTool(): Promise<Tool> {
  return tool({
    name: 'text_journal',
    description: 'Create or search memories for the currently active character across dialogue history, daily recaps, knowledge graph facts, and long-term journal entries.',
    execute: params => executeTextJournalAction(params as {
      action: 'create' | 'search'
      title?: string
      content?: string
      entry?: string
      text?: string
      query?: string
      limit?: number
    }),
    parameters: textJournalParams,
  })
}

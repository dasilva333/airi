import { useShortTermMemoryStore, useTextJournalStore } from '@proj-airi/stage-ui/stores'
import type { Tool } from '@xsai/shared-chat'
import { tool } from '@xsai/tool'
import { z } from 'zod'

const textJournalParams = z
  .object({
    action: z.enum(['create', 'search']).describe('Choose one: create or search.'),
    content: z.string().nullable().describe('The journal entry text to append for the active character when creating.'),
    limit: z.number().int().min(1).max(10).nullable().describe('Maximum number of search results to return.'),
    query: z.string().nullable().describe('Keyword query to search within the active character journal entries.'),
    title: z.string().nullable().describe('Short human-readable label for the journal entry when creating.'),
  })
  .strict()

async function executeCreateTextJournalEntry(params: { title?: string; content?: string }) {
  if (!params.content?.trim())
    return 'Error: content is required for text_journal.create. Please provide the content you wish to save.'

  const store = useTextJournalStore()
  const entry = await store.createEntry({
    content: params.content,
    source: 'tool',
    title: params.title,
  })

  return `Saved text journal entry "${entry.title}" for ${entry.characterName}.`
}

async function executeSearchTextJournalEntries(params: { query?: string; limit?: number }) {
  if (!params.query?.trim())
    return 'Error: query is required for text_journal.search. Please provide a keyword query to search.'

  const longTermStore = useTextJournalStore()
  await longTermStore.load()

  const entries = await longTermStore.searchEntries({
    limit: params.limit,
    query: params.query,
  })

  if (entries.length > 0) {
    return entries
      .map((entry, index) =>
        [
          `Result ${index + 1}:`,
          'Layer: long-term',
          `Title: ${entry.title}`,
          `Character: ${entry.characterName}`,
          `Created At: ${new Date(entry.createdAt).toISOString()}`,
          `Content: ${entry.content}`,
        ].join('\n'),
      )
      .join('\n\n')
  }

  const shortTermStore = useShortTermMemoryStore()
  await shortTermStore.load()
  const shortTermBlocks = shortTermStore.searchBlocks({
    limit: params.limit,
    query: params.query,
  })

  if (shortTermBlocks.length === 0)
    return `No memory entries found for query "${params.query}" in long-term or short-term memory.`

  return shortTermBlocks
    .map((block, index) =>
      [
        `Result ${index + 1}:`,
        'Layer: short-term',
        `Date: ${block.date}`,
        `Character: ${block.characterName}`,
        `Created At: ${new Date(block.createdAt).toISOString()}`,
        `Content: ${block.summary}`,
      ].join('\n'),
    )
    .join('\n\n')
}

async function executeTextJournalAction(params: {
  action: 'create' | 'search'
  title?: string | null
  content?: string | null
  query?: string | null
  limit?: number | null
}) {
  const normalizedParams = {
    action: params.action,
    content: params.content ?? undefined,
    limit: params.limit ?? undefined,
    query: params.query ?? undefined,
    title: params.title ?? undefined,
  }

  if (normalizedParams.action === 'create') return await executeCreateTextJournalEntry(normalizedParams)

  if (normalizedParams.action === 'search') return await executeSearchTextJournalEntries(normalizedParams)

  return 'No text journal action performed.'
}

const tools: Promise<Tool>[] = [
  tool({
    description: 'Create or search long-term text journal entries for the currently active character.',
    execute: (params) =>
      executeTextJournalAction(
        params as {
          action: 'create' | 'search'
          title?: string
          content?: string
          query?: string
          limit?: number
        },
      ),
    name: 'text_journal',
    parameters: textJournalParams,
  }),
]

export const textJournalTools = async () => Promise.all(tools)

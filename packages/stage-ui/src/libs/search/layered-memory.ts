import { createStorage } from 'unstorage'

import indexedDbDriver from 'unstorage/drivers/indexedb'
import { searchWorker } from '../workers/search'
import type { HybridSearchResult, MemoryLayer, SearchDocumentMeta } from './hybrid-scorer'
import { defaultScorerConfig, scoreHybridResults } from './hybrid-scorer'

const indexStorage = createStorage({
  driver: indexedDbDriver({ base: 'airi-search-index' }),
})

export interface LayeredSearchResult extends HybridSearchResult {}

let isPersisting = false
let isIndexing = false

const KIND_MAP: Record<string, MemoryLayer> = {
  assistant_turn: 'raw',
  journal_entry: 'ltmm',
  memory_block: 'stmm',
  user_turn: 'raw',
}

function resolveMemoryLayer(kind: string): MemoryLayer {
  if (kind in KIND_MAP) return KIND_MAP[kind]

  if (kind.endsWith('_turn')) return 'raw'
  if (kind.endsWith('_block')) return 'stmm'
  if (kind.endsWith('_entry')) return 'ltmm'

  return 'raw'
}

export const layeredMemory = {
  async indexDocuments(documents: any[]) {
    if (isIndexing) return
    isIndexing = true
    try {
      await searchWorker.index(documents)
      await this.persist()
    } finally {
      isIndexing = false
    }
  },
  async init() {
    const snapshot = await indexStorage.getItem('snapshot')
    await searchWorker.init(snapshot)
  },

  async persist() {
    if (isPersisting) return
    isPersisting = true
    try {
      const snapshot = await searchWorker.persist()
      await indexStorage.setItem('snapshot', snapshot)
    } finally {
      isPersisting = false
    }
  },

  async search(query: string, limit = 10): Promise<LayeredSearchResult[]> {
    const rawResults = await searchWorker.search(query, limit)
    const documents = rawResults.documents.map((document: SearchDocumentMeta & { kind: string }) => ({
      ...document,
      kind: resolveMemoryLayer(document.kind),
    }))

    return scoreHybridResults(
      query,
      documents,
      rawResults.vectorHits,
      rawResults.keywordHits,
      defaultScorerConfig,
    ).slice(0, limit)
  },
}

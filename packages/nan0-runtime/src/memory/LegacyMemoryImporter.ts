import type { LegacyNan0Export, Nan0MemoryRecord } from '../types'

function isMemoryRecord(value: unknown): value is Nan0MemoryRecord {
  if (!value || typeof value !== 'object')
    return false

  const record = value as Partial<Nan0MemoryRecord>
  return typeof record.id === 'string'
    && typeof record.kind === 'string'
    && typeof record.content === 'string'
    && Array.isArray(record.tags)
    && typeof record.createdAt === 'number'
    && !!record.metadata
    && typeof record.metadata === 'object'
}

export function parseLegacyNan0Export(input: string): LegacyNan0Export {
  const parsed = JSON.parse(input) as Partial<LegacyNan0Export>

  if (parsed.schemaVersion !== 1)
    throw new Error('Legacy Nan0 export must use schemaVersion 1.')

  if (!Array.isArray(parsed.records) || !parsed.records.every(isMemoryRecord))
    throw new Error('Legacy Nan0 export contains invalid memory records.')

  return {
    schemaVersion: 1,
    exportedAt: typeof parsed.exportedAt === 'number'
      ? parsed.exportedAt
      : Date.now(),
    records: parsed.records,
  }
}

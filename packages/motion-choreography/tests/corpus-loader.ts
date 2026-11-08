import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '../.cache')
const MANIFEST_PATH = join(__dirname, 'fixtures/corpus-manifest.json')

export interface CorpusItem {
  id: string
  title: string
  artist: string
  license: string
  url: string
  sha1: string
  expectedBpm: number
  expectedRhythm: string
  genreHint?: string
}

export function getCorpusManifest(): CorpusItem[] {
  const content = readFileSync(MANIFEST_PATH, 'utf-8')
  return JSON.parse(content) as CorpusItem[]
}

/**
 * Loads an audio track from the local cache. If missing and downloadIfMissing is true,
 * fetches from the remote URL and validates the SHA-1 checksum.
 */
export async function loadCorpusAudio(
  item: CorpusItem,
  downloadIfMissing = false,
): Promise<Buffer | null> {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
  }

  const ext = item.url.split('.').pop() ?? 'ogg'
  const filePath = join(CACHE_DIR, `${item.id}.${ext}`)

  if (existsSync(filePath)) {
    const buffer = readFileSync(filePath)
    const hash = createHash('sha1').update(buffer).digest('hex')
    if (hash === item.sha1) {
      return buffer
    }
  }

  if (!downloadIfMissing) {
    return null
  }

  const response = await fetch(item.url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${item.url}: HTTP ${response.status}`)
  }

  const arrayBuf = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const hash = createHash('sha1').update(buffer).digest('hex')

  if (hash !== item.sha1) {
    throw new Error(
      `Checksum mismatch for ${item.id}: expected sha1 ${item.sha1}, computed ${hash}`,
    )
  }

  writeFileSync(filePath, buffer)
  return buffer
}

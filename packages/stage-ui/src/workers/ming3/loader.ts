/**
 * fusor-ai runtime loader for Ming 3.0 TTS (adapted from the upstream demo's
 * `engine/dist/host/loader.js`).
 *
 * `startRuntime` picks the best runtime build this browser runs (threaded
 * builds need a cross-origin-isolated page; relaxed SIMD is probed), and
 * `loadParts` streams every bundle part into it — from OPFS when cached there,
 * else from the network while caching it — through the runtime's part
 * protocol: `write_part(index, bytes)` in order, `end_part(index)` (which
 * checks size and BLAKE3 and throws `{"kind","message"}` JSON), and
 * `restart_part(index)`. Only an `integrity` failure evicts a cached part.
 *
 * NOTICE (single-threaded-first): AIRI ships no COOP/COEP isolation headers
 * today, so `crossOriginIsolated` is false and `chooseBuild` always lands on a
 * `web-single*` build. Threaded builds additionally need the compute-pool
 * spawn protocol (`fusor-ai-spawn-compute`), which is not wired — the loader
 * falls back to single-threaded with a warning if threads are ever requested.
 */

export interface Ming3RuntimeBuild {
  name: string
  threads: boolean
  relaxed: boolean
}

export interface Ming3ManifestPart {
  file: string
  bytes: number
  blake3: string
}

export interface Ming3Manifest {
  parts: Ming3ManifestPart[]
  [key: string]: unknown
}

export interface Ming3Runtime {
  write_part: (index: number, bytes: Uint8Array) => void
  end_part: (index: number) => void
  restart_part: (index: number) => void
  start: (requestJson: string) => string
  step: () => string
  take_audio: () => Float32Array
  cancel: () => void
  threads: () => number
}

export interface Ming3Glue {
  default: (opts: { module_or_path: unknown }) => Promise<void>
  initThreadPool?: (threads: number) => Promise<void>
  Runtime: new (manifestText: string) => Ming3Runtime
  voices: () => string
  last_panic?: () => string | undefined
  [key: string]: unknown
}

const PARALLEL_PARTS = 4
const PUSH_BYTES = 4 << 20 // coalesce network chunks into writes of this size

// Relaxed SIMD: a function using `i32x4.relaxed_dot_i8x16_i7x16_add_s`
// (0xfd 0x93 0x02), the instruction the relaxed kernels are built on.
const RELAXED_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 19, 1, 17, 0, 65, 1, 253, 15, 65, 2, 253, 15, 65, 3, 253, 15, 253, 147, 2, 11])

// Runtime builds, best first.
export const BUILDS: Ming3RuntimeBuild[] = [
  { name: 'web-threaded-relaxed', threads: true, relaxed: true },
  { name: 'web-threaded', threads: true, relaxed: false },
  { name: 'web-single-relaxed', threads: false, relaxed: true },
  { name: 'web-single', threads: false, relaxed: false },
]

/** The `kind` of a runtime error (`format`, `integrity`, …), or null for other errors. */
export function errorKind(error: unknown): string | null {
  try {
    return JSON.parse(String((error as Error)?.message ?? error)).kind
  }
  catch {
    return null
  }
}

/** A runtime error's message, or the runtime's last Rust panic behind a wasm trap. */
export function describe(error: unknown, glue?: Ming3Glue): string {
  const text = String((error as Error)?.message ?? error)
  try {
    return JSON.parse(text).message
  }
  catch {}
  const panic = glue?.last_panic?.()
  return panic ? `${text} (panic: ${panic})` : text
}

/** Whether this browser validates the relaxed-SIMD probe the relaxed builds need. */
export function isRelaxedSimdSupported(): boolean {
  try {
    return typeof WebAssembly !== 'undefined' && WebAssembly.validate(RELAXED_PROBE)
  }
  catch {
    return false
  }
}

/** Whether this page can spawn threaded WASM workers (cross-origin isolation). */
export function isThreadingAvailable(): boolean {
  try {
    return (globalThis as { crossOriginIsolated?: unknown }).crossOriginIsolated === true
  }
  catch {
    return false
  }
}

/** The best build this browser runs, or `requested` (a `BUILDS` name) when it can run that. */
export function chooseBuild(threads: number, requested?: string): Ming3RuntimeBuild {
  const threaded = (globalThis as { crossOriginIsolated?: unknown }).crossOriginIsolated === true && threads > 1
  const relaxed = typeof WebAssembly !== 'undefined' && WebAssembly.validate(RELAXED_PROBE)
  const usable = BUILDS.filter(b => (!b.threads || threaded) && (!b.relaxed || relaxed))
  return usable.find(b => b.name === requested) ?? usable[0]
}

/**
 * Imports and instantiates `<distUrl>/<build>/<glueName>.js`.
 * `onWarning(message)` hears about a fallback to one thread.
 */
export async function startRuntime({ distUrl, glueName, threads, requested, onWarning }: {
  distUrl: string
  glueName: string
  threads: number
  requested?: string
  onWarning?: (message: string) => void
}): Promise<{ glue: Ming3Glue, build: Ming3RuntimeBuild, threads: number }> {
  const build = chooseBuild(threads, requested)
  try {
    return { glue: await instantiate(distUrl, glueName, build, threads), build, threads: build.threads ? threads : 1 }
  }
  catch (error) {
    // The shared memory or the compute workers could not be set up: one thread still works.
    if (!build.threads)
      throw error
    onWarning?.(`threads unavailable (${describe(error)}); running on one thread`)
    const single = chooseBuild(1)
    return { glue: await instantiate(distUrl, glueName, single, 1), build: single, threads: 1 }
  }
}

async function instantiate(distUrl: string, glueName: string, build: Ming3RuntimeBuild, threads: number): Promise<Ming3Glue> {
  const base = new URL(`${build.name}/`, distUrl).href
  const glue = (await import(/* @vite-ignore */ `${base}${glueName}.js`)) as Ming3Glue
  const moduleOrPath = new URL(`${glueName}_bg.wasm`, base).href
  await glue.default({ module_or_path: moduleOrPath })
  if (build.threads)
    await glue.initThreadPool?.(threads)
  return glue
}

/**
 * Streams every part of `manifest` (relative to `baseUrl`) into `runtime`.
 * `onProgress` gets `{ done, total, network, cache }` byte counts. Parts are
 * cached in the OPFS directory `cacheName`, one file per BLAKE3 hash.
 */
export async function loadParts({ runtime, manifest, baseUrl, cacheName, onProgress }: {
  runtime: Ming3Runtime
  manifest: Ming3Manifest
  baseUrl: string
  cacheName: string
  onProgress?: (p: { done: number, total: number, network: number, cache: number }) => void
}): Promise<{ done: number, total: number, network: number, cache: number }> {
  const store = await openStore(cacheName)
  const total = manifest.parts.reduce((n, part) => n + part.bytes, 0)
  const progress = { done: 0, total, network: 0, cache: 0 }
  const report = (bytes: number, source: 'network' | 'cache') => {
    progress.done += bytes
    progress[source] += bytes
    onProgress?.({ ...progress })
  }
  const queue = manifest.parts.map((part, index) => ({ part, index }))
  const lane = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      await loadPart({ runtime, store, item, baseUrl, report })
    }
  }
  await Promise.all(Array.from({ length: PARALLEL_PARTS }, lane))
  return progress
}

/**
 * Minimal structural typing for the OPFS sync access handle. The DOM lib in
 * this workspace does not include `FileSystemSyncAccessHandle` (same reason
 * `workers/web-rwkv/cache.ts` declares its own), so this is declared locally
 * rather than referenced from lib.dom.
 */
interface SyncAccessWriter {
  write: (data: Uint8Array, options?: { at?: number }) => number
  close: () => void
  flush: () => void
  truncate: (size: number) => void
}

type FileHandleWithSync = FileSystemFileHandle & {
  createSyncAccessHandle: () => Promise<SyncAccessWriter>
}

interface PartStore {
  has: (part: Ming3ManifestPart) => Promise<boolean>
  read: (part: Ming3ManifestPart) => Promise<ReadableStream<Uint8Array>>
  remove: (part: Ming3ManifestPart) => Promise<void>
  writer: (part: Ming3ManifestPart) => Promise<{ write: (bytes: Uint8Array) => void, close: () => void } | null>
}

async function loadPart({ runtime, store, item: { part, index }, baseUrl, report }: {
  runtime: Ming3Runtime
  store: PartStore | null
  item: { part: Ming3ManifestPart, index: number }
  baseUrl: string
  report: (bytes: number, source: 'network' | 'cache') => void
}): Promise<void> {
  if (store && await store.has(part)) {
    const pushed = await pushStream(runtime, index, await store.read(part), n => report(n, 'cache'))
    try {
      runtime.end_part(index)
      return
    }
    catch (error) {
      // Only a hash mismatch means the cached copy is bad; anything else (the runtime failing
      // to build from a complete bundle) is reported as is.
      if (errorKind(error) !== 'integrity')
        throw error
      await store.remove(part)
      runtime.restart_part(index)
      report(-pushed, 'cache')
    }
  }
  const response = await fetchOk(new URL(part.file, baseUrl).href)
  const sink = await store?.writer(part)
  try {
    await pushStream(runtime, index, response.body!, n => report(n, 'network'), sink)
    runtime.end_part(index)
  }
  catch (error) {
    sink?.close()
    if (errorKind(error) !== 'format')
      await store?.remove(part) // bad bytes, or a cut-off download
    throw error
  }
  sink?.close()
}

/** Pushes a byte stream into part `index` in writes of about PUSH_BYTES; returns the bytes. */
async function pushStream(
  runtime: Ming3Runtime,
  index: number,
  stream: ReadableStream<Uint8Array>,
  onBytes: (bytes: number) => void,
  sink?: { write: (bytes: Uint8Array) => void, close: () => void } | null,
): Promise<number> {
  const reader = stream.getReader()
  let pending: Uint8Array[] = []
  let pendingBytes = 0
  let total = 0
  const flush = () => {
    if (!pendingBytes)
      return
    const bytes = pending.length === 1 ? pending[0] : concat(pending, pendingBytes)
    runtime.write_part(index, bytes)
    sink?.write(bytes)
    onBytes(bytes.length)
    total += bytes.length
    pending = []
    pendingBytes = 0
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done)
      break
    pending.push(value)
    pendingBytes += value.length
    if (pendingBytes >= PUSH_BYTES)
      flush()
  }
  flush()
  return total
}

function concat(chunks: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`${url}: HTTP ${response.status}`)
  return response
}

/**
 * Parts cached in the origin-private file system. A file whose part fails verification is
 * deleted; a cached file is verified again on every load (an interrupted write leaves a short
 * file, which `has` rejects). Without OPFS everything is fetched.
 */
async function openStore(cacheName: string): Promise<PartStore | null> {
  let dir: FileSystemDirectoryHandle
  try {
    dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(cacheName, { create: true })
  }
  catch {
    return null
  }
  return {
    async has(part) {
      try {
        return (await (await dir.getFileHandle(part.blake3)).getFile()).size === part.bytes
      }
      catch {
        return false
      }
    },
    async read(part) {
      return (await (await dir.getFileHandle(part.blake3)).getFile()).stream() as ReadableStream<Uint8Array>
    },
    async remove(part) {
      await dir.removeEntry(part.blake3).catch(() => {})
    },
    async writer(part) {
      let access: SyncAccessWriter
      try {
        const handle = await dir.getFileHandle(part.blake3, { create: true }) as FileHandleWithSync
        if (typeof handle.createSyncAccessHandle !== 'function')
          return null // no sync access handles (or another tab holds the file): don't cache
        access = await handle.createSyncAccessHandle()
      }
      catch {
        return null
      }
      access.truncate(0)
      let offset = 0
      let failed = false // e.g. quota exceeded: keep loading, just stop caching this part
      return {
        write(bytes: Uint8Array) {
          if (failed)
            return
          try {
            offset += access.write(bytes, { at: offset })
          }
          catch {
            failed = true
          }
        },
        close() {
          try {
            access.flush()
          }
          finally {
            access.close()
          }
        },
      }
    },
  }
}

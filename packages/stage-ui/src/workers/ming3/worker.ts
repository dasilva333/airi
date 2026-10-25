/**
 * Ming 3.0 TTS Web Worker entry point.
 *
 * Owns the fusor runtime lifecycle: picks the best runtime build, streams the
 * 850MB bundle into it (OPFS-cached, BLAKE3-verified), then synthesizes one
 * 80ms frame per macrotask so a stop request is seen between frames. Every
 * frame's new PCM goes back to the adapter as a transferable Float32Array.
 *
 * After the model is loaded nothing else is fetched: synthesis is entirely local.
 */

import type { Ming3Glue, Ming3Manifest, Ming3Runtime } from './loader'

import { MING3_BUNDLE_BASE, MING3_ENGINE_DIST_BASE, MING3_ENGINE_LOCAL_BASE } from '../../stores/providers/ming3-catalog'
import { describe, fetchOk, loadParts, startRuntime } from './loader'

const CACHE_DIR = 'ming-tts-parts'
const DIST_URL = `${MING3_ENGINE_DIST_BASE}/`
// Same-origin mirror of the runtime tree for threaded builds (which cannot
// load from Blob URLs due to relative sub-imports). Absolutized against the
// worker's own origin so dynamic import() and nested fetches stay same-origin.
const LOCAL_DIST_URL = new URL(MING3_ENGINE_LOCAL_BASE, globalThis.location.origin).href

function post(message: unknown, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0)
    globalThis.postMessage(message, { transfer })
  else
    globalThis.postMessage(message)
}
const yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0))

let runtime: { rt: Ming3Runtime, glue: Ming3Glue } | null = null
let stopRequested = false
// Resource-timing entries of this worker when the model was ready: every later one is a request
// made during synthesis (the page shows the count; it should stay 0).
let entriesAtReady = 0
const requestsSinceReady = () => performance.getEntriesByType('resource').length - entriesAtReady

globalThis.onmessage = async ({ data }: MessageEvent) => {
  try {
    if (data.type === 'load')
      await load(data)
    else if (data.type === 'generate')
      await generate(data.request)
    else if (data.type === 'stop')
      stopRequested = true
  }
  catch (error) {
    post({ type: 'error', message: describe(error, runtime?.glue) })
  }
}

async function load({ modelUrl, threads, build: requested }: {
  modelUrl?: string
  threads?: number
  build?: string
}): Promise<void> {
  const t0 = performance.now()
  const baseUrl = modelUrl || MING3_BUNDLE_BASE
  const manifestText = await (await fetchOk(new URL('manifest.json', baseUrl).href)).text()
  const started = await startRuntime({
    distUrl: DIST_URL,
    localDistUrl: LOCAL_DIST_URL,
    glueName: 'ming_runtime',
    threads: threads ?? 1,
    requested,
    onWarning: message => post({ type: 'warning', message }),
  })
  const rt = new started.glue.Runtime(manifestText)
  runtime = { rt, glue: started.glue }
  post({ type: 'build', build: started.build.name, threads: started.threads })
  const manifest = JSON.parse(manifestText) as Ming3Manifest
  const progress = await loadParts({
    runtime: rt,
    manifest,
    baseUrl,
    cacheName: CACHE_DIR,
    onProgress: p => post({ type: 'progress', ...p }),
  })
  entriesAtReady = performance.getEntriesByType('resource').length
  post({
    type: 'ready',
    ms: Math.round(performance.now() - t0),
    voices: JSON.parse(started.glue.voices()),
    threads: rt.threads(),
    partHashes: manifest.parts.map(p => p.blake3),
    ...progress,
  })
}

async function generate(request: { text: string, voice: { builtin: string } | { design: string }, preset: string }): Promise<void> {
  if (!runtime)
    throw new Error('Ming worker: no model loaded.')
  const { rt } = runtime
  stopRequested = false
  const plan = JSON.parse(rt.start(JSON.stringify(request)))
  post({ type: 'plan', fragments: plan.fragments.length })
  const t0 = performance.now()
  for (;;) {
    if (stopRequested) {
      rt.cancel()
      post({ type: 'done', stopped: true, ms: performance.now() - t0, networkRequests: requestsSinceReady() })
      return
    }
    const progress = JSON.parse(rt.step())
    const samples = rt.take_audio()
    if (samples.length)
      post({ type: 'audio', samples }, [samples.buffer])
    post({ type: 'frame', ...progress, ms: performance.now() - t0 })
    if (progress.done)
      break
    await yieldTask()
  }
  post({ type: 'done', stopped: false, ms: performance.now() - t0, networkRequests: requestsSinceReady() })
}

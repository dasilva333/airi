import type { InferenceDevice, LayaDecideRequest, LoadModelRequest, LoadStreamItem } from '../../libs/inference/contract'

import { AutoTokenizer } from '@huggingface/transformers'
import { defineInvokeHandler, defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import * as ort from 'onnxruntime-web'

import { LAYA_CACHE_NAME } from '../../libs/inference/cache-utils'
import { layaDecideEvent, layaLoadEvent, layaUnloadEvent } from '../../libs/inference/contract'
import {
  evictStaleLayaEntries,
  LAYA_MODEL_SPECS,
  LAYA_TOKENIZER_REPO,
  LAYA_TOKENIZER_REVISION,
  layaFileUrl,
  layaModelFiles,
  layaWeightsFile,
} from '../../libs/inference/laya-models'
import { decodeAnswers, QTYPES, renderOptions, serializeState, toInternal } from './prep'

const { context } = createContext()

let activeSession: ort.InferenceSession | null = null
let activePrecision: 'int8' | 'fp16' | null = null
let activeEp: 'wasm' | 'webgpu' | null = null
let activeTokenizer: any = null
let runLock: Promise<unknown> = Promise.resolve()

function ensureOrtConfigured(): void {
  if (!ort.env?.wasm)
    return
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/'
  const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4
  // NOTICE: threaded jsep build requires SharedArrayBuffer + COOP/COEP.
  // Windows file:// renderers report crossOriginIsolated=false and hide SAB;
  // forcing numThreads=1 avoids spawning pthreads into an unshareable heap.
  ort.env.wasm.numThreads = isolated ? Math.min(4, cores) : 1
  ort.env.wasm.simd = true
  ort.env.wasm.proxy = false
}

ensureOrtConfigured()

async function downloadFile(cache: Cache, fileUrl: string, onProgress?: (loaded: number, total: number) => void): Promise<void> {
  const res = await fetch(fileUrl, { redirect: 'follow' })
  if (!res.ok || !res.body)
    throw new Error(`Failed to download ${fileUrl}: HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done)
      break
    chunks.push(value)
    received += value.length
    onProgress?.(received, total)
  }
  const blob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' })
  await cache.put(fileUrl, new Response(blob, {
    headers: { 'content-length': String(received), 'content-type': 'application/octet-stream' },
  }))
}

async function ensureSession(
  precision: 'int8' | 'fp16',
  targetEp: 'wasm' | 'webgpu',
  emit?: (item: LoadStreamItem) => void,
): Promise<ort.InferenceSession> {
  if (activeSession && activePrecision === precision && activeEp === targetEp)
    return activeSession
  if (activeSession && (activePrecision !== precision || activeEp !== targetEp)) {
    activeSession = null
    activePrecision = null
    activeEp = null
  }
  if (activeSession)
    return activeSession

  ensureOrtConfigured()
  const spec = LAYA_MODEL_SPECS[precision]
  const cache = await caches.open(LAYA_CACHE_NAME)
  const buffers = new Map<string, ArrayBuffer>()
  for (const file of layaModelFiles(spec)) {
    const fileUrl = layaFileUrl(spec, file)
    let match = await cache.match(fileUrl)
    if (!match) {
      await evictStaleLayaEntries(cache)
      await downloadFile(cache, fileUrl, (loaded, total) => emit?.({
        kind: 'progress',
        payload: { phase: 'download', percent: total > 0 ? Math.round((loaded / total) * 100) : -1, message: file, file, loaded, total },
      }))
      match = await cache.match(fileUrl)
      if (!match)
        throw new Error(`Failed to retrieve Laya ${file} from cache after download.`)
    }
    buffers.set(file, await match.arrayBuffer())
  }
  const weightsFile = layaWeightsFile(spec)
  const weightsBytes = buffers.get(weightsFile)!.byteLength
  if (weightsBytes < spec.minWeightsBytes) {
    await cache.delete(layaFileUrl(spec, weightsFile))
    throw new Error(`Cached Laya weights truncated (${weightsBytes} bytes). Evicted; retry load.`)
  }

  emit?.({ kind: 'progress', payload: { phase: 'compile', percent: -1, message: `Compiling ${spec.modelFile} (${targetEp})...` } })
  const executionProviders: string[] = targetEp === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm']
  // NOTICE: fp16 ModernBERT trips SimplifiedLayerNormFusion at level 'all'
  // (GetIndexFromName: InsertedPrecisionFreeCast not found); 'basic' skips it.
  const optLevel: 'basic' | 'all' = precision === 'fp16' ? 'basic' : 'all'
  const modelBytes = new Uint8Array(buffers.get(spec.modelFile)!)
  // The graph references its external weights by file name relative to itself.
  const externalData = spec.externalDataFile
    ? [{ path: spec.externalDataFile.split('/').pop()!, data: new Uint8Array(buffers.get(spec.externalDataFile)!) }]
    : undefined
  try {
    activeSession = await ort.InferenceSession.create(modelBytes, { executionProviders, graphOptimizationLevel: optLevel, externalData })
  }
  catch {
    activeSession = await ort.InferenceSession.create(modelBytes, { executionProviders, graphOptimizationLevel: 'disabled', externalData })
  }
  activePrecision = precision
  activeEp = targetEp
  return activeSession
}

async function ensureTokenizer(emit?: (item: LoadStreamItem) => void): Promise<any> {
  if (activeTokenizer)
    return activeTokenizer
  emit?.({ kind: 'progress', payload: { phase: 'download', percent: -1, message: 'Loading Laya tokenizer...' } })
  activeTokenizer = await AutoTokenizer.from_pretrained(LAYA_TOKENIZER_REPO, { revision: LAYA_TOKENIZER_REVISION })
  return activeTokenizer
}

function precisionFromPayload(payload?: LoadModelRequest): 'int8' | 'fp16' {
  const m = payload?.model ?? ''
  if (m.includes('fp16'))
    return 'fp16'
  const d = payload?.dtype ?? ''
  if (d.includes('fp16'))
    return 'fp16'
  return 'int8'
}

defineStreamInvokeHandler(context, layaLoadEvent, toStreamHandler<LoadModelRequest, LoadStreamItem>(async ({ payload, emit }) => {
  const precision = precisionFromPayload(payload)
  const wantWebGpu = payload?.device === 'webgpu'
  const session = await ensureSession(precision, wantWebGpu ? 'webgpu' : 'wasm', emit)
  await ensureTokenizer(emit)
  void session
  emit({ kind: 'ready', info: { device: (wantWebGpu ? 'webgpu' : 'wasm') as InferenceDevice, metadata: { precision } } })
}))

defineInvokeHandler(context, layaDecideEvent, async (req: LayaDecideRequest) => {
  const start = performance.now()
  const precision = req.precision ?? 'int8'
  const targetEp = req.useWebGpu ? 'webgpu' : 'wasm'
  const [session, tokenizer] = await Promise.all([
    ensureSession(precision, targetEp),
    ensureTokenizer(),
  ])

  const qids = Object.keys(req.questions)
  if (qids.length === 0)
    throw new Error('runLayaSystemOne: at least one question is required')

  const clsId = tokenizer.cls_token_id ?? 50281
  const sepId = tokenizer.sep_token_id ?? 50282
  const maskId = tokenizer.mask_token_id ?? 50284
  const padId = tokenizer.pad_token_id ?? 50283
  const maxLen = 512
  const headMaxLen = 192

  const encodeText = (txt: string): number[] => {
    const out = tokenizer(txt, { add_special_tokens: false })
    const data = out.input_ids.ort_tensor?.cpuData || out.input_ids.data
    return Array.from(data, (v: any) => Number(v))
  }

  const items = qids.map((qid) => {
    const q = toInternal((req.questions as any)[qid])
    const opts = renderOptions(q)
    const scrub = (s: string) => s.split('[MASK]').join(' ')
    let headIds = encodeText(`${q.t} question: ${scrub(q.ins)}`)
    let optIds = opts.map(o => [maskId, ...encodeText(` ${scrub(o)}`).slice(0, 48)])
    const total = (xs: number[][]) => xs.reduce((s, o) => s + o.length, 0)
    let optBudget = headMaxLen - total(optIds)
    if (optBudget < 16) {
      const per = Math.max(4, Math.floor((headMaxLen - 16) / Math.max(1, optIds.length)))
      optIds = optIds.map(o => o.slice(0, per))
      optBudget = headMaxLen - total(optIds)
    }
    headIds = headIds.slice(0, Math.max(8, optBudget))
    const seq = [clsId, ...headIds, sepId]
    const markers: number[] = []
    for (const o of optIds) {
      markers.push(seq.length)
      seq.push(...o)
    }
    seq.push(sepId)
    const room = Math.max(0, maxLen - seq.length - 1)
    const st = encodeText(scrub(serializeState(req.state))).slice(0, room)
    seq.push(...st, sepId)
    return { q, ids: seq.slice(0, maxLen), markers: markers.filter(m => m < maxLen), qtype: QTYPES[q.t] ?? 0 }
  })

  const n = items.length
  // Pad only to the longest sequence in the batch: the encoder is length-agnostic
  // and padding every question to 512 multiplies CPU time ~5x for typical prompts.
  const L = Math.max(...items.map(it => it.ids.length))
  // NOTICE: the exported graph computes the act-head features with an
  // unconditional `topk(2)` over the option axis, so a batch whose widest
  // question has one option fails with "k argument [2] should not be greater
  // than specified axis dim value [1]". Extra slots stay masked out.
  const K = Math.max(2, ...items.map(it => it.markers.length))
  const inputIds = new BigInt64Array(n * L).fill(BigInt(padId))
  const attention = new BigInt64Array(n * L)
  const markerPos = new BigInt64Array(n * K)
  const markerMask = new Uint8Array(n * K)
  const qtype = new BigInt64Array(n)
  let nTokens = 0
  items.forEach((it, i) => {
    it.ids.forEach((v, j) => {
      inputIds[i * L + j] = BigInt(v)
      attention[i * L + j] = 1n
    })
    nTokens += it.ids.length
    it.markers.forEach((m, j) => {
      markerPos[i * K + j] = BigInt(m)
      markerMask[i * K + j] = 1
    })
    qtype[i] = BigInt(it.qtype)
  })

  const inputTensor = new ort.Tensor('int64', inputIds, [n, L])
  const attentionTensor = new ort.Tensor('int64', attention, [n, L])
  const markerPosTensor = new ort.Tensor('int64', markerPos, [n, K])
  const markerMaskTensor = new ort.Tensor('bool', markerMask, [n, K])
  const qtypeTensor = new ort.Tensor('int64', qtype, [n])

  let out: Record<string, ort.Tensor> | null = null
  try {
    let release!: () => void
    const next = new Promise<void>(r => release = r)
    const prev = runLock
    runLock = next
    await prev.catch(() => {})
    try {
      out = await session.run({
        input_ids: inputTensor,
        attention_mask: attentionTensor,
        marker_pos: markerPosTensor,
        marker_mask: markerMaskTensor,
        qtype: qtypeTensor,
      })
    }
    finally {
      release()
    }
  }
  finally {
    inputTensor.dispose?.()
    attentionTensor.dispose?.()
    markerPosTensor.dispose?.()
    markerMaskTensor.dispose?.()
    qtypeTensor.dispose?.()
  }

  try {
    const logitsTensor = out!.logits || (out as any).output
    const logits = logitsTensor?.data
    if (!(logits instanceof Float32Array))
      throw new Error('Laya worker: unexpected logits dtype')
    const answers = decodeAnswers(logits, items, K, qids)
    return {
      model: `laya-${precision}${req.useWebGpu ? '-webgpu' : ''}`,
      answers,
      usage: { input_tokens: nTokens, output_tokens: 0 },
      latency_ms: Math.round(performance.now() - start),
    }
  }
  finally {
    if (out) {
      for (const t of Object.values(out))
        (t as any)?.dispose?.()
    }
  }
})

defineInvokeHandler(context, layaUnloadEvent, async () => {
  // NOTICE: ort 1.24 exposes no session dispose; dropping refs lets the
  // worker GC tensors, while host.terminate() reclaims the WASM SAB itself.
  activeSession = null
  activeTokenizer = null
  activePrecision = null
  activeEp = null
})

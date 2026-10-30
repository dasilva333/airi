/**
 * Laya ONNX weight sources, shared by the worker (which downloads and runs
 * them) and the main thread (which checks the cache and shows progress).
 *
 * Kept free of runtime imports so the worker bundle can pull it in without
 * dragging the adapter (and its `new Worker(...)`) into the worker chunk.
 *
 * NOTICE: `tozp/laya-onnx` (the previous source) is not usable. Its int8 file
 * returns near-identical logits for every option (uniform answers), and both
 * of its graphs bake `seq_len = 512` into the head attention reshape, so every
 * question must be padded to 512 tokens. The sources below were checked
 * against a known-answer example (billing / churn / weather questions) and
 * accept the real sequence length.
 */

export type LayaPrecision = 'int8' | 'fp16'
export type DecisionModelFamily = 'laya' | 'openjev'

export interface LayaModelSpec {
  /** Family of the decision model. */
  family?: DecisionModelFamily
  /** Hugging Face repository the files are fetched from. */
  repo: string
  /** Pinned commit, so a repo update cannot silently swap the weights. */
  revision: string
  /** Graph file; for single-file models it also carries the weights. */
  modelFile: string
  /** External weights file referenced by `modelFile`, when the export splits them. */
  externalDataFile?: string
  /** Smallest plausible size of the weights file; anything below is a truncated download. */
  minWeightsBytes: number
  /** Approximate download size, for labels. */
  approxSizeMb: number
  /** Number of attention heads (16 for ModernBERT-large/Laya, 12 for ModernBERT-base/OpenJev). */
  numHeads?: number
  /** Repository hosting the matching tokenizer. */
  tokenizerRepo?: string
  /** Tokenizer revision. */
  tokenizerRevision?: string
}

export type DecisionModelSpec = LayaModelSpec

export const LAYA_MODEL_SPECS: Record<LayaPrecision, LayaModelSpec> = {
  // MatMulNBits 8-bit weight-only quantization in one self-contained file.
  int8: {
    family: 'laya',
    repo: 'bgoldfarb93/laya-int8',
    revision: 'e6c564dc6d3b2df54cc21ba963fc2f3e62303edf',
    modelFile: 'laya.onnx',
    minWeightsBytes: 600_000_000,
    approxSizeMb: 633,
    numHeads: 16,
    tokenizerRepo: 'onnx-community/laya-ONNX',
    tokenizerRevision: '42e2a6e3b3708c8ff5f61f4aa75c314b1449199b',
  },
  // Dynamo export with fp16 weights and activations; validated on WebGPU by its exporter.
  fp16: {
    family: 'laya',
    repo: 'onnx-community/laya-ONNX',
    revision: '42e2a6e3b3708c8ff5f61f4aa75c314b1449199b',
    modelFile: 'onnx/model_fp16.onnx',
    externalDataFile: 'onnx/model_fp16.onnx_data',
    minWeightsBytes: 800_000_000,
    approxSizeMb: 847,
    numHeads: 16,
    tokenizerRepo: 'onnx-community/laya-ONNX',
    tokenizerRevision: '42e2a6e3b3708c8ff5f61f4aa75c314b1449199b',
  },
}

export const OPENJEV_MODEL_SPECS: Record<LayaPrecision, LayaModelSpec> = {
  // OpenJev / Verdict (151M) int8 export: lightweight ModernBERT-base with calibrated RLCD.
  int8: {
    family: 'openjev',
    repo: 'heman10x/rlcd-modernbert-151m',
    revision: 'main',
    modelFile: 'model.onnx',
    minWeightsBytes: 120_000_000,
    approxSizeMb: 155,
    numHeads: 12,
    tokenizerRepo: 'heman10x/rlcd-modernbert-151m',
    tokenizerRevision: 'main',
  },
  // OpenJev / Verdict (151M) fp16 export for WebGPU.
  fp16: {
    family: 'openjev',
    repo: 'heman10x/rlcd-modernbert-151m',
    revision: 'main',
    modelFile: 'model_fp16.onnx',
    minWeightsBytes: 250_000_000,
    approxSizeMb: 300,
    numHeads: 12,
    tokenizerRepo: 'heman10x/rlcd-modernbert-151m',
    tokenizerRevision: 'main',
  },
}

export function getDecisionModelSpec(modelId?: string, precision: LayaPrecision = 'int8'): LayaModelSpec {
  if (modelId?.includes('openjev') || modelId?.includes('151m') || modelId?.includes('heman10x'))
    return OPENJEV_MODEL_SPECS[precision]
  return LAYA_MODEL_SPECS[precision]
}

/**
 * Longest sequence the worker feeds the encoder, in tokens (question head plus
 * state).
 *
 * NOTICE: the checkpoint's `config.json` ships `laya.max_len = 512`, but that is
 * only the trained default; the ModernBERT encoder has `max_position_embeddings
 * = 8192` and the exported graphs take dynamic lengths. On WebGPU, the dense
 * self-attention tensor [batch, 16, L, L] in fp32 hits the 2 GiB single-buffer
 * ceiling at L=5792, so 4096 (1.0 GiB attention buffer) is the practical ceiling.
 * Anything longer is cleanly truncated by the worker.
 * Sequences are padded only to the longest one in the batch, and batches are split
 * to stay within the WebGPU buffer limit.
 */
export const LAYA_MAX_SEQ_LEN = 4096

/** Tokenizer repository; identical tokenizer files to the original checkpoint. */
export const LAYA_TOKENIZER_REPO = 'onnx-community/laya-ONNX'
export const LAYA_TOKENIZER_REVISION = '42e2a6e3b3708c8ff5f61f4aa75c314b1449199b'

export function layaFileUrl(spec: LayaModelSpec, file: string): string {
  return `https://huggingface.co/${spec.repo}/resolve/${spec.revision}/${file}`
}

/** Every file a precision needs, the weights-bearing one last. */
export function layaModelFiles(spec: LayaModelSpec): string[] {
  return spec.externalDataFile ? [spec.modelFile, spec.externalDataFile] : [spec.modelFile]
}

export function layaWeightsFile(spec: LayaModelSpec): string {
  return spec.externalDataFile ?? spec.modelFile
}

/**
 * Drops `laya-cache` entries that no current spec references (weights from a
 * previous source or revision), which would otherwise pin hundreds of MB.
 */
export async function evictStaleLayaEntries(cache: Cache): Promise<void> {
  const allSpecs = [...Object.values(LAYA_MODEL_SPECS), ...Object.values(OPENJEV_MODEL_SPECS)]
  const known = new Set(allSpecs.flatMap(spec => layaModelFiles(spec).map(file => layaFileUrl(spec, file))))
  for (const request of await cache.keys()) {
    if (!known.has(request.url))
      await cache.delete(request)
  }
}

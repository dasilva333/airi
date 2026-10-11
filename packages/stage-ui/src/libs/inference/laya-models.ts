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

export interface LayaModelSpec {
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
}

export const LAYA_MODEL_SPECS: Record<LayaPrecision, LayaModelSpec> = {
  // MatMulNBits 8-bit weight-only quantization in one self-contained file.
  int8: {
    repo: 'bgoldfarb93/laya-int8',
    revision: 'e6c564dc6d3b2df54cc21ba963fc2f3e62303edf',
    modelFile: 'laya.onnx',
    minWeightsBytes: 600_000_000,
    approxSizeMb: 633,
  },
  // Dynamo export with fp16 weights and activations; validated on WebGPU by its exporter.
  fp16: {
    repo: 'onnx-community/laya-ONNX',
    revision: '42e2a6e3b3708c8ff5f61f4aa75c314b1449199b',
    modelFile: 'onnx/model_fp16.onnx',
    externalDataFile: 'onnx/model_fp16.onnx_data',
    minWeightsBytes: 800_000_000,
    approxSizeMb: 847,
  },
}

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
  const known = new Set(Object.values(LAYA_MODEL_SPECS).flatMap(spec => layaModelFiles(spec).map(file => layaFileUrl(spec, file))))
  for (const request of await cache.keys()) {
    if (!known.has(request.url))
      await cache.delete(request)
  }
}

const f32Scratch = new Float32Array(1)
const i32Scratch = new Int32Array(f32Scratch.buffer)
function f32ToHalfBits(value) {
  f32Scratch[0] = value
  const x = i32Scratch[0]
  let bits = x >> 16 & 32768
  let mantissa = x >> 12 & 2047
  const exp = x >> 23 & 255
  if (exp < 103)
    return bits
  if (exp > 142) {
    bits |= 31744
    bits |= exp === 255 && x & 8388607 ? 512 : 0
    return bits
  }
  if (exp < 113) {
    mantissa |= 2048
    bits |= (mantissa >> 114 - exp) + (mantissa >> 113 - exp & 1)
    return bits
  }
  bits |= exp - 112 << 10 | mantissa >> 1
  bits += mantissa & 1
  return bits
}
function bf16BitsToF16Bits(bf16) {
  i32Scratch[0] = bf16 << 16
  return f32ToHalfBits(f32Scratch[0])
}
function alignedCopy(src) {
  if (src.byteOffset % 4 === 0 && src.byteLength === src.buffer.byteLength)
    return src
  return src.slice()
}
function toF16Bytes(src, dtype) {
  if (dtype === 'F16')
    return src
  if (dtype === 'BF16') {
    const aligned = alignedCopy(src)
    const inU16 = new Uint16Array(aligned.buffer, aligned.byteOffset, aligned.byteLength >> 1)
    const out = new Uint16Array(inU16.length)
    for (let i = 0; i < inU16.length; i++)
      out[i] = bf16BitsToF16Bits(inU16[i])
    return new Uint8Array(out.buffer)
  }
  if (dtype === 'F32') {
    const aligned = alignedCopy(src)
    const inF32 = new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength >> 2)
    const out = new Uint16Array(inF32.length)
    for (let i = 0; i < inF32.length; i++)
      out[i] = f32ToHalfBits(inF32[i])
    return new Uint8Array(out.buffer)
  }
  throw new Error(`web-rwkv: unsupported safetensors dtype "${dtype}" (expected F16, BF16, or F32)`)
}
function loraNumEmbRawAxis(name, ndims) {
  if (ndims < 2)
    return null
  const endsWithDot = suffixes => suffixes.some(s => name.endsWith(`.${s}`))
  if (endsWithDot(['w1', 'a1', 'g1', 'v1']) || name.endsWith('time_mix_w1') || name.endsWith('time_decay_w1'))
    return ndims - 1
  if (endsWithDot(['w2', 'a2', 'g2', 'v2']) || name.endsWith('time_mix_w2') || name.endsWith('time_decay_w2'))
    return ndims - 2
  return null
}
function transposeInnerAxesF16(data, shape) {
  const n = shape.length
  const rows = shape[n - 2]
  const cols = shape[n - 1]
  let outer = 1
  for (let k = 0; k < n - 2; k++)
    outer *= shape[k]
  const out = new Uint8Array(data.byteLength)
  for (let o = 0; o < outer; o++) {
    const base = o * rows * cols
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const from = (base + i * cols + j) * 2
        const to = (base + j * rows + i) * 2
        out[to] = data[from]
        out[to + 1] = data[from + 1]
      }
    }
  }
  const shapeOut = shape.slice()
  shapeOut[n - 2] = cols
  shapeOut[n - 1] = rows
  return { data: out, shape: shapeOut }
}
function orientAdapterMatrix(name, data, shape, numEmb) {
  const axis = loraNumEmbRawAxis(name, shape.length)
  if (axis == null || !Number.isFinite(numEmb) || shape[axis] === numEmb)
    return { data, shape }
  return transposeInnerAxesF16(data, shape)
}
function readSafetensorsHeader(head) {
  if (head.byteLength < 8)
    throw new Error(`web-rwkv: safetensors file is too short (${head.byteLength} bytes) to read header length`)
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength)
  const headerLen = Number(view.getBigUint64(0, true))
  const MAX_HEADER_LEN = 1e8
  if (headerLen < 2 || headerLen > MAX_HEADER_LEN) {
    const preview = new TextDecoder('utf-8').decode(head.subarray(0, 16)).replace(/[^\x20-\x7E]/g, '.')
    throw new Error(`web-rwkv: invalid safetensors header length (${headerLen} bytes). The file may be corrupt or not a valid safetensors format. (Preview of first 16 bytes: "${preview}")`)
  }
  if (8 + headerLen > head.byteLength)
    throw new Error(`web-rwkv: safetensors header (${headerLen} bytes) exceeds the provided buffer`)
  const json = new TextDecoder().decode(head.subarray(8, 8 + headerLen))
  const raw = JSON.parse(json)
  const tensors = {}
  for (const [name, info] of Object.entries(raw)) {
    if (name === '__metadata__')
      continue
    tensors[name] = { dtype: info.dtype, shape: info.shape, data_offsets: info.data_offsets }
  }
  return { tensors, dataStart: 8 + headerLen, headerLen }
}
function countRwkvLayers(tensors) {
  let n = 0
  for (const name of Object.keys(tensors)) {
    const m = /^blocks\.(\d+)\./.exec(name)
    if (m)
      n = Math.max(n, Number(m[1]) + 1)
  }
  return n
}
export {
  bf16BitsToF16Bits,
  countRwkvLayers,
  f32ToHalfBits,
  loraNumEmbRawAxis,
  orientAdapterMatrix,
  readSafetensorsHeader,
  toF16Bytes,
}

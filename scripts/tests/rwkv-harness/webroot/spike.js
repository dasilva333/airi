/**
 * One-shot end-to-end proof that the RWKV WASM runs against a real WebGPU
 * adapter in this browser. Mirrors production worker.ts:
 *   buildReader (HTTP Range, coalesced chunks, f16 cast + adapter orient)
 *   -> Session.from_reader(0,0,0, SessionType.Chat)
 *   -> NucleusSampler transform/softmax/sample loop
 *   -> stop scanner on role markers
 * Writes a JSON verdict onto window.__SPIKE_RESULT for the Node driver to read.
 */

const MODEL_URL = '/models/model.safetensors'
const VOCAB_URL = '/rwkv_vocab_v20230424.json'

async function fetchRange(url, start, end) {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, cache: 'no-store' })
  if (res.status !== 206 && res.status !== 200)
    throw new Error(`range ${start}-${end} -> HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

async function run() {
  const ST = await import('/vendor/stage-ui-web-rwkv/safetensors.js')
  const STOP = await import('/vendor/stage-ui-web-rwkv/stop.js')
  const wasm = await import('/vendor/web-rwkv-wasm/web_rwkv_wasm.js')
  await wasm.default({ module_or_path: '/vendor/web-rwkv-wasm/web_rwkv_wasm_bg.wasm' })
  const { Session, SessionType, Tensor, TensorReader, Tokenizer, NucleusSampler } = wasm

  // --- buildReader (whole-file path via one Range fetch; mirrors worker.ts) ---
  const probe = await fetch(MODEL_URL, { headers: { Range: 'bytes=0-7' }, cache: 'no-store' })
  const head8 = new Uint8Array(await probe.arrayBuffer())
  const headerLen = Number(new DataView(head8.buffer, head8.byteOffset, head8.byteLength).getBigUint64(0, true))
  const headBytes = await fetchRange(MODEL_URL, 0, 8 + headerLen - 1)
  const { tensors, dataStart } = ST.readSafetensorsHeader(headBytes)
  const names = Object.keys(tensors)
  const numEmb = tensors['emb.weight']?.shape[1] ?? Number.NaN
  const dataEnd = Math.max(...names.map(n => tensors[n].data_offsets[1]))
  const fileBytes = await fetchRange(MODEL_URL, dataStart, dataStart + dataEnd - 1)
  const built = []
  for (const nm of names) {
    const info = tensors[nm]
    const [s, e] = info.data_offsets
    const raw = fileBytes.subarray(s, e) // relative to data block start
    const f16 = ST.toF16Bytes(raw, info.dtype)
    const o = ST.orientAdapterMatrix(nm, f16, info.shape, numEmb)
    built.push(new Tensor(nm, Uint32Array.from(o.shape), o.data.buffer.slice(o.data.byteOffset, o.data.byteOffset + o.data.byteLength)))
  }
  const reader = new TensorReader(built)
  const session = await Session.from_reader(reader, 0, 0, 0, SessionType.Chat)
  const vocab = await (await fetch(VOCAB_URL)).text()
  const tokenizer = new Tokenizer(vocab)
  const info = session.info()

  // --- sampler loop (mirrors worker.ts generate handler) ---
  const evidence = '0: [2026-06-16T15:00:00Z] User: I tried baking sourdough but burned the crust.\n1: [2026-06-16T15:01:00Z] Bot: Temperature control is tricky! What temp?'
  const prompt = `Extract 3-5 semantic Echo Chips from the following raw conversation evidence window. Output a JSON object with a "pills" array.\n\nEvidence Window:\n${evidence}\n\n{"pills": [`
  session.load(new Float32Array(session.state_len()))
  const sampler = new NucleusSampler(info, 0.6, 0.9, 0.0, 0.0, 0.996)
  const output = new Float32Array(info.num_vocab)
  const probs = new Float32Array(info.num_vocab)
  let tokens = tokenizer.encode(new TextEncoder().encode(prompt))
  const decoder = new TextDecoder()
  const stopScanner = STOP.createStopScanner(['\n\nUser:', '\nUser:', '\n\nSystem:', '\nSystem:', '\n\nAssistant:', '\nAssistant:'])
  const t0 = performance.now()
  let text = ''
  for (let i = 0; i < 48; i++) {
    if (tokens.length > 0)
      await session.run(tokens, output)
    sampler.transform(output)
    await session.softmax(output, probs)
    const token = sampler.sample(probs)
    if (token === 0)
      break
    sampler.update(Uint32Array.of(token))
    tokens = Uint32Array.of(token)
    const dec = decoder.decode(tokenizer.decode(tokens), { stream: true })
    if (dec) {
      const t = stopScanner.push(dec); if (t)
        text += t; if (stopScanner.stopped)
        break
    }
  }
  const elapsedMs = Math.round(performance.now() - t0)
  return { ok: true, numTensors: built.length, numEmb, numVocab: info.num_vocab, stateLen: session.state_len(), elapsedMs, promptTokens: 'see-driver', output: `{"pills": [${text}` }
}

run()
  .then((r) => { window.__SPIKE_RESULT = r })
  .catch((e) => { window.__SPIKE_RESULT = { ok: false, error: String((e && e.stack) || e).slice(0, 1500) } })

export async function probe() {
  const wasm = await import('/vendor/web-rwkv-wasm/web_rwkv_wasm.js')
  await wasm.default({ module_or_path: '/vendor/web-rwkv-wasm/web_rwkv_wasm_bg.wasm' })
  const ST = await import('/vendor/stage-ui-web-rwkv/safetensors.js')
  // build session from the cached model via range fetch (same as runner)
  const MODEL = '/models/model.safetensors'
  const probe8 = await (await fetch(MODEL, { headers: { Range: 'bytes=0-7' } })).arrayBuffer()
  const headerLen = Number(new DataView(probe8).getBigUint64(0, true))
  const head = new Uint8Array(await (await fetch(MODEL, { headers: { Range: `bytes=0-${8 + headerLen - 1}` } })).arrayBuffer())
  const { tensors, dataStart } = ST.readSafetensorsHeader(head)
  const names = Object.keys(tensors)
  const numEmb = tensors['emb.weight']?.shape[1] ?? Number.NaN
  const dataEnd = Math.max(...names.map(n => tensors[n].data_offsets[1]))
  const fileBytes = new Uint8Array(await (await fetch(MODEL, { headers: { Range: `bytes=${dataStart}-${dataStart + dataEnd - 1}` } })).arrayBuffer())
  const built = []
  for (const nm of names) {
    const info = tensors[nm]; const [s, e] = info.data_offsets
    const f16 = ST.toF16Bytes(fileBytes.subarray(s, e), info.dtype)
    const o = ST.orientAdapterMatrix(nm, f16, info.shape, numEmb)
    built.push(new wasm.Tensor(nm, Uint32Array.from(o.shape), o.data.buffer.slice(o.data.byteOffset, o.data.byteOffset + o.data.byteLength)))
  }
  const session = await wasm.Session.from_reader(new wasm.TensorReader(built), 0, 0, 0, wasm.SessionType.Chat)
  const info = session.info()
  const SL = session.state_len()
  // do one tiny run so state is non-trivial
  const vocab = await (await fetch('/rwkv_vocab_v20230424.json')).text()
  const tk = new wasm.Tokenizer(vocab)
  const scratch = new Float32Array(info.num_vocab)
  await session.run(tk.encode(new TextEncoder().encode('User: hello there, how are you today')), scratch)
  const state = new Float32Array(SL)
  await session.back(state)
  // No StateVisual (its json() is a huge base64 heatmap, too slow here).
  return {
    num_emb: info.num_emb,
    num_hidden: info.num_hidden,
    num_head: info.num_head,
    num_layer: info.num_layer,
    num_vocab: info.num_vocab,
    state_len: SL,
    per_layer_if_even_split: SL / info.num_layer,
    hidden_times_layer: info.num_hidden * info.num_layer,
    state_sample_first8: Array.from(state.slice(0, 8)),
  }
}

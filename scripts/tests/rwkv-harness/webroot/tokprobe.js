export async function probe() {
  const wasm = await import('/vendor/web-rwkv-wasm/web_rwkv_wasm.js')
  await wasm.default({ module_or_path: '/vendor/web-rwkv-wasm/web_rwkv_wasm_bg.wasm' })
  const vocab = await (await fetch('/rwkv_vocab_v20230424.json')).text()
  const tk = new wasm.Tokenizer(vocab)
  const enc = new TextEncoder()
  const out = {}
  for (const s of ['mood', 'flavor', 'journal_candidate', '"type"', '":"', '", "', 'content', 'relevanceScore', '"pills"']) {
    const ids = Array.from(tk.encode(enc.encode(s)))
    out[s] = ids
  }
  return out
}

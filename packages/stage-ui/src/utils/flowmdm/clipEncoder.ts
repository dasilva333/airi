import { AutoTokenizer, CLIPTextModelWithProjection } from '@huggingface/transformers'

let tokenizerPromise: Promise<any> | null = null
let textModelPromise: Promise<any> | null = null

export async function getClipEmbedding(prompt: string, onLog?: (msg: string) => void): Promise<Float32Array> {
  const modelId = 'Xenova/clip-vit-base-patch32'

  try {
    if (!tokenizerPromise) {
      onLog?.('Loading CLIP tokenizer (Xenova/clip-vit-base-patch32)...')
      tokenizerPromise = AutoTokenizer.from_pretrained(modelId)
    }
    if (!textModelPromise) {
      onLog?.('Loading CLIP text model (Xenova/clip-vit-base-patch32)...')
      textModelPromise = CLIPTextModelWithProjection.from_pretrained(modelId)
    }

    const [tokenizer, textModel] = await Promise.all([tokenizerPromise, textModelPromise])
    onLog?.('Encoding prompt text into CLIP embedding space...')

    const inputs = await tokenizer(prompt)
    const { text_embeds } = await textModel(inputs)

    onLog?.('CLIP embedding generated successfully.')
    return text_embeds.data as Float32Array
  }
  catch (err: any) {
    onLog?.(`[WARN] CLIP load/encode failed: ${err.message || String(err)}. Using zero baseline embedding fallback...`)
    const fallback = new Float32Array(512)
    fallback.fill(0.1)
    return fallback
  }
}

/**
 * Ming 3.0 TTS adapter accessor + 44.1 kHz WAV encoding.
 *
 * The fusor runtime streams 44.1 kHz mono PCM frames; this module packs them
 * into a 16-bit WAV (the rest of AIRI's local TTS path is 24 kHz, so the
 * 44.1 kHz rate is preserved end-to-end and declared on the provider).
 */

let ming3Adapter: any = null

/**
 * Singleton accessor for the Ming 3.0 adapter, lazily created on first use.
 */
export async function getMing3AdapterInstance() {
  if (!ming3Adapter) {
    const { createMing3Adapter } = await import('../../libs/inference/adapters/ming3')
    ming3Adapter = createMing3Adapter()
  }
  return ming3Adapter
}

export const MING3_SAMPLE_RATE = 44100

/**
 * Encode mono Float32 PCM samples as a 16-bit WAV ArrayBuffer at 44.1 kHz.
 */
export function encodeMing3Wav(samples: Float32Array, sampleRate = MING3_SAMPLE_RATE): ArrayBuffer {
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataLength = samples.length * bytesPerSample
  const headerLength = 44
  const buffer = new ArrayBuffer(headerLength + dataLength)
  const view = new DataView(buffer)

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  const output = new Int16Array(buffer, headerLength)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  return buffer
}

/**
 * Lightweight text normalization for Ming synthesis input.
 *
 * NOTICE: unlike the MOSS sanitizer this deliberately preserves square
 * brackets and `<|...|>` markers — `[Laughter]`-style paralinguistic tags are
 * first-class Ming input and must reach the runtime intact.
 */
export function sanitizeMing3InputText(text: string): string {
  if (!text)
    return ''

  return text
    .replace(/\s+/g, ' ')
    .trim()
}

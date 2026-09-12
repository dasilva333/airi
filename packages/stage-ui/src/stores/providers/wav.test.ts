import {
  toFloat32FromPCM16,
  toPCM16FromFloat32,
  toWav,
  toWavFromPCM16,
} from '@proj-airi/audio/encoding'
import { describe, expect, it } from 'vitest'

describe('wav and pcm encoding', () => {
  it('converts between Float32 and PCM16 correctly', () => {
    const float32 = new Float32Array([-1, 0, 1])
    const pcm16 = toPCM16FromFloat32(float32)

    expect(pcm16.length).toBe(6)

    const reconstructed = toFloat32FromPCM16(pcm16)
    expect(reconstructed[0]).toBeCloseTo(-1, 4)
    expect(reconstructed[1]).toBeCloseTo(0, 4)
    expect(reconstructed[2]).toBeCloseTo(1, 1)
  })

  it('generates a valid 44-byte WAV header via toWavFromPCM16', () => {
    const pcm16 = new Uint8Array([0, 0, 128, 127]) // 2 samples of PCM16
    const sampleRate = 24000
    const wavBuffer = toWavFromPCM16(pcm16, sampleRate, 1)

    expect(wavBuffer.byteLength).toBe(44 + pcm16.byteLength)

    const view = new DataView(wavBuffer)
    const decoder = new TextDecoder()

    // RIFF chunk
    expect(decoder.decode(new Uint8Array(wavBuffer, 0, 4))).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + pcm16.byteLength)
    expect(decoder.decode(new Uint8Array(wavBuffer, 8, 4))).toBe('WAVE')

    // fmt sub-chunk
    expect(decoder.decode(new Uint8Array(wavBuffer, 12, 4))).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16) // PCM header size
    expect(view.getUint16(20, true)).toBe(1) // Audio format 1 = PCM
    expect(view.getUint16(22, true)).toBe(1) // 1 channel
    expect(view.getUint32(24, true)).toBe(sampleRate)
    expect(view.getUint16(34, true)).toBe(16) // Bits per sample

    // data sub-chunk
    expect(decoder.decode(new Uint8Array(wavBuffer, 36, 4))).toBe('data')
    expect(view.getUint32(40, true)).toBe(pcm16.byteLength)

    // Verify audio samples are appended
    const sampleBytes = new Uint8Array(wavBuffer, 44)
    expect(Array.from(sampleBytes)).toEqual(Array.from(pcm16))
  })

  it('encodes Float32 buffer to WAV via toWav', () => {
    const float32 = new Float32Array([0.5, -0.5])
    const wavBuffer = toWav(float32.buffer, 16000, 1)

    expect(wavBuffer.byteLength).toBe(44 + float32.length * 2)
    const view = new DataView(wavBuffer)
    expect(view.getUint32(24, true)).toBe(16000)
  })
})

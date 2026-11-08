/**
 * Zero-dependency WAV decoder and encoder.
 * Handles standard 8-bit, 16-bit, 24-bit PCM and 32-bit IEEE float WAV files.
 */

export interface DecodedAudio {
  channelData: Float32Array[]
  sampleRate: number
  duration: number
}

export function decodeWav(input: ArrayBuffer | Uint8Array): DecodedAudio {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // Verify RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  if (riff !== 'RIFF') {
    throw new Error(`Invalid WAV header: expected 'RIFF', received '${riff}'`)
  }

  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
  if (wave !== 'WAVE') {
    throw new Error(`Invalid WAV format: expected 'WAVE', received '${wave}'`)
  }

  let offset = 12
  let audioFormat = 1
  let numChannels = 1
  let sampleRate = 44100
  let bitsPerSample = 16
  let dataOffset = 0
  let dataLength = 0

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    )
    const chunkSize = view.getUint32(offset + 4, true)
    const chunkDataOffset = offset + 8

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(chunkDataOffset, true)
      numChannels = view.getUint16(chunkDataOffset + 2, true)
      sampleRate = view.getUint32(chunkDataOffset + 4, true)
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true)
    }
    else if (chunkId === 'data') {
      dataOffset = chunkDataOffset
      dataLength = chunkSize
      break
    }

    // Chunks are word-aligned (2-byte padding if odd length)
    offset += 8 + chunkSize + (chunkSize % 2)
  }

  if (dataOffset === 0) {
    throw new Error('Invalid WAV: missing \'data\' chunk')
  }

  // Support PCM (1) and IEEE float (3)
  if (audioFormat !== 1 && audioFormat !== 3) {
    throw new Error(`Unsupported WAV audio format code: ${audioFormat}`)
  }

  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const totalSamples = Math.floor(Math.min(dataLength, bytes.byteLength - dataOffset) / blockAlign)

  const channelData: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(new Float32Array(totalSamples))
  }

  let readPtr = dataOffset
  for (let i = 0; i < totalSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = 0
      if (audioFormat === 3 && bitsPerSample === 32) {
        sample = view.getFloat32(readPtr, true)
      }
      else if (audioFormat === 1) {
        if (bitsPerSample === 16) {
          sample = view.getInt16(readPtr, true) / 32768.0
        }
        else if (bitsPerSample === 24) {
          // 24-bit little endian signed integer
          const b0 = view.getUint8(readPtr)
          const b1 = view.getUint8(readPtr + 1)
          const b2 = view.getUint8(readPtr + 2)
          let val = (b2 << 16) | (b1 << 8) | b0
          if (val & 0x800000) {
            val |= ~0xFFFFFF
          }
          sample = val / 8388608.0
        }
        else if (bitsPerSample === 32) {
          sample = view.getInt32(readPtr, true) / 2147483648.0
        }
        else if (bitsPerSample === 8) {
          sample = (view.getUint8(readPtr) - 128) / 128.0
        }
      }
      channelData[ch][i] = Math.max(-1.0, Math.min(1.0, sample))
      readPtr += bytesPerSample
    }
  }

  const duration = totalSamples / sampleRate

  return {
    channelData,
    sampleRate,
    duration,
  }
}

/**
 * Encodes audio channels into a standard 16-bit PCM WAV byte buffer.
 */
export function encodeWav(channelData: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = channelData.length
  if (numChannels === 0) {
    throw new Error('Cannot encode WAV with 0 channels')
  }
  const numSamples = channelData[0].length
  const bytesPerSample = 2 // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numSamples * blockAlign
  const bufferSize = 44 + dataSize

  const buffer = new Uint8Array(bufferSize)
  const view = new DataView(buffer.buffer)

  // RIFF identifier 'RIFF'
  buffer[0] = 0x52; buffer[1] = 0x49; buffer[2] = 0x46; buffer[3] = 0x46
  // File length minus 8 bytes
  view.setUint32(4, 36 + dataSize, true)
  // 'WAVE'
  buffer[8] = 0x57; buffer[9] = 0x41; buffer[10] = 0x56; buffer[11] = 0x45

  // 'fmt ' chunk
  buffer[12] = 0x66; buffer[13] = 0x6D; buffer[14] = 0x74; buffer[15] = 0x20
  view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // ByteRate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // BitsPerSample

  // 'data' chunk
  buffer[36] = 0x64; buffer[37] = 0x61; buffer[38] = 0x74; buffer[39] = 0x61
  view.setUint32(40, dataSize, true)

  let writePtr = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1.0, Math.min(1.0, channelData[ch][i]))
      const val = s < 0 ? s * 32768 : s * 32767
      view.setInt16(writePtr, Math.round(val), true)
      writePtr += 2
    }
  }

  return buffer
}

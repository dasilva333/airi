/**
 * Generic utility for consuming audio streams delivered over Server-Sent Events (SSE).
 * Used by MiniMax Speech, OpenAI-compatible streaming TTS, and related voice engines.
 */

/**
 * Converts a hexadecimal string to a Uint8Array of bytes.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim()
  const bytes = new Uint8Array(Math.floor(cleanHex.length / 2))
  for (let index = 0; index < cleanHex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(cleanHex.slice(index, index + 2), 16)
  }
  return bytes
}

/**
 * Reads an SSE stream from a Response body, extracts audio chunks via a parser callback,
 * and concatenates them into a single audio Response.
 *
 * @param response The fetch Response object with an active SSE body stream
 * @param extractAudioChunk A callback that inspects parsed JSON events and returns a Uint8Array of audio bytes (or null if event contains no audio)
 * @param contentType The MIME type for the resulting Response (e.g. 'audio/mpeg' or 'audio/wav')
 */
export async function readSSEAudioStream(
  response: Response,
  extractAudioChunk: (event: any) => Uint8Array | null | undefined,
  contentType = 'audio/mpeg',
): Promise<Response> {
  if (!response.body) {
    throw new Error('Response body is empty or unavailable for streaming.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const audioChunks: Uint8Array[] = []
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data:'))
        continue

      const jsonStr = line.slice(5).trim()
      if (!jsonStr || jsonStr === '[DONE]')
        continue

      try {
        const event = JSON.parse(jsonStr)
        const chunk = extractAudioChunk(event)
        if (chunk && chunk.length > 0) {
          audioChunks.push(chunk)
        }
      }
      catch {
        // A malformed SSE event does not invalidate earlier audio chunks.
      }
    }
  }

  // Handle any remainder in buffer
  if (buffer.startsWith('data:')) {
    const jsonStr = buffer.slice(5).trim()
    if (jsonStr && jsonStr !== '[DONE]') {
      try {
        const event = JSON.parse(jsonStr)
        const chunk = extractAudioChunk(event)
        if (chunk && chunk.length > 0) {
          audioChunks.push(chunk)
        }
      }
      catch {
        // Ignore
      }
    }
  }

  const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of audioChunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }

  return new Response(combined.buffer, {
    status: 200,
    headers: { 'Content-Type': contentType },
  })
}

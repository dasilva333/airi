import { describe, expect, it } from 'vitest'

import { hexToBytes, readSSEAudioStream } from './sse-audio-stream'

describe('sse-audio-stream', () => {
  it('converts hex string to byte array', () => {
    const bytes = hexToBytes('494433')
    expect(bytes.length).toBe(3)
    expect(bytes[0]).toBe(0x49)
    expect(bytes[1]).toBe(0x44)
    expect(bytes[2]).toBe(0x33)
  })

  it('reads and concatenates SSE audio stream chunks correctly', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('data: {"data":{"audio":"0102","status":1}}\n\n'))
        controller.enqueue(encoder.encode('data: {"data":{"audio":"0304","status":1}}\n\n'))
        // status 2 is final summary in MiniMax; shouldn't duplicate
        controller.enqueue(encoder.encode('data: {"data":{"audio":"01020304","status":2}}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    const response = new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })

    const result = await readSSEAudioStream(
      response,
      (event) => {
        if (event.data?.audio && event.data.status !== 2) {
          return hexToBytes(event.data.audio)
        }
        return null
      },
      'audio/mpeg',
    )

    expect(result.status).toBe(200)
    expect(result.headers.get('Content-Type')).toBe('audio/mpeg')

    const buffer = await result.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4])
  })
})

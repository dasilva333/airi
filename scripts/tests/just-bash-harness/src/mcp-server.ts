import type { IncomingMessage, ServerResponse } from 'node:http'

import { randomUUID } from 'node:crypto'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

const streamableSessions = new Map<string, StreamableHTTPServerTransport>()

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'airi-remote-mcp-harness',
    version: '1.0.0',
  })

  // Tool 1: ping
  server.tool(
    'ping',
    'Ping the remote MCP server to check connectivity and latency. Returns "pong".',
    {
      message: z.string().optional().describe('Optional message to echo back'),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'pong',
                echo: message || null,
                server_time: new Date().toISOString(),
                protocol: 'StreamableHTTP',
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // Tool 2: weather_lookup
  server.tool(
    'weather_lookup',
    'Get current weather conditions and 3-day forecast for a city',
    {
      city: z.string().describe('City name, e.g. Tokyo, San Francisco, Paris, London, New York'),
    },
    async ({ city }) => {
      const normalized = city.trim().toLowerCase()
      let condition = 'Partly Cloudy'
      let tempC = 20
      let humidity = 60

      if (normalized.includes('tokyo')) {
        condition = 'Pleasant & Clear'
        tempC = 19
        humidity = 55
      }
      else if (normalized.includes('francisco')) {
        condition = 'Foggy & Cool'
        tempC = 14
        humidity = 82
      }
      else if (normalized.includes('london')) {
        condition = 'Overcast & Drizzle'
        tempC = 12
        humidity = 88
      }
      else if (normalized.includes('paris')) {
        condition = 'Mild & Sunny'
        tempC = 17
        humidity = 62
      }
      else if (normalized.includes('york')) {
        condition = 'Breezy & Sunny'
        tempC = 18
        humidity = 50
      }

      const tempF = Math.round((tempC * 9) / 5 + 32)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                city,
                temperature_c: tempC,
                temperature_f: tempF,
                condition,
                humidity_percent: humidity,
                wind_speed_kmh: 14,
                forecast: [
                  { day: 'Tomorrow', high_c: tempC + 2, low_c: tempC - 4, condition },
                  { day: 'Day 2', high_c: tempC + 1, low_c: tempC - 3, condition: 'Sunny' },
                  { day: 'Day 3', high_c: tempC - 1, low_c: tempC - 5, condition: 'Scattered Clouds' },
                ],
                updated_at: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  return server
}

export async function handleStreamableHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // CORS & headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Normalize Accept header for Streamable HTTP compliance
  const currentAccept = req.headers.accept || ''
  if (!currentAccept.includes('text/event-stream')) {
    req.headers.accept = currentAccept
      ? `${currentAccept}, application/json, text/event-stream`
      : 'application/json, text/event-stream'
  }

  // Read request body if present
  let body: any
  if (req.method === 'POST') {
    const rawBody = await new Promise<string>((resolve) => {
      let data = ''
      req.on('data', chunk => (data += chunk))
      req.on('end', () => resolve(data))
    })
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody)
      }
      catch {
        // Fallback for non-JSON
      }
    }
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined
  let transport: StreamableHTTPServerTransport | undefined

  if (sessionId && streamableSessions.has(sessionId)) {
    transport = streamableSessions.get(sessionId)!
  }
  else if (!sessionId && req.method === 'POST' && isInitializeRequest(body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        console.log(`[StreamableHTTP] Session initialized: ${sid}`)
        streamableSessions.set(sid, transport!)
      },
    })

    transport.onclose = () => {
      if (transport?.sessionId) {
        console.log(`[StreamableHTTP] Transport closed: ${transport.sessionId}`)
        streamableSessions.delete(transport.sessionId)
      }
    }

    const server = createMcpServer()
    await server.connect(transport)
  }
  else if (sessionId) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found' }, id: null }))
    return
  }
  else {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: No valid session ID or initialize message' }, id: null }))
    return
  }

  await transport.handleRequest(req, res, body)
}

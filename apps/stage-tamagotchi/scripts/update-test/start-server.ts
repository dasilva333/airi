import type { IncomingMessage, Server, ServerResponse } from 'node:http'

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'

export interface TestServerOptions {
  port?: number
  host?: string
  storeDir: string
}

export interface TestServerInstance {
  port: number
  host: string
  url: string
  server: Server
  setSimulateFailure: (fail: boolean) => void
  setDelayMs: (ms: number) => void
  close: () => Promise<void>
}

const MIME_TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.sig': 'text/plain; charset=utf-8',
  '.sha256': 'text/plain; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, If-None-Match',
}

/**
 * Creates and starts a lightweight HTTP server serving a release store for local testing.
 */
export async function startTestServer(options: TestServerOptions): Promise<TestServerInstance> {
  const host = options.host ?? '127.0.0.1'
  const targetPort = options.port ?? 0
  const storeRoot = resolve(options.storeDir)

  let simulateFailure = false
  let delayMs = 0

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS)
      res.end()
      return
    }

    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs))
    }

    if (simulateFailure) {
      res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Simulated Internal Server Error' }))
      return
    }

    const rawPath = req.url ? new URL(req.url, `http://${host}`).pathname : '/'
    const cleanPath = rawPath.replace(/^\/+/, '')

    // Health / Discovery endpoint
    if (cleanPath === '' || cleanPath === 'health') {
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ status: 'ok', server: 'local-test-update-server', store: storeRoot }, null, 2))
      return
    }

    const filePath = join(storeRoot, cleanPath)

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not Found', path: cleanPath }))
      return
    }

    const stat = statSync(filePath)
    const ext = extname(filePath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    if (req.method === 'HEAD') {
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Content-Length': stat.size,
      })
      res.end()
      return
    }

    res.writeHead(200, {
      ...CORS_HEADERS,
      'Content-Type': contentType,
      'Content-Length': stat.size,
    })

    const stream = createReadStream(filePath)
    stream.pipe(res)
  })

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.listen(targetPort, host, () => resolvePromise())
    server.on('error', rejectPromise)
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : targetPort
  const url = `http://${host}:${port}`

  return {
    port,
    host,
    url,
    server,
    setSimulateFailure: (fail: boolean) => {
      simulateFailure = fail
    },
    setDelayMs: (ms: number) => {
      delayMs = ms
    },
    close: async () => {
      await new Promise<void>((resolveClose) => {
        server.close(() => resolveClose())
      })
    },
  }
}

// CLI execution check
const isCli = process.argv[1] && (
  process.argv[1].endsWith('start-server.ts')
  || process.argv[1].endsWith('start-server.js')
)

if (isCli) {
  const args = process.argv.slice(2)
  const portIdx = args.indexOf('--port')
  const port = portIdx !== -1 ? Number(args[portIdx + 1]) : 6123
  const storeIdx = args.indexOf('--store')
  const storeDir = storeIdx !== -1 ? args[storeIdx + 1] : join(process.cwd(), 'out', 'update-store')

  startTestServer({ port, storeDir }).then(({ url }) => {
    console.log(`[test-updater] Local update server listening at: ${url}`)
    console.log(`[test-updater] Serving release store from: ${resolve(storeDir)}`)
  }).catch((err) => {
    console.error('[test-updater] Failed to start server:', err)
    process.exit(1)
  })
}

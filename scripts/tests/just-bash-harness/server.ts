import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import { handleStreamableHttp } from './src/mcp-server.ts'
import { SandboxManager } from './src/sandbox.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.join(__dirname, 'public')
const PORT = 5188

// Initialize in-memory POSIX bash sandbox manager
const sandbox = new SandboxManager()
await sandbox.init()

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // API: Exec command inside the in-memory POSIX sandbox
  if (req.method === 'POST' && url.pathname === '/api/exec') {
    let body = ''
    req.on('data', chunk => (body += chunk))
    req.on('end', async () => {
      try {
        const { command } = JSON.parse(body || '{}')
        if (!command) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Command is required' }))
          return
        }
        const result = await sandbox.exec(command)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      }
      catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // API: Reset sandbox to clean seeded state
  if (req.method === 'POST' && url.pathname === '/api/reset') {
    await sandbox.reset()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  // API: Read file from in-memory POSIX filesystem (/workspace)
  if (req.method === 'GET' && url.pathname === '/api/fs/read') {
    const filePath = url.searchParams.get('path')
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing path query parameter' }))
      return
    }
    try {
      const content = await sandbox.readFile(filePath)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, path: filePath, content }))
    }
    catch (err: any) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // Remote MCP Server (Streamable HTTP)
  if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
    await handleStreamableHttp(req, res)
    return
  }

  // Static File Serving
  if (req.method === 'GET' || req.method === 'HEAD') {
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname
    // Prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '')
    const fullPath = path.join(PUBLIC_DIR, filePath)

    try {
      const stats = await fs.stat(fullPath)
      if (stats.isFile()) {
        const ext = path.extname(fullPath).toLowerCase()
        const contentType = MIME_TYPES[ext] || 'application/octet-stream'
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
        })
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        const content = await fs.readFile(fullPath)
        res.end(content)
        return
      }
    }
    catch {
      // Fall through to 404
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not Found')
})

server.listen(PORT, () => {
  console.log(`\n🚀 [Project AIRI] Decomposed Just-Bash Harness running at: http://localhost:${PORT}\n`)
})

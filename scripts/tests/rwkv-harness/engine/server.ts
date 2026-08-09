/**
 * Static file server for the WebGPU bridge webroot.
 *
 * Exists for two reasons:
 *  1. Chrome refuses to `import()` ES modules / `fetch()` wasm from `file://`,
 *     so the bridge page must be served over HTTP.
 *  2. The 364 MB base-model safetensors is served to the page via HTTP (with
 *     Range support, mirroring production `buildReader` in
 *     `packages/stage-ui/src/workers/web-rwkv/worker.ts`). Pushing the model
 *     through the CDP `Runtime.evaluate` bridge as base64 (~486 MB) blows the
 *     protocol message-size cap and kills the tab — confirmed by spike — so the
 *     model is fetched by the page, and only tiny prompt/result strings cross
 *     the bridge.
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.safetensors': 'application/octet-stream',
  '.state': 'application/octet-stream',
}

export interface ServedDir {
  /** Base URL of the ephemeral server, e.g. `http://127.0.0.1:55568`. */
  baseUrl: string
  port: number
  close: () => Promise<void>
}

/**
 * Serve the given set of absolute file paths plus a webroot directory over an
 * ephemeral localhost HTTP server. Files are mapped by their basename under
 * `/models/` (for binary blobs) and the webroot is served at `/`.
 */
export function startStaticServer(webroot: string, modelFiles: Record<string, string>): Promise<ServedDir> {
  const root = path.resolve(webroot)

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])

    // Binary model blobs (model.safetensors etc.) served with Range support.
    if (urlPath.startsWith('/models/')) {
      const name = path.basename(urlPath)
      const abs = modelFiles[name]
      if (!abs || !fs.existsSync(abs)) {
        res.writeHead(404); res.end('not found'); return
      }
      const stat = fs.statSync(abs)
      const range = req.headers.range
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range)
        if (m) {
          const start = Number(m[1])
          const end = m[2] ? Number(m[2]) : stat.size - 1
          res.writeHead(206, {
            'content-type': 'application/octet-stream',
            'content-length': end - start + 1,
            'content-range': `bytes ${start}-${end}/${stat.size}`,
            'accept-ranges': 'bytes',
          })
          fs.createReadStream(abs, { start, end }).pipe(res)
          return
        }
      }
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'content-length': stat.size,
        'accept-ranges': 'bytes',
      })
      fs.createReadStream(abs).pipe(res)
      return
    }

    // Webroot static assets.
    const rel = urlPath === '/' ? '/index.html' : urlPath
    const fp = path.join(root, rel)
    if (!fp.startsWith(root) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
      res.writeHead(404); res.end('not found'); return
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' })
    fs.createReadStream(fp).pipe(res)
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        port,
        close: () => new Promise<void>(res => server.close(() => res())),
      })
    })
  })
}

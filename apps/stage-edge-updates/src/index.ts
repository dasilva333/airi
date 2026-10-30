export interface Env {
  UPDATES_BUCKET: R2Bucket
  METRICS: KVNamespace
  UPLOAD_SECRET?: string
}

function getContentType(pathname: string): string {
  if (pathname.endsWith('.json'))
    return 'application/json; charset=utf-8'
  if (pathname.endsWith('.tar.gz') || pathname.endsWith('.tgz'))
    return 'application/gzip'
  if (pathname.endsWith('.sig') || pathname.endsWith('.sha256'))
    return 'text/plain; charset=utf-8'
  if (pathname.endsWith('.yaml') || pathname.endsWith('.yml'))
    return 'text/yaml; charset=utf-8'
  if (pathname.endsWith('.exe'))
    return 'application/x-msdownload'
  if (pathname.endsWith('.dmg'))
    return 'application/x-apple-diskimage'
  if (pathname.endsWith('.deb'))
    return 'application/vnd.debian.binary-package'
  if (pathname.endsWith('.rpm'))
    return 'application/x-rpm'
  if (pathname.endsWith('.AppImage'))
    return 'application/x-executable'
  if (pathname.endsWith('.zip'))
    return 'application/zip'
  return 'application/octet-stream'
}

function getCacheControl(pathname: string): string {
  // Manifests change when releases occur, keep edge cache fresh (60 seconds)
  if (pathname.startsWith('channels/') || pathname.endsWith('.json') || pathname.endsWith('.yml') || pathname.endsWith('.yaml')) {
    return 'public, max-age=60, s-maxage=60'
  }
  // Bundles and installers have immutable content hashes, cache aggressively (1 year)
  if (pathname.startsWith('bundles/') || pathname.endsWith('.tar.gz') || pathname.endsWith('.sig')) {
    return 'public, max-age=31536000, immutable'
  }
  return 'public, max-age=300'
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, If-None-Match, Authorization',
  'Access-Control-Max-Age': '86400',
}

async function incrementCounter(kv: KVNamespace, key: string, by = 1): Promise<number> {
  const current = Number.parseInt((await kv.get(key)) || '0', 10) || 0
  const updated = current + by
  await kv.put(key, updated.toString())
  return updated
}

async function recordTelemetry(request: Request, key: string, env: Env) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const country = (request as any).cf?.country || 'Unknown'
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    // Increment overall hits
    await Promise.allSettled([
      incrementCounter(env.METRICS, 'hits:total'),
      incrementCounter(env.METRICS, `hits:date:${today}`),
      env.METRICS.put('telemetry:last_seen', JSON.stringify({
        timestamp: new Date().toISOString(),
        key,
        country,
        userAgent: userAgent.slice(0, 120),
      })),
    ])

    // Route-specific metrics
    if (key.startsWith('channels/')) {
      const channel = key.replace(/^channels\//, '').replace(/\.json$/, '')
      await Promise.allSettled([
        incrementCounter(env.METRICS, `channels:${channel}:hits`),
        incrementCounter(env.METRICS, 'channels:total_checks'),
      ])
    }
    else if (key.startsWith('bundles/')) {
      const bundle = key.replace(/^bundles\//, '')
      await Promise.allSettled([
        incrementCounter(env.METRICS, `bundles:${bundle}:downloads`),
        incrementCounter(env.METRICS, 'bundles:total_downloads'),
      ])
    }
    else if (key.startsWith('installers/')) {
      const installer = key.replace(/^installers\//, '')
      await Promise.allSettled([
        incrementCounter(env.METRICS, `installers:${installer}:downloads`),
        incrementCounter(env.METRICS, 'installers:total_downloads'),
      ])
    }
  }
  catch (e) {
    console.error('Failed to record telemetry:', e)
  }
}

async function getStats(env: Env): Promise<Response> {
  const today = new Date().toISOString().slice(0, 10)
  const [
    totalHits,
    todayHits,
    totalChecks,
    totalDownloads,
    stableHits,
    canaryHits,
    devHits,
    nightlyHits,
    lastSeenRaw,
  ] = await Promise.all([
    env.METRICS.get('hits:total'),
    env.METRICS.get(`hits:date:${today}`),
    env.METRICS.get('channels:total_checks'),
    env.METRICS.get('bundles:total_downloads'),
    env.METRICS.get('channels:stable:hits'),
    env.METRICS.get('channels:canary:hits'),
    env.METRICS.get('channels:dev:hits'),
    env.METRICS.get('channels:nightly:hits'),
    env.METRICS.get('telemetry:last_seen'),
  ])

  let lastSeen = null
  if (lastSeenRaw) {
    try {
      lastSeen = JSON.parse(lastSeenRaw)
    }
    catch {}
  }

  const stats = {
    overview: {
      totalHits: Number.parseInt(totalHits || '0', 10),
      todayHits: Number.parseInt(todayHits || '0', 10),
      totalUpdateChecks: Number.parseInt(totalChecks || '0', 10),
      totalBundleDownloads: Number.parseInt(totalDownloads || '0', 10),
    },
    channels: {
      stable: Number.parseInt(stableHits || '0', 10),
      canary: Number.parseInt(canaryHits || '0', 10),
      dev: Number.parseInt(devHits || '0', 10),
      nightly: Number.parseInt(nightlyHits || '0', 10),
    },
    lastActivity: lastSeen,
    serverTime: new Date().toISOString(),
  }

  return new Response(JSON.stringify(stats, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      ...CORS_HEADERS,
    },
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      })
    }

    // Authenticated upload endpoint for OTA releases
    if (request.method === 'PUT') {
      const authHeader = request.headers.get('Authorization') || ''
      const token = authHeader.replace(/^Bearer\s+/i, '')
      const expectedSecret = env.UPLOAD_SECRET || 'airi-ota-secret-20261028'

      if (token !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        })
      }

      const key = url.pathname.replace(/^\/+/, '')
      if (!key) {
        return new Response(JSON.stringify({ error: 'Missing key' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        })
      }

      const body = request.body
      if (!body) {
        return new Response(JSON.stringify({ error: 'Missing body' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        })
      }

      await env.UPDATES_BUCKET.put(key, body, {
        httpMetadata: {
          contentType: getContentType(key),
        },
      })

      return new Response(JSON.stringify({ status: 'uploaded', key }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      })
    }

    const key = url.pathname.replace(/^\/+/, '')

    // Metrics / Stats endpoint
    if (key === 'stats' || key === 'metrics') {
      return getStats(env)
    }

    // Health / Discovery check
    if (key === '' || key === 'health') {
      const [totalHits, totalDownloads] = await Promise.all([
        env.METRICS.get('hits:total'),
        env.METRICS.get('bundles:total_downloads'),
      ])

      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'airi-updates-feed',
          bucket: 'airi-updates',
          timestamp: new Date().toISOString(),
          channels: ['stable', 'canary', 'dev', 'nightly'],
          metrics: {
            totalHits: Number.parseInt(totalHits || '0', 10),
            totalBundleDownloads: Number.parseInt(totalDownloads || '0', 10),
          },
        }, null, 2),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
            ...CORS_HEADERS,
          },
        },
      )
    }

    // Non-blocking telemetry tracking via waitUntil
    if (request.method === 'GET') {
      ctx.waitUntil(recordTelemetry(request, key, env))
    }

    try {
      const isHead = request.method === 'HEAD'
      const range = request.headers.get('range') ?? undefined

      if (isHead) {
        const head = await env.UPDATES_BUCKET.head(key)
        if (!head) {
          return new Response(JSON.stringify({ error: 'Not Found', key }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        const headers = new Headers({
          ...CORS_HEADERS,
          'Content-Type': head.httpMetadata?.contentType || getContentType(key),
          'Content-Length': head.size.toString(),
          'ETag': head.httpEtag,
          'Cache-Control': getCacheControl(key),
        })

        return new Response(null, { status: 200, headers })
      }

      // Check conditional If-None-Match first
      const ifNoneMatch = request.headers.get('if-none-match')
      if (ifNoneMatch) {
        const head = await env.UPDATES_BUCKET.head(key)
        if (head && (head.httpEtag === ifNoneMatch || head.etag === ifNoneMatch)) {
          return new Response(null, {
            status: 304,
            headers: {
              ...CORS_HEADERS,
              'ETag': head.httpEtag,
              'Cache-Control': getCacheControl(key),
            },
          })
        }
      }

      const getOptions: any = {}
      if (range) {
        getOptions.range = request.headers
      }

      const object = await env.UPDATES_BUCKET.get(key, getOptions)

      if (!object) {
        return new Response(JSON.stringify({ error: 'Not Found', key }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        })
      }

      // Check if conditional request was satisfied (304 Not Modified)
      if (!('body' in object) || object.body === null) {
        return new Response(null, {
          status: 304,
          headers: {
            ...CORS_HEADERS,
            'ETag': object.httpEtag,
            'Cache-Control': getCacheControl(key),
          },
        })
      }

      const headers = new Headers({
        ...CORS_HEADERS,
        'Content-Type': object.httpMetadata?.contentType || getContentType(key),
        'ETag': object.httpEtag,
        'Cache-Control': getCacheControl(key),
      })

      // Handle Range response
      if (object.range) {
        const offset = 'offset' in object.range ? object.range.offset : undefined
        const length = 'length' in object.range ? object.range.length : undefined
        if (typeof offset === 'number' && typeof length === 'number') {
          const start = offset
          const end = offset + length - 1
          headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`)
          headers.set('Content-Length', length.toString())
        }
        return new Response(object.body, { status: 206, headers })
      }

      headers.set('Content-Length', object.size.toString())
      return new Response(object.body, { status: 200, headers })
    }
    catch (err: any) {
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: err?.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      })
    }
  },
}

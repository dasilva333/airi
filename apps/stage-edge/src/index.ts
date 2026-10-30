/**
 * Main Cloudflare Worker fetch event handler & router for @proj-airi/stage-edge.
 */

import { verifyDiscordSignature } from './crypto/ed25519'
import { jsonResponse } from './discord/client'
import { EMBASSY_DO_ID_NAME } from './embassy/embassy-do'
import { generateLlmReply } from './inference/llm'
import { buildSystemInstruction } from './templates/character'

export { DiscordHostDO } from './discord/discord-host-do'
export { EmbassyDO } from './embassy/embassy-do'

export const DISCORD_HOST_DO_NAME = 'default-discord-host'

export interface Env {
  LLM_API_KEY: string
  LLM_MODEL?: string
  LLM_BASE_URL?: string
  DISCORD_PUBLIC_KEY: string
  DISCORD_BOT_TOKEN?: string
  SYSTEM_PROMPT?: string
  CHARACTER_NAME?: string
  MEMORY?: KVNamespace
  COMPANION_PUBLIC_KEY?: string
  COMPANION_TAGLINE?: string
  COMPANION_AVATAR_URL?: string
  OWNER_ID?: string
  EMBASSY?: DurableObjectNamespace
  DISCORD_HOST?: DurableObjectNamespace
  ALLOWED_CHANNEL_ID?: string
}

const MAX_INTRO_MESSAGE_LENGTH = 100
const MAX_TAGLINE_MESSAGE_LENGTH = 140
const SIGNATURE_DRIFT_SEC = 300
const NONCE_TTL_SEC = 600
const INVITE_TTL_SEC = 86400

function sanitizeIntroMessage(input?: unknown): string {
  const text = typeof input === 'string' ? input : ''
  return text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, MAX_INTRO_MESSAGE_LENGTH)
}

function sanitizeTaglineMessage(input?: unknown): string {
  const text = typeof input === 'string' ? input : ''
  return text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, MAX_TAGLINE_MESSAGE_LENGTH)
}

function isHex64(value?: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value)
}

async function verifyEd25519Message(publicKeyHex: string, signatureHex: string, message: string): Promise<boolean> {
  try {
    const { hexToUint8Array } = await import('./crypto/ed25519')
    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const keyData = hexToUint8Array(publicKeyHex)
    const signatureData = hexToUint8Array(signatureHex)
    const key = await crypto.subtle.importKey('raw', keyData.buffer as BufferSource, 'Ed25519', false, ['verify'])
    return await crypto.subtle.verify('Ed25519', key, signatureData.buffer as BufferSource, data.buffer as BufferSource)
  }
  catch {
    return false
  }
}

async function consumeNonce(env: Env, nonce: string): Promise<boolean> {
  if (!env.MEMORY || !nonce || nonce.length < 8 || nonce.length > 128)
    return false
  const key = `friends/nonces/${nonce}`
  try {
    const seen = await env.MEMORY.get(key)
    if (seen)
      return false
    await env.MEMORY.put(key, '1', { expirationTtl: NONCE_TTL_SEC })
    return true
  }
  catch {
    return false
  }
}

function isTimestampFresh(timestamp: unknown): timestamp is number {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp))
    return false
  return Math.abs(Date.now() - timestamp) <= SIGNATURE_DRIFT_SEC * 1000
}

function getEmbassyStub(env: Env): DurableObjectStub | null {
  try {
    if (!env.EMBASSY)
      return null
    return env.EMBASSY.get(env.EMBASSY.idFromName(EMBASSY_DO_ID_NAME))
  }
  catch {
    return null
  }
}

async function callEmbassy(path: string, stub: DurableObjectStub, body: unknown): Promise<{ ok: boolean, status: number, data: any }> {
  try {
    const res = await stub.fetch(`https://embassy${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    let data: any = null
    try {
      data = await res.json()
    }
    catch {}
    return { ok: res.ok, status: res.status, data }
  }
  catch {
    return { ok: false, status: 502, data: { error: 'embassy_unreachable' } }
  }
}

export interface ExecutionContext {
  waitUntil: (promise: Promise<any>) => void
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight for all endpoints
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', worker: '@proj-airi/stage-edge' }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Generic Web CORS Reverse-Proxy endpoint (/cors-proxy?url=... or /proxy?url=...)
    if (url.pathname === '/cors-proxy' || url.pathname === '/proxy') {
      const targetUrl = url.searchParams.get('url') || request.headers.get('x-target-url')
      if (!targetUrl) {
        return jsonResponse(
          { error: 'Missing target URL parameter. Example: /cors-proxy?url=https://api.cloudflare.com/client/v4/user' },
          { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
        )
      }

      try {
        const parsedTarget = new URL(targetUrl)
        const targetHost = parsedTarget.hostname.toLowerCase()

        if (
          targetHost === 'localhost'
          || targetHost === '127.0.0.1'
          || targetHost === '0.0.0.0'
          || targetHost === '::1'
          || targetHost.endsWith('.local')
          || targetHost.endsWith('.internal')
        ) {
          return jsonResponse(
            { error: 'Cannot proxy loopback or local network addresses through edge proxy.' },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
          )
        }
        const forwardHeaders = new Headers(request.headers)
        forwardHeaders.delete('host')
        forwardHeaders.delete('referer')
        forwardHeaders.delete('origin')
        forwardHeaders.delete('x-target-url')

        // Map custom target authorization header if provided
        const customAuth = request.headers.get('x-target-authorization')
        if (customAuth) {
          forwardHeaders.set('Authorization', customAuth)
          forwardHeaders.delete('x-target-authorization')
        }

        const upstreamRes = await fetch(parsedTarget.toString(), {
          method: request.method,
          headers: forwardHeaders,
          body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : undefined,
          redirect: 'follow',
        })

        const responseHeaders = new Headers(upstreamRes.headers)
        responseHeaders.set('Access-Control-Allow-Origin', '*')
        responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        responseHeaders.set('Access-Control-Allow-Headers', '*')

        return new Response(upstreamRes.body, {
          status: upstreamRes.status,
          statusText: upstreamRes.statusText,
          headers: responseHeaders,
        })
      }
      catch (err: any) {
        return jsonResponse(
          { error: `Upstream fetch failed: ${err?.message || err}` },
          { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } },
        )
      }
    }

    // Handle Discord interaction webhooks
    if (request.method === 'POST' && url.pathname === '/discord') {
      const bodyText = await request.text()

      // Discord requires ALL incoming webhook requests (including Type 1 PING) to pass Ed25519 signature verification
      const isValid = await verifyDiscordSignature(request, bodyText, env.DISCORD_PUBLIC_KEY)
      if (!isValid) {
        return new Response('Invalid signature', { status: 401 })
      }

      let interaction: any = null
      try {
        interaction = JSON.parse(bodyText)
      }
      catch {}

      // Discord PING verification (Type 1)
      if (interaction?.type === 1) {
        return jsonResponse({ type: 1 })
      }

      // Application command interaction (Type 2)
      if (interaction.type === 2) {
        const options = interaction.data?.options || []
        const messageOpt = options.find((o: any) => o.name === 'message')
        const userPrompt = messageOpt?.value || options[0]?.value || 'Hello!'

        let systemPrompt = env.SYSTEM_PROMPT
        if (env.MEMORY) {
          try {
            const kvPrompt = await env.MEMORY.get('system/prompt')
            if (kvPrompt) {
              systemPrompt = kvPrompt
            }
          }
          catch {}
        }

        const systemInstruction = buildSystemInstruction({
          name: env.CHARACTER_NAME || 'AIRI',
          personality: 'Kind, supportive, witty AI companion.',
          systemPrompt,
        })

        // Fetch rolling memory history from Cloudflare KV if available
        let history: Array<{ role: string, content: string }> = []
        if (env.MEMORY) {
          try {
            const rawHistory = await env.MEMORY.get('context/rolling')
            if (rawHistory) {
              const parsed = JSON.parse(rawHistory)
              if (Array.isArray(parsed)) {
                history = parsed
              }
            }
          }
          catch {}
        }

        const appId = interaction.application_id
        const token = interaction.token

        const doInferenceAndReply = async () => {
          try {
            const reply = await generateLlmReply({
              prompt: userPrompt,
              systemInstruction,
              history,
              model: env.LLM_MODEL,
              apiKey: env.LLM_API_KEY,
              baseUrl: env.LLM_BASE_URL,
              sessionId: interaction.channel_id ? `discord-channel-${interaction.channel_id}` : undefined,
            })

            // Append new turn to rolling history and save back to KV
            if (env.MEMORY) {
              try {
                history.push({ role: 'user', content: userPrompt })
                history.push({ role: 'assistant', content: reply })
                if (history.length > 50) {
                  history = history.slice(-50)
                }
                await env.MEMORY.put('context/rolling', JSON.stringify(history))
              }
              catch {}
            }

            // Edit original Discord interaction thinking message via webhook PATCH
            if (appId && token) {
              const patchUrl = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`

              // Discord limits message content to 2000 characters maximum
              let safeContent = reply
              if (safeContent.length > 2000) {
                safeContent = `${safeContent.slice(0, 1930)}\n\n*(Truncated to fit Discord 2000-character limit)*`
              }

              const res = await fetch(patchUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: safeContent }),
              })

              if (!res.ok) {
                const errText = await res.text()
                console.error(`[Discord PATCH Error] HTTP ${res.status}: ${errText}`)
              }
            }
          }
          catch (err: any) {
            if (appId && token) {
              const patchUrl = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`
              await fetch(patchUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: `⚠️ Edge Inference Error: ${err.message} | baseUrl=${env.LLM_BASE_URL} | model=${env.LLM_MODEL}`,
                }),
              })
            }
          }
        }

        const channelId = interaction.channel_id || interaction.channel?.id
        if (env.DISCORD_HOST && channelId) {
          const hostStub = env.DISCORD_HOST.get(env.DISCORD_HOST.idFromName(DISCORD_HOST_DO_NAME))
          const wakePromise = hostStub.fetch('http://internal/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activeChannelId: channelId }),
          }).catch((err: any) => console.warn('[Stage-Edge] Failed to wake DiscordHostDO:', err))

          if (ctx?.waitUntil) {
            ctx.waitUntil(wakePromise)
          }
        }

        if (ctx?.waitUntil) {
          ctx.waitUntil(doInferenceAndReply())
          return jsonResponse({ type: 5 })
        }
        else {
          await doInferenceAndReply()
          return jsonResponse({ type: 5 })
        }
      }
    }

    // Discord Gateway DO control & query routes
    if (url.pathname.startsWith('/discord/gateway/') || url.pathname === '/discord/status' || url.pathname === '/discord/connect') {
      if (!env.DISCORD_HOST) {
        return jsonResponse({ error: 'DISCORD_HOST durable object not bound' }, { status: 501, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const hostStub = env.DISCORD_HOST.get(env.DISCORD_HOST.idFromName(DISCORD_HOST_DO_NAME))
      let targetPath = url.pathname
      if (url.pathname.startsWith('/discord/gateway/')) {
        targetPath = `/${url.pathname.slice('/discord/gateway/'.length)}`
      }
      else if (url.pathname.startsWith('/discord/')) {
        targetPath = `/${url.pathname.slice('/discord/'.length)}`
      }
      return hostStub.fetch(new Request(`http://internal${targetPath}${url.search}`, request))
    }

    // Companion embassy: hibernated WebSocket attachment (single DO per user).
    if (url.pathname === '/ws') {
      const ownerId = request.headers.get('x-owner-id') ?? url.searchParams.get('owner')
      if (!env.OWNER_ID || !ownerId || ownerId !== env.OWNER_ID) {
        return jsonResponse({ error: 'forbidden' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const embassyStub = getEmbassyStub(env)
      if (!embassyStub) {
        return jsonResponse({ error: 'embassy_not_configured' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      return embassyStub.fetch(request)
    }

    // Companion embassy: public ambassador card (single-character exposure only).
    if (request.method === 'GET' && url.pathname === '/api/companion/card') {
      return jsonResponse({
        name: env.CHARACTER_NAME || 'AIRI',
        avatarUrl: env.COMPANION_AVATAR_URL || null,
        tagline: env.COMPANION_TAGLINE || null,
        publicKey: env.COMPANION_PUBLIC_KEY || null,
      }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // Companion embassy: owner-only single-use invite mint (24h expiry).
    if (request.method === 'POST' && url.pathname === '/api/friends/invite') {
      if (!env.MEMORY) {
        return jsonResponse({ error: 'kv_not_configured' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const ownerId = request.headers.get('x-owner-id')
      if (!env.OWNER_ID || !ownerId || ownerId !== env.OWNER_ID) {
        return jsonResponse({ error: 'forbidden' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const invite = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`
      const createdAt = Date.now()
      try {
        await env.MEMORY.put(`friends/invites/${invite}`, JSON.stringify({ createdAt }), { expirationTtl: INVITE_TTL_SEC })
      }
      catch {
        return jsonResponse({ error: 'kv_write_failed' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const origin = new URL(request.url).origin
      return jsonResponse({
        invite,
        uri: `airi://pair?worker=${origin}&invite=${invite}`,
        expiresAt: createdAt + INVITE_TTL_SEC * 1000,
      }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // Companion embassy: public inbound friend request intake (pending quarantine).
    if (request.method === 'POST' && url.pathname === '/api/friends/request') {
      if (!env.MEMORY) {
        return jsonResponse({ error: 'kv_not_configured' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      let body: any = null
      try {
        body = await request.json()
      }
      catch {
        return jsonResponse({ error: 'invalid_json' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const introMessage = sanitizeIntroMessage(body?.introMessage)
      if (typeof body?.introMessage === 'string' && body.introMessage.length > MAX_INTRO_MESSAGE_LENGTH) {
        return jsonResponse({ error: 'intro_too_long' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      // Self-asserted public blurb: length-checked and sanitized, but intentionally
      // outside the Ed25519 payload (same class as the sender display name — the
      // recipient reviews it in the drawer before accepting).
      const fromTagline = sanitizeTaglineMessage(body?.fromTagline)
      if (typeof body?.fromTagline === 'string' && body.fromTagline.length > MAX_TAGLINE_MESSAGE_LENGTH) {
        return jsonResponse({ error: 'tagline_too_long' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const { fromHandle, fromPubkey, fromCharacterName, timestamp, nonce, signature, invite } = body ?? {}
      if (typeof fromHandle !== 'string' || !fromHandle || !isHex64(fromPubkey) || typeof fromCharacterName !== 'string' || !fromCharacterName) {
        return jsonResponse({ error: 'invalid_identity' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      if (!isTimestampFresh(timestamp) || typeof nonce !== 'string') {
        return jsonResponse({ error: 'stale_or_missing_timestamp' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      if (typeof signature !== 'string' || !signature) {
        return jsonResponse({ error: 'missing_signature' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      if (invite !== undefined) {
        if (typeof invite !== 'string' || !invite) {
          return jsonResponse({ error: 'invalid_invite' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
        }
        let stored: string | null = null
        try {
          stored = await env.MEMORY.get(`friends/invites/${invite}`)
        }
        catch {}
        if (!stored) {
          return jsonResponse({ error: 'invalid_invite' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
        }
      }
      if (!await consumeNonce(env, nonce)) {
        return jsonResponse({ error: 'replayed_nonce' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const payload = `${timestamp}:${nonce}:${introMessage}:${fromPubkey}`
      if (!await verifyEd25519Message(fromPubkey, signature, payload)) {
        return jsonResponse({ error: 'invalid_signature' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const record = {
        id,
        fromHandle,
        fromPubkey,
        fromCharacterName,
        introMessage,
        fromTagline,
        timestamp,
        nonce,
      }
      const embassyStub = getEmbassyStub(env)
      if (embassyStub) {
        const routed = await callEmbassy('/internal/friend-request', embassyStub, record)
        if (!routed.ok) {
          const status = routed.status === 400 ? 400 : 502
          return jsonResponse(routed.data ?? { error: 'embassy_unreachable' }, { status, headers: { 'Access-Control-Allow-Origin': '*' } })
        }
        return jsonResponse({ status: 'pending', id, pushed: routed.data?.pushed ?? 0 }, { headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      try {
        await env.MEMORY.put(`friends/requests/inbound/${id}`, JSON.stringify({
          ...record,
          status: 'pending',
        }))
      }
      catch {
        return jsonResponse({ error: 'kv_write_failed' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      return jsonResponse({ status: 'pending', id }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // Companion embassy: authenticated peer inbox relay (trusted senders only).
    if (request.method === 'POST' && url.pathname === '/api/friends/inbox') {
      if (!env.MEMORY) {
        return jsonResponse({ error: 'kv_not_configured' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const senderPubkey = request.headers.get('x-sender-pubkey')
      const signature = request.headers.get('x-signature-ed25519')
      const timestampHeader = request.headers.get('x-signature-timestamp')
      const nonce = request.headers.get('x-signature-nonce')
      const timestamp = timestampHeader ? Number(timestampHeader) : Number.NaN
      if (!isHex64(senderPubkey) || !signature || !isTimestampFresh(timestamp) || !nonce) {
        return jsonResponse({ error: 'unauthorized' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const bodyText = await request.text()
      if (!await consumeNonce(env, nonce)) {
        return jsonResponse({ error: 'replayed_nonce' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      if (!await verifyEd25519Message(senderPubkey, signature, `${timestamp}:${nonce}:${bodyText}`)) {
        return jsonResponse({ error: 'invalid_signature' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const inboxStub = getEmbassyStub(env)
      if (inboxStub) {
        let topic = 'unknown'
        try {
          const parsed = JSON.parse(bodyText)
          if (parsed && typeof parsed.topic === 'string' && parsed.topic)
            topic = parsed.topic
        }
        catch {}
        const routed = await callEmbassy('/internal/inbox', inboxStub, {
          senderPubkey,
          topic,
          payloadJson: bodyText,
          timestamp,
          nonce,
        })
        if (!routed.ok) {
          if (routed.status === 403)
            return jsonResponse({ error: 'quarantined' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } })
          return jsonResponse(routed.data ?? { error: 'embassy_unreachable' }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } })
        }
        return jsonResponse({ queued: true, pushed: routed.data?.pushed ?? 0 }, { headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      let accepted: string | null = null
      try {
        accepted = await env.MEMORY.get(`friends/accepted/${senderPubkey}`)
      }
      catch {}
      if (!accepted) {
        return jsonResponse({ error: 'quarantined' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      try {
        await env.MEMORY.put(`friends/inbox/${senderPubkey}/${timestamp}_${nonce}`, bodyText)
      }
      catch {
        return jsonResponse({ error: 'kv_write_failed' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      return jsonResponse({ queued: true }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // Companion embassy: owner-only trust grant. Moves a pending applicant to
    // `trusted`, unblocking their inbox. DO path writes trusted_peers + flips
    // friend_requests; KV fallback writes friends/accepted/{pubkey}.
    if (request.method === 'POST' && url.pathname === '/api/friends/accept') {
      if (!env.MEMORY) {
        return jsonResponse({ error: 'kv_not_configured' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const ownerId = request.headers.get('x-owner-id')
      if (!env.OWNER_ID || !ownerId || ownerId !== env.OWNER_ID) {
        return jsonResponse({ error: 'forbidden' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      let body: any = null
      try {
        body = await request.json()
      }
      catch {
        return jsonResponse({ error: 'invalid_json' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      if (!isHex64(body?.pubkey)) {
        return jsonResponse({ error: 'invalid_identity' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const acceptStub = getEmbassyStub(env)
      if (acceptStub) {
        const routed = await callEmbassy('/internal/accept', acceptStub, {
          pubkey: body.pubkey,
          handle: typeof body.handle === 'string' ? body.handle : '',
        })
        if (!routed.ok)
          return jsonResponse(routed.data ?? { error: 'embassy_unreachable' }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } })
        return jsonResponse({ trusted: true }, { headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      try {
        await env.MEMORY.put(`friends/accepted/${body.pubkey}`, JSON.stringify({
          handle: typeof body.handle === 'string' ? body.handle : '',
          acceptedAt: Date.now(),
        }))
      }
      catch {
        return jsonResponse({ error: 'kv_write_failed' }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      return jsonResponse({ trusted: true }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    return new Response('Not Found', { status: 404 })
  },
}

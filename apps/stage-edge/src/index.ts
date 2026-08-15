/**
 * Main Cloudflare Worker fetch event handler & router for @proj-airi/stage-edge.
 */

import { verifyDiscordSignature } from './crypto/ed25519'
import { jsonResponse } from './discord/client'
import { generateLlmReply } from './inference/llm'
import { buildSystemInstruction } from './templates/character'

export interface Env {
  LLM_API_KEY: string
  LLM_MODEL?: string
  LLM_BASE_URL?: string
  DISCORD_PUBLIC_KEY: string
  SYSTEM_PROMPT?: string
  CHARACTER_NAME?: string
  MEMORY?: KVNamespace
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

    return new Response('Not Found', { status: 404 })
  },
}

/**
 * Main Cloudflare Worker fetch event handler & router for @proj-airi/stage-edge.
 */

import { verifyDiscordSignature } from './crypto/ed25519'
import { jsonResponse } from './discord/client'
import { generateGeminiReply } from './inference/gemini'
import { buildSystemInstruction } from './templates/character'

export interface Env {
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
  DISCORD_PUBLIC_KEY: string
  SYSTEM_PROMPT?: string
  CHARACTER_NAME?: string
  MEMORY?: KVNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health check endpoint
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', worker: '@proj-airi/stage-edge' })
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
        const systemInstruction = buildSystemInstruction({
          name: env.CHARACTER_NAME || 'AIRI',
          personality: 'Kind, supportive, witty AI companion.',
          systemPrompt: env.SYSTEM_PROMPT,
        })

        try {
          const reply = await generateGeminiReply({
            prompt: userPrompt,
            systemInstruction,
            model: env.GEMINI_MODEL,
            apiKey: env.GEMINI_API_KEY,
          })

          return jsonResponse({
            type: 4,
            data: { content: reply },
          })
        }
        catch (err: any) {
          return jsonResponse({
            type: 4,
            data: { content: `⚠️ Edge Inference Error: ${err.message}` },
          })
        }
      }
    }

    return new Response('Not Found', { status: 404 })
  },
}

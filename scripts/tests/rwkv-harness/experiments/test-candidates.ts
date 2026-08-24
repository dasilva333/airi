/**
 * Test Candidates: Verifies exact model endpoints against the Artificial Analysis Leaderboard.
 */

import fs from 'node:fs'

const CANDIDATES_TO_VERIFY = [
  { name: 'Claude Opus 5', provider: 'orcarouter', model: 'anthropic/claude-opus-5' },
  { name: 'Claude Fable 5', provider: 'orcarouter', model: 'anthropic/claude-fable-5' },
  { name: 'Kimi K3 (max)', provider: 'opencode', model: 'kimi-k3' },
  { name: 'Kimi K3 (Kios)', provider: 'kios', model: 'kimi-k3' },
  { name: 'Grok 4.5/4.6', provider: 'seekai', model: 'grok-4.5' },
  { name: 'Gemini 3.7 Flash', provider: 'aihubmix', model: 'gemini-3.7-flash-free' },
  { name: 'Gemini Flash-Lite', provider: 'google', model: 'models/gemini-flash-lite-latest' },
  { name: 'DeepSeek V4 Pro 0813', provider: 'alibaba', model: 'deepseek-v4-pro-0813' },
  { name: 'DeepSeek V4 Pro', provider: 'iamhc', model: 'DeepSeek-V4-Pro' },
  { name: 'DeepSeek V4 Pro Free', provider: 'orcarouter', model: 'deepseek/deepseek-v4-pro-free' },
  { name: 'Muse Spark 1.2', provider: 'openrouter', model: 'meta/muse-spark-1.2-contributor' },
  { name: 'Nemotron 3 Ultra 550B', provider: 'kios', model: 'nemotron-3-ultra-550b-a55b' },
  { name: 'MiniMax M3', provider: 'opencode', model: 'minimax-m3' },
  { name: 'Qwen 3.8 27B', provider: 'alibaba', model: 'qwen3.8-27b' },
  { name: 'Qwen 3.8 27B Free', provider: 'orcarouter', model: 'qwen/qwen3.8-27b-free' },
  { name: 'Kat Coder Pro v2.5', provider: 'iamhc', model: 'kat-coder-pro-v2.5' },
  { name: 'Stealth Ox-Alpha', provider: 'openrouter', model: 'stealth/ox-alpha' },
]

async function main() {
  const creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8'))
  console.log('=== Verifying True Frontier Model Candidates ===\n')

  for (const c of CANDIDATES_TO_VERIFY) {
    const p = creds[c.provider]
    if (!p) {
      console.log(`✗ Provider ${c.provider} missing`)
      continue
    }

    const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`
    const t0 = Date.now()
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: c.model,
          messages: [{ role: 'user', content: 'Say hello in 3 words' }],
          max_tokens: 20,
        }),
      })

      const elapsed = Date.now() - t0
      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || ''
        console.log(`✓ [${c.provider}] ${c.name} (${c.model}) -> OK in ${elapsed}ms: "${text.trim().replace(/\n/g, ' ')}"`)
      }
      else {
        const err = await res.text()
        console.log(`✗ [${c.provider}] ${c.name} (${c.model}) -> HTTP ${res.status}: ${err.slice(0, 100)}`)
      }
    }
    catch (e: any) {
      console.log(`✗ [${c.provider}] ${c.name} (${c.model}) -> Error: ${e.message}`)
    }
  }
}

main().catch(console.error)

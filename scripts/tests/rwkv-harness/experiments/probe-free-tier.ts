/**
 * Probe 100% Free Tier Providers: Kios, SeekAI, NVIDIA NIM, OrcaRouter
 */

import fs from 'node:fs'

async function testEndpoint(providerName: string, p: any, model: string) {
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
        model,
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        max_tokens: 30,
      }),
      signal: AbortSignal.timeout(8000),
    })
    const latency = Date.now() - t0
    if (res.ok) {
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || ''
      console.log(`✓ [${providerName}] ${model} -> OK (${latency}ms): "${text.trim().replace(/\n/g, ' ')}"`)
      return true
    }
    else {
      const err = await res.text()
      console.log(`✗ [${providerName}] ${model} -> HTTP ${res.status}: ${err.slice(0, 150)}`)
      return false
    }
  }
  catch (e: any) {
    console.log(`✗ [${providerName}] ${model} -> Error: ${e.message}`)
    return false
  }
}

async function main() {
  const creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8'))
  console.log('=== Probing 100% Free Providers (Kios, SeekAI, NVIDIA, OrcaRouter) ===\n')

  // 1. KiosAPI
  console.log('-- KiosAPI --')
  for (const m of ['nemotron-3-ultra-550b-a55b', 'kimi-k3', 'minimax-m3', 'deepseek-v4-flash-0731']) {
    await testEndpoint('KiosAPI', creds.kios, m)
  }

  // 2. SeekAI
  console.log('\n-- SeekAI --')
  for (const m of ['deepseek/deepseek-v4-flash', 'grok-4.5', 'stealth/ox-alpha', 'z-ai/glm-5.2:free', 'deepseek-v4-flash']) {
    await testEndpoint('SeekAI', creds.seekai, m)
  }

  // 3. NVIDIA NIM
  console.log('\n-- NVIDIA NIM --')
  for (const m of ['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-r1', 'nvidia/llama-3.1-nemotron-70b-instruct', '01-ai/yi-large']) {
    await testEndpoint('NVIDIA NIM', creds.nvidia, m)
  }

  // 4. OrcaRouter
  console.log('\n-- OrcaRouter --')
  for (const m of ['qwen/qwen3.8-27b-free', 'deepseek/deepseek-v4-flash-free', 'orcarouter/free', 'orcarouter/auto']) {
    await testEndpoint('OrcaRouter', creds.orcarouter, m)
  }
}

main().catch(console.error)

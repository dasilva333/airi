/**
 * Diagnostic Probe: Inspects exact raw outputs and failure causes for each model.
 */

import fs from 'node:fs'

const PROMPT = `You are an expert generative artist. Complete the following p5.js sketch using p5.brush to paint "A single simple flower with soft pink petals, a warm yellow center, a thin vertical stem, and one small green leaf on a light background." as an expressive watercolor artwork.

RULES:
1. Paint shapes centered at (0,0) spanning -300..300.
2. Use watercolor washes: brush.fill(r,g,b,opacity), brush.bleed(0.1..0.4, "out"), brush.circle(x, y, radius), brush.rect(x, y, w, h), brush.line(x1, y1, x2, y2).
3. Do NOT declare setup() or draw(). You are already inside function setup().
4. Output ONLY JavaScript statements that paint the flower. Close the function with } at the end.

function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`

async function main() {
  const creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8'))
  const models = [
    { name: 'Gemini Flash-Lite', p: creds.google, model: 'models/gemini-flash-lite-latest' },
    { name: 'Ox-Alpha (OpenRouter)', p: creds.openrouter, model: 'stealth/ox-alpha' },
    { name: 'DeepSeek V4 Flash (iamhc)', p: creds.iamhc, model: 'DeepSeek-V4-Flash' },
    { name: 'DeepSeek V4 Flash (SeekAI)', p: creds.seekai, model: 'deepseek-v4-flash' },
    { name: 'Qwen 3.8 Free (OrcaRouter)', p: creds.orcarouter, model: 'qwen/qwen3.8-27b-free' },
  ]

  for (const m of models) {
    console.log(`\n======================================================`)
    console.log(`Diagnostic: ${m.name} (${m.model})`)
    console.log(`======================================================`)

    if (!m.p) {
      console.log(`✗ Provider config missing`)
      continue
    }

    const url = `${m.p.baseUrl.replace(/\/+$/, '')}/chat/completions`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${m.p.apiKey}`,
        },
        body: JSON.stringify({
          model: m.model,
          messages: [
            { role: 'system', content: 'You are an expert generative artist specializing in p5.js and p5.brush.' },
            { role: 'user', content: PROMPT },
          ],
          max_tokens: 1000,
        }),
      })

      const raw = await res.text()
      if (!res.ok) {
        console.log(`✗ HTTP ${res.status}: ${raw.slice(0, 300)}`)
        continue
      }

      const data = JSON.parse(raw)
      const choice = data.choices?.[0]
      const content = choice?.message?.content || choice?.text || ''
      console.log(`HTTP 200 OK. Content length: ${content.length} chars`)
      console.log(`Finish reason: ${choice?.finish_reason || 'N/A'}`)
      console.log(`--- Raw output snippet ---`)
      console.log(content.slice(0, 500))
      console.log(`--------------------------`)
    }
    catch (e: any) {
      console.log(`✗ Error: ${e.message}`)
    }
  }
}

main().catch(console.error)

/**
 * Provider Probe: Queries /models across all configured providers.
 */

import fs from 'node:fs'
import path from 'node:path'

async function probe() {
  const credsPath = path.resolve(process.cwd(), 'credentials.json')
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))

  console.log('=== Probing Provider Endpoints for Available Models ===\n')

  for (const [key, p] of Object.entries<any>(creds)) {
    console.log(`\n------------------------------------------------------`)
    console.log(`[${key}] ${p.name} (${p.baseUrl})`)
    console.log(`------------------------------------------------------`)

    const url = `${p.baseUrl.replace(/\/+$/, '')}/models`
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${p.apiKey}`,
        },
      })
      if (!res.ok) {
        console.log(`  ✗ HTTP ${res.status}: ${res.statusText}`)
        continue
      }
      const data = await res.json()
      const models = data.data || data.models || data
      if (Array.isArray(models)) {
        console.log(`  ✓ Found ${models.length} models. Sample:`)
        const sample = models.slice(0, 8).map((m: any) => m.id || m.name || m)
        console.log(`    ${sample.join(', ')}`)
      }
      else {
        console.log(`  ✓ Response object:`, Object.keys(data))
      }
    }
    catch (err: any) {
      console.log(`  ✗ Error probing: ${err.message}`)
    }
  }
}

probe().catch(console.error)

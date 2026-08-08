#!/usr/bin/env npx tsx
/**
 * KV Inspection & Dissection Tool for @proj-airi/stage-edge.
 *
 * Programmatically connects to Cloudflare via REST API / SDK using credentials in .env,
 * lists all KV namespaces & keys, downloads the raw memory payloads (e.g. context/rolling),
 * and formats them for review & analysis before local sync ingestion.
 *
 * Usage (from monorepo root):
 *   npx tsx apps/stage-edge/scripts/inspect-kv.ts [scriptName]
 */

import fs from 'node:fs'
import path from 'node:path'

import { Cloudflare } from 'cloudflare'

// ── Load .env ────────────────────────────────────────────────────────────────

function loadEnvFile(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), 'apps/stage-edge/.env'),
    path.resolve(process.cwd(), '.env'),
  ]
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const vars: Record<string, string> = {}
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const val = match[2].trim().replace(/^["']|["']$/g, '')
          vars[key] = val
          if (!process.env[key])
            process.env[key] = val
        }
      }
      return vars
    }
  }
  throw new Error('No .env file found')
}

async function main() {
  const env = loadEnvFile()
  const apiToken = env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN

  if (!apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN is missing!')
  }

  const client = new Cloudflare({ apiToken })

  console.info('\n======================================================')
  console.info('   🔍 AIRI Stage Edge: Cloudflare KV Memory Inspector')
  console.info('======================================================\n')

  // 1. Resolve target account
  let accountId = env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) {
    for await (const account of client.accounts.list()) {
      accountId = account.id
      console.info(`✓ Resolved Cloudflare Account: "${account.name}" (${accountId})`)
      break
    }
  }

  if (!accountId) {
    throw new Error('Could not resolve Cloudflare Account ID.')
  }

  // 2. Find target KV namespace(s)
  const targetName = process.argv[2] || 'airi-baseline-test'
  const targetTitle = `airi-kv-${targetName}`

  console.info(`\nSearching for KV namespaces matching "${targetTitle}"...\n`)

  const namespaces: Array<{ id: string, title: string }> = []
  for await (const ns of client.kv.namespaces.list({ account_id: accountId })) {
    if (ns.title.includes('airi-kv') || ns.title === targetTitle) {
      namespaces.push({ id: ns.id, title: ns.title })
    }
  }

  if (namespaces.length === 0) {
    console.warn(`⚠️ No KV namespaces found matching "${targetTitle}". Available namespaces listed above.`)
    process.exit(1)
  }

  const dump: Record<string, any> = {}

  for (const ns of namespaces) {
    console.info(`------------------------------------------------------`)
    console.info(`📦 Namespace: "${ns.title}" (ID: ${ns.id})`)
    console.info(`------------------------------------------------------`)

    const nsDump: Record<string, any> = {}

    // List all keys in this namespace
    const keys: string[] = []
    for await (const keyObj of client.kv.namespaces.keys.list(ns.id, { account_id: accountId })) {
      keys.push(keyObj.name)
    }

    console.info(`Found ${keys.length} key(s): ${keys.map(k => `"${k}"`).join(', ')}\n`)

    for (const key of keys) {
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${ns.id}/values/${encodeURIComponent(key)}`,
          {
            headers: { Authorization: `Bearer ${apiToken}` },
          },
        )

        if (!res.ok) {
          console.warn(`  ❌ Key "${key}" fetch failed -> HTTP ${res.status}`)
          continue
        }

        const rawText = await res.text()
        let parsedValue: any = rawText

        try {
          parsedValue = JSON.parse(rawText)
        }
        catch {}

        nsDump[key] = parsedValue

        console.info(`  🔑 Key: "${key}"`)
        if (Array.isArray(parsedValue)) {
          console.info(`     Type: Array (${parsedValue.length} items)`)
          console.info(`     Dialogue Breakdown:`)
          parsedValue.forEach((item, idx) => {
            const roleStr = item.role ? `[${item.role.toUpperCase()}]` : '[UNKNOWN]'
            const contentPreview = typeof item.content === 'string'
              ? (item.content.length > 90 ? `${item.content.slice(0, 90)}...` : item.content)
              : JSON.stringify(item.content)
            console.info(`       ${idx + 1}. ${roleStr.padEnd(12)}: ${contentPreview}`)
          })
        }
        else if (typeof parsedValue === 'object' && parsedValue !== null) {
          console.info(`     Type: Object (${Object.keys(parsedValue).length} fields)`)
          console.info(`     Raw Payload:`, JSON.stringify(parsedValue, null, 2))
        }
        else {
          console.info(`     Value: "${rawText}"`)
        }
        console.info('')
      }
      catch (err: any) {
        console.warn(`  ❌ Error reading key "${key}":`, err.message)
      }
    }

    dump[ns.title] = nsDump
  }

  // Save raw dump JSON file
  const dumpPath = path.resolve(process.cwd(), 'apps/stage-edge/scripts/kv-dump.json')
  fs.writeFileSync(dumpPath, JSON.stringify(dump, null, 2))
  console.info(`\n✅ Raw memory snapshot saved to: ${dumpPath}\n`)
}

main().catch((err) => {
  console.error('❌ KV Inspection Error:', err.message || err)
  process.exit(1)
})

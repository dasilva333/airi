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

// ── Load .env & Auto-Refresh Token ──────────────────────────────────────────

const CLOUDFLARE_OAUTH_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7'
const TOKEN_ENDPOINT = 'https://dash.cloudflare.com/oauth2/token'

function getEnvPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'apps/stage-edge/.env'),
    path.resolve(process.cwd(), '.env'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p))
      return p
  }
  throw new Error('No .env file found')
}

function loadEnvFile(): { envPath: string, vars: Record<string, string> } {
  const envPath = getEnvPath()
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
  return { envPath, vars }
}

async function refreshAccessToken(refreshToken: string, envPath: string): Promise<string> {
  console.info('🔄 Cloudflare Access Token expired or missing. Auto-refreshing via OAuth PKCE...')
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLOUDFLARE_OAUTH_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${await res.text()}`)
  }

  const tokenData: any = await res.json()
  const newAccessToken = tokenData.access_token
  const newRefreshToken = tokenData.refresh_token || refreshToken

  let content = fs.readFileSync(envPath, 'utf-8')
  if (content.includes('CLOUDFLARE_API_TOKEN=')) {
    content = content.replace(/CLOUDFLARE_API_TOKEN="[^"]*"/, `CLOUDFLARE_API_TOKEN="${newAccessToken}"`)
  }
  else {
    content += `\nCLOUDFLARE_API_TOKEN="${newAccessToken}"`
  }

  if (tokenData.refresh_token && content.includes('CLOUDFLARE_REFRESH_TOKEN=')) {
    content = content.replace(/CLOUDFLARE_REFRESH_TOKEN="[^"]*"/, `CLOUDFLARE_REFRESH_TOKEN="${newRefreshToken}"`)
  }

  fs.writeFileSync(envPath, content, 'utf-8')
  console.info('✓ Successfully refreshed OAuth token and updated .env!')
  return newAccessToken
}

async function main() {
  const { envPath, vars: env } = loadEnvFile()
  let apiToken = env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN
  const refreshToken = env.CLOUDFLARE_REFRESH_TOKEN || process.env.CLOUDFLARE_REFRESH_TOKEN

  if (!apiToken && refreshToken) {
    apiToken = await refreshAccessToken(refreshToken, envPath)
  }

  if (!apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_REFRESH_TOKEN are missing!')
  }

  let client = new Cloudflare({ apiToken })

  console.info('\n======================================================')
  console.info('   🔍 AIRI Stage Edge: Cloudflare KV Memory Inspector')
  console.info('======================================================\n')

  // 1. Resolve target account (with auto-refresh on 401/403)
  let accountId = env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) {
    try {
      for await (const account of client.accounts.list()) {
        accountId = account.id
        console.info(`✓ Resolved Cloudflare Account: "${account.name}" (${accountId})`)
        break
      }
    }
    catch (err: any) {
      if ((err?.status === 401 || err?.status === 403 || String(err).includes('Invalid access token')) && refreshToken) {
        apiToken = await refreshAccessToken(refreshToken, envPath)
        client = new Cloudflare({ apiToken })
        for await (const account of client.accounts.list()) {
          accountId = account.id
          console.info(`✓ Resolved Cloudflare Account: "${account.name}" (${accountId})`)
          break
        }
      }
      else {
        throw err
      }
    }
  }

  if (!accountId) {
    throw new Error('Could not resolve Cloudflare Account ID.')
  }

  // 2. Find target KV namespace(s)
  const targetName = process.argv[2] || ''

  console.info(`\nSearching for AIRI KV namespaces...\n`)

  const namespaces: Array<{ id: string, title: string }> = []
  for await (const ns of client.kv.namespaces.list({ account_id: accountId })) {
    if (ns.title.startsWith('airi-') || (targetName && ns.title.includes(targetName))) {
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

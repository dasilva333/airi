#!/usr/bin/env npx tsx
/**
 * Refresh-and-Deploy helper for @proj-airi/stage-edge.
 *
 * Reads CLOUDFLARE_REFRESH_TOKEN from .env, exchanges it for a fresh
 * access token, then runs the standard CLI deploy flow.
 *
 * Usage (from monorepo root):
 *   npx tsx apps/stage-edge/scripts/refresh-deploy.ts
 */

import fs from 'node:fs'
import path from 'node:path'

const CLOUDFLARE_OAUTH_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7'
const TOKEN_ENDPOINT = 'https://dash.cloudflare.com/oauth2/token'

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
      console.info(`✓ Loaded env from ${envPath}`)
      return vars
    }
  }
  throw new Error('No .env file found')
}

// ── Refresh Token ────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
  console.info('\n=== Refreshing Cloudflare OAuth Access Token ===\n')

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
    const errText = await res.text()
    throw new Error(`Token refresh failed -> HTTP ${res.status}: ${errText}`)
  }

  const data: any = await res.json()
  console.info(`✓ New access token acquired (expires in ${data.expires_in}s)`)

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
  }
}

// ── Deploy ───────────────────────────────────────────────────────────────────

async function deploy(apiToken: string) {
  // Dynamic import to reuse existing deployer
  const { CloudflareStageDeployer } = await import('../src/deployer/index')

  const deployer = new CloudflareStageDeployer({ apiToken, accountId: '' })
  const accounts = await deployer.getAccounts()

  if (accounts.length === 0) {
    throw new Error('No Cloudflare accounts found for this token.')
  }

  const accountId = accounts[0].id
  console.info(`✓ Using Cloudflare Account: ${accounts[0].name} (${accountId})`)

  const deployerWithAcc = new CloudflareStageDeployer({ apiToken, accountId })

  const result = await deployerWithAcc.deployWorker({
    scriptName: 'airi-baseline-test',
    characterPrompt: process.env.SYSTEM_PROMPT || 'You are AIRI, a friendly AI companion.',
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || '',
    llmModel: process.env.LLM_MODEL || '',
    discordBotToken: process.env.DISCORD_BOT_TOKEN,
    memoryMode: 'unlimited',
  })

  console.info(`\n🚀 Deployment complete! Live URL: ${result.workerUrl}\n`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const env = loadEnvFile()

  const refreshToken = env.CLOUDFLARE_REFRESH_TOKEN || process.env.CLOUDFLARE_REFRESH_TOKEN
  if (!refreshToken) {
    throw new Error('CLOUDFLARE_REFRESH_TOKEN is missing from .env')
  }

  // 1. Refresh the access token
  const tokens = await refreshAccessToken(refreshToken)

  // 2. Update .env with new tokens for next run
  const envPath = path.resolve(process.cwd(), 'apps/stage-edge/.env')
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf-8')
    content = content.replace(
      /^CLOUDFLARE_API_TOKEN=.*$/m,
      `CLOUDFLARE_API_TOKEN="${tokens.accessToken}"`,
    )
    if (tokens.refreshToken !== refreshToken) {
      content = content.replace(
        /^CLOUDFLARE_REFRESH_TOKEN=.*$/m,
        `CLOUDFLARE_REFRESH_TOKEN="${tokens.refreshToken}"`,
      )
    }
    fs.writeFileSync(envPath, content)
    console.info('✓ Updated .env with fresh tokens')
  }

  // 3. Deploy
  await deploy(tokens.accessToken)
}

main().catch((err) => {
  console.error('❌ Refresh-Deploy Error:', err.message || err)
  process.exit(1)
})

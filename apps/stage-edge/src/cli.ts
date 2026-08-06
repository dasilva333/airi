/**
 * CLI Facade for @proj-airi/stage-edge deployment and OAuth authorization helper.
 * Run via `npx airi-edge deploy` or `pnpm -F @proj-airi/stage-edge deploy`.
 */

import fs from 'node:fs'
import path from 'node:path'

import { CloudflareStageDeployer } from './deployer/index'

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), 'apps/stage-edge/.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const val = match[2].trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

async function runCli() {
  loadEnvFile()
  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  if (command === 'oauth' || command === 'auth') {
    const { loginWithCloudflareOAuth } = await import('./deployer/oauth')
    try {
      const tokens = await loginWithCloudflareOAuth()
      console.log('\n=== OAuth Tokens Successfully Captured! ===\n')
      console.log(`Access Token:  ${tokens.accessToken.slice(0, 15)}...`)
      console.log(`Refresh Token: ${tokens.refreshToken.slice(0, 15)}...`)
      console.log(`Expires In:    ${tokens.expiresIn} seconds\n`)
    }
    catch (err: any) {
      console.error('❌ OAuth Login Failed:', err.message)
      process.exit(1)
    }
    return
  }

  if (command === 'accounts' || command === 'account') {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    if (!apiToken) {
      console.error('❌ CLOUDFLARE_API_TOKEN is missing!')
      process.exit(1)
    }
    const deployer = new CloudflareStageDeployer({ apiToken, accountId: '' })
    const accounts = await deployer.getAccounts()
    console.log('\n=== Available Cloudflare Accounts ===\n')
    for (const acc of accounts) {
      console.log(`Account Name: ${acc.name} | ID: ${acc.id}`)
    }
    console.log('\nSet CLOUDFLARE_ACCOUNT_ID="<ID>" to target your account.\n')
    return
  }

  if (command === 'deploy') {
    console.log('\n=== AIRI Stage Edge: Baseline Automated Deployment ===\n')
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    let accountId = process.env.CLOUDFLARE_ACCOUNT_ID

    if (!apiToken) {
      console.error('❌ CLOUDFLARE_API_TOKEN is missing!')
      process.exit(1)
    }

    const deployer = new CloudflareStageDeployer({ apiToken, accountId: accountId || '' })

    if (!accountId) {
      const accounts = await deployer.getAccounts()
      if (accounts.length === 0) {
        console.error('❌ No Cloudflare accounts found for this token.')
        process.exit(1)
      }
      accountId = accounts[0].id
      console.info(`✓ Auto-selected Cloudflare Account: ${accounts[0].name} (${accountId})`)
      // Re-initialize with auto-selected account ID
      const deployerWithAcc = new CloudflareStageDeployer({ apiToken, accountId })
      const result = await deployerWithAcc.deployWorker({
        scriptName: 'airi-baseline-test',
        characterPrompt: 'You are AIRI Stage Edge Baseline Test.',
        geminiApiKey: process.env.GEMINI_API_KEY || 'demo_gemini_key',
        discordBotToken: process.env.DISCORD_BOT_TOKEN,
        memoryMode: 'unlimited',
      })
      console.log(`\n🚀 Deployment complete! Live URL: ${result.workerUrl}\n`)
      return
    }

    const result = await deployer.deployWorker({
      scriptName: 'airi-baseline-test',
      characterPrompt: 'You are AIRI Stage Edge Baseline Test.',
      geminiApiKey: process.env.GEMINI_API_KEY || 'demo_gemini_key',
      discordBotToken: process.env.DISCORD_BOT_TOKEN,
      memoryMode: 'unlimited',
    })

    console.log(`\n🚀 Deployment complete! Live URL: ${result.workerUrl}\n`)
    return
  }

  console.log(`
AIRI Stage Edge CLI Facade (npx airi-edge)

Commands:
  oauth   - Generate Cloudflare API Token authorization URL
  deploy  - Deploy Edge Relay worker programmatically to Cloudflare
`)
}

runCli().catch((err) => {
  console.error('❌ CLI Execution Error:', err)
  process.exit(1)
})

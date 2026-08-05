/**
 * CLI Facade for @proj-airi/stage-edge deployment and OAuth authorization helper.
 * Run via `npx airi-edge deploy` or `pnpm -F @proj-airi/stage-edge deploy`.
 */

import { CloudflareStageDeployer } from './deployer/index'

async function runCli() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  if (command === 'oauth' || command === 'auth') {
    console.log('\n=== AIRI Stage Edge: Cloudflare OAuth Authorization ===\n')
    console.log('Open the following URL in your browser to generate your Cloudflare API Token:')
    console.log(`\n  👉 ${CloudflareStageDeployer.getOAuthUrl()}\n`)
    console.log('Once authorized, set your environment variables:')
    console.log('  export CLOUDFLARE_API_TOKEN="your_token_here"')
    console.log('  export CLOUDFLARE_ACCOUNT_ID="your_account_id_here"\n')
    return
  }

  if (command === 'deploy') {
    console.log('\n=== AIRI Stage Edge: Headless CLI Deployment ===\n')
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

    if (!apiToken || !accountId) {
      console.error('❌ Missing environment variables!')
      console.log('Run `npx airi-edge oauth` to generate your Cloudflare API Token.')
      process.exit(1)
    }

    const deployer = new CloudflareStageDeployer({ apiToken, accountId })
    const result = await deployer.deployWorker({
      scriptName: 'airi-relay-loona',
      characterPrompt: 'You are Loona, a witty AI character.',
      discordPublicKey: process.env.DISCORD_PUBLIC_KEY || 'demo_public_key',
      geminiApiKey: process.env.GEMINI_API_KEY || 'demo_gemini_key',
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

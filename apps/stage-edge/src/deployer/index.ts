/**
 * Client-Side Node.js Cloudflare API SDK wrapper for @proj-airi/stage-edge.
 * Programmatically creates KV namespaces, binds secrets, and uploads Worker bundles.
 */

import Cloudflare from 'cloudflare'

import { fetchDiscordPublicKey, registerSlashCommands, updateInteractionsEndpointUrl } from '../discord/client'

export interface CloudflareDeployerConfig {
  apiToken: string
  accountId: string
}

export interface WorkerDeployOptions {
  scriptName: string
  characterPrompt: string
  characterName?: string
  llmBaseUrl?: string
  llmApiKey: string
  llmModel?: string
  discordPublicKey?: string
  discordBotToken?: string
  memoryMode?: 'fixed' | 'unlimited'
  initialHistory?: Array<{ role: string, content: string }>
}

export class CloudflareStageDeployer {
  private client: Cloudflare
  private accountId: string

  constructor(config: CloudflareDeployerConfig) {
    this.client = new Cloudflare({ apiToken: config.apiToken })
    this.accountId = config.accountId
  }

  /**
   * Helper to fetch accounts associated with the Cloudflare Access Token.
   */
  public async getAccounts(): Promise<Array<{ id: string, name: string }>> {
    console.info('[Stage-Deployer] Fetching account memberships...')
    const accounts: Array<{ id: string, name: string }> = []
    for await (const account of this.client.accounts.list()) {
      accounts.push({ id: account.id, name: account.name })
    }
    return accounts
  }

  /**
   * Helper to ensure accountId is resolved from token if not explicitly provided.
   */
  private async ensureAccountId(): Promise<string> {
    if (this.accountId)
      return this.accountId
    console.info('[Stage-Deployer] Account ID missing, auto-resolving from Cloudflare Token...')
    const accounts = await this.getAccounts()
    if (accounts.length > 0) {
      this.accountId = accounts[0].id
      return this.accountId
    }
    throw new Error('Unable to resolve Cloudflare Account ID from API token.')
  }

  /**
   * Programmatically creates or resolves a KV namespace for character memory.
   */
  public async ensureKvNamespace(title: string): Promise<string> {
    const accountId = await this.ensureAccountId()
    console.info(`[Stage-Deployer] Resolving Cloudflare KV Namespace: "${title}"...`)

    // 1. Check existing KV namespaces to prevent duplicates
    for await (const ns of this.client.kv.namespaces.list({ account_id: accountId })) {
      if (ns.title === title) {
        console.info(`✓ Found pre-existing KV namespace -> ID: ${ns.id}`)
        return ns.id
      }
    }

    // 2. Create new KV namespace if miss
    const response = await this.client.kv.namespaces.create({
      account_id: accountId,
      title,
    })
    console.info(`✓ Created new KV namespace -> ID: ${response.id}`)
    return response.id
  }

  /**
   * Writes a key-value pair directly into the Cloudflare KV storage via REST API.
   */
  public async setKvValue(namespaceId: string, key: string, value: string): Promise<void> {
    const accountId = await this.ensureAccountId()
    console.info(`[Stage-Deployer] Writing KV key "${key}" into namespace ${namespaceId}...`)
    await this.client.kv.namespaces.values.update(namespaceId, key, {
      account_id: accountId,
      value,
    })
    console.info(`✓ KV key "${key}" updated successfully.`)
  }

  /**
   * Reads a key-value pair directly from Cloudflare KV storage via REST API.
   */
  public async getKvValue(namespaceId: string, key: string): Promise<any> {
    const accountId = await this.ensureAccountId()
    console.info(`[Stage-Deployer] Reading KV key "${key}" from namespace ${namespaceId}...`)
    const rawValue = await this.client.kv.namespaces.values.get(namespaceId, key, {
      account_id: accountId,
    })
    const text = await rawValue.text()
    try {
      return JSON.parse(text)
    }
    catch {
      return text
    }
  }

  /**
   * Programmatically uploads compiled Worker script & binds KV and secrets to Cloudflare.
   */
  public async deployWorker(options: WorkerDeployOptions): Promise<{ workerUrl: string, namespaceId: string, publicKey: string }> {
    console.info(`[Stage-Deployer] Initiating zero-custody Worker deployment for "${options.scriptName}"...`)

    // 0. Auto-resolve Discord Public Key if bot token provided
    let resolvedPublicKey = options.discordPublicKey || ''
    if (options.discordBotToken && !resolvedPublicKey) {
      console.info(`[Stage-Deployer] Auto-resolving Discord Public Key via Bot Token...`)
      try {
        resolvedPublicKey = await fetchDiscordPublicKey(options.discordBotToken)
        console.info(`✓ Discord Public Key resolved: ${resolvedPublicKey.slice(0, 16)}...`)
      }
      catch (err: any) {
        console.warn(`[Stage-Deployer] Public Key auto-resolution warning: ${err.message}`)
        resolvedPublicKey = 'demo_public_key_fallback'
      }
    }

    // 1. Ensure KV namespace exists
    const namespaceId = await this.ensureKvNamespace(`airi-kv-${options.scriptName}`)

    // 2. Seed baseline KV test value ("ping" -> "pong") & initial history context if provided
    await this.setKvValue(namespaceId, 'ping', 'pong')
    if (options.initialHistory && options.initialHistory.length > 0) {
      await this.setKvValue(namespaceId, 'context/rolling', JSON.stringify(options.initialHistory))
    }

    // 3. Construct bundled ES module Worker script payload
    let workerScriptCode = ''
    try {
      const { packageWorkerScript } = await import('./packager')
      workerScriptCode = await packageWorkerScript()
    }
    catch (err: any) {
      console.warn(`[Stage-Deployer] Packager fallback: ${err.message}`)
      workerScriptCode = `
export default {
  async fetch(request, env) {
    return new Response(JSON.stringify({ status: 'ok', script: "${options.scriptName}" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
`
    }

    const formData = new FormData()
    const metadata = {
      main_module: 'index.mjs',
      compatibility_date: '2025-02-04',
      compatibility_flags: ['nodejs_compat'],
      bindings: [
        { type: 'kv_namespace', name: 'MEMORY', namespace_id: namespaceId },
        { type: 'plain_text', name: 'SYSTEM_PROMPT', text: options.characterPrompt },
        { type: 'plain_text', name: 'CHARACTER_NAME', text: options.characterName || 'AIRI' },
        { type: 'plain_text', name: 'LLM_BASE_URL', text: options.llmBaseUrl || '' },
        { type: 'plain_text', name: 'LLM_MODEL', text: options.llmModel || 'gemini-3.5-flash-lite' },
        { type: 'secret_text', name: 'LLM_API_KEY', text: options.llmApiKey },
        { type: 'secret_text', name: 'DISCORD_PUBLIC_KEY', text: resolvedPublicKey },
      ],
    }

    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json')
    formData.append('index.mjs', new Blob([workerScriptCode], { type: 'application/javascript+module' }), 'index.mjs')

    console.info(`[Stage-Deployer] Uploading ES module script to Cloudflare Workers API...`)

    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${options.scriptName}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.client.apiToken}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Worker script upload failed -> HTTP ${res.status}: ${errText}`)
    }

    // 4. Enable workers.dev subdomain route and retrieve account subdomain name
    await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${options.scriptName}/subdomain`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.client.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true }),
    })

    const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/subdomain`, {
      headers: { Authorization: `Bearer ${this.client.apiToken}` },
    })
    const subJson: any = await subRes.json()
    const subdomainName = subJson.result?.subdomain || 'workers'

    const workerUrl = `https://${options.scriptName}.${subdomainName}.workers.dev`
    console.info(`\n🎉 Worker deployed successfully!`)
    console.info(`👉 Live Endpoint: ${workerUrl}\n`)

    // 5. Register interactions endpoint URL on Discord
    if (options.discordBotToken) {
      const discordEndpointUrl = `${workerUrl}/discord`
      console.info(`[Stage-Deployer] Registering Discord Interactions Endpoint: ${discordEndpointUrl}`)
      try {
        await updateInteractionsEndpointUrl(options.discordBotToken, discordEndpointUrl)
        console.info(`✓ Discord Interactions Endpoint registered successfully!`)
      }
      catch (err: any) {
        console.warn(`[Stage-Deployer] Discord Interactions URL auto-registration warning: ${err.message}`)
      }

      // 6. Register global slash commands so Discord routes them to the Worker
      try {
        await registerSlashCommands(options.discordBotToken)
      }
      catch (err: any) {
        console.warn(`[Stage-Deployer] Slash command registration warning: ${err.message}`)
      }
    }

    return { workerUrl, namespaceId, publicKey: resolvedPublicKey }
  }
}

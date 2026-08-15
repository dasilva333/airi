/**
 * Helper utilities for formatting Discord REST & webhook interaction responses.
 */

export function jsonResponse(body: unknown, init?: number | ResponseInit): Response {
  const options: ResponseInit = typeof init === 'number' ? { status: init } : (init || {})
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8')
  }
  return new Response(JSON.stringify(body), {
    ...options,
    headers,
  })
}

export function getCommandOption(interaction: any, optionName: string): any {
  return interaction.data?.options?.find((option: any) => option.name === optionName) ?? null
}

export function getAttachmentByOption(interaction: any, optionName: string): any {
  const attachmentOption = getCommandOption(interaction, optionName)
  if (!attachmentOption?.value) {
    return null
  }
  const attachmentId = attachmentOption.value
  return interaction.data?.resolved?.attachments?.[attachmentId] ?? null
}

export function getMediaAttachment(interaction: any): { kind: string, attachment: any } | null {
  const candidates = [
    { kind: 'image', attachment: getAttachmentByOption(interaction, 'image') },
    { kind: 'audio', attachment: getAttachmentByOption(interaction, 'audio') },
    { kind: 'video', attachment: getAttachmentByOption(interaction, 'video') },
  ]
  return candidates.find(item => item.attachment !== null) ?? null
}

/**
 * Automatically queries Discord REST API using the Bot Token to fetch the Application Public Key.
 * Eliminates setup friction by deriving public_key automatically!
 */
export async function fetchDiscordPublicKey(botToken: string): Promise<string> {
  const cleanToken = botToken.replace(/^Bot\s+/i, '').trim()
  const response = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
    headers: {
      Authorization: `Bot ${cleanToken}`,
    },
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Failed to fetch Discord Application info -> HTTP ${response.status}: ${errText}`)
  }

  const appInfo: any = await response.json()
  if (!appInfo.verify_key && !appInfo.public_key) {
    throw new Error('Discord API response did not include a valid public key (verify_key).')
  }

  const publicKey = appInfo.verify_key || appInfo.public_key
  console.info(`✓ Successfully auto-resolved Discord Application Public Key: ${publicKey.slice(0, 10)}...`)
  return publicKey
}

/**
 * Programmatically updates the Discord Application Interactions Endpoint URL via REST API.
 * Triggered automatically post-Cloudflare deployment to eliminate manual portal setup!
 */
export async function updateInteractionsEndpointUrl(botToken: string, endpointUrl: string): Promise<void> {
  const cleanToken = botToken.replace(/^Bot\s+/i, '').trim()
  console.info(`[Discord-Client] Programmatically updating Interactions Endpoint URL to "${endpointUrl}"...`)

  const response = await fetch('https://discord.com/api/v10/applications/@me', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bot ${cleanToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      interactions_endpoint_url: endpointUrl,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Failed to update Discord Interactions Endpoint URL -> HTTP ${response.status}: ${errText}`)
  }

  console.info(`✓ Discord Interactions Endpoint URL verified & registered successfully!`)
}

/**
 * Registers slash commands globally for the Discord Application via REST API.
 * Must be called after deploying the Worker so Discord knows which commands to route.
 */
export async function registerSlashCommands(botToken: string): Promise<void> {
  const cleanToken = botToken.replace(/^Bot\s+/i, '').trim()

  // First fetch the Application ID
  const appRes = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
    headers: { Authorization: `Bot ${cleanToken}` },
  })
  if (!appRes.ok) {
    throw new Error(`Failed to fetch Application ID -> HTTP ${appRes.status}`)
  }
  const appInfo: any = await appRes.json()
  const appId = appInfo.id

  const commands = [
    {
      name: 'chat',
      description: 'Send a message to AIRI and get a response.',
      options: [
        {
          type: 3, // STRING
          name: 'message',
          description: 'What you want to say to AIRI',
          required: true,
        },
      ],
    },
  ]

  console.info(`[Discord-Client] Registering ${commands.length} global slash command(s) for App ID ${appId}...`)

  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${cleanToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to register slash commands -> HTTP ${res.status}: ${errText}`)
  }

  const registered: any[] = await res.json()
  console.info(`✓ ${registered.length} slash command(s) registered successfully: ${registered.map(c => `/${c.name}`).join(', ')}`)
}

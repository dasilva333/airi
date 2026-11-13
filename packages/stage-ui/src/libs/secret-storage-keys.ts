// Credential-bearing entries. The 24 h auto-backup writes this bundle unencrypted under
// Documents/AIRI-Backups/, so key material must never enter it; only the names are recorded.
// A trailing `/` matches a whole branch; every other entry is an exact key.
// Kept import-free so any module (sync engine, tests) can consult it without side effects.
export const SECRET_STORAGE_KEYS = [
  'settings/credentials/', // provider API keys (providers/runtime/instance-store.ts)
  'settings/sync/s3-access-key-id',
  'settings/sync/s3-secret-access-key',
  'settings/cloudflare/cfOAuthTokens',
  'settings/cloudflare/cfApiToken',
  'settings/cloudflare/cfAccountId',
  'local:peers/device-keypair', // libp2p device identity private key
  'local:providers', // provider catalog configs can carry raw API keys (config.apiKey is read straight off them)
  'settings/free-hub/', // free-tier test API keys
  'settings/discord/token',
  'settings/discord/cfOAuthTokens',
  'settings/discord/cfApiToken',
  'settings/discord/cfAccountId',
  'settings/twitter/api-key',
  'settings/twitter/api-secret',
  'settings/twitter/access-token',
  'settings/twitter/access-token-secret',
  'cf_oauth_verifier', // Cloudflare PKCE verifier
  'settings/connection/auth-token',
  'settings/connection/hf-token',
  'settings/server-channel/auth-token',
  'settings/server-channel/websocket-tls-config', // client cert key + passphrase
  'settings/llm/apiKey',
  'settings/mcp/config', // MCP servers may carry auth env/headers
  'lhack_gemini_api_key',
  'vhack_gemini_api_key',
  'artistry-replicate-api-key',
  'artistry-nanobanana-api-key',
  'artistry-pollinations-api-key',
]

export function isSecretStorageKey(key: string): boolean {
  // A trailing `/` matches the whole branch, so a renamed token key can never slip through.
  // Exact entries keep non-secret neighbours (s3-endpoint, cfSubdomain, discord/twitter enable flags).
  return SECRET_STORAGE_KEYS.some(secret => secret.endsWith('/') ? key.startsWith(secret) : key === secret)
}

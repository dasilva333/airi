/**
 * Native Cloudflare OAuth 2.0 PKCE Authentication Server for AIRI Stage Edge.
 * Spawns a temporary http://localhost:8976 callback listener, opens default browser,
 * and automatically exchanges PKCE code for Cloudflare Access & Refresh tokens.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

import open from 'open'

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  accountId?: string
}

const CLOUDFLARE_OAUTH_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7' // Official Wrangler Public Client ID
const REDIRECT_URI = 'http://localhost:8976/oauth/callback'
const AUTH_ENDPOINT = 'https://dash.cloudflare.com/oauth2/auth'
const TOKEN_ENDPOINT = 'https://dash.cloudflare.com/oauth2/token'

const DEFAULT_SCOPES = [
  'account:read',
  'user:read',
  'workers:write',
  'workers_kv:write',
  'workers_routes:write',
  'workers_scripts:write',
  'offline_access',
]

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generatePkce(): { codeVerifier: string, codeChallenge: string } {
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32))
  const codeChallenge = base64UrlEncode(
    crypto.createHash('sha256').update(codeVerifier).digest(),
  )
  return { codeVerifier, codeChallenge }
}

export async function loginWithCloudflareOAuth(): Promise<OAuthTokens> {
  const { codeVerifier, codeChallenge } = generatePkce()
  const state = base64UrlEncode(crypto.randomBytes(16))

  const authUrl = new URL(AUTH_ENDPOINT)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('client_id', CLOUDFLARE_OAUTH_CLIENT_ID)
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.append('scope', DEFAULT_SCOPES.join(' '))
  authUrl.searchParams.append('state', state)
  authUrl.searchParams.append('code_challenge', codeChallenge)
  authUrl.searchParams.append('code_challenge_method', 'S256')

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`)
        if (reqUrl.pathname !== '/oauth/callback') {
          res.writeHead(404)
          res.end('Not Found')
          return
        }

        const code = reqUrl.searchParams.get('code')
        const returnedState = reqUrl.searchParams.get('state')

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Authentication Failed</h1><p>State mismatch error.</p>')
          server.close()
          reject(new Error('OAuth state mismatch'))
          return
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Authentication Failed</h1><p>Missing authorization code.</p>')
          server.close()
          reject(new Error('Missing authorization code'))
          return
        }

        // Exchange code for Access Token
        const tokenRes = await fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLOUDFLARE_OAUTH_CLIENT_ID,
            code_verifier: codeVerifier,
            code,
            redirect_uri: REDIRECT_URI,
          }),
        })

        if (!tokenRes.ok) {
          const errText = await tokenRes.text()
          res.writeHead(500, { 'Content-Type': 'text/html' })
          res.end('<h1>Token Exchange Failed</h1>')
          server.close()
          reject(new Error(`OAuth token exchange failed -> ${errText}`))
          return
        }

        const tokenData: any = await tokenRes.json()

        // 1. Automatically write gitignored .env for local script CLI access
        const envPath = path.resolve(process.cwd(), 'apps/stage-edge/.env')
        const envContent = `CLOUDFLARE_API_TOKEN="${tokenData.access_token}"\nCLOUDFLARE_REFRESH_TOKEN="${tokenData.refresh_token}"\n`
        fs.writeFileSync(envPath, envContent, 'utf-8')

        // 2. Automatically populate gitignored wrangler.json
        const wranglerPath = path.resolve(process.cwd(), 'apps/stage-edge/wrangler.json')
        const wranglerConfig = {
          $schema: 'node_modules/wrangler/config-schema.json',
          name: 'airi-stage-edge',
          main: 'dist/index.mjs',
          compatibility_date: '2025-02-04',
          compatibility_flags: ['nodejs_compat'],
          vars: {
            SYSTEM_PROMPT: 'You are AIRI, a supportive and intelligent companion.',
            GEMINI_MODEL: 'gemini-2.0-flash',
          },
          kv_namespaces: [
            {
              binding: 'MEMORY',
              id: 'AUTO_GENERATED_KV_ID',
            },
          ],
        }
        fs.writeFileSync(wranglerPath, JSON.stringify(wranglerConfig, null, 2), 'utf-8')

        console.log(`\n✓ Automatically saved access tokens to gitignored apps/stage-edge/.env & wrangler.json!`)

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>AIRI Cloudflare Authorization</title>
            </head>
            <body style="font-family: system-ui, sans-serif; text-align: center; padding: 60px 20px; background: #0f172a; color: #f8fafc; margin: 0;">
              <h1 style="color: #38bdf8; font-size: 2rem;">🎉 AIRI Cloudflare Authorization Successful!</h1>
              <p style="font-size: 1.2rem; color: #94a3b8;">Tokens persisted to gitignored <code>apps/stage-edge/wrangler.json</code> & <code>.env</code>.</p>
              <p style="font-size: 1.1rem; color: #38bdf8;">You may now close this browser tab.</p>
            </body>
          </html>
        `)

        server.close()
        resolve({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          accountId: tokenData.account_id,
        })
      }
      catch (err) {
        server.close()
        reject(err)
      }
    })

    server.listen(8976, async () => {
      console.log('\n=== AIRI Cloudflare OAuth 2.0 PKCE Login ===\n')
      console.log(`Opening browser for Cloudflare authorization...`)
      console.log(`URL: ${authUrl.toString()}\n`)
      await open(authUrl.toString())
    })
  })
}

/**
 * Native Cloudflare OAuth 2.0 PKCE Authentication Server for AIRI Stage Edge.
 * Spawns a temporary http://localhost:8976 callback listener, opens default browser,
 * and automatically exchanges PKCE code for Cloudflare Access & Refresh tokens.
 */

import crypto from 'node:crypto'
import http from 'node:http'

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
    const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
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

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>AIRI Cloudflare Authorization</title>
            </head>
            <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px; background: #0f172a; color: #f8fafc; margin: 0;">
              <div style="max-width: 500px; margin: 0 auto; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px 30px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                <h1 style="color: #38bdf8; font-size: 1.75rem; font-weight: 700; margin: 0 0 12px 0;">Authorization Successful!</h1>
                <p style="font-size: 1rem; color: #94a3b8; line-height: 1.5; margin: 0 0 24px 0;">
                  Return to AIRI and click <strong style="color: #f8fafc;">Deploy Character to Cloudflare Edge</strong> to continue with the next step.
                </p>
                <div style="display: inline-block; padding: 8px 16px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; font-size: 0.875rem; color: #38bdf8; font-weight: 600;">
                  You may now close this browser tab
                </div>
              </div>
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

export async function refreshOAuthToken(refreshToken: string): Promise<OAuthTokens> {
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
    const err = await res.text()
    throw new Error(`Token refresh failed: ${err}`)
  }

  const data: any = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
    accountId: data.account_id,
  }
}

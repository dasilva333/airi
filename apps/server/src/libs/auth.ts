import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer } from 'better-auth/plugins'
import * as authSchema from '../schemas/accounts'
import type { Database } from './db'
import type { Env } from './env'

export function createAuth(db: Database, env: Env) {
  return betterAuth({
    // To skip state-mismatch errors
    // https://github.com/better-auth/better-auth/issues/4969#issuecomment-3397804378
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'None', // this enables cross-site cookies
        secure: true, // required for SameSite=None
      },
    },

    baseURL: env.API_SERVER_URL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        ...authSchema,
      },
    }),

    emailAndPassword: {
      enabled: true,
    },

    plugins: [bearer()],

    socialProviders: {
      github: {
        clientId: env.AUTH_GITHUB_CLIENT_ID,
        clientSecret: env.AUTH_GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: env.AUTH_GOOGLE_CLIENT_ID,
        clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: ['*'],
  })
}

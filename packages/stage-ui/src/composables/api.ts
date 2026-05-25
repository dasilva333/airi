import { hc } from 'hono/client'
import type { AppType } from '../../../../apps/server/src/app'

import { SERVER_URL } from '../libs/auth'

export const client = hc<AppType>(SERVER_URL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    return fetch(input, {
      ...init,
      credentials: 'include', // Send cookies with request (for sessions, etc)
      headers,
    })
  },
})

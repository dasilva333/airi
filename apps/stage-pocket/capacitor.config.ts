import type { CapacitorConfig } from '@capacitor/cli'

import { env } from 'node:process'

const serverURL = env.CAPACITOR_DEV_SERVER_URL

const config: CapacitorConfig = {
  appId: 'ai.dasilva333.airi-ios',
  appName: 'Richy\'s AIRI',
  webDir: 'dist',
  server: serverURL
    ? {
        url: serverURL,
        cleartext: true,
      }
    : undefined,
  plugins: {},
}

export default config

import { env } from 'node:process'
import type { CapacitorConfig } from '@capacitor/cli'

const serverURL = env.CAPACITOR_DEV_SERVER_URL

const config: CapacitorConfig = {
  appId: 'ai.moeru.airi-pocket',
  appName: 'AIRI',
  server: serverURL
    ? {
        cleartext: false,
        url: serverURL,
      }
    : undefined,
  webDir: 'dist',
}

export default config

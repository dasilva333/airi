import fs from 'node:fs'
import path from 'node:path'

import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function ensureElectron() {
  let electronPkgPath
  try {
    electronPkgPath = require.resolve('electron/package.json')
  }
  catch {
    console.error('[AIRI] Electron package is not installed in node_modules.')
    process.exit(1)
  }

  const electronDir = path.dirname(electronPkgPath)
  const distDir = path.join(electronDir, 'dist')

  if (!fs.existsSync(distDir)) {
    console.warn('[AIRI] Electron binary runtime missing (dist/ not found).')
    console.warn('[AIRI] Triggering automatic repair via electron/install.js...')

    const installScript = path.join(electronDir, 'install.js')
    if (!fs.existsSync(installScript)) {
      console.error(`[AIRI] Electron installer script not found at ${installScript}`)
      process.exit(1)
    }

    try {
      execSync(`node "${installScript}"`, { stdio: 'inherit' })
      if (fs.existsSync(distDir)) {
        console.log('[AIRI] Electron binary runtime repaired successfully.')
      }
      else {
        console.error('[AIRI] Electron install script ran but dist/ directory is still missing.')
        process.exit(1)
      }
    }
    catch (err) {
      console.error('[AIRI] Failed to execute Electron install script:', err.message)
      process.exit(1)
    }
  }
}

ensureElectron()

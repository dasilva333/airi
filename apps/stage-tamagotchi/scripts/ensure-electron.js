import fs from 'node:fs'
import path from 'node:path'

import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function isElectronBroken(electronDir, distDir) {
  if (!fs.existsSync(distDir)) {
    return true
  }

  const pathFile = path.join(electronDir, 'path.txt')
  if (fs.existsSync(pathFile)) {
    try {
      const content = fs.readFileSync(pathFile, 'utf-8').trim()
      if (content === 'Electron uninstall' || !content) {
        return true
      }
    }
    catch {
      return true
    }
  }

  try {
    require('electron')
  }
  catch (err) {
    if (err.message && (err.message.includes('Electron uninstall') || err.message.includes('failed to install'))) {
      return true
    }
  }

  return false
}

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

  if (isElectronBroken(electronDir, distDir)) {
    console.warn('[AIRI] Electron binary runtime is missing or in uninstalled state.')
    console.warn('[AIRI] Triggering automatic repair via electron/install.js...')

    const installScript = path.join(electronDir, 'install.js')
    if (!fs.existsSync(installScript)) {
      console.error(`[AIRI] Electron installer script not found at ${installScript}`)
      process.exit(1)
    }

    try {
      execSync(`node "${installScript}"`, { stdio: 'inherit' })
      if (!isElectronBroken(electronDir, distDir)) {
        console.log('[AIRI] Electron binary runtime repaired successfully.')
      }
      else {
        console.error('[AIRI] Electron install script ran but Electron is still uninstalled.')
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

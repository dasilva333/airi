import fs from 'node:fs'
import path from 'node:path'

import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function getPlatformPath() {
  switch (process.platform) {
    case 'mas':
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron'
    case 'freebsd':
    case 'openbsd':
    case 'linux':
      return 'electron'
    case 'win32':
      return 'electron.exe'
    default:
      return 'electron'
  }
}

function sanitizePathTxt(electronDir) {
  const pathFile = path.join(electronDir, 'path.txt')
  const platformPath = getPlatformPath()
  const expectedBinaryPath = path.join(electronDir, 'dist', platformPath)

  if (fs.existsSync(pathFile)) {
    try {
      const rawContent = fs.readFileSync(pathFile, 'utf-8')
      const trimmed = rawContent.trim()

      if (rawContent !== trimmed || trimmed === 'Electron uninstall' || trimmed !== platformPath) {
        if (fs.existsSync(expectedBinaryPath)) {
          fs.writeFileSync(pathFile, platformPath)
          console.log(`[AIRI] Auto-repaired path.txt to point to valid binary (${platformPath}).`)
          return true
        }
      }
    }
    catch {
      // Ignore read errors
    }
  }
  else if (fs.existsSync(expectedBinaryPath)) {
    try {
      fs.writeFileSync(pathFile, platformPath)
      console.log(`[AIRI] Created missing path.txt pointing to (${platformPath}).`)
      return true
    }
    catch {
      // Ignore write errors
    }
  }

  return false
}

function isElectronBroken(electronDir, distDir) {
  sanitizePathTxt(electronDir)

  if (!fs.existsSync(distDir)) {
    return true
  }

  try {
    const electronResolved = require('electron')
    if (typeof electronResolved === 'string' && fs.existsSync(electronResolved)) {
      return false
    }
  }
  catch (err) {
    if (err.message && (err.message.includes('Electron uninstall') || err.message.includes('failed to install'))) {
      return true
    }
  }

  const platformPath = getPlatformPath()
  const expectedBinaryPath = path.join(distDir, platformPath)
  return !fs.existsSync(expectedBinaryPath)
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
    if (fs.existsSync(installScript)) {
      try {
        execSync(`node "${installScript}"`, { stdio: 'inherit' })
      }
      catch (err) {
        console.warn('[AIRI] Electron install.js execution warning:', err.message)
      }
    }

    if (isElectronBroken(electronDir, distDir)) {
      console.error('[AIRI] Automatic repair via install.js did not populate Electron runtime.')
      console.error('[AIRI] Please run: pnpm rebuild electron')
      process.exit(1)
    }
    else {
      console.log('[AIRI] Electron binary runtime repaired successfully.')
    }
  }
}

ensureElectron()

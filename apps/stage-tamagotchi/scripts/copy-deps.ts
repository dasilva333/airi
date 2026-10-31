import fs from 'node:fs'
import path from 'node:path'

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const rootRequire = createRequire(path.resolve(import.meta.dirname, '..', '..', 'package.json'))
const targetNodeModules = path.resolve('node_modules')

const packages = [
  '@discordjs/voice',
  'discord.js',
  'prism-media',
  '@snazzah/davey',
  'opusscript',
  'libsodium-wrappers',
  'libsodium',
  'undici',
  'magic-bytes.js',
  'ws',
  'canonicalize',
]

function copyRecursiveSync(src: string, dest: string) {
  const stats = fs.statSync(src)
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }
    fs.readdirSync(src).forEach((child) => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child))
    })
  }
  else {
    fs.copyFileSync(src, dest)
  }
}

for (const pkg of packages) {
  try {
    const entryPath = rootRequire.resolve(pkg)
    const realEntryPath = fs.realpathSync(entryPath)

    let dir = path.dirname(realEntryPath)
    while (dir && !fs.existsSync(path.join(dir, 'package.json'))) {
      const parent = path.dirname(dir)
      if (parent === dir)
        break
      dir = parent
    }

    const srcDir = fs.realpathSync(dir)
    const destDir = path.join(targetNodeModules, pkg)

    console.log(`[copy-deps] Copying ${pkg} from ${srcDir} to ${destDir}`)
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true })
    }
    copyRecursiveSync(srcDir, destDir)
  }
  catch (e: any) {
    console.error(`[copy-deps] Failed to copy ${pkg}: ${e.message}`)
  }
}

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { execSync } from 'node:child_process'

// Construct environment with SSL bypass, max heap size, and GITHUB_TOKEN cleared to fall back to keyring
const safeEnv = { ...process.env }
delete safeEnv.GITHUB_TOKEN
safeEnv.GH_SSL_NO_VERIFY = 'true'
safeEnv.NODE_OPTIONS = '--max-old-space-size=12288'

function execute(cmd, options = {}) {
  console.log(`\n🤖 Running: ${cmd}`)
  return execSync(cmd, { env: safeEnv, stdio: 'inherit', ...options })
}

async function main() {
  const isBuildOnly = process.argv.includes('--build-only')
  const isUploadOnly = process.argv.includes('--upload-only')

  const rootDir = process.cwd()
  const tamagotchiDir = path.join(rootDir, 'apps', 'stage-tamagotchi')
  const packageJsonPath = path.join(tamagotchiDir, 'package.json')

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`❌ Error: Could not find package.json at ${packageJsonPath}`)
    process.exit(1)
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const version = pkg.version
  const tag = `v${version}`
  console.log(`📦 Resolved target release version: ${version} (tag: ${tag})`)

  // Step 1: Pull and fetch tags from git
  console.log('🔄 Syncing local repository with remote...')
  try {
    execute('git -c http.sslVerify=false pull')
    execute('git -c http.sslVerify=false fetch --tags --force')
  }
  catch (error) {
    console.warn('⚠️ Warning: Git sync failed. Proceeding with local repository state.')
  }

  // Re-read package.json after git sync in case remote main was updated
  const updatedPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const currentVersion = updatedPkg.version
  const currentTag = `v${currentVersion}`

  // Check for date stamp mismatch with today's date
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const todayDateStr = `${year}${month}${day}`

  const dateMatch = currentVersion.match(/stable\.(\d{8})$/)
  if (dateMatch) {
    const versionDateStr = dateMatch[1]
    if (versionDateStr !== todayDateStr) {
      console.warn('\n===============================================================')
      console.warn('⚠️  WARNING: RELEASE DATE STAMP MISMATCH DETECTED!')
      console.warn(`👉 Today's date:               ${todayDateStr} (${year}-${month}-${day})`)
      console.warn(`👉 Package version date stamp: ${versionDateStr} (${currentVersion})`)
      console.warn('---------------------------------------------------------------')
      console.warn('Notice: The package version date stamp is from a previous day.')
      console.warn('Did the other machine/agent forget to push their git commits or tags?')
      console.warn('===============================================================\n')
    }
  }

  if (!isUploadOnly) {
    // Step 2: Check for active file locks on output artifacts
    const distWinUnpacked = path.join(tamagotchiDir, 'dist', 'win-unpacked')
    const filesToCheck = [
      path.join(distWinUnpacked, 'resources', 'app.asar'),
      path.join(distWinUnpacked, 'airi.exe'),
    ]

    for (const targetPath of filesToCheck) {
      if (fs.existsSync(targetPath)) {
        console.log(`🔍 Checking for active file locks on: ${targetPath}`)
        try {
          // Attempt to open with read-write access to verify no running process or editor handle is holding the file
          const fd = fs.openSync(targetPath, 'r+')
          fs.closeSync(fd)
          console.log(`✅ ${path.basename(targetPath)} is not locked.`)
        }
        catch (err) {
          if (['EBUSY', 'EACCES', 'EPERM'].includes(err.code) || err.code) {
            console.error('\n❌ BUILD LOCK DETECTED ❌')
            console.error(`The file "${path.basename(targetPath)}" (${targetPath}) is locked by another process (code: ${err.code}).`)
            console.error('👉 Please make sure that AIRI is closed and no VS Code process or terminal is locking the output directory.')
            process.exit(1)
          }
        }
      }
    }

    // Step 3: Restore clean pnpm symlinks in stage-tamagotchi to prevent Vite V8 memory crashes (3221225477)
    console.log(`\n🧹 Cleaning physical node_modules overrides and restoring pnpm symlinks...`)
    const copiedPackages = [
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
    ]
    for (const pkg of copiedPackages) {
      const pkgPath = path.join(tamagotchiDir, 'node_modules', pkg)
      if (fs.existsSync(pkgPath) && !fs.lstatSync(pkgPath).isSymbolicLink()) {
        try {
          fs.rmSync(pkgPath, { recursive: true, force: true })
        }
        catch (e) {
          // ignore
        }
      }
    }
    try {
      execute('pnpm -F @proj-airi/stage-tamagotchi install')
    }
    catch (e) {
      console.warn('⚠️ Warning: pnpm install pre-step failed, continuing...')
    }

    // Step 4: Run the build:win script
    console.log(`\n🔨 Compiling Windows Setup executable...`)
    try {
      execute('pnpm -F @proj-airi/stage-tamagotchi run build:win')
    }
    catch (error) {
      console.error('❌ Build execution failed.')
      process.exit(1)
    }
  }

  // Step 4: Locate the generated exe installer
  const distDir = path.join(tamagotchiDir, 'dist')
  if (!fs.existsSync(distDir)) {
    console.error(`❌ Error: dist folder does not exist at ${distDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(distDir)
  const setupExe = files.find(f => f.startsWith(`AIRI-${version}`) && f.endsWith('.exe'))

  if (!setupExe) {
    console.error(`\n❌ Error: Could not find generated setup executable matching "AIRI-${version}*.exe" in ${distDir}`)
    console.log('Available files in dist:', files)
    process.exit(1)
  }

  const exePath = path.join('apps', 'stage-tamagotchi', 'dist', setupExe)
  console.log(`\n🎉 Found installer asset: ${exePath}`)

  if (isBuildOnly) {
    console.log(`\n✅ Build complete! Setup binary ready for smoke test at:`)
    console.log(`👉 ${exePath}`)
    console.log(`\nWhen smoke testing is complete and approved, run:`)
    console.log(`👉 pnpm run release:win --upload-only`)
    return
  }

  // Step 5: Check if GitHub release already exists, if not, create it
  console.log(`\n🌐 Checking if GitHub release ${tag} exists...`)
  let releaseExists = false
  try {
    execute(`gh release view ${tag} --repo dasilva333/airi`, { stdio: 'ignore' })
    releaseExists = true
    console.log(`✅ Release ${tag} already exists on GitHub.`)
  }
  catch (err) {
    console.log(`ℹ️ Release ${tag} does not exist. Creating new release draft...`)
  }

  if (!releaseExists) {
    const notesFileOpt = fs.existsSync(path.join(rootDir, 'release-notes.md'))
      ? ' --notes-file release-notes.md'
      : ''
    try {
      execute(`gh release create ${tag} --repo dasilva333/airi --title "AIRI ${tag}"${notesFileOpt}`)
      console.log(`✅ Release ${tag} successfully created.`)
    }
    catch (err) {
      console.error(`❌ Failed to create GitHub release ${tag}. Error:`, err.message)
      process.exit(1)
    }
  }

  // Step 6: Upload the binary
  console.log(`\n🚀 Uploading ${setupExe} to release ${tag}...`)
  try {
    execute(`gh release upload ${tag} "${exePath}" --repo dasilva333/airi --clobber`)
    console.log(`\n🏆 Success! Windows setup installer uploaded to GitHub release:`)
    console.log(`👉 https://github.com/dasilva333/airi/releases/tag/${tag}`)
  }
  catch (err) {
    console.error(`❌ Failed to upload installer asset. Error:`, err.message)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unhandled script error:', err)
  process.exit(1)
})

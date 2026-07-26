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

  // Step 2: Restore clean pnpm symlinks in stage-tamagotchi to prevent Vite V8 memory crashes (3221225477)
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

  // Step 3: Run the build:mac script
  console.log(`\n🔨 Compiling macOS target bundle...`)
  try {
    execute('pnpm -F @proj-airi/stage-tamagotchi run build:mac')
  }
  catch (error) {
    console.error('❌ Build execution failed.')
    process.exit(1)
  }

  // Step 3: Locate the generated dmg installer
  const distDir = path.join(tamagotchiDir, 'dist')
  if (!fs.existsSync(distDir)) {
    console.error(`❌ Error: dist folder does not exist at ${distDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(distDir)
  const setupDmg = files.find(f => f.startsWith(`AIRI-${version}`) && f.endsWith('.dmg'))

  if (!setupDmg) {
    console.error(`\n❌ Error: Could not find generated DMG executable matching "AIRI-${version}*.dmg" in ${distDir}`)
    console.log('Available files in dist:', files)
    process.exit(1)
  }

  const dmgPath = path.join('apps', 'stage-tamagotchi', 'dist', setupDmg)
  console.log(`\n🎉 Found installer asset: ${dmgPath}`)

  // Step 4: Check if GitHub release already exists, if not, create it
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

  // Step 5: Upload the DMG
  console.log(`\n🚀 Uploading ${setupDmg} to release ${tag}...`)
  try {
    execute(`gh release upload ${tag} "${dmgPath}" --repo dasilva333/airi --clobber`)
    console.log(`\n🏆 Success! macOS DMG installer uploaded to GitHub release:`)
    console.log(`👉 https://github.com/dasilva333/airi/releases/tag/${tag}`)
  }
  catch (err) {
    console.error(`❌ Failed to upload DMG installer. Error:`, err.message)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unhandled script error:', err)
  process.exit(1)
})

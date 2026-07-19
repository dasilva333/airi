import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { execSync } from 'node:child_process'

// Construct environment with SSL bypass and GITHUB_TOKEN cleared to fall back to keyring
const safeEnv = { ...process.env }
delete safeEnv.GITHUB_TOKEN
safeEnv.GH_SSL_NO_VERIFY = 'true'

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

  // Step 2: Check for active file locks on app.asar
  const asarPath = path.join(tamagotchiDir, 'dist', 'win-unpacked', 'resources', 'app.asar')
  if (fs.existsSync(asarPath)) {
    console.log(`🔍 Checking for active file locks on: ${asarPath}`)
    try {
      const fd = fs.openSync(asarPath, 'r+')
      fs.closeSync(fd)
      console.log('✅ app.asar is not locked. Safe to proceed with build.')
    }
    catch (err) {
      if (['EBUSY', 'EACCES', 'EPERM'].includes(err.code)) {
        console.error('\n❌ BUILD LOCK DETECTED ❌')
        console.error('The file "app.asar" is currently locked by another process.')
        console.error('👉 Please make sure that AIRI is closed and no VS Code process or terminal is locking the output directory.')
        process.exit(1)
      }
    }
  }

  // Step 3: Run the build:win script
  console.log(`\n🔨 Compiling Windows Setup executable...`)
  try {
    execute('pnpm -F @proj-airi/stage-tamagotchi run build:win')
  }
  catch (error) {
    console.error('❌ Build execution failed.')
    process.exit(1)
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

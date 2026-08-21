import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const pocketDir = join(here, '..')
const rootDir = join(pocketDir, '../..')
const xcodeProj = join(pocketDir, 'ios/App/App.xcodeproj')
const buildDir = join(pocketDir, 'build')
const archivePath = join(buildDir, 'App.xcarchive')

// Read root or tamagotchi version
let version = '0.9.26-stable.20260820'
try {
  const pkgTamagotchi = JSON.parse(readFileSync(join(rootDir, 'apps/stage-tamagotchi/package.json'), 'utf-8'))
  if (pkgTamagotchi.version)
    version = pkgTamagotchi.version
}
catch {}

console.info(`[build:ipa] Staging iOS IPA build for version: ${version}`)

// 1. Build web bundle & sync capacitor iOS
console.info('[build:ipa] Step 1/4: Building web bundle & syncing Capacitor iOS...')
execSync('pnpm run build && pnpm exec cap sync ios', { cwd: pocketDir, stdio: 'inherit' })

// 2. Clean previous build archives
if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true, force: true })
}
mkdirSync(buildDir, { recursive: true })

// 3. Run xcodebuild archive
console.info('[build:ipa] Step 2/4: Running xcodebuild archive...')
const archiveCmd = [
  'xcodebuild archive',
  `-project "${xcodeProj}"`,
  '-scheme App',
  '-configuration Release',
  '-destination "generic/platform=iOS"',
  `-archivePath "${archivePath}"`,
  '-allowProvisioningUpdates',
  'CODE_SIGN_STYLE=Automatic',
].join(' ')

execSync(archiveCmd, { cwd: pocketDir, stdio: 'inherit' })

// 4. Package .app from archive into .ipa
console.info('[build:ipa] Step 3/4: Packaging App.app into .ipa bundle...')
const appBundle = join(archivePath, 'Products/Applications/App.app')
if (!existsSync(appBundle)) {
  throw new Error(`[build:ipa] App.app bundle not found at expected path: ${appBundle}`)
}

const stagingDir = join(buildDir, 'ipa-staging')
const payloadDir = join(stagingDir, 'Payload')
mkdirSync(payloadDir, { recursive: true })
cpSync(appBundle, join(payloadDir, 'App.app'), { recursive: true })

const ipaFileName = `AIRI-${version}-ios.ipa`
const ipaOutputPath = join(buildDir, ipaFileName)
const genericIpaPath = join(buildDir, 'App.ipa')

execSync(`zip -r -y "${ipaOutputPath}" Payload`, { cwd: stagingDir, stdio: 'ignore' })
cpSync(ipaOutputPath, genericIpaPath)
rmSync(stagingDir, { recursive: true, force: true })

console.info(`[build:ipa] Step 4/4: Successfully generated IPA: ${ipaOutputPath}`)

// 5. Check if upload requested
const args = process.argv.slice(2)
if (args.includes('--upload') || process.env.UPLOAD_RELEASE === 'true') {
  const tag = `v${version}`
  console.info(`[build:ipa] Uploading ${ipaFileName} to GitHub Release ${tag}...`)
  execSync(`env GITHUB_TOKEN="" gh release upload "${tag}" "${ipaOutputPath}" --repo dasilva333/airi --clobber`, {
    cwd: rootDir,
    stdio: 'inherit',
  })
  console.info(`[build:ipa] Successfully uploaded ${ipaFileName} to release ${tag}!`)
}

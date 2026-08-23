import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { env, platform } from 'node:process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rootDir = join(here, '..')
const mateEngineDir = join(rootDir, 'mate-engine')
const buildDir = join(mateEngineDir, 'Build')
const binDir = join(rootDir, 'bin')
const distDir = join(rootDir, 'dist')

// Read version from package.json
const pkgJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
const version = pkgJson.version ?? '3.4.1'
const releaseTag = env.STAGEMATE_RELEASE_TAG || `stagemate-v${version}`
const fallbackTag = 'stagemate-engine-v3.4'

const targetArg = process.argv[2] ?? (platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : 'linux')

function ensureGhCli(): void {
  const res = spawnSync('gh', ['--version'], { stdio: 'ignore', shell: true })
  if (res.status !== 0) {
    console.error('[release] Error: GitHub CLI (gh) is not installed or not in PATH. Please install gh CLI.')
    process.exit(1)
  }
}

function runBuild(target: string): void {
  console.log(`[release] Building Stage-Mate companion runtime for ${target}...`)
  const res = spawnSync('pnpm', ['run', `build:${target}`], { cwd: rootDir, stdio: 'inherit', shell: true })
  if (res.status !== 0) {
    console.error(`[release] Build failed for ${target}. Aborting release.`)
    process.exit(1)
  }
}

function createZip(target: string): string {
  mkdirSync(distDir, { recursive: true })

  if (target === 'mac' || target === 'osx') {
    const zipName = 'StageMate-macOS.zip'
    const zipPath = join(distDir, zipName)
    if (existsSync(zipPath))
      rmSync(zipPath)

    const appPath = join(binDir, 'StageMate.app')
    if (!existsSync(appPath)) {
      throw new Error(`Expected StageMate.app not found at ${appPath}`)
    }

    console.log(`[release] Compressing ${appPath} -> ${zipPath}...`)
    execSync(`ditto -c -k --sequesterRsrc --keepParent "${appPath}" "${zipPath}"`, { stdio: 'inherit' })
    return zipPath
  }

  if (target === 'win' || target === 'windows') {
    const zipName = 'StageMate-Windows.zip'
    const zipPath = join(distDir, zipName)
    if (existsSync(zipPath))
      rmSync(zipPath)

    const winSource = existsSync(join(buildDir, 'Windows')) ? join(buildDir, 'Windows') : binDir
    console.log(`[release] Compressing Windows bundle from ${winSource} -> ${zipPath}...`)

    if (platform === 'win32') {
      try {
        execSync(`tar -a -cf "${zipPath}" -C "${winSource}" .`, { stdio: 'inherit' })
      }
      catch {
        execSync(`powershell -Command "Compress-Archive -Path '${winSource}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' })
      }
    }
    else {
      execSync(`cd "${winSource}" && zip -r -q "${zipPath}" .`, { stdio: 'inherit' })
    }
    return zipPath
  }

  if (target === 'linux') {
    const zipName = 'StageMate-Linux.zip'
    const zipPath = join(distDir, zipName)
    if (existsSync(zipPath))
      rmSync(zipPath)

    const linuxSource = existsSync(join(buildDir, 'Linux')) ? join(buildDir, 'Linux') : binDir
    console.log(`[release] Compressing Linux bundle from ${linuxSource} -> ${zipPath}...`)
    execSync(`cd "${linuxSource}" && zip -r -q "${zipPath}" .`, { stdio: 'inherit' })
    return zipPath
  }

  throw new Error(`Unsupported release target: ${target}`)
}

const repoTarget = env.GITHUB_REPOSITORY || 'dasilva333/airi'

function uploadToGitHub(tag: string, zipPath: string): void {
  console.log(`[release] Publishing ${zipPath} to GitHub release tag: ${tag} on ${repoTarget}...`)

  // Check if tag/release already exists
  const check = spawnSync('gh', ['release', 'view', tag, '--repo', repoTarget], { stdio: 'ignore', shell: true })
  if (check.status === 0) {
    console.log(`[release] Release ${tag} found. Uploading asset with --clobber...`)
    execSync(`gh release upload "${tag}" "${zipPath}" --repo "${repoTarget}" --clobber`, { stdio: 'inherit' })
  }
  else {
    console.log(`[release] Release ${tag} does not exist. Creating release...`)
    execSync(`gh release create "${tag}" "${zipPath}" --repo "${repoTarget}" --title "Stage-Mate Companion Runtime v${version}" --notes "Prebuilt companion runtime binaries for Stage-Mate sidecar."`, { stdio: 'inherit' })
  }
}

async function main() {
  console.log(`=== Stage-Mate Release Pipeline (v${version}) ===`)
  ensureGhCli()

  const targets = targetArg === 'all' ? ['mac', 'win', 'linux'] : [targetArg]

  for (const t of targets) {
    runBuild(t)
    const zipPath = createZip(t)

    // 1. Upload to the version-pinned release tag (e.g. stagemate-v3.4.1)
    uploadToGitHub(releaseTag, zipPath)

    // 2. Also update the fallback legacy tag (stagemate-engine-v3.4) for older checkouts
    try {
      uploadToGitHub(fallbackTag, zipPath)
    }
    catch (err: any) {
      console.warn(`[release] Notice: Could not upload to fallback tag ${fallbackTag}: ${err.message}`)
    }

    console.log(`[release] Successfully built and published ${t} companion runtime!`)
  }
}

main().catch((err) => {
  console.error(`[release] Fatal error: ${err.message}`)
  process.exit(1)
})

// @ts-check
import { readFileSync } from 'node:fs'
import { env } from 'node:process'

import semver from 'semver'

import { defineConfig } from '@ergosphere-it/electron/config'

/**
 * Returns the channel that a version comes from.
 *
 * @param {string} version
 * @returns {'stable' | 'canary' | 'nightly' | 'dev'}
 */
function channelOfVersion(version) {
  const prerelease = semver.parse(version)?.prerelease ?? []
  const name = String(prerelease[0] ?? '').toLowerCase()
  if (name === 'dev' || name === 'nightly')
    return name
  if (prerelease.length > 0)
    return 'canary'

  return 'stable'
}

// CI names each build in `ERGOSPHERE_IT_VERSION`, for example `0.13.1-nightly.12.13eef81`. The build uses the same name.
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const version = env.ERGOSPHERE_IT_VERSION || packageJson.version

export default defineConfig({
  // The app can switch to another channel at run time, see `src/main/services/electron/auto-updater.ts`.
  channel: env.AIRI_UPDATE_CHANNEL || channelOfVersion(version),
  // Steam updates the Steam build. Flatpak and Nix are known only at runtime, see src/launcher/index.ts.
  disabled: env.VITE_DISTRIBUTION === 'steam',
  // Feed URL pointing to Cloudflare worker distribution
  feedUrl: env.AIRI_UPDATE_FEED_URL || 'https://airi-updates.r1ch4rd.workers.dev',
  nativeVersion: 1,
  publicKeys: env.AIRI_UPDATE_PUBLIC_KEY
    ? [env.AIRI_UPDATE_PUBLIC_KEY]
    : ['ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIF/K7mT48suu2Or2Pnu8HQK/BKL92+WbH+mO6/DxlA8y airi-ota-updater'],
})

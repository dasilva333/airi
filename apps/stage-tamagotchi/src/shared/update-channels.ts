import type { UpdateChannel } from '@proj-airi/electron-eventa/electron-updater'

import semver from 'semver'

import { updateChannels } from '@proj-airi/electron-eventa/electron-updater'

export { updateChannels }
export type { UpdateChannel }

/**
 * Returns the channel that a version comes from. With no channel chosen by the user,
 * the app follows this channel, and `ergo.config.ts` builds it in.
 *
 * The first prerelease identifier names the channel: `dev` for a build of main, `nightly` for the build of a day, and
 * any other name for a release candidate / canary.
 *
 * @example
 * channelOfVersion('0.13.1-dev.821.13eef81') // 'dev'
 * channelOfVersion('0.13.1-nightly.12.13eef81') // 'nightly'
 * channelOfVersion('0.14.0-rc.1') // 'canary'
 * channelOfVersion('0.13.0') // 'stable'
 */
export function channelOfVersion(version: string): UpdateChannel {
  const prerelease = semver.parse(version)?.prerelease ?? []
  const name = String(prerelease[0] ?? '').toLowerCase()
  if (name === 'dev' || name === 'nightly')
    return name
  if (prerelease.length > 0)
    return 'canary'

  return 'stable'
}

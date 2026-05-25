import { abbreviatedSha, branch } from '~build/git'
import { version } from '~build/package'
import buildTime from '~build/time'

export function useBuildInfo() {
  return {
    branch,
    builtOn: buildTime.toISOString(),
    commit: abbreviatedSha,
    version: version ?? 'dev',
  }
}

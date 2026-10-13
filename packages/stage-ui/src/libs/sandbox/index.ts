import { SandboxManager } from './manager'

export type { PersistedWidget } from '../../database/repos/widgets.repo'
export { widgetsRepo } from '../../database/repos/widgets.repo'
export * from './ansi'
export * from './compiler-bridge'
export * from './export'
export * from './import'
export * from './jev'
export * from './manager'
export * from './projections'
export * from './srcdoc'
export * from './types'

let defaultSandboxInstance: SandboxManager | null = null

/**
 * Get or initialize the singleton SandboxManager instance
 */
export async function getSandboxManager(): Promise<SandboxManager> {
  if (!defaultSandboxInstance) {
    defaultSandboxInstance = new SandboxManager()
    await defaultSandboxInstance.init()
  }
  return defaultSandboxInstance
}

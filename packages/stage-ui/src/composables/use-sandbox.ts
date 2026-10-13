import type { PersistedWidget } from '../database/repos/widgets.repo'
import type { CommandLogEntry, ExecResult, MountedWidget, SandboxManager, VirtualFileEntry } from '../libs/sandbox'

import { onMounted, ref } from 'vue'

import { widgetsRepo } from '../database/repos/widgets.repo'
import { getSandboxManager, parseWidgetImportManifest } from '../libs/sandbox'

// NOTICE: shared module-level refs keep every useSandbox() caller (panel,
// floating layer, workspace sheet) on the same widget list. Per-call refs
// caused breakout updates in one surface to never reach the others.
const sharedSandbox = ref<SandboxManager | null>(null)
const sharedIsReady = ref(false)
const sharedIsExecuting = ref(false)
const sharedLastResult = ref<ExecResult | null>(null)
const sharedMountedWidgets = ref<MountedWidget[]>([])
const sharedCommandHistory = ref<CommandLogEntry[]>([])
let sharedListenersRegistered = false

export function useSandbox() {
  const sandbox = sharedSandbox
  const isReady = sharedIsReady
  const isExecuting = sharedIsExecuting
  const lastResult = sharedLastResult
  const mountedWidgets = sharedMountedWidgets
  const commandHistory = sharedCommandHistory

  async function init() {
    if (sandbox.value) {
      // Refresh from singleton in case another surface mutated it first.
      const current = sandbox.value
      mountedWidgets.value = [...current.mountedWidgets]
      commandHistory.value = [...current.commandHistory]
      isReady.value = true
      return
    }
    const instance = await getSandboxManager()
    sandbox.value = instance
    mountedWidgets.value = [...instance.mountedWidgets]
    commandHistory.value = [...instance.commandHistory]

    if (!sharedListenersRegistered) {
      sharedListenersRegistered = true
      instance.onMount(() => {
        mountedWidgets.value = [...instance.mountedWidgets]
      })

      instance.onCommand(() => {
        commandHistory.value = [...instance.commandHistory]
      })
    }

    isReady.value = true
  }

  async function exec(command: string): Promise<ExecResult> {
    await init()
    if (!sandbox.value) {
      throw new Error('Sandbox is not initialized')
    }

    isExecuting.value = true
    try {
      const res = await sandbox.value.exec(command)
      lastResult.value = res
      return res
    }
    finally {
      isExecuting.value = false
    }
  }

  async function readFile(path: string): Promise<string> {
    await init()
    if (!sandbox.value) {
      throw new Error('Sandbox is not initialized')
    }
    return await sandbox.value.readFile(path)
  }

  async function writeFile(path: string, content: string): Promise<void> {
    await init()
    if (!sandbox.value) {
      throw new Error('Sandbox is not initialized')
    }
    await sandbox.value.writeFile(path, content)
  }

  async function listFiles(dir = '/workspace'): Promise<VirtualFileEntry[]> {
    await init()
    if (!sandbox.value)
      return []
    return await sandbox.value.listFiles(dir)
  }

  function clearLogs(): void {
    if (sandbox.value) {
      sandbox.value.clearLogs()
      commandHistory.value = []
    }
  }

  async function reset(): Promise<void> {
    await init()
    if (!sandbox.value)
      return
    await sandbox.value.reset()
    mountedWidgets.value = []
    commandHistory.value = []
    lastResult.value = null
  }

  function unmountWidget(idOrPath: string): void {
    if (sandbox.value) {
      sandbox.value.unmountWidget(idOrPath)
      mountedWidgets.value = [...sandbox.value.mountedWidgets]
    }
  }

  function clearWidgets(): void {
    if (sandbox.value) {
      sandbox.value.clearWidgets()
      mountedWidgets.value = []
    }
  }

  async function setWidgetSurface(idOrPath: string, surface: 'panel' | 'widget'): Promise<void> {
    await init()
    if (sandbox.value) {
      await sandbox.value.setWidgetSurface(idOrPath, surface)
      mountedWidgets.value = [...sandbox.value.mountedWidgets]
    }
  }

  async function updateWidgetPosition(idOrPath: string, position: { x: number, y: number }): Promise<void> {
    await init()
    if (sandbox.value) {
      await sandbox.value.updateWidgetPosition(idOrPath, position)
      mountedWidgets.value = [...sandbox.value.mountedWidgets]
    }
  }

  async function mountPersistedWidget(idOrPath: string, surface?: 'panel' | 'widget'): Promise<void> {
    await init()
    if (sandbox.value) {
      await sandbox.value.mountPersistedWidget(idOrPath, surface)
      mountedWidgets.value = [...sandbox.value.mountedWidgets]
    }
  }

  async function getPersistedWidgets(): Promise<PersistedWidget[]> {
    return await widgetsRepo.getWidgets()
  }

  async function deletePersistedWidget(idOrPath: string): Promise<void> {
    if (sandbox.value) {
      sandbox.value.unmountWidget(idOrPath)
      mountedWidgets.value = [...sandbox.value.mountedWidgets]
    }
    await widgetsRepo.removeWidget(idOrPath)
  }

  async function importWidget(
    manifestInput: string | Record<string, unknown>,
    options?: { mount?: boolean, surface?: 'panel' | 'widget' },
  ): Promise<PersistedWidget> {
    await init()
    const widget = parseWidgetImportManifest(manifestInput)
    if (options?.surface) {
      widget.surface = options.surface
      widget.target = options.surface === 'widget' ? 'window' : 'sidepanel'
    }
    await widgetsRepo.saveWidget(widget)
    if (options?.mount !== false) {
      if (sandbox.value) {
        await sandbox.value.mountPersistedWidget(widget.id, widget.surface)
        mountedWidgets.value = [...sandbox.value.mountedWidgets]
      }
    }
    return widget
  }

  onMounted(() => {
    void init()
  })

  return {
    sandbox,
    isReady,
    isExecuting,
    lastResult,
    mountedWidgets,
    commandHistory,
    init,
    exec,
    listFiles,
    clearLogs,
    readFile,
    writeFile,
    reset,
    unmountWidget,
    clearWidgets,
    setWidgetSurface,
    updateWidgetPosition,
    mountPersistedWidget,
    getPersistedWidgets,
    deletePersistedWidget,
    importWidget,
  }
}

import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

import starterCustomTerminalIcon from '../assets/widgets/starter-custom-terminal.avif'

export type DashboardModuleId
  = | 'stage'
    | 'nan0'
    | 'memories'
    | 'scene'
    | 'media'
    | 'widgets'
    | 'terminal'

export interface DashboardModuleDef {
  id: DashboardModuleId
  title: string
  subtitle: string
  icon: string
  iconColorClass?: string
  image?: string
}

export const ALL_DASHBOARD_MODULES: DashboardModuleDef[] = [
  {
    id: 'widgets',
    title: 'Widgets',
    subtitle: 'Interactive tools and mini apps',
    icon: 'i-solar:widget-5-bold-duotone',
    iconColorClass: 'text-emerald-500 dark:text-emerald-400',
  },
  {
    id: 'terminal',
    title: 'Virtual Terminal',
    subtitle: 'Workspace commands and output',
    icon: 'i-solar:code-square-bold-duotone',
    iconColorClass: 'text-emerald-600 dark:text-emerald-400',
    image: starterCustomTerminalIcon,
  },
  {
    id: 'memories',
    title: 'Memories',
    subtitle: 'Character memory and recall',
    icon: 'i-solar:book-2-bold-duotone',
    iconColorClass: 'text-amber-500 dark:text-amber-400',
  },
  {
    id: 'stage',
    title: 'Stage',
    subtitle: 'Companion viewport',
    icon: 'i-solar:smile-circle-bold-duotone',
    iconColorClass: 'text-pink-500 dark:text-pink-400',
  },
  {
    id: 'nan0',
    title: 'Nan0 Cognition',
    subtitle: 'Somatic state and reflexes',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    iconColorClass: 'text-cyan-500 dark:text-cyan-400',
  },
  {
    id: 'scene',
    title: 'Current Scene',
    subtitle: 'Scene state and context',
    icon: 'i-solar:gallery-bold-duotone',
    iconColorClass: 'text-sky-500 dark:text-sky-400',
  },
  {
    id: 'media',
    title: 'Media Gallery',
    subtitle: 'Images and generated media',
    icon: 'i-solar:album-bold-duotone',
    iconColorClass: 'text-violet-500 dark:text-violet-400',
  },
]

export interface SmartDashboardContext {
  hasDisplayModel?: boolean
  isNan0Active?: boolean
  hasMemories?: boolean
  hasMedia?: boolean
  hasScene?: boolean
  isSandboxActive?: boolean
}

/**
 * Computes an intelligent, contextual initial list of dashboard modules
 * based on whether features/data actually exist for the current character and session.
 */
export function computeSmartInitialDashboardModules(ctx: SmartDashboardContext): DashboardModuleId[] {
  const result: DashboardModuleId[] = []

  // 1. Stage (if a display model is attached)
  if (ctx.hasDisplayModel) {
    result.push('stage')
  }

  // 2. Nan0 Cognition (if active on this card)
  if (ctx.isNan0Active) {
    result.push('nan0')
  }

  // 3. Widgets (always available as interactive mini-apps)
  result.push('widgets')

  // 4. Virtual Terminal (if sandbox is active)
  if (ctx.isSandboxActive) {
    result.push('terminal')
  }

  // 5. Memories (if any journal/daily summary/echo records exist)
  if (ctx.hasMemories) {
    result.push('memories')
  }

  // 6. Scene & Media (if visual assets or scenes are present)
  if (ctx.hasScene) {
    result.push('scene')
  }
  if (ctx.hasMedia) {
    result.push('media')
  }

  // Fallback for completely fresh/empty cards: provide a balanced starter set
  if (result.length === 0) {
    return ['widgets', 'terminal', 'memories']
  }

  return result
}

export type DashboardMode = 'view' | 'customize'

export function useChatDashboard() {
  const mode = ref<DashboardMode>('view')

  // Persisted active modules (ordered list)
  const activeModuleIds = useLocalStorage<DashboardModuleId[]>('airi:chat:dashboard-active-modules', [
    'widgets',
    'terminal',
    'memories',
  ])

  // Persisted collapsed states per module
  const collapsedStates = useLocalStorage<Record<string, boolean>>('airi:chat:dashboard-collapsed', {
    stage: true,
  })

  // Has the dashboard ever been initialized with smart defaults?
  const hasInitialized = useLocalStorage<boolean>('airi:chat:dashboard-has-initialized', false)

  const activeModules = computed(() => {
    const map = new Map(ALL_DASHBOARD_MODULES.map(m => [m.id, m]))
    return activeModuleIds.value
      .map(id => map.get(id))
      .filter((m): m is DashboardModuleDef => Boolean(m))
  })

  const availableModules = computed(() => {
    const activeSet = new Set(activeModuleIds.value)
    return ALL_DASHBOARD_MODULES.filter(m => !activeSet.has(m.id))
  })

  function initializeIfFresh(ctx: SmartDashboardContext) {
    if (!hasInitialized.value) {
      const smartList = computeSmartInitialDashboardModules(ctx)
      activeModuleIds.value = smartList
      hasInitialized.value = true
    }
  }

  function isCollapsed(id: DashboardModuleId): boolean {
    return Boolean(collapsedStates.value[id])
  }

  function toggleCollapse(id: DashboardModuleId) {
    collapsedStates.value = {
      ...collapsedStates.value,
      [id]: !collapsedStates.value[id],
    }
  }

  function setCollapsed(id: DashboardModuleId, collapsed: boolean) {
    collapsedStates.value = {
      ...collapsedStates.value,
      [id]: collapsed,
    }
  }

  function addModule(id: DashboardModuleId) {
    if (!activeModuleIds.value.includes(id)) {
      activeModuleIds.value = [...activeModuleIds.value, id]
    }
  }

  function hideModule(id: DashboardModuleId) {
    activeModuleIds.value = activeModuleIds.value.filter(item => item !== id)
  }

  function moveModule(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= activeModuleIds.value.length)
      return
    if (toIndex < 0 || toIndex >= activeModuleIds.value.length)
      return

    const updated = [...activeModuleIds.value]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    activeModuleIds.value = updated
  }

  function moveModuleByStep(id: DashboardModuleId, direction: 'up' | 'down') {
    const index = activeModuleIds.value.indexOf(id)
    if (index === -1)
      return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    moveModule(index, targetIndex)
  }

  function isModuleActive(id: DashboardModuleId): boolean {
    return activeModuleIds.value.includes(id)
  }

  function restoreDefaults(smartCtx?: SmartDashboardContext) {
    if (smartCtx) {
      activeModuleIds.value = computeSmartInitialDashboardModules(smartCtx)
    }
    else {
      activeModuleIds.value = ['widgets', 'terminal', 'memories']
    }
  }

  return {
    mode,
    activeModuleIds,
    activeModules,
    availableModules,
    collapsedStates,
    isCollapsed,
    toggleCollapse,
    setCollapsed,
    addModule,
    hideModule,
    isModuleActive,
    moveModule,
    moveModuleByStep,
    initializeIfFresh,
    restoreDefaults,
  }
}

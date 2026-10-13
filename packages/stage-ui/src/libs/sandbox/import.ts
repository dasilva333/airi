import type { PersistedWidget } from '../../database/repos/widgets.repo'
import type { WidgetExportManifest } from './export'

/**
 * Parses and validates an exported widget manifest JSON string or object,
 * normalizing it into a clean PersistedWidget record ready for repo storage and mounting.
 */
export function parseWidgetImportManifest(input: string | Record<string, unknown> | WidgetExportManifest): PersistedWidget {
  let raw: Record<string, unknown>
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input)
    }
    catch (err: any) {
      throw new Error(`Failed to parse widget manifest JSON: ${err.message || 'Syntax error'}`)
    }
  }
  else if (typeof input === 'object' && input !== null) {
    raw = input as Record<string, unknown>
  }
  else {
    throw new Error('Invalid widget manifest: input must be a JSON string or object')
  }

  const code = (typeof raw.code === 'string' && raw.code.trim())
    ? raw.code
    : (typeof raw.sourceCode === 'string' && raw.sourceCode.trim() ? raw.sourceCode : '')

  const sourceCode = typeof raw.sourceCode === 'string' && raw.sourceCode.trim()
    ? raw.sourceCode
    : undefined

  if (!code && !sourceCode) {
    throw new Error('Invalid widget manifest: missing code or sourceCode')
  }

  const rawTitle = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim()
    : 'Imported Widget'

  const safeSlug = rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'widget'

  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : `widget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  let path = typeof raw.path === 'string' && raw.path.trim() ? raw.path.trim() : ''
  let sourcePath = typeof raw.sourcePath === 'string' && raw.sourcePath.trim() ? raw.sourcePath.trim() : undefined

  if (!path) {
    if (sourcePath) {
      path = sourcePath.endsWith('.ts') ? sourcePath.replace(/\.ts$/, '.js') : sourcePath
    }
    else {
      path = `/workspace/${safeSlug}.js`
    }
  }

  if (!sourcePath && sourceCode) {
    sourcePath = path.endsWith('.js') ? path.replace(/\.js$/, '.ts') : `/workspace/${safeSlug}.ts`
  }

  const surface: 'panel' | 'widget' = (raw.surface === 'widget' || raw.surface === 'panel')
    ? raw.surface
    : (raw.target === 'window' ? 'widget' : 'panel')

  const target = (raw.target === 'window' || raw.target === 'sidepanel' || raw.target === 'inline')
    ? raw.target
    : (surface === 'widget' ? 'window' : 'sidepanel')

  const position = (raw.position && typeof (raw.position as any).x === 'number' && typeof (raw.position as any).y === 'number')
    ? { x: (raw.position as any).x, y: (raw.position as any).y }
    : undefined

  const state = (typeof raw.state === 'object' && raw.state !== null && !Array.isArray(raw.state))
    ? (raw.state as Record<string, unknown>)
    : {}

  const scope: 'global' | 'card' = raw.scope === 'card' ? 'card' : 'global'
  const cardId = typeof raw.cardId === 'string' && raw.cardId.trim() ? raw.cardId.trim() : undefined

  const now = Date.now()

  return {
    id,
    title: rawTitle,
    path,
    sourcePath,
    sourceCode,
    code: code || sourceCode || '',
    surface,
    target,
    position,
    state,
    scope,
    cardId,
    isMounted: false,
    mountedAt: now,
    updatedAt: now,
  }
}

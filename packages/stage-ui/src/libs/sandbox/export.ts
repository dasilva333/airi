import type { PersistedWidget } from '../../database/repos/widgets.repo'
import type { MountedWidget } from './types'

export interface WidgetExportManifest {
  version: '1.0'
  id: string
  title: string
  scope?: 'global' | 'card'
  cardId?: string
  surface?: 'panel' | 'widget'
  target?: 'sidepanel' | 'inline' | 'window'
  position?: { x: number, y: number }
  state: Record<string, unknown>
  sourcePath?: string
  sourceCode?: string
  code: string
  exportedAt: number
}

/**
 * Creates a clean, schema-compliant JSON manifest from any mounted or persisted widget.
 */
export function buildWidgetExportManifest(widget: MountedWidget | PersistedWidget): WidgetExportManifest {
  return {
    version: '1.0',
    id: widget.id,
    title: widget.title || widget.path?.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Widget',
    scope: (widget as any).scope || 'global',
    cardId: (widget as any).cardId,
    surface: widget.surface || 'panel',
    target: widget.target,
    position: widget.position,
    state: widget.state || {},
    sourcePath: widget.sourcePath,
    sourceCode: widget.sourceCode,
    code: widget.code,
    exportedAt: Date.now(),
  }
}

/**
 * Copies the serialized widget manifest directly to the user's system clipboard.
 */
export async function copyWidgetManifestToClipboard(widget: MountedWidget | PersistedWidget): Promise<boolean> {
  const manifest = buildWidgetExportManifest(widget)
  const json = JSON.stringify(manifest, null, 2)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(json)
      return true
    }
    catch (e) {
      console.warn('[Sandbox] Failed to write widget manifest to clipboard:', e)
    }
  }
  return false
}

/**
 * Triggers a browser download of the widget manifest as a timestamped .json file.
 */
export function downloadWidgetManifestFile(widget: MountedWidget | PersistedWidget): void {
  const manifest = buildWidgetExportManifest(widget)
  const json = JSON.stringify(manifest, null, 2)
  const rawTitle = manifest.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'widget'
  const filename = `${rawTitle}_${manifest.exportedAt}.json`

  if (typeof document !== 'undefined') {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

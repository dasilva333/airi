/**
 * Pure export-filename policy for Hacker Studio.
 *
 * Characterization source: `vrm-vhack/HackerPanel.vue` prior to the adapter
 * extraction. Keep these rules stable while the VRM exporter moves behind the
 * adapter boundary.
 */

export interface ModelNameSources {
  metaName?: string | null
  metaTitle?: string | null
  displayModelName?: string | null
  displayModelFileName?: string | null
  selectedFileName?: string | null
  selectedUrl?: string | null
  displayModelUrl?: string | null
  cardName?: string | null
  selectedModelId?: string | null
}

export function sanitizeModelBaseName(value?: string | null): string {
  if (!value)
    return ''
  let name = value.trim()
  try {
    name = decodeURIComponent(name)
  }
  catch {}
  name = name.split(/[?#]/)[0]
  name = name.split(/[\\/]/).pop() || name
  name = name.replace(/\.(vrm|glb|gltf|zip|pmx|pmd)$/i, '')
  name = name.replace(/^(display-model-|preset-)/i, '')
  name = name.replace(/[<>:"|?*\u0000-\u001F]/g, '_')
  name = name.replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^[._]+|[._]+$/g, '')
  return name.slice(0, 64)
}

export function modelNameFromUrl(url?: string | null): string {
  if (!url || url.startsWith('blob:') || url.startsWith('data:'))
    return ''
  try {
    return new URL(url).pathname.split('/').pop() || ''
  }
  catch {
    return url.split('/').pop() || ''
  }
}

export function resolveModelBaseName(sources: ModelNameSources): string {
  const candidates = [
    sources.metaName,
    sources.metaTitle,
    sources.displayModelName,
    sources.displayModelFileName,
    sources.selectedFileName,
    modelNameFromUrl(sources.selectedUrl),
    sources.displayModelUrl ? modelNameFromUrl(sources.displayModelUrl) : '',
    sources.cardName,
    sources.selectedModelId,
  ]
  for (const candidate of candidates) {
    const name = sanitizeModelBaseName(candidate)
    if (name)
      return name
  }
  return 'Avatar'
}

export function exportTimestamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

export function buildExportFileName(
  sources: ModelNameSources,
  now: Date = new Date(),
  extension = 'vrm',
  label = 'VHACK',
): string {
  return `${resolveModelBaseName(sources)}_${label}_${exportTimestamp(now)}.${extension}`
}

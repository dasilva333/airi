import type { ProviderMetadata } from '../stores/providers/types'
import type { CatalogNodeItem } from './settings-catalog'

import { getAllCatalogItems } from './settings-catalog'

export interface SearchItem {
  id: string
  title: string
  category: string
  description?: string
  to: string
  icon?: string
  keywords?: string[]
}

/**
 * Converts a canonical CatalogNodeItem into a SearchItem for autocomplete indexing.
 */
export function convertCatalogItemToSearchItem(item: CatalogNodeItem): SearchItem | null {
  if (item.id === 'hub' || item.kind === 'root') {
    return null
  }

  let category = item.clusterGroup || 'Settings'
  if (item.kind === 'area') {
    category = 'Primary Page'
  }
  else if (item.kind === 'tool') {
    category = 'Developer Tools'
  }
  else if (item.parentId === 'area-modules') {
    category = 'Modules'
  }
  else if (item.parentId === 'area-system') {
    category = 'System Preferences'
  }
  else if (item.parentId === 'area-models') {
    category = 'Companion Avatars'
  }
  else if (item.parentId === 'area-memory') {
    category = 'Memory Systems'
  }
  else if (item.parentId === 'prov-cat-chat') {
    category = 'Providers (Chat)'
  }
  else if (item.parentId === 'prov-cat-speech') {
    category = 'Providers (Speech)'
  }
  else if (item.parentId === 'prov-cat-stt') {
    category = 'Providers (Hearing)'
  }
  else if (item.parentId === 'prov-cat-artistry') {
    category = 'Providers (Artistry)'
  }
  else if (item.parentId === 'prov-cat-motion') {
    category = 'Providers (Motion)'
  }
  else if (item.parentId === 'prov-cat-cloud') {
    category = 'Providers (Cloud)'
  }

  const cleanCategory = category.replace(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, '').trim() || category

  const routeSegments = item.route ? item.route.split('/').filter(Boolean) : []
  const keywords = [
    item.id,
    item.label,
    item.shortLabel || '',
    ...routeSegments,
    ...(item.keywords || []),
  ].filter(Boolean)

  return {
    id: item.id,
    title: item.label,
    category: cleanCategory,
    description: item.description,
    to: item.route || '/settings',
    icon: item.icon || 'i-solar:settings-bold-duotone',
    keywords,
  }
}

/**
 * Converts a live ProviderMetadata instance from the provider registry into a SearchItem.
 */
export function convertProviderMetadataToSearchItem(p: ProviderMetadata): SearchItem {
  const categoryNameMap: Record<string, string> = {
    chat: 'Providers (Chat)',
    speech: 'Providers (Speech)',
    transcription: 'Providers (Hearing)',
    embed: 'Providers (Embedding)',
    vision: 'Providers (Vision)',
    artistry: 'Providers (Artistry)',
    motion: 'Providers (Motion)',
    cloud: 'Providers (Cloud)',
  }

  const categoryLabel = categoryNameMap[p.category] || `Providers (${p.category})`
  const routeCategory = (p.id === 'blip-local' || p.category === 'vision')
    ? 'chat'
    : (p.category === 'transcription' ? 'transcription' : p.category)
  const to = `/settings/providers/${routeCategory}/${p.id}`

  const keywords = [
    p.id,
    p.name,
    p.category,
    p.deployment || '',
    ...(p.tasks || []),
  ].filter(Boolean)

  return {
    id: `prov-${p.id}`,
    title: p.name,
    category: categoryLabel,
    description: p.description || `${p.name} ${p.category} provider`,
    to,
    icon: p.icon || (p.deployment === 'local' ? 'i-solar:cpu-bold-duotone' : 'i-solar:cloud-bold-duotone'),
    keywords,
  }
}

/**
 * Static baseline index dynamically generated from the canonical Settings Catalog and Provider Registry.
 *
 * NOTICE: the unified-registry sweep only covers `defineProvider` backends.
 * Legacy speech/transcription providers (Kokoro, Pocket, MOSS, Ming, Whisper…)
 * ride in through the live `allProvidersMetadata` sweep in SettingsSearchBar
 * instead — see `rankSearchResults` below for how exact matches stay visible.
 */
export const staticIndex: SearchItem[] = getAllCatalogItems()
  .map(convertCatalogItemToSearchItem)
  .filter((item): item is SearchItem => item !== null)

/**
 * Match tier for relevance ranking: title hits outrank id/route hits, which
 * outrank keyword hits, which outrank bare description/category substring hits.
 * Without this, an exact provider-name match sorts wherever the catalog order
 * put it and can fall off the dropdown slice behind substring noise
 * (e.g. "ming" matching "streaming" in a dozen descriptions).
 */
export function searchMatchTier(item: SearchItem, query: string): number {
  const q = query.toLowerCase()
  if (item.title.toLowerCase().includes(q))
    return 0
  if (item.id.toLowerCase().includes(q) || item.to.toLowerCase().includes(q))
    return 1
  if (item.keywords?.some(k => k.toLowerCase().includes(q)))
    return 2
  return 3
}

/**
 * Stable relevance sort for filtered search results: exact title/id/route
 * matches first, description-only substring matches last. Same-tier order is
 * preserved, so callers can still `.slice(0, N)` for the dropdown.
 */
export function rankSearchResults(items: SearchItem[], query: string): SearchItem[] {
  const q = query.trim().toLowerCase()
  return [...items].sort((a, b) => searchMatchTier(a, q) - searchMatchTier(b, q))
}

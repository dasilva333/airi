import { MMDLoader } from '@moeru/three-mmd'
import type { LoadingManager } from 'three'
import { LoadingManager as ThreeLoadingManager } from 'three'

/**
 * Create an MMDLoader with an optional custom LoadingManager.
 *
 * Use when:
 * - Loading PMX/PMD model files, optionally with a custom manager for texture URL remapping
 *
 * Returns:
 * - A new MMDLoader instance configured with the given manager
 */
export function createMMDLoader(manager?: LoadingManager): MMDLoader {
  return new MMDLoader([], manager)
}
/**
 * Create a LoadingManager that remaps texture URLs to blob URLs from a file map.
 *
 * Use when:
 * - Loading an MMD model from a blob URL where textures are also stored as blobs
 *
 * Expects:
 * - A Map of relative filename/path (lowercase) -> blob URL
 *
 * Returns:
 * - A LoadingManager with URL modifier that resolves texture paths from the map
 */
export function createTextureRemappingManager(textureMap: Map<string, string>): LoadingManager {
  const manager = new ThreeLoadingManager()

  console.log('[MMD:Loader] Creating manager. Map keys:', Array.from(textureMap.keys()))

  manager.setURLModifier((url: string) => {
    console.log('[MMD:Loader] Requested URL:', url)

    // Normalize slashes and lowercase
    const normalizedUrl = url.replace(/\\/g, '/').toLowerCase()

    // 1. Try exact match on the full normalized URL
    if (textureMap.has(normalizedUrl)) {
      console.log('[MMD:Loader] Resolved (exact match):', normalizedUrl)
      return textureMap.get(normalizedUrl)!
    }

    // 2. Try progressively shorter paths (suffixes)
    const pathParts = normalizedUrl.split('/')
    for (let i = 0; i < pathParts.length; i++) {
      const candidate = pathParts.slice(i).join('/')
      if (textureMap.has(candidate)) {
        console.log('[MMD:Loader] Resolved (suffix match):', candidate)
        return textureMap.get(candidate)!
      }
    }

    // 3. Last resort: just the filename
    const filename = pathParts[pathParts.length - 1]
    if (filename && textureMap.has(filename)) {
      console.log('[MMD:Loader] Resolved (filename fallback):', filename)
      return textureMap.get(filename)!
    }

    console.warn('[MMD:Loader] Texture not found in map for URL:', url)
    return url
  })

  return manager
}

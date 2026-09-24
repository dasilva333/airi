/**
 * Resolves the URL for a built-in MMD animation (.vmd), handling:
 * 1. Electron production builds (file:///.../index.html)
 * 2. Web deployments with base paths (e.g. /airi/)
 * 3. Local Vite dev server (http://localhost:5173/)
 */
export function resolveBuiltinMmdAnimationUrl(name: string, baseUrl?: string, docHref?: string): string {
  const base = baseUrl ?? (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) ?? './'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const relativePath = `${normalizedBase}assets/mmd/animations/${name}`
  const targetDoc = docHref ?? (typeof window !== 'undefined' && window.location ? window.location.href : '')
  if (targetDoc) {
    try {
      const docBase = targetDoc.split('#')[0]
      return new URL(relativePath, docBase).href
    }
    catch {}
  }
  return relativePath
}

/**
 * Returns the MMD-relevant animation names from card idleAnimations,
 * stripping foreign prefixes (live2d:, spine:) and stripping the mmd: prefix
 * so names match the registered VMD motion filenames.
 */
export function parseMmdCycleAnimations(idleAnimations: string[] | undefined): string[] {
  if (!idleAnimations || idleAnimations.length === 0)
    return []
  return idleAnimations
    .filter(key => typeof key === 'string' && !key.startsWith('live2d:') && !key.startsWith('spine:'))
    .map(key => key.startsWith('mmd:') ? key.slice('mmd:'.length) : key)
}

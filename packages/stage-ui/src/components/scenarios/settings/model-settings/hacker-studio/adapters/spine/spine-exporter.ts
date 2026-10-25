import JSZip from 'jszip'

export interface SpinePageMutation {
  /** ZIP path of the atlas page, e.g. `textures/body.png`. */
  path: string
  /** Base64 PNG payload. */
  data: string
}

export interface SpineExportOptions {
  source: ArrayBuffer
  atlasPath: string
  mutations: SpinePageMutation[]
}

function findZipKey(zip: JSZip, path: string): string | undefined {
  const files = Object.keys(zip.files)
  const exact = files.find(file => file === path)
  if (exact)
    return exact
  const lower = path.toLowerCase()
  return files.find(file => file.toLowerCase() === lower)
}

export async function exportSpineZip(options: SpineExportOptions): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(options.source)
  const atlasKey = findZipKey(zip, options.atlasPath)
  if (!atlasKey)
    throw new Error('Spine atlas not found in bundle')

  if (!zip.file(atlasKey))
    throw new Error('Spine atlas could not be read from bundle')

  for (const mutation of options.mutations) {
    const pageKey = findZipKey(zip, mutation.path)
    if (pageKey)
      zip.file(pageKey, mutation.data, { base64: true })
    else
      zip.file(mutation.path, mutation.data, { base64: true })
  }

  // NOTICE: do not rewrite the per-page `size:` header. Spine derives each
  // region's normalized UVs from that header; changing only the header while
  // leaving the region coordinates intact distorts sampling. The atlas remains
  // the source of truth, and the replacement image is sampled by normalized UVs.
  return zip.generateAsync({ type: 'uint8array' })
}

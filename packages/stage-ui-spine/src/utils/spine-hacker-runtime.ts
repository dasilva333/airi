import type { ManagedWebGLRenderingContext, TextureAtlas, TextureAtlasPage } from '@esotericsoftware/spine-webgl'

import type { SpineModelLayout } from './spine-zip-loader'

import { shallowRef } from 'vue'

/**
 * Live Spine handles needed by Hacker Studio.
 *
 * These are raw runtime objects and must never be placed in Pinia. The shallow
 * module ref lets the UI adapter observe load/unload without proxying the atlas
 * or WebGL context.
 */
export interface SpineHackerRuntime {
  atlas: TextureAtlas
  context: ManagedWebGLRenderingContext
  layout: SpineModelLayout
  variantName?: string
  sourceBuffer?: ArrayBuffer
  premultipliedAlpha: boolean
  modelId?: string
  /** Uses the dynamically loaded Spine runtime's own GLTexture/context pair. */
  createTexture: (image: HTMLImageElement | ImageBitmap, page: TextureAtlasPage) => any
  /** Owner token so an unmounting old scene cannot clear a newer runtime. */
  token?: symbol
}

const runtime = shallowRef<SpineHackerRuntime | null>(null)

export function useSpineHackerRuntime() {
  return runtime
}

export function setSpineHackerRuntime(value: SpineHackerRuntime | null) {
  runtime.value = value
}

export function clearSpineHackerRuntime(token?: symbol) {
  if (token && runtime.value?.token !== token)
    return
  runtime.value = null
}

export function createSpinePageTexture(
  activeRuntime: SpineHackerRuntime,
  image: HTMLImageElement | ImageBitmap,
  page: TextureAtlasPage,
): any {
  return activeRuntime.createTexture(image, page)
}

export interface Live2DBaseTextureLike {
  width?: number
  height?: number
}

export interface Live2DTextureLike<TBase = any> {
  baseTexture: TBase
  update: () => void
}

export interface Live2DDrawableLike<TBase = any> {
  texture?: Live2DTextureLike<TBase>
}

export interface BaseTextureSwap<TBase = any> {
  previous: TBase
  next: TBase
  swappedDrawables: Live2DDrawableLike<TBase>[]
}

/**
 * The “nuclear swap” that actually updates the displayed Live2D model: replace
 * the target texture's baseTexture and repoint drawables that still reference
 * the previous baseTexture. This is intentionally kept pure so it can be tested
 * without Pixi/WebGL.
 */
export function replaceBaseTexture<TBase>(
  target: Live2DTextureLike<TBase>,
  next: TBase,
  drawables: Live2DDrawableLike<TBase>[] = [],
): BaseTextureSwap<TBase> {
  const previous = target.baseTexture
  target.baseTexture = next
  target.update()

  const swappedDrawables: Live2DDrawableLike<TBase>[] = []
  for (const drawable of drawables) {
    if (drawable.texture && drawable.texture.baseTexture === previous) {
      drawable.texture.baseTexture = next
      drawable.texture.update()
      swappedDrawables.push(drawable)
    }
  }

  return { previous, next, swappedDrawables }
}

export function restoreBaseTexture<TBase>(
  target: Live2DTextureLike<TBase>,
  original: Pick<BaseTextureSwap<TBase>, 'previous' | 'swappedDrawables'>,
): void {
  target.baseTexture = original.previous
  target.update()

  for (const drawable of original.swappedDrawables) {
    if (!drawable.texture)
      continue
    drawable.texture.baseTexture = original.previous
    drawable.texture.update()
  }
}

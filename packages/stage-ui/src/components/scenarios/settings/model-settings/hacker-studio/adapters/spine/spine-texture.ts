export interface SpineAtlasPageLike {
  texture: any
  setTexture: (texture: any) => void
}

export interface SpinePageTextureSwap {
  previousTexture: any
  nextTexture: any
}

export function replaceSpinePageTexture(page: SpineAtlasPageLike, nextTexture: any): SpinePageTextureSwap {
  const swap = {
    previousTexture: page.texture,
    nextTexture,
  }
  page.setTexture(nextTexture)
  return swap
}

export function restoreSpinePageTexture(page: SpineAtlasPageLike, swap: SpinePageTextureSwap): void {
  page.setTexture(swap.previousTexture)
}

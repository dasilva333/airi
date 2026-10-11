export interface DestroyableLive2dModel {
  destroy?: (options?: { children?: boolean, texture?: boolean, baseTexture?: boolean }) => void
  internalModel?: {
    destroy?: () => void
  }
}

/**
 * Safely destroys a Live2D model instance and ensures its allocated textures
 * and baseTextures are released from Pixi's GPU texture cache.
 */
export function destroyLive2dModel(target?: DestroyableLive2dModel | null): void {
  if (!target)
    return

  try {
    if (typeof target.destroy === 'function') {
      target.destroy({ texture: true, baseTexture: true })
    }
    else if (target.internalModel && typeof target.internalModel.destroy === 'function') {
      target.internalModel.destroy()
    }
  }
  catch (err) {
    console.warn('[destroyLive2dModel] Error destroying Live2D model instance:', err)
  }
}

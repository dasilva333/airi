import { FileLoader, Live2DFactory, ZipLoader } from 'pixi-live2d-display/cubism4'

import { live2dEncodeFilenamesMiddleware } from './live2d-uri-encode-filenames'
import { OPFSCacheV2 } from './opfs-loader'

const zipLoaderIndex = Live2DFactory.live2DModelMiddlewares.indexOf(ZipLoader.factory)

if (Live2DFactory.live2DModelMiddlewares.includes(OPFSCacheV2.checkMiddlewareV2)) {
  // Middlewares already registered.
} else if (zipLoaderIndex !== -1) {
  // Insert Check before ZipLoader
  Live2DFactory.live2DModelMiddlewares.splice(zipLoaderIndex, 0, OPFSCacheV2.checkMiddlewareV2)
  // Insert Save after ZipLoader
  Live2DFactory.live2DModelMiddlewares.splice(zipLoaderIndex + 2, 0, OPFSCacheV2.saveMiddlewareV2)
} else {
  console.warn('[OPFS] ZipLoader not found in middlewares, caching disabled')
}

// A middleware to URI-encode possible filenames in settings to handle filenames with UTF-8 characters.
if (!Live2DFactory.live2DModelMiddlewares.includes(live2dEncodeFilenamesMiddleware)) {
  // Insert before FileLoader
  const insertBefore = Live2DFactory.live2DModelMiddlewares.indexOf(FileLoader.factory)
  if (insertBefore >= 0) {
    Live2DFactory.live2DModelMiddlewares.splice(insertBefore, 0, live2dEncodeFilenamesMiddleware)
  }
}

// Monkeypatch ZipLoader.unzip to sanitize manifest settings in-memory before pixi-live2d-display parses them,
// preventing WebGL initialization crashes (TypeError: Parameter 'url' must be a string) on custom/non-standard triggers.
const originalUnzip = ZipLoader.unzip
ZipLoader.unzip = function (reader: any, settings: any) {
  if (settings) {
    // Sanitize motions
    if (settings.motions && typeof settings.motions === 'object') {
      for (const [groupName, motions] of Object.entries(settings.motions)) {
        if (Array.isArray(motions)) {
          settings.motions[groupName] = motions.filter((motion: any) => {
            return (
              (typeof motion?.file === 'string' && motion.file.trim() !== '') ||
              (typeof motion?.File === 'string' && motion.File.trim() !== '')
            )
          })
        }
      }
    }
    // Sanitize expressions
    if (settings.expressions && Array.isArray(settings.expressions)) {
      settings.expressions = settings.expressions.filter((exp: any) => {
        return (
          (typeof exp?.file === 'string' && exp.file.trim() !== '') ||
          (typeof exp?.File === 'string' && exp.File.trim() !== '')
        )
      })
    }
  }
  return originalUnzip.call(this, reader, settings)
}

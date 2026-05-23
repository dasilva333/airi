import type { Live2DFactoryContext, Middleware } from 'pixi-live2d-display/cubism4'

function tryEncode(obj: any, prop: string | number) {
  if (obj?.[prop] && typeof obj[prop] === 'string') {
    obj[prop] = encodeURI(obj[prop])
  }
}

// A middleware to URI-encode possible filenames in settings to handle filenames with UTF-8 characters.
export const live2dEncodeFilenamesMiddleware: Middleware<Live2DFactoryContext> = (context, next) => {
  if (typeof context.source !== 'object' || !context.source)
    return next()

  // Be skeptical
  const settings = context.source.settings as any
  if (!settings)
    return next()

  // In-memory sanitization of motions to prevent WebGL/ZipLoader URL resolution crashes on custom scripting entries
  // Keeps array length identical, but deletes the empty property so the loader skips it without shifting indices
  if (settings.motions && typeof settings.motions === 'object') {
    for (const motions of Object.values(settings.motions)) {
      if (Array.isArray(motions)) {
        for (const motion of motions) {
          if (motion && typeof motion === 'object') {
            if (typeof motion.file === 'string' && motion.file.trim() === '') {
              delete motion.file
            }
            if (typeof motion.File === 'string' && motion.File.trim() === '') {
              delete motion.File
            }
          }
        }
      }
    }
  }

  // In-memory sanitization of expressions without shifting indices
  if (settings.expressions && Array.isArray(settings.expressions)) {
    for (const exp of settings.expressions) {
      if (exp && typeof exp === 'object') {
        if (typeof exp.file === 'string' && exp.file.trim() === '') {
          delete exp.file
        }
        if (typeof exp.File === 'string' && exp.File.trim() === '') {
          delete exp.File
        }
      }
    }
  }

  tryEncode(settings, 'moc')
  if (Array.isArray(settings.textures)) {
    for (let i = 0; i < settings.textures.length; i++) {
      tryEncode(settings.textures, i)
    }
  }
  tryEncode(settings, 'physics')
  tryEncode(settings, 'url')

  return next()
}

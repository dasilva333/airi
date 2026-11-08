import type { SpineVersion } from './spine-version'

export type SpineRuntime = typeof import('@esotericsoftware/spine-webgl-4-0')
  | typeof import('@esotericsoftware/spine-webgl-4-1')
  | typeof import('@esotericsoftware/spine-webgl')

/**
 * Updates a skeleton with its matching runtime. Spine 4.2 requires a physics mode.
 * Rejects a skeleton from another runtime before it can change world transforms.
 */
export function updateSpineWorldTransform(
  runtime: SpineRuntime,
  skeleton: InstanceType<SpineRuntime['Skeleton']>,
  physics?: import('@esotericsoftware/spine-webgl').Physics,
): void {
  if ('Physics' in runtime && skeleton instanceof runtime.Skeleton) {
    skeleton.updateWorldTransform(physics ?? runtime.Physics.update)
    return
  }

  if (!('Physics' in runtime) && skeleton instanceof runtime.Skeleton) {
    skeleton.updateWorldTransform()
    return
  }

  throw new Error('The skeleton does not belong to the selected Spine runtime.')
}

/**
 * Lazily loads the spine-webgl runtime for the given Spine version.
 *
 * Use when:
 * - The skeleton version has been detected and we need the matching runtime
 *   to parse and render the model correctly.
 *
 * Expects:
 * - A valid SpineVersion ('4.0', '4.1', or '4.2').
 *
 * Returns:
 * - The full spine-webgl module namespace for that version.
 */
export async function loadSpineRuntime(version: SpineVersion): Promise<typeof import('@esotericsoftware/spine-webgl')> {
  let runtime: typeof import('@esotericsoftware/spine-webgl')
  switch (version) {
    case '4.0':
      runtime = await import('@esotericsoftware/spine-webgl-4-0') as unknown as typeof import('@esotericsoftware/spine-webgl')
      break
    case '4.1':
      runtime = await import('@esotericsoftware/spine-webgl-4-1') as unknown as typeof import('@esotericsoftware/spine-webgl')
      break
    case '4.2':
      runtime = await import('@esotericsoftware/spine-webgl')
      break
    default:
      throw new Error(`Spine version ${version} is not supported yet.`)
  }

  if (runtime.GLTexture) {
    (runtime.GLTexture as any).DISABLE_UNPACK_PREMULTIPLIED_ALPHA_WEBGL = true
  }

  return runtime
}

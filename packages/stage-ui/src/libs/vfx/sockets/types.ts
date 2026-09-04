import type { Object3D, Quaternion, Vector3, Vector4 } from 'three'

export type AvatarSocketName
  = | 'head'
    | 'chest'
    | 'hips'
    | 'leftWrist'
    | 'rightWrist'
    | 'leftAnkle'
    | 'rightAnkle'
    | 'leftLowerArm'
    | 'rightLowerArm'
    | 'root'

export interface BoneSegmentDef {
  parent: Object3D
  bone: Object3D
  radius: number
  weight: number
}

export interface AvatarTransform {
  position: Vector3
  rotation: Quaternion
  scale: Vector3
}

export interface AvatarSocketResolver {
  readonly modelType: 'vrm' | 'mmd' | 'generic'
  readonly root: Object3D
  readonly height: number

  getBoneNode: (socket: AvatarSocketName) => Object3D | null
  getWorldTransform: (socket: AvatarSocketName) => AvatarTransform | null
  getAvailableSockets: () => AvatarSocketName[]

  /**
   * Packs skeletal limb segments into world-space Vector4 arrays for GPU flame / arc shaders.
   * `a[i]` carries (worldX, worldY, worldZ, limbHalfWidth)
   * `b[i]` carries (worldX, worldY, worldZ, 0)
   * Returns the count of active segments.
   */
  writeBoneSegments: (a: Vector4[], b: Vector4[]) => number

  update?: (dt: number) => void
  dispose?: () => void
}

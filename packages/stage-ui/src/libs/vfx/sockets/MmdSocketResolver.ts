import type { Bone, Object3D, SkinnedMesh, Vector4 } from 'three'

import type { AvatarSocketName, AvatarSocketResolver, AvatarTransform } from './types'

import { Box3, Quaternion, Vector3 } from 'three'

const MMD_BONE_DICTIONARY: Record<AvatarSocketName, string[]> = {
  head: ['頭', 'Head', 'head'],
  chest: ['胸', '上半身2', '上半身', 'Chest', 'chest', 'UpperBody'],
  hips: ['下半身', '腰', 'Hips', 'hips', 'LowerBody'],
  leftWrist: ['左手首', '左手', 'LeftWrist', 'leftWrist', 'LeftHand'],
  rightWrist: ['右手首', '右手', 'RightWrist', 'rightWrist', 'RightHand'],
  leftLowerArm: ['左ひじ', 'LeftElbow', 'leftElbow', 'LeftLowerArm'],
  rightLowerArm: ['右ひじ', 'RightElbow', 'rightElbow', 'RightLowerArm'],
  leftAnkle: ['左足首', 'LeftAnkle', 'leftAnkle', 'LeftFoot'],
  rightAnkle: ['右足首', 'RightAnkle', 'rightAnkle', 'RightFoot'],
  root: ['全ての親', 'センター', 'Root', 'root'],
}

const MMD_LIMB_PAIRS: { parentNames: string[], childNames: string[], radiusFraction: number, weight: number }[] = [
  { parentNames: ['下半身', 'Hips'], childNames: ['上半身', 'Spine'], radiusFraction: 0.09, weight: 2 },
  { parentNames: ['上半身', 'Spine'], childNames: ['胸', '上半身2', 'Chest'], radiusFraction: 0.09, weight: 2 },
  { parentNames: ['胸', '上半身2', 'Chest'], childNames: ['首', 'Neck'], radiusFraction: 0.08, weight: 2 },
  { parentNames: ['首', 'Neck'], childNames: ['頭', 'Head'], radiusFraction: 0.06, weight: 1 },

  { parentNames: ['左腕', 'LeftArm'], childNames: ['左ひじ', 'LeftElbow'], radiusFraction: 0.045, weight: 2 },
  { parentNames: ['左ひじ', 'LeftElbow'], childNames: ['左手首', 'LeftWrist'], radiusFraction: 0.038, weight: 2 },
  { parentNames: ['右腕', 'RightArm'], childNames: ['右ひじ', 'RightElbow'], radiusFraction: 0.045, weight: 2 },
  { parentNames: ['右ひじ', 'RightElbow'], childNames: ['右手首', 'RightWrist'], radiusFraction: 0.038, weight: 2 },

  { parentNames: ['左足', 'LeftLeg'], childNames: ['左ひざ', 'LeftKnee'], radiusFraction: 0.06, weight: 2 },
  { parentNames: ['左ひざ', 'LeftKnee'], childNames: ['左足首', 'LeftAnkle'], radiusFraction: 0.048, weight: 2 },
  { parentNames: ['右足', 'RightLeg'], childNames: ['右ひざ', 'RightKnee'], radiusFraction: 0.06, weight: 2 },
  { parentNames: ['右ひざ', 'RightKnee'], childNames: ['右足首', 'RightAnkle'], radiusFraction: 0.048, weight: 2 },
]

const _scratchPos = new Vector3()
const _scratchQuat = new Quaternion()
const _scratchScale = new Vector3()
const _scratchBox = new Box3()

export class MmdSocketResolver implements AvatarSocketResolver {
  public readonly modelType = 'mmd'
  public readonly root: Object3D
  public height = 1.65

  private _bones: Map<string, Bone> = new Map()
  private _segments: { parent: Object3D, child: Object3D, radius: number }[] = []

  constructor(mmdRoot: Object3D) {
    this.root = mmdRoot
    this._indexBones()
    this._measureHeight()
    this._buildSegments()
  }

  private _indexBones() {
    this._bones.clear()
    this.root.traverse((child) => {
      if ((child as SkinnedMesh).isSkinnedMesh) {
        const mesh = child as SkinnedMesh
        if (mesh.skeleton?.bones) {
          for (const bone of mesh.skeleton.bones) {
            if (bone.name)
              this._bones.set(bone.name, bone)
          }
        }
      }
      else if ((child as any).isBone) {
        this._bones.set(child.name, child as Bone)
      }
    })
  }

  private _measureHeight() {
    _scratchBox.setFromObject(this.root)
    const size = _scratchBox.getSize(_scratchPos)
    this.height = size.y > 0.2 ? size.y : 1.65
  }

  private _findBone(candidates: string[]): Bone | null {
    for (const name of candidates) {
      const match = this._bones.get(name)
      if (match)
        return match
    }
    return null
  }

  private _buildSegments() {
    this._segments = []
    for (const pair of MMD_LIMB_PAIRS) {
      const parent = this._findBone(pair.parentNames)
      const child = this._findBone(pair.childNames)
      if (parent && child) {
        for (let w = 0; w < pair.weight; w++) {
          this._segments.push({
            parent,
            child,
            radius: this.height * pair.radiusFraction,
          })
        }
      }
    }
  }

  getBoneNode(socket: AvatarSocketName): Object3D | null {
    if (socket === 'root')
      return this.root
    const candidates = MMD_BONE_DICTIONARY[socket] || []
    return this._findBone(candidates)
  }

  getWorldTransform(socket: AvatarSocketName): AvatarTransform | null {
    const node = this.getBoneNode(socket)
    if (!node)
      return null

    node.updateWorldMatrix(true, false)
    node.matrixWorld.decompose(_scratchPos, _scratchQuat, _scratchScale)

    return {
      position: _scratchPos.clone(),
      rotation: _scratchQuat.clone(),
      scale: _scratchScale.clone(),
    }
  }

  getAvailableSockets(): AvatarSocketName[] {
    const allSockets: AvatarSocketName[] = [
      'head',
      'chest',
      'hips',
      'leftWrist',
      'rightWrist',
      'leftLowerArm',
      'rightLowerArm',
      'leftAnkle',
      'rightAnkle',
      'root',
    ]
    return allSockets.filter(s => this.getBoneNode(s) !== null)
  }

  writeBoneSegments(a: Vector4[], b: Vector4[]): number {
    const count = Math.min(this._segments.length, a.length, b.length)

    for (let i = 0; i < count; i++) {
      const seg = this._segments[i]
      seg.parent.updateWorldMatrix(true, false)
      seg.child.updateWorldMatrix(true, false)

      seg.parent.getWorldPosition(_scratchPos)
      a[i].set(_scratchPos.x, _scratchPos.y, _scratchPos.z, seg.radius)

      seg.child.getWorldPosition(_scratchPos)
      b[i].set(_scratchPos.x, _scratchPos.y, _scratchPos.z, 0)
    }

    return count
  }

  update(_dt: number) {
    this.root.updateMatrixWorld(true)
  }
}

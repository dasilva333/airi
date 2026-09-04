import type { VRM } from '@pixiv/three-vrm'
import type { VRMHumanBoneName } from '@pixiv/three-vrm-core'
import type { Object3D, Vector4 } from 'three'

import type { AvatarSocketName, AvatarSocketResolver, AvatarTransform } from './types'

import { Box3, Quaternion, Vector3 } from 'three'

interface BonePair {
  parentName: VRMHumanBoneName
  childName: VRMHumanBoneName
  radiusFraction: number
  weight: number
}

const VRM_LIMB_PAIRS: BonePair[] = [
  { parentName: 'hips', childName: 'spine', radiusFraction: 0.09, weight: 2 },
  { parentName: 'spine', childName: 'chest', radiusFraction: 0.09, weight: 2 },
  { parentName: 'chest', childName: 'neck', radiusFraction: 0.08, weight: 2 },
  { parentName: 'neck', childName: 'head', radiusFraction: 0.06, weight: 1 },

  { parentName: 'leftUpperArm', childName: 'leftLowerArm', radiusFraction: 0.045, weight: 2 },
  { parentName: 'leftLowerArm', childName: 'leftHand', radiusFraction: 0.038, weight: 2 },
  { parentName: 'rightUpperArm', childName: 'rightLowerArm', radiusFraction: 0.045, weight: 2 },
  { parentName: 'rightLowerArm', childName: 'rightHand', radiusFraction: 0.038, weight: 2 },

  { parentName: 'leftUpperLeg', childName: 'leftLowerLeg', radiusFraction: 0.06, weight: 2 },
  { parentName: 'leftLowerLeg', childName: 'leftFoot', radiusFraction: 0.048, weight: 2 },
  { parentName: 'rightUpperLeg', childName: 'rightLowerLeg', radiusFraction: 0.06, weight: 2 },
  { parentName: 'rightLowerLeg', childName: 'rightFoot', radiusFraction: 0.048, weight: 2 },
]

const _scratchPos = new Vector3()
const _scratchQuat = new Quaternion()
const _scratchScale = new Vector3()
const _scratchBox = new Box3()

export class VrmSocketResolver implements AvatarSocketResolver {
  public readonly modelType = 'vrm'
  public readonly vrm: VRM
  public readonly root: Object3D
  public height = 1.65

  private _segments: { parent: Object3D, child: Object3D, radius: number }[] = []

  constructor(vrm: VRM) {
    this.vrm = vrm
    this.root = vrm.scene

    this._measureHeight()
    this._buildSegments()
  }

  private _measureHeight() {
    _scratchBox.setFromObject(this.vrm.scene)
    const size = _scratchBox.getSize(_scratchPos)
    this.height = size.y > 0.2 ? size.y : 1.65
  }

  private _buildSegments() {
    this._segments = []
    const humanoid = this.vrm.humanoid
    if (!humanoid)
      return

    for (const pair of VRM_LIMB_PAIRS) {
      const parent = humanoid.getNormalizedBoneNode(pair.parentName) || humanoid.getRawBoneNode(pair.parentName)
      const child = humanoid.getNormalizedBoneNode(pair.childName) || humanoid.getRawBoneNode(pair.childName)

      if (parent && child) {
        // Apply weighting by slot repetition
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
    const humanoid = this.vrm.humanoid
    if (!humanoid)
      return null

    switch (socket) {
      case 'head':
        return humanoid.getNormalizedBoneNode('head') || humanoid.getRawBoneNode('head')
      case 'chest':
        return humanoid.getNormalizedBoneNode('chest')
          || humanoid.getNormalizedBoneNode('upperChest')
          || humanoid.getNormalizedBoneNode('spine')
          || humanoid.getRawBoneNode('chest')
      case 'hips':
        return humanoid.getNormalizedBoneNode('hips') || humanoid.getRawBoneNode('hips')
      case 'leftWrist':
        return humanoid.getNormalizedBoneNode('leftHand') || humanoid.getRawBoneNode('leftHand')
      case 'rightWrist':
        return humanoid.getNormalizedBoneNode('rightHand') || humanoid.getRawBoneNode('rightHand')
      case 'leftLowerArm':
        return humanoid.getNormalizedBoneNode('leftLowerArm') || humanoid.getRawBoneNode('leftLowerArm')
      case 'rightLowerArm':
        return humanoid.getNormalizedBoneNode('rightLowerArm') || humanoid.getRawBoneNode('rightLowerArm')
      case 'leftAnkle':
        return humanoid.getNormalizedBoneNode('leftFoot') || humanoid.getRawBoneNode('leftFoot')
      case 'rightAnkle':
        return humanoid.getNormalizedBoneNode('rightFoot') || humanoid.getRawBoneNode('rightFoot')
      case 'root':
        return this.vrm.scene
      default:
        return null
    }
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

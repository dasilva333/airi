import {
  BufferAttribute,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Sphere,
  Vector3,
} from 'three'

/**
 * Creates instanced ribbon geometry for electrical arcs, flame tongues, and arcane ribbons.
 * Nodes run along x (0 to 1), with strand instance index in attribute `aStrand`.
 */
export function createBoltRibbonGeometry(nodes = 72, strands = 24): InstancedBufferGeometry {
  const steps = Math.max(2, Math.round(nodes))
  const count = Math.max(1, Math.round(strands))

  const positions = new Float32Array(steps * 2 * 3)
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const o = i * 6
    positions[o + 0] = t
    positions[o + 1] = -1
    positions[o + 2] = 0
    positions[o + 3] = t
    positions[o + 4] = 1
    positions[o + 5] = 0
  }

  const indices = new Uint16Array((steps - 1) * 6)
  for (let i = 0; i < steps - 1; i++) {
    const a = i * 2
    const o = i * 6
    indices[o + 0] = a
    indices[o + 1] = a + 1
    indices[o + 2] = a + 2
    indices[o + 3] = a + 1
    indices[o + 4] = a + 3
    indices[o + 5] = a + 2
  }

  const strandIndex = new Float32Array(count)
  for (let i = 0; i < count; i++) strandIndex[i] = i

  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aStrand', new InstancedBufferAttribute(strandIndex, 1))
  geometry.setIndex(new BufferAttribute(indices, 1))
  geometry.instanceCount = count
  geometry.boundingSphere = new Sphere(new Vector3(), 1e4)
  return geometry
}

/**
 * Creates instanced icosphere geometry for orbiting embers and volumetric aura orbs.
 */
export function createOrbFieldGeometry(detail = 2, count = 8): InstancedBufferGeometry {
  const instances = Math.max(1, Math.round(count))
  const source = new IcosahedronGeometry(1, Math.max(0, Math.round(detail)))

  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', source.getAttribute('position').clone())
  if (source.index)
    geometry.setIndex(source.index.clone())

  const orbIndex = new Float32Array(instances)
  for (let i = 0; i < instances; i++) orbIndex[i] = i
  geometry.setAttribute('aOrb', new InstancedBufferAttribute(orbIndex, 1))

  geometry.instanceCount = instances
  geometry.boundingSphere = new Sphere(new Vector3(), 1e4)

  source.dispose()
  return geometry
}

/**
 * Polar coordinate and radial layout utilities for Stage Radial Menu.
 * Sourced from Stage-Mate CircleSelector.cs geometry and AIRI screen-space perspective.
 */

export interface PolarSliceLayout {
  index: number
  angleDeg: number
  startAngleDeg: number
  endAngleDeg: number
  x: number
  y: number
}

/**
 * Computes polar layout for N radial buttons evenly distributed around a circle.
 * 0 degrees represents 12 o'clock (top), rotating clockwise.
 */
export function computePolarLayout(
  count: number,
  radius: number,
  startOffsetDeg = 0,
): PolarSliceLayout[] {
  if (count <= 0)
    return []

  const sliceSpan = 360 / count
  const layouts: PolarSliceLayout[] = []

  for (let i = 0; i < count; i++) {
    const angleDeg = (i * sliceSpan + startOffsetDeg + 360) % 360
    const startAngleDeg = (angleDeg - sliceSpan / 2 + 360) % 360
    const endAngleDeg = (angleDeg + sliceSpan / 2 + 360) % 360

    const rad = (angleDeg * Math.PI) / 180
    const x = radius * Math.sin(rad)
    const y = -radius * Math.cos(rad)

    layouts.push({
      index: i,
      angleDeg,
      startAngleDeg,
      endAngleDeg,
      x,
      y,
    })
  }

  return layouts
}

/**
 * Converts a 2D pointer displacement (deltaX, deltaY from menu center) to the active slice index.
 * Returns null if the pointer is within the inner deadzone or outside the maximum interactive radius.
 */
export function getHoveredSliceIndex(
  deltaX: number,
  deltaY: number,
  count: number,
  deadzoneRadius = 24,
  outerRadius = 180,
): number | null {
  if (count <= 0)
    return null

  const distance = Math.hypot(deltaX, deltaY)
  if (distance < deadzoneRadius || distance > outerRadius)
    return null

  // In screen coordinates: +X is right, +Y is down.
  // 12 o'clock is deltaX=0, deltaY<0.
  // atan2(x, -y) gives 0 at 12 o'clock, +PI/2 at 3 o'clock, PI at 6 o'clock, -PI/2 at 9 o'clock.
  const angleRad = Math.atan2(deltaX, -deltaY)
  const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360
  const sliceSpan = 360 / count

  const index = Math.floor((angleDeg + sliceSpan / 2) / sliceSpan) % count
  return index
}

/**
 * Computes 3D parallax tilt angles towards the mouse cursor.
 * Port of Stage-Mate's `tiltTowardsMouse` (CircleSelector.cs:170-178).
 */
export function computeParallaxTilt(
  deltaX: number,
  deltaY: number,
  radius: number,
  maxTiltDeg = 14,
): { rotateX: number, rotateY: number } {
  if (radius <= 0)
    return { rotateX: 0, rotateY: 0 }

  const normX = Math.max(-1, Math.min(1, deltaX / radius))
  const normY = Math.max(-1, Math.min(1, deltaY / radius))

  // Hovering top (normY < 0) tilts top backward (rotateX > 0)
  const rotateX = -normY * maxTiltDeg
  const rotateY = normX * maxTiltDeg

  return { rotateX, rotateY }
}

/**
 * Clamps radial menu center coordinates so the circular wheel does not clip beyond stage viewport borders.
 */
export function clampRadialMenuPosition(
  headX: number,
  headY: number,
  containerW: number,
  containerH: number,
  menuRadius = 130,
  margin = 16,
  verticalOffset = 120,
): { x: number, y: number } {
  if (containerW <= 0 || containerH <= 0)
    return { x: headX, y: headY }

  const minX = menuRadius + margin
  const maxX = containerW - menuRadius - margin
  const minY = menuRadius + margin
  const maxY = containerH - menuRadius - margin

  const clampedX = Math.max(minX, Math.min(maxX, headX))
  // Places menu below the head anchor (torso/chest level) so the face is not blocked
  const preferredY = headY + verticalOffset
  const clampedY = Math.max(minY, Math.min(maxY, preferredY))

  return { x: clampedX, y: clampedY }
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number, y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

/**
 * Generates an SVG path `d` string for an annular (donut) sector between innerR and outerR.
 */
export function describeAnnularSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  let sweep = endAngleDeg - startAngleDeg
  if (sweep < 0)
    sweep += 360
  if (sweep >= 360)
    sweep = 359.999

  const largeArcFlag = sweep > 180 ? 1 : 0

  const startOuter = polarToCartesian(cx, cy, outerR, startAngleDeg)
  const endOuter = polarToCartesian(cx, cy, outerR, startAngleDeg + sweep)
  const startInner = polarToCartesian(cx, cy, innerR, startAngleDeg + sweep)
  const endInner = polarToCartesian(cx, cy, innerR, startAngleDeg)

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

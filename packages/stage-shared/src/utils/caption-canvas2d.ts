import type { BubbleBodyStyle, BubbleTailStyle } from './caption-sentiment'

/**
 * Canvas2D Vector Speech Bubble Options.
 */
export interface CanvasBubbleOptions {
  width: number
  height: number
  bodyStyle: BubbleBodyStyle
  tailStyle: BubbleTailStyle
  wagPhase?: number
  color: string
  fillColor?: string
  outlineWidth?: number
  outlineAlpha?: number
  fillAlpha?: number
}

/**
 * Draws the complete visible speech bubble path (body + active tail limb).
 */
export function drawCanvasBubbleBody(ctx: CanvasRenderingContext2D, opts: CanvasBubbleOptions): void {
  const { width, height, bodyStyle, tailStyle, wagPhase = 0 } = opts
  const halfW = width / 2
  const tailBaseHalf = Math.max(8, Math.round(width * 0.05))
  const tailHeight = Math.max(10, Math.round(width * 0.05))

  ctx.beginPath()

  if (bodyStyle === 'jagged-starburst') {
    // Jagged mountain peaks outer polygon pass (matching Live2D)
    const spikes = 16
    const topY = -height
    const botY = 0

    ctx.moveTo(-halfW, -height / 2)
    for (let i = 0; i <= spikes; i++) {
      const step = i / spikes
      const x = -halfW + step * width
      const spikeY = (i % 2 === 0) ? topY - 4 : topY + 4
      ctx.lineTo(x, spikeY)
    }
    ctx.lineTo(halfW + 4, -height / 2)

    // Right jagged edge
    ctx.lineTo(halfW, botY)

    // Bottom edge with jagged tail
    if (tailStyle !== 'none') {
      ctx.lineTo(tailBaseHalf, 0)
      ctx.lineTo(0, tailHeight + 4)
      ctx.lineTo(-tailBaseHalf, 0)
    }
    ctx.lineTo(-halfW, botY)
    ctx.closePath()
    return
  }

  if (bodyStyle === 'scalloped-cloud') {
    // Scalloped puffy thought cloud
    const r = Math.min(14, Math.round(height * 0.25))
    ctx.moveTo(-halfW + r, -height)

    // Top arcs
    ctx.lineTo(halfW - r, -height)
    ctx.arcTo(halfW, -height, halfW, -height + r, r)
    // Right arcs
    ctx.lineTo(halfW, -r)
    ctx.arcTo(halfW, 0, halfW - r, 0, r)
    // Bottom edge
    ctx.lineTo(-halfW + r, 0)
    ctx.arcTo(-halfW, 0, -halfW, -r, r)
    // Left arcs
    ctx.lineTo(-halfW, -height + r)
    ctx.arcTo(-halfW, -height, -halfW + r, -height, r)
    ctx.closePath()
    return
  }

  // Standard Rounded Bubble
  const radius = Math.min(12, Math.round(height * 0.22))
  ctx.moveTo(-halfW + radius, -height)

  // Top edge
  ctx.lineTo(halfW - radius, -height)
  ctx.arcTo(halfW, -height, halfW, -height + radius, radius)

  // Right edge
  ctx.lineTo(halfW, -radius)
  ctx.arcTo(halfW, 0, halfW - radius, 0, radius)

  // Bottom edge (Right side before tail)
  ctx.lineTo(tailBaseHalf, 0)

  // Dynamic Tail Morphing
  if (tailStyle === 'pointer') {
    ctx.lineTo(0, tailHeight)
    ctx.lineTo(-tailBaseHalf, 0)
  }
  else if (tailStyle === 'wagging') {
    const wagX = Math.sin(wagPhase) * (tailHeight * 0.8)
    ctx.bezierCurveTo(
      tailBaseHalf * 0.5,
      tailHeight * 0.4,
      wagX + tailBaseHalf,
      tailHeight * 0.7,
      wagX,
      tailHeight * 1.15,
    )
    ctx.bezierCurveTo(
      wagX - tailBaseHalf,
      tailHeight * 0.7,
      -tailBaseHalf * 0.5,
      tailHeight * 0.4,
      -tailBaseHalf,
      0,
    )
  }
  else if (tailStyle === 'heart-curl') {
    const curlX = tailHeight * 0.85
    ctx.bezierCurveTo(
      tailBaseHalf + 6,
      tailHeight * 0.3,
      curlX + 10,
      tailHeight * 0.6,
      curlX,
      tailHeight * 1.1,
    )
    ctx.bezierCurveTo(
      curlX - 10,
      tailHeight * 1.4,
      -tailBaseHalf - 4,
      tailHeight * 0.8,
      -tailBaseHalf,
      0,
    )
  }
  else if (tailStyle === 'droop') {
    ctx.bezierCurveTo(
      tailBaseHalf,
      tailHeight * 0.6,
      tailBaseHalf * 0.3,
      tailHeight * 1.4,
      -tailBaseHalf * 0.5,
      tailHeight * 1.3,
    )
    ctx.bezierCurveTo(
      -tailBaseHalf * 0.8,
      tailHeight * 1.0,
      -tailBaseHalf * 0.8,
      tailHeight * 0.5,
      -tailBaseHalf,
      0,
    )
  }
  else if (tailStyle === 'jagged-pointer') {
    ctx.lineTo(tailBaseHalf + 3, tailHeight * 0.3)
    ctx.lineTo(2, tailHeight * 0.5)
    ctx.lineTo(tailBaseHalf + 1, tailHeight * 0.8)
    ctx.lineTo(0, tailHeight * 1.2)
    ctx.lineTo(-tailBaseHalf * 0.5, tailHeight * 0.7)
    ctx.lineTo(-2, tailHeight * 0.4)
    ctx.lineTo(-tailBaseHalf, 0)
  }
  else {
    // 'none' or 'thought-dots'
    ctx.lineTo(-tailBaseHalf, 0)
  }

  // Bottom edge (Left side after tail)
  ctx.lineTo(-halfW + radius, 0)
  ctx.arcTo(-halfW, 0, -halfW, -radius, radius)

  // Left edge
  ctx.lineTo(-halfW, -height + radius)
  ctx.arcTo(-halfW, -height, -halfW + radius, -height, radius)
  ctx.closePath()
}

/**
 * Draws the interior clipping mask path (enclosing the bubble body only).
 */
export function drawCanvasInteriorMask(ctx: CanvasRenderingContext2D, opts: CanvasBubbleOptions): void {
  const { width, height, bodyStyle } = opts
  const halfW = width / 2
  ctx.beginPath()

  if (bodyStyle === 'jagged-starburst') {
    const spikes = 16
    const topY = -height
    const botY = 0

    ctx.moveTo(-halfW, -height / 2)
    for (let i = 0; i <= spikes; i++) {
      const step = i / spikes
      const x = -halfW + step * width
      const spikeY = (i % 2 === 0) ? topY - 4 : topY + 4
      ctx.lineTo(x, spikeY)
    }
    ctx.lineTo(halfW + 4, -height / 2)
    ctx.lineTo(halfW, botY)
    ctx.lineTo(-halfW, botY)
    ctx.closePath()
    return
  }

  const radius = Math.min(12, Math.round(height * 0.22))
  ctx.moveTo(-halfW + radius, -height)
  ctx.lineTo(halfW - radius, -height)
  ctx.arcTo(halfW, -height, halfW, -height + radius, radius)
  ctx.lineTo(halfW, -radius)
  ctx.arcTo(halfW, 0, halfW - radius, 0, radius)
  ctx.lineTo(-halfW + radius, 0)
  ctx.arcTo(-halfW, 0, -halfW, -radius, radius)
  ctx.lineTo(-halfW, -height + radius)
  ctx.arcTo(-halfW, -height, -halfW + radius, -height, radius)
  ctx.closePath()
}

/**
 * Draws auxiliary vector shapes (e.g. 3 thought cloud dots).
 */
export function drawCanvasAuxiliaryShapes(
  ctx: CanvasRenderingContext2D,
  opts: CanvasBubbleOptions,
): void {
  const { tailStyle, color, fillColor = '#FFFFFF' } = opts
  if (tailStyle !== 'thought-dots')
    return

  const dotSizes = [5, 3.5, 2]
  const dotOffsetsY = [8, 16, 23]
  const dotOffsetsX = [0, 2, 4]

  ctx.fillStyle = fillColor
  ctx.strokeStyle = color
  ctx.lineWidth = 1.8

  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(dotOffsetsX[i], dotOffsetsY[i], dotSizes[i], 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

/**
 * Draws crisp vector heart at (x, y).
 */
export function drawCanvasHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fillColor: string,
  alpha = 1,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fillColor
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.moveTo(0, size * 0.3)
  ctx.bezierCurveTo(-size * 0.5, -size * 0.3, -size, size * 0.2, 0, size)
  ctx.bezierCurveTo(size, size * 0.2, size * 0.5, -size * 0.3, 0, size * 0.3)
  ctx.fill()
  ctx.restore()
}

/**
 * Draws crisp vector raindrop at (x, y).
 */
export function drawCanvasRaindrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fillColor: string,
  alpha = 1,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fillColor
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.bezierCurveTo(size * 0.6, -size * 0.2, size * 0.6, size * 0.6, 0, size)
  ctx.bezierCurveTo(-size * 0.6, size * 0.6, -size * 0.6, -size * 0.2, 0, -size)
  ctx.fill()
  ctx.restore()
}

/**
 * Draws crisp vector 6-point star at (x, y).
 */
export function drawCanvas6PointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fillColor: string,
  alpha = 1,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fillColor
  ctx.translate(x, y)
  ctx.beginPath()
  const outerR = size
  const innerR = size * 0.4
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6 - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    const px = Math.cos(angle) * r
    const py = Math.sin(angle) * r
    if (i === 0)
      ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

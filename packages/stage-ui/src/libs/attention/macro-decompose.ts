import type { MirageBoundingBoxLike, SpatialCandidate } from './types'

export function computeZone(x1: number, y1: number, x2: number, y2: number): string {
  const width = x2 - x1
  const height = y2 - y1
  if (width >= 800 && height >= 800)
    return 'Full Screen'

  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  if (cy <= 130) {
    if (cx <= 320)
      return 'Top-Left Titlebar'
    if (cx >= 680)
      return 'Top-Right Toolbar'
    return 'Top Header'
  }
  if (cy >= 870) {
    if (cx <= 320)
      return 'Bottom-Left'
    if (cx >= 680)
      return 'Bottom-Right'
    return 'Bottom Dock / Footer'
  }
  if (cx <= 260)
    return 'Left Sidebar'
  if (cx >= 740)
    return 'Right Panel'
  if (cy <= 400)
    return 'Upper Canvas'
  if (cy >= 650)
    return 'Lower Canvas'
  return 'Center Canvas'
}

export function computeIoU(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number],
): number {
  const [ax1, ay1, ax2, ay2] = boxA
  const [bx1, by1, bx2, by2] = boxB

  const ix1 = Math.max(ax1, bx1)
  const iy1 = Math.max(ay1, by1)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)

  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const intersectionArea = iw * ih

  if (intersectionArea <= 0)
    return 0

  const areaA = Math.max(1, (ax2 - ax1) * (ay2 - ay1))
  const areaB = Math.max(1, (bx2 - bx1) * (by2 - by1))
  const unionArea = areaA + areaB - intersectionArea

  return unionArea > 0 ? intersectionArea / unionArea : 0
}

export function computeOverlapRatio(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number],
): number {
  const [ax1, ay1, ax2, ay2] = boxA
  const [bx1, by1, bx2, by2] = boxB

  const ix1 = Math.max(ax1, bx1)
  const iy1 = Math.max(ay1, by1)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)

  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const intersectionArea = iw * ih

  if (intersectionArea <= 0)
    return 0

  const areaA = Math.max(1, (ax2 - ax1) * (ay2 - ay1))
  const areaB = Math.max(1, (bx2 - bx1) * (by2 - by1))
  const minArea = Math.min(areaA, areaB)

  return minArea > 0 ? intersectionArea / minArea : 0
}

export function deduplicateCandidates(items: SpatialCandidate[]): SpatialCandidate[] {
  const result: SpatialCandidate[] = []

  for (const item of items) {
    const existingIndex = result.findIndex((existing) => {
      // Never merge a macro window with a small child control
      const existingIsMacro = existing.category === 'macro_window'
      const itemIsMacro = item.category === 'macro_window'
      if (existingIsMacro !== itemIsMacro)
        return false

      const iou = computeIoU(existing.bbox, item.bbox)
      if (iou >= 0.40)
        return true

      const overlap = computeOverlapRatio(existing.bbox, item.bbox)
      const areaA = Math.max(1, existing.width * existing.height)
      const areaB = Math.max(1, item.width * item.height)
      const areaRatio = Math.min(areaA, areaB) / Math.max(areaA, areaB)

      return overlap >= 0.70 && areaRatio >= 0.35
    })

    if (existingIndex === -1) {
      result.push({ ...item })
    }
    else {
      const existing = result[existingIndex]
      existing.tags = Array.from(new Set([...existing.tags, ...item.tags]))

      if (!existing.textSnippet && item.textSnippet) {
        existing.textSnippet = item.textSnippet
      }
      else if (existing.textSnippet && item.textSnippet && !existing.textSnippet.includes(item.textSnippet)) {
        if (item.textSnippet.length > existing.textSnippet.length) {
          existing.textSnippet = item.textSnippet
        }
      }

      if (existing.category === 'text_banner' && (item.category === 'action_control' || item.category === 'control_pill')) {
        existing.category = item.category
        existing.label = item.label
      }

      existing.confidence = Math.max(existing.confidence, item.confidence)
    }
  }

  return result
}

export function decomposeMacroFrame(
  parsed: { objects?: any[], text?: any[] },
  boxes: MirageBoundingBoxLike[] = [],
): SpatialCandidate[] {
  const rawObjects: any[] = Array.isArray(parsed.objects) ? parsed.objects : []
  const rawText: any[] = Array.isArray(parsed.text) ? parsed.text : []

  const rawList: SpatialCandidate[] = []

  rawObjects.forEach((obj: any, idx: number) => {
    const [x1, y1, x2, y2] = Array.isArray(obj.bbox) ? obj.bbox : [0, 0, 1000, 1000]
    const width = Math.max(1, x2 - x1)
    const height = Math.max(1, y2 - y1)
    const areaPercent = Number(((width * height) / 10000).toFixed(2))
    const zone = computeZone(x1, y1, x2, y2)
    const name = String(obj.name || obj.label || 'object').toLowerCase()
    const color = obj.description?.color || undefined
    const score = typeof obj.score === 'number' ? obj.score : 0.85

    // Associate overlapping / inside text
    const matchingText = rawText
      .filter((t: any) => {
        if (!Array.isArray(t.bbox))
          return false
        const [tx1, ty1, tx2, ty2] = t.bbox
        const tcx = (tx1 + tx2) / 2
        const tcy = (ty1 + ty2) / 2
        return tcx >= x1 - 15 && tcx <= x2 + 15 && tcy >= y1 - 15 && tcy <= y2 + 15
      })
      .map((t: any) => typeof t === 'string' ? t : (t.string || t.text || ''))
      .filter(Boolean)
      .join(' ')

    let category: SpatialCandidate['category'] = 'control_pill'
    let label = obj.name || 'UI Element'
    const tags: string[] = []

    if (color)
      tags.push(`#${color}`)

    if (name.includes('window') || (width >= 600 && height >= 600) || areaPercent >= 20) {
      category = 'macro_window'
      label = 'Software Window'
      tags.push('#macro_window', '#app_root')
    }
    else if (name.includes('sidebar') || name.includes('menu') || (height >= 400 && width >= 180) || areaPercent >= 8) {
      category = 'sub_panel'
      label = 'Sidebar Navigation'
      tags.push('#container', '#sidebar', '#navigation')
    }
    else if (name.includes('text') || name.includes('label')) {
      category = 'text_banner'
      label = matchingText ? 'Text Section' : 'Text Label'
      tags.push('#heading', '#label')
    }
    else if (name.includes('button')) {
      if (width >= 150 || areaPercent >= 1.0) {
        category = 'action_control'
        label = 'Primary Action'
        tags.push('#action_button', '#clickable')
      }
      else {
        category = 'control_pill'
        label = 'Button Control'
        tags.push('#button', '#control')
      }
    }
    else {
      tags.push('#element')
    }

    if (matchingText)
      tags.push('#has_text')

    const matchingBox: MirageBoundingBoxLike = boxes.find(b =>
      b.type === 'object'
      && Math.abs(b.left * 1000 - x1) < 2
      && Math.abs(b.top * 1000 - y1) < 2,
    ) || {
      top: y1 / 1000,
      left: x1 / 1000,
      bottom: y2 / 1000,
      right: x2 / 1000,
      label,
      confidence: score,
      type: 'object',
      text: matchingText || undefined,
    }

    rawList.push({
      id: `C${idx + 1}`,
      label,
      category,
      zone,
      bbox: [x1, y1, x2, y2],
      width,
      height,
      areaPercent,
      confidence: score,
      color,
      textSnippet: matchingText || undefined,
      tags,
      box: matchingBox,
    })
  })

  // 2. Incorporate standalone text blocks that weren't captured inside an object
  rawText.forEach((t: any, tidx: number) => {
    const textStr = typeof t === 'string' ? t : (t.string || t.text || '')
    if (!textStr || textStr.trim().length < 3)
      return
    const [tx1, ty1, tx2, ty2] = Array.isArray(t.bbox) ? t.bbox : [0, 0, 0, 0]

    const alreadyCovered = rawList.some(c =>
      c.textSnippet?.includes(textStr)
      || (tx1 >= c.bbox[0] - 10 && tx2 <= c.bbox[2] + 10 && ty1 >= c.bbox[1] - 10 && ty2 <= c.bbox[3] + 10),
    )
    if (alreadyCovered)
      return

    const width = Math.max(1, tx2 - tx1)
    const height = Math.max(1, ty2 - ty1)
    const areaPercent = Number(((width * height) / 10000).toFixed(2))
    const zone = computeZone(tx1, ty1, tx2, ty2)
    const score = typeof t.score === 'number' ? t.score : 0.75

    const matchingBox: MirageBoundingBoxLike = boxes.find(b =>
      b.type === 'text'
      && Math.abs(b.left * 1000 - tx1) < 2
      && Math.abs(b.top * 1000 - ty1) < 2,
    ) || {
      top: ty1 / 1000,
      left: tx1 / 1000,
      bottom: ty2 / 1000,
      right: tx2 / 1000,
      label: 'text',
      confidence: score,
      type: 'text',
      text: textStr,
    }

    rawList.push({
      id: `T${tidx + 1}`,
      label: width >= 180 ? 'Header Text' : 'Text Block',
      category: 'text_banner',
      zone,
      bbox: [tx1, ty1, tx2, ty2],
      width,
      height,
      areaPercent,
      confidence: score,
      textSnippet: textStr,
      tags: ['#text', '#extracted', width >= 180 ? '#headline' : '#body_text'],
      box: matchingBox,
    })
  })

  // Deduplicate overlapping multi-class boxes (Pascal VOC IoU >= 0.40)
  const deduplicated = deduplicateCandidates(rawList)

  const priorityOrder: Record<SpatialCandidate['category'], number> = {
    macro_window: 1,
    sub_panel: 2,
    action_control: 3,
    text_banner: 4,
    control_pill: 5,
  }

  const sorted = deduplicated.sort((a, b) => {
    const pDiff = (priorityOrder[a.category] || 99) - (priorityOrder[b.category] || 99)
    if (pDiff !== 0)
      return pDiff
    return b.areaPercent - a.areaPercent
  })

  return sorted.map((cand, idx) => ({
    ...cand,
    id: `C${idx + 1}`,
  }))
}

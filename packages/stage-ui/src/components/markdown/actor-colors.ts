import { isValidActorId } from '../../utils/chat-actor-slices'

export interface ActorColorOptions {
  actorId?: string
  startsActor?: boolean
}

export function formatActorName(id: string): string {
  const name = id.replace(/^(actress_|actor_)/i, '')
  const customNames: Record<string, string> = {
    cg1: 'Nia',
    cg2: 'Vara',
    juewa: 'Juewa',
    rumi: 'Rumi',
  }
  const lower = name.toLowerCase()
  if (customNames[lower])
    return customNames[lower]

  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function postProcessActorColors(html: string, options: ActorColorOptions = {}): string {
  const structuredActorId = isValidActorId(options.actorId) ? options.actorId : undefined
  if (!html.includes('[ACTOR:') && !structuredActorId)
    return html

  // Match standard paragraph <p>...</p> or list item <li>...</li> blocks.
  const blockRegex = /(<p>|<li>)([\s\S]*?)(<\/p>|<\/li>)/gi
  let activeActorId: string | undefined = structuredActorId
  let pendingChip = !!structuredActorId && options.startsActor === true

  return html.replace(blockRegex, (match, openTag, innerContent, closeTag) => {
    const markerRegex = /\[ACTOR:\s*([\w-]+)\s*\]/i
    const markerMatch = markerRegex.exec(innerContent)

    if (markerMatch) {
      activeActorId = markerMatch[1]
      innerContent = innerContent.replace(markerRegex, '')
      pendingChip = true
    }

    if (!activeActorId)
      return match

    let chipHtml = ''
    if (pendingChip) {
      const displayName = formatActorName(activeActorId)
      chipHtml = `<span class="actor-chip actor-chip-${activeActorId}">${displayName}</span>`
      pendingChip = false
    }

    return `${openTag}${chipHtml}<span class="actor-color-${activeActorId}">${innerContent}</span>${closeTag}`
  })
}

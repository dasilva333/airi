export type PeerRelationship = 'same-account' | 'external-friend'
export type PeerTrustState = 'pending' | 'trusted' | 'restricted' | 'blocked'

export interface BasePeer {
  id: string
  alias: string
  characterName: string
  avatarUrl?: string
  relationship: PeerRelationship
  trustState: PeerTrustState
  lastSeenTimestamp: number
  endpoints: {
    cloudflareWorkerUrl?: string
    libp2pMultiaddrs?: string[]
  }
}

export interface SameAccountDevice extends BasePeer {
  relationship: 'same-account'
  machineId: string
  deviceType: 'desktop' | 'laptop' | 'pocket-mobile'
  edgeVaultSyncedAt?: number
}

export interface ExternalFriend extends BasePeer {
  relationship: 'external-friend'
  shareHandle: string
  mutualConsentToken?: string
  allowedCapabilities: {
    canNapChat: boolean
    canShareMemories: boolean
    canStreamSensory: boolean
    customPromptGuidance?: string
  }
  allowedCompanionIds?: string[]
  introMessage?: string
  /**
   * Public ambassador blurb, mirrored from the peer's card tagline at
   * add/accept time (or ferried through the friend-request handshake).
   * Public by design — never holds tavern/private card contents.
   */
  tagline?: string | null
}

export interface FriendRequest {
  id: string
  fromHandle: string
  fromPubkey: string
  fromCharacterName: string
  fromAvatarUrl?: string
  introMessage?: string
  /** Sender's public ambassador blurb, when they opted to include it. Self-asserted, like the sender name/handle. */
  fromTagline?: string | null
  timestamp: number
  nonce: string
  status: 'pending' | 'accepted' | 'ignored'
}

export interface AmbassadorCard {
  name: string
  avatarUrl?: string | null
  tagline?: string | null
  publicKey?: string | null
}

export const MAX_INTRO_MESSAGE_LENGTH = 100

export function sanitizeIntroMessage(input?: string | null): string {
  const text = (input ?? '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim()
  return text.slice(0, MAX_INTRO_MESSAGE_LENGTH)
}

export function isIntroMessageValid(input?: string | null): boolean {
  if (input == null || input === '')
    return true
  return input.length <= MAX_INTRO_MESSAGE_LENGTH
}

export const MAX_TAGLINE_LENGTH = 140

export function sanitizeTaglineMessage(input?: string | null): string {
  const text = (input ?? '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim()
  return text.slice(0, MAX_TAGLINE_LENGTH)
}

/**
 * The signature covers sender identity, replay protection, and intro integrity.
 * Sender name/handle/tagline are deliberately self-asserted public claims outside
 * the signature — same class as the display name. The recipient sees them in the
 * review drawer before accepting, and prompt assembly frames peer blurbs as
 * untrusted third-party content.
 */
export function buildRequestSignaturePayload(timestamp: number, nonce: string, introMessage: string, senderPubkey: string): string {
  return `${timestamp}:${nonce}:${sanitizeIntroMessage(introMessage)}:${senderPubkey}`
}

export type Peer = SameAccountDevice | ExternalFriend

/**
 * Public ambassador resolution: explicit override first (when it names a
 * known companion), then the active card, then the first companion.
 * Callers pass their own companion-id list — the roster-wide pool lives in
 * the card library, not in this helper.
 */
export function resolveEmbassyCompanionId(companionIds: string[], activeId: string | undefined, overrideId: string): string {
  if (overrideId && companionIds.includes(overrideId))
    return overrideId
  if (activeId && companionIds.includes(activeId))
    return activeId
  return companionIds[0] || 'airi'
}

/**
 * Ambassador tagline resolution: explicit tagline first, then the card's
 * first greeting (already a public-facing opener), then blank.
 * Callers surface a set-your-tagline affordance instead of sending a
 * silent blank — see the nap-chat Friends surface (Region A).
 */
export function resolveAmbassadorTagline(card?: { tagline?: string | null, greetings?: string[] | null } | null): string {
  const direct = (card?.tagline || '').trim()
  if (direct)
    return direct
  const greeting = (card?.greetings || []).map(g => (g || '').trim()).find(g => g.length > 0) || ''
  return greeting
}

export function isSameAccountDevice(peer: Peer): peer is SameAccountDevice {
  return peer.relationship === 'same-account'
}

export function isExternalFriend(peer: Peer): peer is ExternalFriend {
  return peer.relationship === 'external-friend'
}

export function isNapChatEligible(peer: Peer): boolean {
  if (!isExternalFriend(peer))
    return false
  return peer.trustState === 'trusted' && peer.allowedCapabilities.canNapChat
}

export function isQuarantined(peer: Peer): boolean {
  return peer.trustState !== 'trusted'
}

export function canSeePresence(peer: Peer): boolean {
  return peer.trustState === 'trusted'
}

export function isMemoryShareEligible(peer: Peer): boolean {
  if (!isExternalFriend(peer))
    return false
  return peer.trustState === 'trusted' && peer.allowedCapabilities.canShareMemories
}

export function isCompanionAllowedForFriend(peer: Peer, companionId: string): boolean {
  if (!isExternalFriend(peer))
    return false
  if (peer.trustState !== 'trusted')
    return false
  const allowlist = peer.allowedCompanionIds
  if (!allowlist || allowlist.length === 0)
    return true
  return allowlist.includes(companionId)
}

/**
 * Extracts a human-readable alias/subdomain from a federation handle or URL.
 * e.g. "airi-stage-edge.richard-pinedo.workers.dev" -> "richard-pinedo"
 *      "airi-stage-edge.r1ch4rd.workers.dev" -> "r1ch4rd"
 *      "https://alice.embassy.io" -> "alice"
 */
export function extractHandleAlias(handle?: string | null): string {
  if (!handle || typeof handle !== 'string')
    return ''
  const clean = handle.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim()
  const parts = clean.split('.')
  if (parts.length >= 4 && clean.endsWith('.workers.dev')) {
    return parts[1] || parts[0]
  }
  if (parts.length >= 2 && (parts[0].startsWith('airi-') || parts[0] === 'stage-edge')) {
    return parts[1] || parts[0]
  }
  return parts[0] || clean
}

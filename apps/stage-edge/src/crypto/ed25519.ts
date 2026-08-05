/**
 * Convert hex string to Uint8Array for Web Crypto Ed25519 verification.
 */
export function hexToUint8Array(hex?: string | null): Uint8Array {
  if (!hex) {
    return new Uint8Array()
  }

  const matches = hex.match(/.{1,2}/g)
  if (!matches) {
    return new Uint8Array()
  }

  return new Uint8Array(matches.map(byte => Number.parseInt(byte, 16)))
}

/**
 * Verify incoming HTTP interaction signature from Discord using Web Crypto Ed25519.
 */
export async function verifyDiscordSignature(
  request: Request,
  bodyText: string,
  publicKeyHex?: string | null,
): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519')
  const timestamp = request.headers.get('x-signature-timestamp')

  if (!signature || !timestamp || !publicKeyHex) {
    return false
  }

  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(timestamp + bodyText)
    const keyData = hexToUint8Array(publicKeyHex)
    const signatureData = hexToUint8Array(signature)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'NODE-ED25519',
        namedCurve: 'NODE-ED25519',
      },
      false,
      ['verify'],
    )

    return await crypto.subtle.verify(
      'NODE-ED25519',
      key,
      signatureData,
      data,
    )
  }
  catch (error) {
    console.error('[Ed25519 Verification Error]:', error)
    return false
  }
}

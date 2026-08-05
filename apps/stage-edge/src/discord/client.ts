/**
 * Helper utilities for formatting Discord REST & webhook interaction responses.
 */

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

export function getCommandOption(interaction: any, optionName: string): any {
  return interaction.data?.options?.find((option: any) => option.name === optionName) ?? null
}

export function getAttachmentByOption(interaction: any, optionName: string): any {
  const attachmentOption = getCommandOption(interaction, optionName)
  if (!attachmentOption?.value) {
    return null
  }
  const attachmentId = attachmentOption.value
  return interaction.data?.resolved?.attachments?.[attachmentId] ?? null
}

export function getMediaAttachment(interaction: any): { kind: string, attachment: any } | null {
  const candidates = [
    { kind: 'image', attachment: getAttachmentByOption(interaction, 'image') },
    { kind: 'audio', attachment: getAttachmentByOption(interaction, 'audio') },
    { kind: 'video', attachment: getAttachmentByOption(interaction, 'video') },
  ]
  return candidates.find(item => item.attachment !== null) ?? null
}

/** Initial voice triple the editor modal opens with (provider, model, voice). */
export interface VoiceEditorInitial {
  provider: string
  model: string
  voice: string
}

/**
 * Request to open the shared voice editor modal for a card default voice or
 * a per-actor override. `onSave` binds the emitted 3-part voice tuple to the
 * matching scope (`modules.speech` or `visual_assets.{actor}.speech`).
 */
export interface VoiceEditorPayload {
  scope: 'card-default' | 'actor'
  actorId?: string
  initial: VoiceEditorInitial
  characterName?: string
  onSave: (voice: { baseProvider: string, baseModel: string, baseVoice: string }) => void
}

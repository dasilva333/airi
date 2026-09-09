export type OnboardingV3Step
  = | 'welcome'
    | 'appearance'
    | 'triage'
    | 'experience'
    | 'profile'
    | 'vessel'
    | 'persona'
    | 'hearing'
    | 'consciousness'
    | 'speech'
    | 'thinking'
    | 'emotions'
    | 'artistry'
    | 'sensory'
    | 'tools'
    | 'finale'

export interface OnboardingV3StepDef {
  id: OnboardingV3Step
  label: string
  subtitle?: string
  index: number
}

export const ONBOARDING_V3_STEPS: OnboardingV3StepDef[] = [
  { id: 'welcome', label: 'Welcome', subtitle: 'Private Companion Studio', index: 0 },
  { id: 'appearance', label: 'Appearance', subtitle: 'Language, Theme & Accent', index: 1 },
  { id: 'triage', label: 'Triage', subtitle: 'Architecture Choice', index: 2 },
  { id: 'experience', label: 'Experience', subtitle: 'Interaction Archetype', index: 3 },
  { id: 'profile', label: 'User Profile', subtitle: 'Who Are You?', index: 4 },
  { id: 'vessel', label: 'Physical Vessel', subtitle: 'Live2D / VRM Avatar Body', index: 5 },
  { id: 'persona', label: 'Soul & Persona', subtitle: 'Personality Core', index: 6 },
  { id: 'hearing', label: 'Hearing', subtitle: 'Voice Transcription (STT)', index: 7 },
  { id: 'consciousness', label: 'Consciousness', subtitle: 'Reasoning Engine (LLM)', index: 8 },
  { id: 'speech', label: 'Speech', subtitle: 'Neural Voice Studio (TTS)', index: 9 },
  { id: 'thinking', label: 'Thinking', subtitle: 'Pacing & Subconscious Asides', index: 10 },
  { id: 'emotions', label: 'Emotions', subtitle: '2-Pass ACT Expression Bridge', index: 11 },
  { id: 'artistry', label: 'Artistry', subtitle: 'Visuals & Autonomous Director', index: 12 },
  { id: 'sensory', label: 'Sensory', subtitle: 'Screen Watching & Heartbeats', index: 13 },
  { id: 'tools', label: 'Tools & Skills', subtitle: 'Memory Hierarchy & Actions', index: 14 },
  { id: 'finale', label: 'Stage Finale', subtitle: 'Pre-Flight Readiness & Launch', index: 15 },
]

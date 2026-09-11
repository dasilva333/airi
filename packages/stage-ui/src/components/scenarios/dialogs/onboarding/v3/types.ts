import type { ModuleBundleConfig } from './stores/useOnboardingV3Draft'

export type OnboardingV3Step
  = | 'welcome'
    | 'triage'
    | 'appearance'
    | 'experience'
    | 'profile'
    | 'vessel'
    | 'persona'
    | 'hearing'
    | 'consciousness'
    | 'speech'
    | 'thinking'
    | 'emotions'
    | 'vision'
    | 'screen'
    | 'proactivity'
    | 'artistry'
    | 'sensory'
    | 'memory'
    | 'tools'
    | 'finale'

export interface OnboardingV3StepDef {
  id: OnboardingV3Step
  label: string
  subtitle?: string
  index: number
  moduleKey?: keyof ModuleBundleConfig
}

export const ONBOARDING_V3_STEPS: OnboardingV3StepDef[] = [
  { id: 'welcome', label: 'Welcome', subtitle: 'Private Companion Studio', index: 0 },
  { id: 'triage', label: 'Account', subtitle: 'Account Sign-In & Architecture', index: 1 },
  { id: 'appearance', label: 'Appearance', subtitle: 'Language, Theme & Accent', index: 2 },
  { id: 'experience', label: 'Experience', subtitle: 'Interaction Archetype', index: 3 },
  { id: 'profile', label: 'User Profile', subtitle: 'Who Are You?', index: 4 },
  { id: 'vessel', label: 'Physical Vessel', subtitle: 'Live2D / VRM Avatar Body', index: 5 },
  { id: 'persona', label: 'Soul & Persona', subtitle: 'Personality Core', index: 6 },
  { id: 'hearing', label: 'Hearing', subtitle: 'Voice Transcription (STT)', index: 7, moduleKey: 'hearing' },
  { id: 'consciousness', label: 'Consciousness', subtitle: 'Reasoning Engine (LLM)', index: 8 },
  { id: 'speech', label: 'Speech', subtitle: 'Neural Voice Studio (TTS)', index: 9, moduleKey: 'speech' },
  { id: 'thinking', label: 'Thinking', subtitle: 'Pacing & Subconscious Asides', index: 10, moduleKey: 'thinking' },
  { id: 'emotions', label: 'Emotions', subtitle: '2-Pass ACT Expression Bridge', index: 11, moduleKey: 'emotions' },
  { id: 'vision', label: 'Vision', subtitle: 'Chat Photo & Image Analysis', index: 12, moduleKey: 'vision' },
  { id: 'screen', label: 'Screen', subtitle: 'Desktop Screen Watching', index: 13, moduleKey: 'screen' },
  { id: 'proactivity', label: 'Proactivity', subtitle: 'Daily Schedule & Heartbeats', index: 14, moduleKey: 'proactivity' },
  { id: 'artistry', label: 'Artistry', subtitle: 'Visuals & Autonomous Director', index: 15, moduleKey: 'artistry' },
  { id: 'memory', label: 'Memory', subtitle: 'Cognitive Memory Hierarchy', index: 16, moduleKey: 'memory' },
  { id: 'tools', label: 'Tools', subtitle: 'Automation & Desktop MCP', index: 17, moduleKey: 'tools' },
  { id: 'finale', label: 'Stage Finale', subtitle: 'Pre-Flight Readiness & Launch', index: 18 },
]

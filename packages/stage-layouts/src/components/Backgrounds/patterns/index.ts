import type { StageAtmosphere } from '@proj-airi/stage-ui/stores'
import type { Component } from 'vue'

import { markRaw } from 'vue'

import PatternBubbles from './pattern-bubbles.vue'
import PatternCrosses from './pattern-crosses.vue'
import PatternHearts from './pattern-hearts.vue'
import PatternNotes from './pattern-notes.vue'
import PatternPetals from './pattern-petals.vue'
import PatternStars from './pattern-stars.vue'

export {
  PatternBubbles,
  PatternCrosses,
  PatternHearts,
  PatternNotes,
  PatternPetals,
  PatternStars,
}

export interface AtmosphereOption {
  id: StageAtmosphere
  name: string
  icon: string
  description: string
  component?: Component
}

export const ATMOSPHERE_OPTIONS: AtmosphereOption[] = [
  {
    id: 'none',
    name: 'None',
    icon: 'i-solar:close-circle-bold-duotone',
    description: 'Clean and static with no moving particles',
  },
  {
    id: 'hearts',
    name: 'Hearts',
    icon: 'i-solar:heart-bold-duotone',
    description: 'Pastel floating hearts drifting upward with gentle sway',
    component: markRaw(PatternHearts),
  },
  {
    id: 'petals',
    name: 'Sakura Petals',
    icon: 'i-solar:leaf-bold-duotone',
    description: 'Soft pink cherry blossom petals drifting with the wind',
    component: markRaw(PatternPetals),
  },
  {
    id: 'stars',
    name: 'Anime Stars',
    icon: 'i-solar:stars-bold-duotone',
    description: 'Twinkling 4-point diamond sparkles and star glints',
    component: markRaw(PatternStars),
  },
  {
    id: 'bubbles',
    name: 'Dreamy Bubbles',
    icon: 'i-solar:waterdrops-bold-duotone',
    description: 'Shimmering translucent bubbles floating upward',
    component: markRaw(PatternBubbles),
  },
  {
    id: 'crosses',
    name: 'Cyber Crosses',
    icon: 'i-solar:widget-add-bold-duotone',
    description: 'Minimalist tech plus and cross stencils',
    component: markRaw(PatternCrosses),
  },
  {
    id: 'notes',
    name: 'Melody Notes',
    icon: 'i-solar:music-note-bold-duotone',
    description: 'Musical eighth notes drifting with rhythmic pulse',
    component: markRaw(PatternNotes),
  },
]

export function resolveAtmosphereComponent(id: StageAtmosphere): Component | null {
  const match = ATMOSPHERE_OPTIONS.find(opt => opt.id === id)
  return match?.component || null
}

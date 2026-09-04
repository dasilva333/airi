import type { StageAtmosphere } from '../stores/background'

export interface AtmosphereMeta {
  id: StageAtmosphere
  name: string
  icon: string
  description: string
}

export const ATMOSPHERE_PRESETS: AtmosphereMeta[] = [
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
  },
  {
    id: 'petals',
    name: 'Sakura',
    icon: 'i-solar:leaf-bold-duotone',
    description: 'Soft pink cherry blossom petals drifting with the wind',
  },
  {
    id: 'stars',
    name: 'Stars',
    icon: 'i-solar:stars-bold-duotone',
    description: 'Twinkling 4-point diamond sparkles and star glints',
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    icon: 'i-solar:waterdrops-bold-duotone',
    description: 'Shimmering translucent bubbles floating upward',
  },
  {
    id: 'crosses',
    name: 'Crosses',
    icon: 'i-solar:widget-add-bold-duotone',
    description: 'Minimalist tech plus and cross stencils',
  },
  {
    id: 'notes',
    name: 'Melody',
    icon: 'i-solar:music-note-bold-duotone',
    description: 'Musical eighth notes drifting with rhythmic pulse',
  },
]

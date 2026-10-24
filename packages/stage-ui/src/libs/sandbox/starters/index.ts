import type { WidgetExportManifest } from '../export'

import { DAILY_CHECKLIST_STARTER } from './daily-checklist'
import { FOCUS_TIMER_STARTER } from './focus-timer'
import { GLYPHS_AUDIO_WORKS_STARTER } from './glyphs-audio-works'
import { HAVEN_WEATHER_STARTER } from './haven-weather'
import { HONEY_NOTES_STARTER } from './honey-notes'
import { LIVE2D_MENU_DRIVER_STARTER } from './live2d-menu-driver'
import { STRAWBERRY_PET_STARTER } from './strawberry-pet'

export * from './daily-checklist'
export * from './focus-timer'
export * from './glyphs-audio-works'
export * from './haven-weather'
export * from './honey-notes'
export * from './live2d-menu-driver'
export * from './strawberry-pet'

export const BUNDLED_STARTER_WIDGETS: WidgetExportManifest[] = [
  LIVE2D_MENU_DRIVER_STARTER,
  STRAWBERRY_PET_STARTER,
  FOCUS_TIMER_STARTER,
  DAILY_CHECKLIST_STARTER,
  HONEY_NOTES_STARTER,
  HAVEN_WEATHER_STARTER,
  GLYPHS_AUDIO_WORKS_STARTER,
]

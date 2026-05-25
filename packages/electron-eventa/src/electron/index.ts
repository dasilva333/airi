import { app } from './app'
import { dockMode } from './dock-mode'
import { screen } from './screen'
import { systemPreferences } from './system-preferences'
import { window } from './window'

export type { DesktopWindowInfo, DockModeConfig, DockModeStatus, DockPosition, TargetWindowBounds } from './dock-mode'
export { dockModeStatusChanged, dockModeTargetBounds } from './dock-mode'
export { cursorScreenPoint, startLoopGetCursorScreenPoint } from './screen'
export type { BackgroundMaterialType, ResizeDirection, VibrancyType } from './window'
export { bounds, startLoopGetBounds } from './window'

export const electron = {
  app,
  dockMode,
  screen,
  systemPreferences,
  window,
}

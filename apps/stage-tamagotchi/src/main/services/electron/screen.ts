import { defineInvokeHandler } from '@moeru/eventa'
import type { createContext } from '@moeru/eventa/adapters/electron/main'
import { cursorScreenPoint, startLoopGetCursorScreenPoint } from '@proj-airi/electron-eventa'
import { createRendererLoop } from '@proj-airi/electron-vueuse/main'
import type { BrowserWindow } from 'electron'
import { screen } from 'electron'

import { electron } from '../../../shared/eventa'
import { onAppBeforeQuit, onAppWindowAllClosed } from '../../libs/bootkit/lifecycle'

export function createScreenService(params: {
  context: ReturnType<typeof createContext>['context']
  window: BrowserWindow
}) {
  const { start, stop } = createRendererLoop({
    run: () => {
      const dipPos = screen.getCursorScreenPoint()
      params.context.emit(cursorScreenPoint, dipPos)
    },
    window: params.window,
  })

  onAppWindowAllClosed(() => stop())
  onAppBeforeQuit(() => stop())
  const cleanup = () => stop()
  params.window.on('close', cleanup)
  params.window.on('closed', cleanup)

  defineInvokeHandler(params.context, startLoopGetCursorScreenPoint, () => start())

  defineInvokeHandler(params.context, electron.screen.getAllDisplays, () => screen.getAllDisplays())
  defineInvokeHandler(params.context, electron.screen.getPrimaryDisplay, () => screen.getPrimaryDisplay())
  defineInvokeHandler(params.context, electron.screen.dipToScreenPoint, (point) =>
    point ? screen.dipToScreenPoint(point) : screen.getCursorScreenPoint(),
  )
  defineInvokeHandler(params.context, electron.screen.dipToScreenRect, (rect) => {
    if (params.window.isDestroyed()) return { height: 0, width: 0, x: 0, y: 0 }
    return rect ? screen.dipToScreenRect(params.window, rect) : params.window.getBounds()
  })
  defineInvokeHandler(params.context, electron.screen.screenToDipPoint, (point) =>
    point ? screen.screenToDipPoint(point) : screen.getCursorScreenPoint(),
  )
  defineInvokeHandler(params.context, electron.screen.screenToDipRect, (rect) => {
    if (params.window.isDestroyed()) return { height: 0, width: 0, x: 0, y: 0 }
    return rect ? screen.screenToDipRect(params.window, rect) : params.window.getBounds()
  })
  defineInvokeHandler(params.context, electron.screen.getCursorScreenPoint, () => screen.getCursorScreenPoint())

  return cleanup
}

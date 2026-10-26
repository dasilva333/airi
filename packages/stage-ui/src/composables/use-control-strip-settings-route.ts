/**
 * Route opener for Control Strip deep links into the settings surface.
 *
 * Extracted because two callers need it: the characters popover (profile edit /
 * gallery) and the Motion Studio popover (manage motions). One copy keeps the
 * Electron-vs-web branching consistent.
 *
 * On Electron the route is handed to the host window as a `control-strip:open-settings`
 * window event, because the settings window is a separate BrowserWindow that the
 * strip's renderer cannot navigate. On web the router navigates in place.
 */
import { useRouter } from 'vue-router'

export function useControlStripSettingsRoute() {
  const router = useRouter()

  function openSettingsRoute(route: string) {
    if (typeof window !== 'undefined' && (window as any).electron) {
      window.dispatchEvent(new CustomEvent('control-strip:open-settings', {
        detail: { route },
      }))
    }
    else if (router && typeof router.push === 'function') {
      void router.push(route)
    }
    else {
      window.dispatchEvent(new CustomEvent('control-strip:open-settings', {
        detail: { route },
      }))
    }
  }

  return { openSettingsRoute }
}

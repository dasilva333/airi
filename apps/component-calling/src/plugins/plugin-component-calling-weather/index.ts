import { weatherComponent } from './components'

export const registerWidgets = (() => {
  return function registerWidgets() {
    return {
      components: [weatherComponent],
    }
  }
})()

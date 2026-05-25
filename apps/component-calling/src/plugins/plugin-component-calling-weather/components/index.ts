import { object, string } from 'valibot'
import { defineCallingComponent } from '../../plugin-component-calling'
import Weather from './Weather.vue'

export { default as Weather } from './Weather.vue'

export const weatherComponent = defineCallingComponent(
  'weather',
  Weather,
  object({
    city: string(),
    condition: string(),
    temperature: string(),
  }),
  {
    city: 'Tokyo',
    condition: 'Sunny',
    temperature: '25°',
  },
)

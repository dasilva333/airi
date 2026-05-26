import { defineInvokeHandler } from '@moeru/eventa'
import type { createContext } from '@moeru/eventa/adapters/electron/main'
import { electronOpenOnboarding } from '../../../../shared/eventa'
import type { OnboardingWindowManager } from '../../../windows/onboarding'

export function createOnboardingService(params: {
  context: ReturnType<typeof createContext>['context']
  onboardingWindowManager: OnboardingWindowManager
}) {
  defineInvokeHandler(params.context, electronOpenOnboarding, async () => {
    await params.onboardingWindowManager.getAndToggleWindow()
  })
}

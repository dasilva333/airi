<script setup lang="ts">
import { ProfileSwitcherPopover } from '@proj-airi/stage-ui/components'
import { useRouter } from 'vue-router'

import HeaderAvatar from './HeaderAvatar.vue'
import HeaderLink from './HeaderLink.vue'
import ActionViewControls from './InteractiveArea/Actions/ViewControls.vue'

const router = useRouter()

function handleNavigation() {
  router.push('/settings/airi-card')
}
</script>

<template>
  <header mb-1 w-full flex items-center justify-between gap-2>
    <HeaderLink />
    <div flex items-center gap-4>
      <!-- Model & Position Controls -->
      <div flex items-center gap-2>
        <ProfileSwitcherPopover @create="handleNavigation" @manage="handleNavigation" />
        <ActionViewControls />
      </div>

      <!-- Separator -->
      <div h-6 w-px bg-neutral-200 dark:bg-neutral-800 />

      <!-- App & System Controls -->
      <HeaderAvatar />
    </div>
  </header>
</template>

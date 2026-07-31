import type { AnimationState, Skeleton } from '@esotericsoftware/spine-webgl'
import type { Ref } from 'vue'

import { ref } from 'vue'

export interface SpineHitArea {
  id?: string
  name: string
  type?: 'pull' | 'tap' | 'pat' | 'tickle' | 'patSmash' | 'smash'

  spring?: {
    stiffness?: number
    damping?: number
  }
  limits?: {
    maxStretch?: number
    maxBackward?: number
    perpRatio?: number
  }
  follower?: {
    bone?: string
    mode?: string
  }
  audio?: {
    pull?: string
    release?: string
    tap?: string
  }
}

export interface SpineGestureOptions {
  canvas: Ref<HTMLCanvasElement | undefined>
  skeleton: () => Skeleton | undefined
  animationState: () => AnimationState | undefined
  hitDetectionMode: Ref<'bounds' | 'radial'>
  radialHitRadius: Ref<number>
  model0HitAreas: () => SpineHitArea[]
  model0Motions: () => Record<string, any[]>
  loadedBlobUrls: () => Record<string, string> | undefined
  fastSpeedThreshold?: number
  tapMaxDurationMs?: number
  minSwipeDistance?: number
}

interface PointerSample {
  x: number
  y: number
  time: number
}

export function useSpineGestureInteraction(options: SpineGestureOptions) {
  const activeArea = ref<SpineHitArea | null>(null)
  const isInteracting = ref(false)
  const currentAudio = ref<HTMLAudioElement | null>(null)

  const fastSpeedThreshold = options.fastSpeedThreshold ?? 10000
  const tapMaxDurationMs = options.tapMaxDurationMs ?? 280
  const minSwipeDistance = options.minSwipeDistance ?? 6

  let pointerDownTime = 0
  let pointerDownX = 0
  let pointerDownY = 0
  let pointerDownClientX = 0
  let pointerDownClientY = 0
  let maxDragDistance = 0

  const samples: PointerSample[] = []
  let activeTrackAnim: string | null = null

  function resolveAudioUrl(soundName?: string): string | null {
    if (!soundName)
      return null

    const blobUrls = options.loadedBlobUrls()
    if (!blobUrls)
      return null

    if (blobUrls[soundName])
      return blobUrls[soundName]

    const allKeys = Object.keys(blobUrls)
    const normTarget = soundName.replace(/\\/g, '/').toLowerCase()
    const targetBase = normTarget.split('/').pop() || ''
    const targetBaseNoExt = targetBase.replace(/\.[^/.]+$/, '')

    for (const key of allKeys) {
      const normKey = key.replace(/\\/g, '/').toLowerCase()
      if (normKey === normTarget || normKey.endsWith(`/${normTarget}`) || normTarget.endsWith(`/${normKey}`)) {
        return blobUrls[key]
      }
    }

    for (const key of allKeys) {
      const normKey = key.replace(/\\/g, '/').toLowerCase()
      const keyBase = normKey.split('/').pop() || ''
      if (keyBase === targetBase) {
        return blobUrls[key]
      }
    }

    for (const key of allKeys) {
      const normKey = key.replace(/\\/g, '/').toLowerCase()
      const keyBase = normKey.split('/').pop() || ''
      const keyBaseNoExt = keyBase.replace(/\.[^/.]+$/, '')
      if (keyBaseNoExt === targetBaseNoExt && keyBaseNoExt.length > 0) {
        return blobUrls[key]
      }
    }

    return null
  }

  function playSoundUrl(url: string, stopPrevious = true) {
    const hash = typeof window !== 'undefined' ? window.location.hash || '#/' : '#/'
    const isStage = hash === '#/' || hash.startsWith('#/stage') || hash.startsWith('#/actor')
    if (!isStage)
      return

    if (stopPrevious && currentAudio.value) {
      currentAudio.value.pause()
      currentAudio.value.currentTime = 0
    }

    try {
      const audio = new Audio(url)
      if (stopPrevious) {
        currentAudio.value = audio
      }
      audio.play().catch(e => console.warn('[Spine Gesture] Audio play blocked/failed:', e))
    }
    catch (e) {
      console.warn('[Spine Gesture] Failed to initialize audio:', e)
    }
  }

  function playSound(soundName?: string, stopPrevious = true) {
    if (!soundName)
      return
    const url = resolveAudioUrl(soundName)
    if (url) {
      playSoundUrl(url, stopPrevious)
    }
  }

  function findAnimationOnSkeleton(animName: string): string | null {
    const skel = options.skeleton()
    if (!skel)
      return null

    // 1. Direct match
    if (skel.data.findAnimation(animName))
      return animName

    // 2. Suffix match (e.g. xXionx_Touch_Idle matches Touch_Idle)
    const suffixMatch = skel.data.animations.find(a =>
      a.name === animName
      || a.name.endsWith(`_${animName}`)
      || a.name.endsWith(animName)
      || a.name.toLowerCase().endsWith(animName.toLowerCase()),
    )
    if (suffixMatch)
      return suffixMatch.name

    // 3. Substring match
    const subMatch = skel.data.animations.find(a =>
      a.name.toLowerCase().includes(animName.toLowerCase()),
    )
    if (subMatch)
      return subMatch.name

    return null
  }

  function setTrackAnimation(trackIndex: number, animName: string, loop: boolean, onComplete?: () => void) {
    const state = options.animationState()
    if (!state)
      return

    const resolvedName = findAnimationOnSkeleton(animName)
    if (!resolvedName) {
      console.warn(`[Spine Gesture] Animation "${animName}" (or variant) not found on skeleton.`)
      return
    }

    if (activeTrackAnim === resolvedName && loop)
      return

    activeTrackAnim = resolvedName
    const entry = state.setAnimation(trackIndex, resolvedName, loop)
    if (entry && onComplete) {
      entry.listener = {
        complete: () => {
          onComplete()
        },
      }
    }
  }

  function checkBoneHit(areaName: string, bone: any, targetX: number, targetY: number): boolean {
    const canvasEl = options.canvas.value
    const skel = options.skeleton()
    if (!canvasEl || !skel)
      return false

    const mode = options.hitDetectionMode.value || 'bounds'
    const boneCanvasX = canvasEl.width / 2 + bone.worldX
    const boneCanvasY = canvasEl.height / 2 - bone.worldY

    if (mode === 'radial') {
      const radius = options.radialHitRadius.value || 35
      const dist = Math.sqrt((targetX - boneCanvasX) ** 2 + (targetY - boneCanvasY) ** 2)
      return dist < radius
    }

    // Bounds / BoundingBox Mode check
    const slot = skel.findSlot(areaName) || skel.findSlot(bone.data.name)
    if (slot && slot.attachment) {
      const offset = { x: 0, y: 0 } as any
      const size = { x: 0, y: 0 } as any
      skel.getBounds?.(offset, size, [])
    }

    const radius = options.radialHitRadius.value || 35
    const dist = Math.sqrt((targetX - boneCanvasX) ** 2 + (targetY - boneCanvasY) ** 2)
    return dist < radius
  }

  function calculateVelocity(currentX: number, currentY: number, now: number): number {
    samples.push({ x: currentX, y: currentY, time: now })

    // Keep samples within 100ms window
    while (samples.length > 0 && now - samples[0].time > 100) {
      samples.shift()
    }

    if (samples.length < 2)
      return 0

    const first = samples[0]
    const last = samples[samples.length - 1]
    const dt = (last.time - first.time) / 1000
    if (dt <= 0)
      return 0

    const dx = last.x - first.x
    const dy = last.y - first.y
    return (Math.sqrt(dx * dx + dy * dy) / dt)
  }

  function findHitArea(realX: number, realY: number): SpineHitArea | null {
    const skel = options.skeleton()
    const canvasEl = options.canvas.value
    if (!skel || !canvasEl)
      return null

    const areas = options.model0HitAreas()

    // 1. Check explicit hit area for Bonk/Smash if present in model0HitAreas
    for (const area of areas) {
      if (area.name.includes('Smash') || area.name.includes('Bonk') || area.type === 'smash') {
        const boneName = area.id || area.name
        const bone = skel.findBone(boneName) || skel.findBone('Character_Pat')
        if (bone && checkBoneHit(boneName, bone, realX, realY)) {
          return area
        }
      }
    }

    // 2. Check virtual Bonk/Smash hit area positioned to the left of Character_Pat
    const patBone = skel.findBone('Character_Pat')
    if (patBone) {
      const leftBonkX = (canvasEl.width / 2 + patBone.worldX) - 55
      const leftBonkY = canvasEl.height / 2 - patBone.worldY
      const radius = options.radialHitRadius.value || 35
      const distToLeftBonk = Math.sqrt((realX - leftBonkX) ** 2 + (realY - leftBonkY) ** 2)
      if (distToLeftBonk < radius) {
        return {
          id: 'Character_Smash',
          name: 'Character_Smash',
          type: 'smash',
        }
      }
    }

    // 3. Check regular hit areas (Character_Pat, Character_Ball_Move, Character_Tickle, etc.)
    for (const area of areas) {
      const boneName = area.id || area.name
      const bone = skel.findBone(boneName)
      if (bone && checkBoneHit(boneName, bone, realX, realY)) {
        return area
      }
    }
    return null
  }

  function getCanvasCoords(event: PointerEvent): { realX: number, realY: number } | null {
    const canvasEl = options.canvas.value
    if (!canvasEl)
      return null

    const rect = canvasEl.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const realX = mouseX * (canvasEl.width / canvasEl.clientWidth)
    const realY = mouseY * (canvasEl.height / canvasEl.clientHeight)
    return { realX, realY }
  }

  function resolveAreaType(area: SpineHitArea): string {
    const name = area.id || area.name || ''
    if (name.includes('Smash') || name.includes('Bonk') || area.type === 'smash') {
      return 'smash'
    }
    if (name.includes('Pat') || area.type === 'pat' || area.type === 'patSmash') {
      return 'pat'
    }
    if (name.includes('Tickle') || area.type === 'tickle') {
      return 'tickle'
    }
    if (name.includes('Ball') || area.type === 'pull') {
      return 'pull'
    }
    return area.type || 'tap'
  }

  function isDescendantOf(child: any, parent: any): boolean {
    let curr = child.parent
    while (curr) {
      if (curr === parent)
        return true
      curr = curr.parent
    }
    return false
  }

  function setBoneWorldDisplacement(bone: any, worldDx: number, worldDy: number) {
    const parent = bone.parent
    if (!parent) {
      bone.x = bone.data.x + worldDx
      bone.y = bone.data.y + worldDy
      return
    }

    // Spine's built-in localToWorld computes exact world coordinate of setup pose
    const setupWorld = typeof parent.localToWorld === 'function'
      ? parent.localToWorld({ x: bone.data.x, y: bone.data.y })
      : { x: parent.worldX + bone.data.x, y: parent.worldY + bone.data.y }

    // Target world position after mouse pull displacement
    const targetWorld = {
      x: setupWorld.x + worldDx,
      y: setupWorld.y + worldDy,
    }

    // Spine's built-in worldToLocal matrix inverse transforms target back to exact parent local bone space
    if (typeof parent.worldToLocal === 'function') {
      const targetLocal = parent.worldToLocal(targetWorld)
      bone.x = targetLocal.x
      bone.y = targetLocal.y
    }
    else {
      const rad = -(parent.worldRotationX || 0) * (Math.PI / 180)
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const scaleX = Math.abs(parent.worldScaleX || 1)
      const scaleY = Math.abs(parent.worldScaleY || 1)

      bone.x = bone.data.x + (worldDx * cos - worldDy * sin) / scaleX
      bone.y = bone.data.y + (worldDx * sin + worldDy * cos) / scaleY
    }
  }

  const pullOffset = ref({ x: 0, y: 0 })
  const pullVelocity = ref({ x: 0, y: 0 })
  let activePullArea: SpineHitArea | null = null

  function updatePullPhysics(delta: number) {
    const skel = options.skeleton()
    if (!skel)
      return

    const isDraggingPull = isInteracting.value && activeArea.value && resolveAreaType(activeArea.value) === 'pull'
    const currentPullArea = isDraggingPull ? activeArea.value : activePullArea

    if (!currentPullArea)
      return

    const boneName = currentPullArea.id || currentPullArea.name
    const bone = skel.findBone(boneName) || skel.findBone('Character_Ball_Move')
    if (!bone)
      return

    const stiffness = currentPullArea.spring?.stiffness ?? 1680
    const damping = currentPullArea.spring?.damping ?? 20

    const followerName = currentPullArea.follower?.bone || (boneName.endsWith('_Re') ? boneName : `${boneName}_Re`)
    const followerBone = skel.findBone(followerName)

    if (!isDraggingPull) {
      // Released: apply spring-damper snapping math back to setup pose (0, 0)
      if (Math.abs(pullOffset.value.x) > 0.01 || Math.abs(pullOffset.value.y) > 0.01 || Math.abs(pullVelocity.value.x) > 0.01 || Math.abs(pullVelocity.value.y) > 0.01) {
        const forceX = -stiffness * pullOffset.value.x - damping * pullVelocity.value.x
        const forceY = -stiffness * pullOffset.value.y - damping * pullVelocity.value.y

        pullVelocity.value.x += forceX * delta
        pullVelocity.value.y += forceY * delta

        pullOffset.value.x += pullVelocity.value.x * delta
        pullOffset.value.y += pullVelocity.value.y * delta

        // Energy cutoff: reset exact setup pose coordinates when settled
        if (Math.hypot(pullOffset.value.x, pullOffset.value.y) < 0.1 && Math.hypot(pullVelocity.value.x, pullVelocity.value.y) < 0.1) {
          pullOffset.value.x = 0
          pullOffset.value.y = 0
          pullVelocity.value.x = 0
          pullVelocity.value.y = 0
          bone.x = bone.data.x
          bone.y = bone.data.y
          if (followerBone && followerBone !== bone) {
            followerBone.x = followerBone.data.x
            followerBone.y = followerBone.data.y
          }
          activePullArea = null
          return
        }
      }
    }

    // Set bone position directly in world space using matrix inverse
    setBoneWorldDisplacement(bone, pullOffset.value.x, pullOffset.value.y)

    // Set follower bone position relative to its setup pose
    if (followerBone && followerBone !== bone) {
      if (isDescendantOf(followerBone, bone)) {
        // Direct/indirect child bone inherits bone's transform automatically
        followerBone.x = followerBone.data.x
        followerBone.y = followerBone.data.y
      }
      else {
        const mode = currentPullArea.follower?.mode || 'same'
        const fWorldX = mode === 'mirror' ? -pullOffset.value.x : pullOffset.value.x
        const fWorldY = mode === 'mirror' ? -pullOffset.value.y : pullOffset.value.y

        setBoneWorldDisplacement(followerBone, fWorldX, fWorldY)
      }
    }
  }

  function onGlobalPointerRelease(event: Event) {
    if (isInteracting.value) {
      onPointerUp(event as PointerEvent)
    }
  }

  function attachGlobalReleaseListeners() {
    if (typeof window === 'undefined')
      return
    window.addEventListener('pointerleave', onGlobalPointerRelease)
    window.addEventListener('mouseleave', onGlobalPointerRelease)
    window.addEventListener('blur', onGlobalPointerRelease)
    window.addEventListener('pointerup', onGlobalPointerRelease)
  }

  function detachGlobalReleaseListeners() {
    if (typeof window === 'undefined')
      return
    window.removeEventListener('pointerleave', onGlobalPointerRelease)
    window.removeEventListener('mouseleave', onGlobalPointerRelease)
    window.removeEventListener('blur', onGlobalPointerRelease)
    window.removeEventListener('pointerup', onGlobalPointerRelease)
  }

  function onPointerDown(event: PointerEvent) {
    const coords = getCanvasCoords(event)
    if (!coords)
      return

    const area = findHitArea(coords.realX, coords.realY)
    if (!area)
      return

    activeArea.value = area
    isInteracting.value = true
    pointerDownTime = performance.now()
    pointerDownX = coords.realX
    pointerDownY = coords.realY
    pointerDownClientX = event.clientX
    pointerDownClientY = event.clientY
    maxDragDistance = 0

    samples.length = 0
    activeTrackAnim = null

    attachGlobalReleaseListeners()

    const areaType = resolveAreaType(area)

    if (areaType === 'pull') {
      activePullArea = area
      pullOffset.value = { x: 0, y: 0 }
      pullVelocity.value = { x: 0, y: 0 }
      setTrackAnimation(5, 'Touch_Idle', true)
      playSound(area.audio?.pull)
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!isInteracting.value || !activeArea.value)
      return

    if (typeof window !== 'undefined') {
      const buffer = 2
      if (
        event.clientX <= buffer
        || event.clientX >= window.innerWidth - buffer
        || event.clientY <= buffer
        || event.clientY >= window.innerHeight - buffer
      ) {
        onPointerUp(event)
        return
      }
    }

    const coords = getCanvasCoords(event)
    if (!coords)
      return

    const now = performance.now()
    const dx = coords.realX - pointerDownX
    const dy = coords.realY - pointerDownY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > maxDragDistance)
      maxDragDistance = dist

    const area = activeArea.value
    const areaType = resolveAreaType(area)

    if (areaType === 'pull') {
      const canvasEl = options.canvas.value
      const skel = options.skeleton()
      const scaleX = Math.abs(skel?.scaleX || 1)
      const scaleY = Math.abs(skel?.scaleY || 1)

      const dprX = canvasEl ? canvasEl.width / (canvasEl.clientWidth || 1) : 1
      const dprY = canvasEl ? canvasEl.height / (canvasEl.clientHeight || 1) : 1

      const cssDx = event.clientX - pointerDownClientX
      const cssDy = event.clientY - pointerDownClientY

      // Convert monitor CSS pixel delta to physical WebGL buffer pixels, then to Spine local bone units
      const rawDx = (cssDx * dprX) / scaleX
      const rawDy = -(cssDy * dprY) / scaleY

      const maxStretch = area.limits?.maxStretch ?? 60
      const currentDist = Math.hypot(rawDx, rawDy)

      if (currentDist > maxStretch && currentDist > 0) {
        const ratio = maxStretch / currentDist
        pullOffset.value.x = rawDx * ratio
        pullOffset.value.y = rawDy * ratio
      }
      else {
        pullOffset.value.x = rawDx
        pullOffset.value.y = rawDy
      }
      pullVelocity.value.x = 0
      pullVelocity.value.y = 0
    }
    else if (areaType === 'pat' || areaType === 'patSmash') {
      if (maxDragDistance >= minSwipeDistance) {
        setTrackAnimation(5, 'Pat_Idle', true)
      }
    }
    else if (areaType === 'tickle') {
      const speed = calculateVelocity(coords.realX, coords.realY, now)
      if (speed >= fastSpeedThreshold) {
        setTrackAnimation(5, 'Tickle_Idle_2', true) // Furious tickle
      }
      else {
        setTrackAnimation(5, 'Tickle_Idle_1', true) // Normal tickle
      }
    }
  }

  function onPointerUp(_event: PointerEvent) {
    detachGlobalReleaseListeners()

    if (!isInteracting.value || !activeArea.value)
      return

    const now = performance.now()
    const duration = now - pointerDownTime
    const area = activeArea.value
    const areaName = area.id || area.name
    const areaType = resolveAreaType(area)

    const state = options.animationState()

    const finishInteraction = (animFile?: string, soundFile?: string) => {
      if (animFile && state) {
        setTrackAnimation(5, animFile, false, () => {
          if (state)
            state.setEmptyAnimation(5, 0.2)
          activeTrackAnim = null
        })
      }
      else if (state) {
        state.setEmptyAnimation(5, 0.2)
        activeTrackAnim = null
      }

      if (soundFile) {
        playSound(soundFile)
      }
      else if (area.audio?.release) {
        playSound(area.audio.release)
      }
    }

    function playSmashAudioSequence(areaName: string, area: SpineHitArea) {
      const blobUrls = options.loadedBlobUrls()
      const motionsMap = options.model0Motions()
      const tapMotions = motionsMap[`tap_${areaName}`] || motionsMap.tap_Character_Pat || motionsMap.tap_Character_Smash

      let smashMotionSound: string | undefined
      if (tapMotions && Array.isArray(tapMotions)) {
        const matched = tapMotions.find((m: any) => m.file?.includes('Smash') || m.sound?.includes('Smash') || m.audio?.includes('Smash'))
        smashMotionSound = matched?.sound || matched?.audio || tapMotions[0]?.sound || tapMotions[0]?.audio
      }

      const impactCandidate = area.audio?.tap
        || smashMotionSound
        || area.audio?.release
        || 'SFX_Common_RubbingEnd.wav'

      let impactAudioUrl = resolveAudioUrl(impactCandidate)
      if (!impactAudioUrl && blobUrls) {
        const key = Object.keys(blobUrls).find(k => /rubbingend|smash|bonk|hit/i.test(k))
        if (key)
          impactAudioUrl = blobUrls[key]
      }

      if (impactAudioUrl) {
        playSoundUrl(impactAudioUrl, true)
      }

      if (blobUrls) {
        const voiceKeys = Object.keys(blobUrls).filter(k =>
          /_smash_|_smash\.|\/smash_/i.test(k) || /_pat_|_pat\.|\/pat_/i.test(k),
        )
        if (voiceKeys.length > 0) {
          const randomVoiceKey = voiceKeys[Math.floor(Math.random() * voiceKeys.length)]
          const voiceUrl = blobUrls[randomVoiceKey]
          if (voiceUrl && voiceUrl !== impactAudioUrl) {
            playSoundUrl(voiceUrl, false)
          }
        }
      }
    }

    if (areaType === 'pull') {
      const motions = options.model0Motions()[`tap_${areaName}`]
      const releaseAnim = motions?.[0]?.file || 'Touch_End'
      const releaseSound = motions?.[0]?.sound || area.audio?.release
      finishInteraction(releaseAnim, releaseSound)
    }
    else if (areaType === 'pat') {
      const motions = options.model0Motions()[`tap_${areaName}`] || options.model0Motions().tap_Character_Pat
      const releaseAnim = motions?.[0]?.file || 'Pat_End'
      const releaseSound = motions?.[0]?.sound || area.audio?.release
      finishInteraction(releaseAnim, releaseSound)
    }
    else if (areaType === 'tickle') {
      const motions = options.model0Motions()[`tap_${areaName}`]
      const releaseAnim = motions?.[0]?.file || 'Tickle_End'
      const releaseSound = motions?.[0]?.sound || area.audio?.tap || area.audio?.release
      finishInteraction(releaseAnim, releaseSound)
    }
    else if (areaType === 'smash') {
      // Bonk / Smash tap sequence: Smash_End_1 -> Smash_End_2
      const smash1Anim = findAnimationOnSkeleton('Smash_End_1')
        || findAnimationOnSkeleton('Smash_1')
        || findAnimationOnSkeleton('Smash')
        || findAnimationOnSkeleton('Touch_Smash')

      const smash2Anim = findAnimationOnSkeleton('Smash_End_2')
        || findAnimationOnSkeleton('Smash_2')

      if (smash1Anim) {
        setTrackAnimation(5, smash1Anim, false, () => {
          if (smash2Anim && state) {
            setTrackAnimation(5, smash2Anim, false, () => {
              if (state)
                state.setEmptyAnimation(5, 0.2)
              activeTrackAnim = null
            })
          }
          else if (state) {
            state.setEmptyAnimation(5, 0.2)
            activeTrackAnim = null
          }
        })
        playSmashAudioSequence(areaName, area)
      }

      else {
        // Fallback to tap motion
        const motions = options.model0Motions()[`tap_${areaName}`] || options.model0Motions().tap_Character_Pat
        if (motions && motions.length > 0) {
          const config = motions[Math.floor(Math.random() * motions.length)]
          finishInteraction(config.file, config.sound)
        }
        else {
          finishInteraction('Pat_End', area.audio?.release)
        }
      }
    }
    else if (areaType === 'patSmash') {
      if (duration <= tapMaxDurationMs && maxDragDistance < minSwipeDistance) {
        const smash1Anim = findAnimationOnSkeleton('Smash_End_1')
          || findAnimationOnSkeleton('Smash_1')
          || findAnimationOnSkeleton('Smash')
          || findAnimationOnSkeleton('Touch_Smash')

        const smash2Anim = findAnimationOnSkeleton('Smash_End_2')
          || findAnimationOnSkeleton('Smash_2')

        if (smash1Anim) {
          setTrackAnimation(5, smash1Anim, false, () => {
            if (smash2Anim && state) {
              setTrackAnimation(5, smash2Anim, false, () => {
                if (state)
                  state.setEmptyAnimation(5, 0.2)
                activeTrackAnim = null
              })
            }
            else if (state) {
              state.setEmptyAnimation(5, 0.2)
              activeTrackAnim = null
            }
          })
          playSmashAudioSequence(areaName, area)
        }

        else {
          const motions = options.model0Motions()[`tap_${areaName}`]
          if (motions && motions.length > 0) {
            const config = motions[Math.floor(Math.random() * motions.length)]
            finishInteraction(config.file, config.sound)
          }
          else {
            finishInteraction('Pat_End', area.audio?.release)
          }
        }
      }
      else {
        const motions = options.model0Motions()[`tap_${areaName}`]
        const releaseAnim = motions?.[0]?.file || 'Pat_End'
        const releaseSound = motions?.[0]?.sound || area.audio?.release
        finishInteraction(releaseAnim, releaseSound)
      }
    }

    else {
      // Standard single tap motion
      const motions = options.model0Motions()[`tap_${areaName}`]
      if (motions && motions.length > 0) {
        const config = motions[Math.floor(Math.random() * motions.length)]
        finishInteraction(config.file, config.sound)
      }
      else {
        finishInteraction()
      }
    }

    isInteracting.value = false
    activeArea.value = null
    samples.length = 0
  }

  function onPointerCancel(event: PointerEvent) {
    if (isInteracting.value) {
      onPointerUp(event)
    }
  }

  return {
    activeArea,
    isInteracting,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    findHitArea,
    checkBoneHit,
    resolveAudioUrl,
    playSound,
    playSoundUrl,
    update: updatePullPhysics,
  }
}

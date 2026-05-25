<script setup lang="ts">
// From: https://stackoverflow.com/a/71426342/22392721
interface Props {
  duration?: number
  easingEnter?: string
  easingLeave?: string
  opacityClosed?: number
  opacityOpened?: number
}

const props = withDefaults(defineProps<Props>(), {
  duration: 250,
  easingEnter: 'ease-in-out',
  easingLeave: 'ease-in-out',
  opacityClosed: 0,
  opacityOpened: 1,
})

const closed = '0px'

interface initialStyle {
  height: string
  width: string
  position: string
  visibility: string
  overflow: string
  paddingTop: string
  paddingBottom: string
  borderTopWidth: string
  borderBottomWidth: string
  marginTop: string
  marginBottom: string
}

function getElementStyle(element: HTMLElement) {
  return {
    borderBottomWidth: element.style.borderBottomWidth,
    borderTopWidth: element.style.borderTopWidth,
    height: element.style.height,
    marginBottom: element.style.marginBottom,
    marginTop: element.style.marginTop,
    overflow: element.style.overflow,
    paddingBottom: element.style.paddingBottom,
    paddingTop: element.style.paddingTop,
    position: element.style.position,
    visibility: element.style.visibility,
    width: element.style.width,
  }
}

let animation: Animation | null = null
let lastElement: HTMLElement | null = null

function prepareElement(element: HTMLElement, initialStyle: initialStyle) {
  const { width } = getComputedStyle(element)
  element.style.width = width
  element.style.position = 'absolute'
  element.style.visibility = 'hidden'
  element.style.height = ''
  const { height } = getComputedStyle(element)
  element.style.width = initialStyle.width
  element.style.position = initialStyle.position
  element.style.visibility = initialStyle.visibility
  element.style.height = closed
  element.style.overflow = 'hidden'
  return initialStyle.height && initialStyle.height !== closed ? initialStyle.height : height
}

function animateTransition(
  element: HTMLElement,
  initialStyle: initialStyle,
  done: () => void,
  keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
  options?: number | KeyframeAnimationOptions,
) {
  lastElement = element
  animation = element.animate(keyframes, options)
  // Set height to 'auto' to restore it after animation
  element.style.height = initialStyle.height
  animation.onfinish = () => {
    element.style.overflow = initialStyle.overflow
    done()
  }
}

function getEnterKeyframes(height: string, initialStyle: initialStyle) {
  return [
    {
      borderBottomWidth: closed,
      borderTopWidth: closed,
      height: closed,
      marginBottom: closed,
      marginTop: closed,
      opacity: props.opacityClosed,
      paddingBottom: closed,
      paddingTop: closed,
    },
    {
      borderBottomWidth: initialStyle.borderBottomWidth,
      borderTopWidth: initialStyle.borderTopWidth,
      height,
      marginBottom: initialStyle.marginBottom,
      marginTop: initialStyle.marginTop,
      opacity: props.opacityOpened,
      paddingBottom: initialStyle.paddingBottom,
      paddingTop: initialStyle.paddingTop,
    },
  ]
}

function cancelAnimation(HTMLElement: HTMLElement, overflow: string, done: () => void) {
  if (HTMLElement !== lastElement) return false
  if (!animation) return false
  if (animation.playState !== 'running') return false
  animation.onfinish = () => {
    HTMLElement.style.overflow = overflow
    done()
  }
  animation.reverse()
  return true
}

function enterTransition(element: Element, done: () => void) {
  const HTMLElement = element as HTMLElement
  const initialStyle = getElementStyle(HTMLElement)
  if (cancelAnimation(HTMLElement, initialStyle.overflow, done)) return
  const height = prepareElement(HTMLElement, initialStyle)
  const keyframes = getEnterKeyframes(height, initialStyle)
  const options = { duration: props.duration, easing: props.easingEnter }
  animateTransition(HTMLElement, initialStyle, done, keyframes, options)
}

function leaveTransition(element: Element, done: () => void) {
  const HTMLElement = element as HTMLElement
  const initialStyle = getElementStyle(HTMLElement)
  if (cancelAnimation(HTMLElement, initialStyle.overflow, done)) return
  const { height } = getComputedStyle(HTMLElement)
  HTMLElement.style.height = height
  HTMLElement.style.overflow = 'hidden'
  const keyframes = getEnterKeyframes(height, initialStyle).reverse()
  const options = { duration: props.duration, easing: props.easingLeave }
  animateTransition(HTMLElement, initialStyle, done, keyframes, options)
}
</script>

<template>
  <Transition :css="false" @enter="enterTransition" @leave="leaveTransition">
    <slot />
  </Transition>
</template>

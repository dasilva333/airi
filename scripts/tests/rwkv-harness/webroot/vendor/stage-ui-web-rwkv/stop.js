function heldBackTailLength(text, stops, maxStopLen) {
  const max = Math.min(text.length, maxStopLen - 1)
  for (let len = max; len > 0; len--) {
    const suffix = text.slice(text.length - len)
    if (stops.some(stop => stop.startsWith(suffix)))
      return len
  }
  return 0
}
function createStopScanner(stops) {
  const maxStopLen = Math.max(...stops.map(s => s.length))
  let pending = ''
  let stopped = false
  return {
    get stopped() {
      return stopped
    },
    push(text) {
      if (stopped || !text)
        return ''
      pending += text
      let cut = -1
      for (const stop of stops) {
        const at = pending.indexOf(stop)
        if (at >= 0 && (cut === -1 || at < cut))
          cut = at
      }
      if (cut >= 0) {
        stopped = true
        const out2 = pending.slice(0, cut)
        pending = ''
        return out2
      }
      const hold = heldBackTailLength(pending, stops, maxStopLen)
      const out = pending.slice(0, pending.length - hold)
      pending = pending.slice(pending.length - hold)
      return out
    },
    flush() {
      const out = pending
      pending = ''
      return out
    },
  }
}
export {
  createStopScanner,
}

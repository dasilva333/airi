/**
 * Checks if the current time (or a specified time) is within a given schedule window.
 * Supports overnight schedules (e.g., 22:00 - 06:00).
 *
 * @param start - Start time in "HH:mm" format.
 * @param end - End time in "HH:mm" format.
 * @param now - Optional Date object (defaults to current time).
 */
export function isWithinSchedule(start: string, end: string, now = new Date()): boolean {
  if (!start || !end) return true

  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const curH = now.getHours()
  const curM = now.getMinutes()
  const curMinsTotal = curH * 60 + curM
  const startMinsTotal = startH * 60 + startM
  const endMinsTotal = endH * 60 + endM

  // Normal window: 09:00 - 22:00
  if (startMinsTotal <= endMinsTotal) {
    return curMinsTotal >= startMinsTotal && curMinsTotal <= endMinsTotal
  }

  // Overnight window: 22:00 - 06:00
  return curMinsTotal >= startMinsTotal || curMinsTotal <= endMinsTotal
}

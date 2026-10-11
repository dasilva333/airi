/**
 * Strip ANSI color escape codes from terminal outputs
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*[a-z]/gi, '')
}

/**
 * Format ANSI terminal text with basic color spans for UI display
 */
export function ansiToHtml(text: string): string {
  const sanitized = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Replace ANSI color codes with Tailwind/CSS classes
  return sanitized
    // Red
    .replace(/\x1B\[31m([^\x1B]*)\x1B\[0m/g, '<span class="text-red-400 font-semibold">$1</span>')
    // Green
    .replace(/\x1B\[32m([^\x1B]*)\x1B\[0m/g, '<span class="text-green-400 font-semibold">$1</span>')
    // Yellow
    .replace(/\x1B\[33m([^\x1B]*)\x1B\[0m/g, '<span class="text-yellow-400 font-semibold">$1</span>')
    // Blue
    .replace(/\x1B\[34m([^\x1B]*)\x1B\[0m/g, '<span class="text-blue-400 font-semibold">$1</span>')
    // Magenta
    .replace(/\x1B\[35m([^\x1B]*)\x1B\[0m/g, '<span class="text-purple-400 font-semibold">$1</span>')
    // Cyan
    .replace(/\x1B\[36m([^\x1B]*)\x1B\[0m/g, '<span class="text-cyan-400 font-semibold">$1</span>')
    // Fallback strip any remaining codes
    .replace(/\x1B\[[0-9;]*[a-z]/gi, '')
}

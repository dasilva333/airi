export function formatDate(raw: string): {
  time: number
  string: string
} {
  const date = new Date(raw)
  date.setUTCHours(12)

  return {
    string: date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    time: +date,
  }
}

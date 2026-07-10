export function todayStr(): string {
  return toDateStr(new Date())
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return toDateStr(d)
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function daysAgoStr(n: number): string {
  return addDays(todayStr(), -n)
}

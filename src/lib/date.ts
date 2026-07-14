export function todayStr(): string {
  return toDateStr(new Date())
}

export function toDateStr(d: Date): string {
  // Local calendar date — toISOString() would shift to the UTC date,
  // putting evening logs on tomorrow for anyone west of UTC.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

export function timeNowHM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Combine a local day key + HH:MM into an absolute ISO timestamp.
export function isoAt(dateStr: string, hm: string): string {
  return new Date(`${dateStr}T${hm}:00`).toISOString()
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

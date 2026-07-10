// Minimal local persistence layer: every "table" is a JSON array in localStorage.
// This replaces a real backend entirely — all data lives only in this browser.

const PREFIX = 'fittrack:'

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function readTable<T>(table: string): T[] {
  const raw = localStorage.getItem(PREFIX + table)
  return raw ? (JSON.parse(raw) as T[]) : []
}

export function writeTable<T>(table: string, rows: T[]): void {
  localStorage.setItem(PREFIX + table, JSON.stringify(rows))
}

export function readSingleton<T>(key: string): T | null {
  const raw = localStorage.getItem(PREFIX + key)
  return raw ? (JSON.parse(raw) as T) : null
}

export function writeSingleton<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

const TABLES = [
  'profile',
  'foods',
  'food_logs',
  'exercises',
  'workout_plans',
  'plan_exercises',
  'workout_logs',
  'workout_log_sets',
  'body_metrics',
] as const

export function exportAll(): Record<string, unknown> {
  const dump: Record<string, unknown> = {}
  for (const t of TABLES) {
    const raw = localStorage.getItem(PREFIX + t)
    if (raw) dump[t] = JSON.parse(raw)
  }
  return dump
}

export function importAll(dump: Record<string, unknown>): void {
  for (const t of TABLES) {
    if (t in dump) localStorage.setItem(PREFIX + t, JSON.stringify(dump[t]))
  }
}

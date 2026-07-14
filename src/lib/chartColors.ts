// FitTrack is permanently dark (themed after the Training Plan tab), so the
// old prefers-color-scheme hook now always reports dark. It keeps its name and
// signature so chart call sites didn't have to change.
export function usePrefersDark(): boolean {
  return true
}

// Categorical slots (fixed order — never cycle/reassign per-series).
// Matches the Training Plan tab's lift colors: blue, orange, green, purple…
const CATEGORICAL_DARK = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#facc15', '#ef4444']

export function categoricalColors(_dark: boolean): string[] {
  return CATEGORICAL_DARK
}

export function chartChrome(_dark: boolean) {
  return {
    surface: '#0f1320',
    primaryInk: '#f0f4ff',
    secondaryInk: '#c9d1e0',
    mutedInk: '#6b7280',
    gridline: '#1c2230',
    baseline: '#2a3247',
  }
}

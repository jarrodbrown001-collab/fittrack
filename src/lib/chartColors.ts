import { useEffect, useState } from 'react'

export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return dark
}

// Categorical slots (fixed order — never cycle/reassign per-series).
const CATEGORICAL_LIGHT = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']
const CATEGORICAL_DARK = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926']

export function categoricalColors(dark: boolean): string[] {
  return dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT
}

export function chartChrome(dark: boolean) {
  return {
    surface: dark ? '#1a1a19' : '#fcfcfb',
    primaryInk: dark ? '#ffffff' : '#0b0b0b',
    secondaryInk: dark ? '#c3c2b7' : '#52514e',
    mutedInk: '#898781',
    gridline: dark ? '#2c2c2a' : '#e1e0d9',
    baseline: dark ? '#383835' : '#c3c2b7',
  }
}

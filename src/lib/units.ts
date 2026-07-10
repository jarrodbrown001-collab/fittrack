import type { UnitSystem } from '../types/database'

// Canonical storage is always metric: kg, km, cm.
// These helpers convert to/from the display unit based on the profile's unit_system.

const KG_PER_LB = 0.45359237
const KM_PER_MI = 1.609344
const CM_PER_IN = 2.54

export function kgToDisplay(kg: number, system: UnitSystem): number {
  return system === 'imperial' ? kg / KG_PER_LB : kg
}

export function displayToKg(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * KG_PER_LB : value
}

export function kmToDisplay(km: number, system: UnitSystem): number {
  return system === 'imperial' ? km / KM_PER_MI : km
}

export function displayToKm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * KM_PER_MI : value
}

export function cmToDisplay(cm: number, system: UnitSystem): number {
  return system === 'imperial' ? cm / CM_PER_IN : cm
}

export function displayToCm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * CM_PER_IN : value
}

export function weightUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'lb' : 'kg'
}

export function distanceUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'mi' : 'km'
}

export function lengthUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'in' : 'cm'
}

export function formatWeight(kg: number | null, system: UnitSystem, digits = 1): string {
  if (kg == null) return '—'
  return `${kgToDisplay(kg, system).toFixed(digits)} ${weightUnitLabel(system)}`
}

export function formatDistance(km: number | null, system: UnitSystem, digits = 2): string {
  if (km == null) return '—'
  return `${kmToDisplay(km, system).toFixed(digits)} ${distanceUnitLabel(system)}`
}

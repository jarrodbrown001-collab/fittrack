import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { updateProfile } from '../lib/api'
import type { UnitSystem } from '../types/database'

export function Settings() {
  const { profile, user, refreshProfile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    display_name: profile?.display_name ?? '',
    unit_system: (profile?.unit_system ?? 'imperial') as UnitSystem,
    daily_calorie_target: profile?.daily_calorie_target ?? 0,
    daily_protein_target_g: profile?.daily_protein_target_g ?? 0,
    daily_carb_target_g: profile?.daily_carb_target_g ?? 0,
    daily_fat_target_g: profile?.daily_fat_target_g ?? 0,
  }))

  if (!profile || !user) return null

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile(user.id, form)
      await refreshProfile()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Settings</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Profile</h2>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-500 dark:text-slate-400">Display name</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
          />
        </label>

        <label className="mb-1 block text-sm">
          <span className="mb-1 block text-slate-500 dark:text-slate-400">Units</span>
          <div className="flex gap-2">
            {(['imperial', 'metric'] as UnitSystem[]).map((u) => (
              <button
                key={u}
                onClick={() => setForm((f) => ({ ...f, unit_system: u }))}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                  form.unit_system === u
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Daily nutrition targets
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">Calories</span>
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={form.daily_calorie_target}
              onChange={(e) =>
                setForm((f) => ({ ...f, daily_calorie_target: Number(e.target.value) }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">Protein (g)</span>
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={form.daily_protein_target_g}
              onChange={(e) =>
                setForm((f) => ({ ...f, daily_protein_target_g: Number(e.target.value) }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">Carbs (g)</span>
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={form.daily_carb_target_g}
              onChange={(e) =>
                setForm((f) => ({ ...f, daily_carb_target_g: Number(e.target.value) }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">Fat (g)</span>
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={form.daily_fat_target_g}
              onChange={(e) =>
                setForm((f) => ({ ...f, daily_fat_target_g: Number(e.target.value) }))
              }
            />
          </label>
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}

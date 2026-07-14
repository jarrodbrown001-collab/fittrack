import { useRef, useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { updateProfile } from '../lib/api'
import { todayStr } from '../lib/date'
import { migrateLocalToCloud } from '../lib/migrate'
import { exportAll, importAll } from '../lib/storage'
import { cloudEnabled, supabase } from '../lib/supabase'
import type { UnitSystem } from '../types/database'

export function Settings() {
  const { profile, refreshProfile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState(() => ({
    display_name: profile?.display_name ?? '',
    unit_system: (profile?.unit_system ?? 'imperial') as UnitSystem,
    daily_calorie_target: profile?.daily_calorie_target ?? 0,
    daily_protein_target_g: profile?.daily_protein_target_g ?? 0,
    daily_carb_target_g: profile?.daily_carb_target_g ?? 0,
    daily_fat_target_g: profile?.daily_fat_target_g ?? 0,
  }))

  if (!profile) return null

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile(form)
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

      {cloudEnabled && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Account &amp; sync
          </h2>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Cloud sync is on — everything you log saves to your account and shows up on every
            device you sign in from.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                setMigrating(true)
                setMigrateResult(null)
                try {
                  setMigrateResult(await migrateLocalToCloud())
                } catch (err) {
                  setMigrateResult(`Upload failed: ${err instanceof Error ? err.message : err}`)
                } finally {
                  setMigrating(false)
                }
              }}
              disabled={migrating}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {migrating ? 'Uploading…' : "Upload this device's local data"}
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
          {migrateResult && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{migrateResult}</p>
          )}
        </section>
      )}

      {!cloudEnabled && (
      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Backup
        </h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          All data lives only in this browser. Export a backup regularly, or before clearing
          browser data / switching browsers or devices.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(exportAll(), null, 2)], {
                type: 'application/json',
              })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `fittrack-backup-${todayStr()}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Export backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Import backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const text = await file.text()
              importAll(JSON.parse(text))
              window.location.reload()
            }}
          />
        </div>
      </section>
      )}
    </div>
  )
}

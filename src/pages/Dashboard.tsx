import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useProfile } from '../hooks/useProfile'
import {
  listBodyMetricsInRange,
  listFoodLogsInRange,
  listWorkoutLogsInRange,
  upsertBodyMetric,
  type FoodLogWithFood,
} from '../lib/api'
import { addDays, daysAgoStr, formatDateLabel, todayStr } from '../lib/date'
import { categoricalColors, chartChrome, usePrefersDark } from '../lib/chartColors'
import { displayToKg, kgToDisplay, weightUnitLabel } from '../lib/units'
import type { BodyMetric, WorkoutLog } from '../types/database'

const NUTRITION_DAYS = 30
const WORKOUT_WEEKS = 8
const BODY_DAYS = 90

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function Dashboard() {
  const { profile } = useProfile()
  const dark = usePrefersDark()
  const colors = categoricalColors(dark)
  const chrome = chartChrome(dark)

  const [foodLogs, setFoodLogs] = useState<FoodLogWithFood[]>([])
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([])
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([])
  const [weightInput, setWeightInput] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [fl, wl, bm] = await Promise.all([
        listFoodLogsInRange(daysAgoStr(NUTRITION_DAYS - 1), todayStr()),
        listWorkoutLogsInRange(daysAgoStr(WORKOUT_WEEKS * 7 - 1), todayStr()),
        listBodyMetricsInRange(daysAgoStr(BODY_DAYS - 1), todayStr()),
      ])
      setFoodLogs(fl)
      setWorkoutLogs(wl)
      setBodyMetrics(bm)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const nutritionSeries = useMemo(() => {
    const byDate: Record<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }> = {}
    for (const log of foodLogs) {
      const bucket = (byDate[log.logged_date] ??= { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
      bucket.calories += log.food.calories * log.quantity
      bucket.protein_g += log.food.protein_g * log.quantity
      bucket.carbs_g += log.food.carbs_g * log.quantity
      bucket.fat_g += log.food.fat_g * log.quantity
    }
    const days: { date: string; label: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[] = []
    for (let i = NUTRITION_DAYS - 1; i >= 0; i--) {
      const date = daysAgoStr(i)
      const bucket = byDate[date] ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      days.push({ date, label: formatDateLabel(date), ...bucket })
    }
    return days
  }, [foodLogs])

  const workoutSeries = useMemo(() => {
    const byWeek: Record<string, number> = {}
    for (const log of workoutLogs) {
      const wk = mondayOf(log.logged_date)
      byWeek[wk] = (byWeek[wk] ?? 0) + 1
    }
    const weeks: { week: string; label: string; sessions: number }[] = []
    let cursor = mondayOf(daysAgoStr(WORKOUT_WEEKS * 7 - 1))
    for (let i = 0; i < WORKOUT_WEEKS; i++) {
      weeks.push({ week: cursor, label: formatDateLabel(cursor), sessions: byWeek[cursor] ?? 0 })
      cursor = addDays(cursor, 7)
    }
    return weeks
  }, [workoutLogs])

  const weightSeries = useMemo(() => {
    if (!profile) return []
    return bodyMetrics
      .filter((m) => m.weight != null)
      .map((m) => ({
        date: m.logged_date,
        label: formatDateLabel(m.logged_date),
        weight: kgToDisplay(m.weight as number, profile.unit_system),
      }))
  }, [bodyMetrics, profile])

  if (!profile) return null

  const logWeight = async () => {
    if (!weightInput) return
    await upsertBodyMetric({
      logged_date: todayStr(),
      weight: displayToKg(Number(weightInput), profile.unit_system),
      body_fat_pct: null,
      measurements: null,
    })
    setWeightInput('')
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Dashboard</h1>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Calories vs. target — last {NUTRITION_DAYS} days
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={nutritionSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: chrome.mutedInk, fontSize: 11 }}
              interval={Math.ceil(NUTRITION_DAYS / 8)}
              axisLine={{ stroke: chrome.baseline }}
              tickLine={false}
            />
            <YAxis tick={{ fill: chrome.mutedInk, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={{ background: chrome.surface, border: `1px solid ${chrome.gridline}`, fontSize: 12 }}
              labelStyle={{ color: chrome.primaryInk }}
            />
            <Bar dataKey="calories" fill={colors[0]} radius={[3, 3, 0, 0]} name="Calories" />
            {profile.daily_calorie_target ? (
              <ReferenceLine
                y={profile.daily_calorie_target}
                stroke={chrome.baseline}
                strokeDasharray="4 4"
                label={{ value: 'Target', position: 'insideTopRight', fill: chrome.mutedInk, fontSize: 11 }}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Macros — last {NUTRITION_DAYS} days
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={nutritionSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: chrome.mutedInk, fontSize: 11 }}
              interval={Math.ceil(NUTRITION_DAYS / 8)}
              axisLine={{ stroke: chrome.baseline }}
              tickLine={false}
            />
            <YAxis tick={{ fill: chrome.mutedInk, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={{ background: chrome.surface, border: `1px solid ${chrome.gridline}`, fontSize: 12 }}
              labelStyle={{ color: chrome.primaryInk }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: chrome.secondaryInk }} />
            <Line type="monotone" dataKey="protein_g" name="Protein (g)" stroke={colors[0]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="carbs_g" name="Carbs (g)" stroke={colors[1]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="fat_g" name="Fat (g)" stroke={colors[2]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 flex gap-6 text-sm">
          {(
            [
              ['Protein', 'protein_g', colors[0]],
              ['Carbs', 'carbs_g', colors[1]],
              ['Fat', 'fat_g', colors[2]],
            ] as const
          ).map(([label, key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-slate-500 dark:text-slate-400">
                {label} avg: <span className="font-medium text-slate-800 dark:text-slate-200">
                  {Math.round(
                    nutritionSeries.reduce((sum, d) => sum + d[key], 0) / (nutritionSeries.length || 1)
                  )}
                  g/day
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Workout consistency — last {WORKOUT_WEEKS} weeks
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={workoutSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: chrome.mutedInk, fontSize: 11 }} axisLine={{ stroke: chrome.baseline }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: chrome.mutedInk, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: chrome.surface, border: `1px solid ${chrome.gridline}`, fontSize: 12 }}
              labelStyle={{ color: chrome.primaryInk }}
            />
            <Bar dataKey="sessions" name="Sessions" fill={colors[0]} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Body weight — last {BODY_DAYS} days
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder={`Today's weight (${weightUnitLabel(profile.unit_system)})`}
              className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
            />
            <button
              onClick={logWeight}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Log
            </button>
          </div>
        </div>
        {weightSeries.length === 0 ? (
          <p className="text-sm text-slate-400">No weigh-ins yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chrome.mutedInk, fontSize: 11 }} axisLine={{ stroke: chrome.baseline }} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: chrome.mutedInk, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: chrome.surface, border: `1px solid ${chrome.gridline}`, fontSize: 12 }}
                labelStyle={{ color: chrome.primaryInk }}
                formatter={(v) => [`${Number(v).toFixed(1)} ${weightUnitLabel(profile.unit_system)}`, 'Weight']}
              />
              <Line type="monotone" dataKey="weight" name="Weight" stroke={colors[0]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  )
}

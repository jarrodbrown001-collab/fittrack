import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  getTrainingPlanData,
  listBodyMetricsInRange,
  listFoodLogsInRange,
  logEntryMacros,
  upsertBodyMetric,
  type FoodLogWithFood,
} from '../lib/api'
import { addDays, daysAgoStr, formatDateLabel, toDateStr, todayStr } from '../lib/date'
import { categoricalColors, chartChrome, usePrefersDark } from '../lib/chartColors'
import { displayToKg, kgToDisplay, weightUnitLabel } from '../lib/units'
import { getBlockPos, PH, R, S, PW, WEEKS } from './TrainingPlan'
import { ProgressBar } from '../components/ProgressBar'
import type { BodyMetric } from '../types/database'

const NUTRITION_DAYS = 30
const WORKOUT_WEEKS = 8
const BODY_DAYS = 90
const DAY_ICON: Record<string, string> = { strength: '🏋️', power: '⚡', zone2: '🏃', rest: '✝️' }

function toDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

function mondayOf(dateStr: string): string {
  const d = toDate(dateStr)
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toDateStr(d)
}

// The plan's calendar starts Monday June 1, 2026 — the same anchor
// getBlockPos() uses — so a week index maps directly to a real Monday date.
function mondayForWeekIndex(wIdx: number): string {
  return addDays('2026-06-01', wIdx * 7)
}

export function Dashboard() {
  const { profile } = useProfile()
  const dark = usePrefersDark()
  const colors = categoricalColors(dark)
  const chrome = chartChrome(dark)

  const [foodLogs, setFoodLogs] = useState<FoodLogWithFood[]>([])
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([])
  const [planData, setPlanData] = useState<Record<string, any> | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [fl, bm, pd] = await Promise.all([
        listFoodLogsInRange(daysAgoStr(NUTRITION_DAYS - 1), todayStr()),
        listBodyMetricsInRange(daysAgoStr(BODY_DAYS - 1), todayStr()),
        getTrainingPlanData(),
      ])
      setFoodLogs(fl)
      setBodyMetrics(bm)
      setPlanData(pd)
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
      const m = logEntryMacros(log)
      bucket.calories += m.calories
      bucket.protein_g += m.protein_g
      bucket.carbs_g += m.carbs_g
      bucket.fat_g += m.fat_g
    }
    const days: { date: string; label: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[] = []
    for (let i = NUTRITION_DAYS - 1; i >= 0; i--) {
      const date = daysAgoStr(i)
      const bucket = byDate[date] ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      days.push({ date, label: formatDateLabel(date), ...bucket })
    }
    return days
  }, [foodLogs])

  // "Consistency" = Training Plan sessions actually marked complete each
  // week, out of the 6 non-rest days the program schedules (Sundays are
  // rest, so they're excluded from the denominator).
  const workoutSeries = useMemo(() => {
    // Map each real-calendar Monday in the rolling window back to its
    // program week index (undefined outside the 12-week block).
    const mondayToWeekIdx = new Map<string, number>()
    WEEKS.forEach((_, wIdx) => mondayToWeekIdx.set(mondayForWeekIndex(wIdx), wIdx))

    const weeks: { week: string; label: string; sessions: number; possible: number }[] = []
    let cursor = addDays(mondayOf(todayStr()), -7 * (WORKOUT_WEEKS - 1))
    for (let i = 0; i < WORKOUT_WEEKS; i++) {
      const wIdx = mondayToWeekIdx.get(cursor)
      let sessions = 0
      let possible = 0
      if (wIdx !== undefined) {
        const week = WEEKS[wIdx]
        week.days.forEach((d: any, dIdx: number) => {
          if (d.type === R) return
          possible += 1
          if (planData?.cardio?.[`${wIdx}-${dIdx}`]) sessions += 1
        })
      }
      weeks.push({ week: cursor, label: formatDateLabel(cursor), sessions, possible })
      cursor = addDays(cursor, 7)
    }
    return weeks
  }, [planData])

  const todayTotals = useMemo(() => {
    const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    for (const log of foodLogs) {
      if (log.logged_date !== todayStr()) continue
      const m = logEntryMacros(log)
      totals.calories += m.calories
      totals.protein_g += m.protein_g
      totals.carbs_g += m.carbs_g
      totals.fat_g += m.fat_g
    }
    return totals
  }, [foodLogs])

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

  const todayPlan = useMemo(() => {
    const pos = getBlockPos()
    if (!pos.active) return null
    const week = WEEKS[pos.wIdx]
    const day = week.days[pos.dIdx]
    const ph = (PH as any)[week.ph]
    const key = `${pos.wIdx}-${pos.dIdx}`
    const completed = Boolean(planData?.cardio?.[key])
    let setsDone = 0
    let setsTotal = 0
    if (day.type === S || day.type === PW) {
      day.exs.forEach((e: any, ei: number) => {
        setsTotal += e.s
        setsDone += Math.min(planData?.sets?.[`${pos.wIdx}-${pos.dIdx}-${ei}`] ?? 0, e.s)
      })
    }
    return { week, day, ph, completed, setsDone, setsTotal }
  }, [planData])

  // "Upcoming workout" — tomorrow's scheduled session, so there's a heads-up
  // whenever the app is opened the day/night before.
  const tomorrowPlan = useMemo(() => {
    const tomorrow = addDays(todayStr(), 1)
    const pos = getBlockPos(toDate(tomorrow))
    if (!pos.active) return null
    const week = WEEKS[pos.wIdx]
    const day = week.days[pos.dIdx]
    if (day.type === R) return null // no heads-up needed for a rest day
    return { day }
  }, [])

  // Sunday check-in: how the just-finished week went.
  const weekSummary = useMemo(() => {
    if (new Date().getDay() !== 0) return null // only surface on Sundays
    const pos = getBlockPos()
    if (!pos.active) return null
    const week = WEEKS[pos.wIdx]
    let completed = 0
    let possible = 0
    week.days.forEach((d: any, dIdx: number) => {
      if (d.type === R) return
      possible += 1
      if (planData?.cardio?.[`${pos.wIdx}-${dIdx}`]) completed += 1
    })
    return { completed, possible }
  }, [planData])

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
          Today's training
        </h2>
        {!todayPlan ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No active training block right now.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    color: todayPlan.ph.c,
                    background: `rgba(${todayPlan.ph.r},0.12)`,
                  }}
                >
                  {todayPlan.ph.icon} Wk {todayPlan.week.w} · {todayPlan.ph.name}
                </span>
              </div>
              <div className="mt-1.5 truncate text-lg font-bold text-slate-50">
                {{ strength: '🏋️', power: '⚡', zone2: '🏃', rest: '✝️' }[todayPlan.day.type]}{' '}
                {todayPlan.day.title}
              </div>
              {todayPlan.day.type !== R && todayPlan.setsTotal > 0 && !todayPlan.completed && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {todayPlan.setsDone}/{todayPlan.setsTotal} sets logged
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {todayPlan.day.type === R ? (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400">
                  Rest day
                </span>
              ) : todayPlan.completed ? (
                <span className="rounded-full bg-green-900/40 px-3 py-1 text-xs font-medium text-green-400">
                  ✓ Complete
                </span>
              ) : (
                <span className="rounded-full bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-400">
                  Not yet completed
                </span>
              )}
              <Link
                to="/training-plan"
                className="text-xs font-medium text-indigo-500 hover:text-indigo-400"
              >
                Open training plan →
              </Link>
            </div>
          </div>
        )}
        {tomorrowPlan && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Up next: {DAY_ICON[tomorrowPlan.day.type]} {tomorrowPlan.day.title}
          </p>
        )}
      </section>

      {weekSummary && (
        <section className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-200">This week's summary</h2>
          <p className="text-sm text-slate-300">
            You completed{' '}
            <span className="font-semibold text-slate-50">
              {weekSummary.completed}/{weekSummary.possible}
            </span>{' '}
            scheduled sessions this week.{' '}
            {weekSummary.completed === weekSummary.possible
              ? 'Every session done — strong week.'
              : "Anything you didn't finish, log it now or let it go into next week."}
          </p>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Today's nutrition
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProgressBar
            label="Calories"
            value={todayTotals.calories}
            target={profile.daily_calorie_target ?? 0}
          />
          <ProgressBar
            label="Protein"
            value={todayTotals.protein_g}
            target={profile.daily_protein_target_g ?? 0}
            unit="g"
          />
          <ProgressBar
            label="Carbs"
            value={todayTotals.carbs_g}
            target={profile.daily_carb_target_g ?? 0}
            unit="g"
          />
          <ProgressBar
            label="Fat"
            value={todayTotals.fat_g}
            target={profile.daily_fat_target_g ?? 0}
            unit="g"
          />
        </div>
      </section>

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
        <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Training plan consistency — last {WORKOUT_WEEKS} weeks
        </h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Sessions marked complete in the Training Plan tab, out of 6 scheduled per week
          (Sundays are rest days and don't count).
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={workoutSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: chrome.mutedInk, fontSize: 11 }} axisLine={{ stroke: chrome.baseline }} tickLine={false} />
            <YAxis domain={[0, 6]} allowDecimals={false} tick={{ fill: chrome.mutedInk, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: chrome.surface, border: `1px solid ${chrome.gridline}`, fontSize: 12 }}
              labelStyle={{ color: chrome.primaryInk }}
              formatter={(v, _n, entry) => [`${v}/${entry.payload.possible} sessions`, 'Completed']}
            />
            <ReferenceLine y={6} stroke={chrome.baseline} strokeDasharray="4 4" />
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

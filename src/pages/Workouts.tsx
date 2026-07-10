import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createWorkoutLog, deleteWorkoutLog, listWorkoutLogs } from '../lib/api'
import { formatDateLabel, todayStr } from '../lib/date'
import type { WorkoutLog } from '../types/database'

export function Workouts() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setLogs(await listWorkoutLogs())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const startFreeform = async () => {
    setStarting(true)
    try {
      const log = await createWorkoutLog({
        plan_id: null,
        logged_date: todayStr(),
        duration_min: null,
        notes: null,
      })
      navigate(`/workouts/${log.id}`)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Workout history
        </h1>
        <button
          onClick={startFreeform}
          disabled={starting}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {starting ? 'Starting…' : '+ Freeform session'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-400">
          No sessions logged yet. Start one above or from a plan.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <button
                onClick={() => navigate(`/workouts/${log.id}`)}
                className="text-left text-slate-800 hover:text-indigo-600 dark:text-slate-200"
              >
                <span className="font-medium">{formatDateLabel(log.logged_date)}</span>
                {log.duration_min != null && (
                  <span className="ml-2 text-slate-400">{log.duration_min} min</span>
                )}
                {log.notes && <span className="ml-2 text-slate-400">· {log.notes}</span>}
              </button>
              <button
                onClick={async () => {
                  await deleteWorkoutLog(log.id)
                  load()
                }}
                className="text-slate-300 hover:text-red-500"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

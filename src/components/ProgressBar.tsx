export function ProgressBar({
  label,
  value,
  target,
  unit = '',
  showRemaining = true,
}: {
  label: string
  value: number
  target: number
  unit?: string
  showRemaining?: boolean
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const realPct = target > 0 ? Math.round((value / target) * 100) : 0
  const over = target > 0 && value > target
  const remaining = target - value

  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-slate-500 dark:text-slate-400">
          {Math.round(value)}
          {unit} {target > 0 ? `/ ${target}${unit} (${realPct}%)` : ''}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${over ? 'bg-amber-500' : 'bg-indigo-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showRemaining && target > 0 && (
        <div className={`mt-0.5 text-xs ${over ? 'text-amber-500' : 'text-slate-400'}`}>
          {over
            ? `${Math.round(-remaining)}${unit} over`
            : `${Math.round(remaining)}${unit} remaining`}
        </div>
      )}
    </div>
  )
}

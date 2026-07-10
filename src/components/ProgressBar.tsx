export function ProgressBar({
  label,
  value,
  target,
  unit = '',
}: {
  label: string
  value: number
  target: number
  unit?: string
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const over = target > 0 && value > target

  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-slate-500 dark:text-slate-400">
          {Math.round(value)}
          {unit} {target > 0 ? `/ ${target}${unit}` : ''}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${over ? 'bg-amber-500' : 'bg-indigo-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

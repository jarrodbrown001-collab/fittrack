import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/plans', label: 'Plans' },
  { to: '/workouts', label: 'Workouts' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            FitTrack
          </span>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {profile?.display_name}
            </span>
            <button
              onClick={signOut}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

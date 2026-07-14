import { NavLink, Outlet } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/training-plan', label: 'Training Plan' },
  { to: '/plans', label: 'Plans' },
  { to: '/workouts', label: 'Workouts' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  const { profile, loading } = useProfile()

  if (loading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center font-mono text-sm tracking-widest text-slate-400">
        LOADING...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-slate-950/95">
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <div className="flex items-center justify-between">
            <span
              className="text-xl font-black uppercase text-slate-50"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.2em' }}
            >
              FitTrack
            </span>
            <span className="text-xs tracking-widest text-slate-400">{profile.display_name}</span>
          </div>
          <nav className="-mb-px mt-2 flex overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                    isActive
                      ? 'border-indigo-500 text-indigo-500'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`
                }
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

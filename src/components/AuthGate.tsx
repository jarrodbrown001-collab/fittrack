import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cloudEnabled, clearUidCache, supabase } from '../lib/supabase'

// In local-only mode this renders children straight through. In cloud mode
// it blocks the app until a Supabase session exists, so data code can
// always assume a signed-in user.
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(cloudEnabled)

  useEffect(() => {
    if (!cloudEnabled) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      clearUidCache()
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!cloudEnabled) return <>{children}</>

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 font-mono text-sm tracking-widest text-slate-400">
        LOADING...
      </div>
    )
  }

  if (!session) return <SignIn />

  return <>{children}</>
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
    // On success onAuthStateChange in AuthGate swaps this screen out.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={signIn}
        className="w-full max-w-sm rounded-lg border border-white/[0.07] bg-slate-900 p-6"
      >
        <h1
          className="mb-1 text-2xl font-black text-slate-50"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.15em' }}
        >
          FitTrack
        </h1>
        <p className="mb-5 text-xs text-slate-400">
          Sign in to sync your data across devices.
        </p>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-widest text-slate-400">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-widest text-slate-400">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

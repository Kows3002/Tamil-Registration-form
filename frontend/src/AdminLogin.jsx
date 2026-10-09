import { useState } from 'react'

export default function AdminLogin({ onLogin, onToast, loading }) {
  const [username, setUsername] = useState('Adminshree')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submit = async event => {
    event.preventDefault(); setSubmitting(true)
    try { await onLogin(username.trim(), password) }
    catch (error) { onToast(error.message, 'error') }
    finally { setSubmitting(false) }
  }
  return <main className="login-page">
    <header className="login-header"><a className="login-brand" href="/">Sangam<span>Family Registration Portal</span></a><a className="back-link" href="/">Family registration</a></header>
    <section className="login-main"><div className="login-box"><span className="overline">ADMINISTRATION</span><h1>Admin sign in</h1><p>Enter your username and password.</p>
      <form onSubmit={submit}><label htmlFor="admin-username">Username<input id="admin-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /></label>
        <label htmlFor="admin-password">Password<span className="password-input"><input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /><button type="button" className="password-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
        </button></span></label>
        <button className="button primary wide" disabled={submitting || loading}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form><div className="login-security">Your session lasts for one hour.</div></div></section>
  </main>
}

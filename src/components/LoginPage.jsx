import { useState } from 'react'
import { useAppAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { loginBreakglass, oidcConfigured, oidcButtonLabel, signinRedirect } = useAppAuth()
  const [attempt, setAttempt] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [oidcErr, setOidcErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const ok = await loginBreakglass(attempt)
    setBusy(false)
    if (!ok) setErr(true)
  }

  const startOidc = () => {
    setOidcErr('')
    signinRedirect().catch((e) => {
      console.error('OIDC signinRedirect failed', e)
      setOidcErr(e?.message || String(e))
    })
  }

  return (
    <div className="center" style={{ maxWidth: 420, margin: '60px auto' }}>
      <div className="parchment panel">
        <div className="center">
          <div className="seal" style={{ margin: '0 auto 10px' }}>☠</div>
          <h2 className="section-title">The Captain's Log</h2>
          <p className="muted">Log in to come aboard.</p>
        </div>

        {oidcConfigured && (
          <div style={{ marginTop: 20 }}>
            <button className="btn brass" style={{ width: '100%' }} onClick={startOidc}>
              {oidcButtonLabel}
            </button>
            {oidcErr && <p style={{ color: 'var(--wax-red)', marginTop: 8, fontSize: 13 }}>{oidcErr}</p>}
          </div>
        )}

        <div className="rule" style={{ margin: '20px 0' }} />

        <form onSubmit={submit}>
          <label className="eyebrow">Breakglass password</label>
          <input
            className="input"
            type="password"
            autoFocus={!oidcConfigured}
            value={attempt}
            placeholder="password"
            onChange={(e) => { setAttempt(e.target.value); setErr(false) }}
          />
          {err && <p style={{ color: 'var(--wax-red)', marginTop: 8 }}>That's not it, matey.</p>}
          <button className="btn ghost" type="submit" disabled={busy} style={{ width: '100%', marginTop: 12 }}>
            Log in as admin
          </button>
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            Use this only if OIDC login is unavailable — it signs you in as the local admin with full control.
          </p>
        </form>
      </div>
    </div>
  )
}

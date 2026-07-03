import { useState } from 'react'
import { useData } from '../context/DataContext'
import Modal from './common/Modal'

// Soft edit lock: a single shared party passphrase unlocks editing for this
// browser. It deters casual visitors; it is not hard security (the data API is
// public). Change the passphrase any time from the Settings gear.
export default function EditGate() {
  const { canEdit, unlock, lock, settings, setSetting } = useData()
  const [open, setOpen] = useState(false)
  const [gear, setGear] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [err, setErr] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (unlock(attempt)) { setOpen(false); setAttempt(''); setErr(false) }
    else setErr(true)
  }

  return (
    <div className="toolbar">
      {canEdit ? (
        <>
          <span className="eyebrow" style={{ color: 'var(--brass-light)' }}>✦ Editing unlocked</span>
          <button className="btn small" onClick={() => setGear(true)}>⚙ Settings</button>
          <button className="btn small ghost" style={{ color: 'var(--parchment-light)', borderColor: 'var(--brass)' }} onClick={lock}>Lock</button>
        </>
      ) : (
        <button className="btn brass" onClick={() => setOpen(true)}>🔓 Unlock to edit</button>
      )}

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="center">
            <div className="seal" style={{ margin: '0 auto 10px' }}>✒</div>
            <h2 className="section-title">Captain's Passphrase</h2>
            <p className="muted">Enter the crew's shared passphrase to unlock editing.</p>
          </div>
          <form onSubmit={submit} style={{ marginTop: 16 }}>
            <input
              className="input"
              type="password"
              autoFocus
              value={attempt}
              placeholder="passphrase"
              onChange={(e) => { setAttempt(e.target.value); setErr(false) }}
            />
            {err && <p style={{ color: 'var(--wax-red)', marginTop: 8 }}>That's not the passphrase, matey.</p>}
            <div className="toolbar" style={{ marginTop: 16, justifyContent: 'center' }}>
              <button className="btn brass" type="submit">Unlock</button>
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {gear && (
        <Modal onClose={() => setGear(false)}>
          <h2 className="section-title">Settings</h2>
          <hr className="rule" />
          <label className="eyebrow">Edit passphrase</label>
          <input
            className="input"
            defaultValue={settings?.edit_passphrase ?? ''}
            onBlur={(e) => setSetting('edit_passphrase', e.target.value)}
          />
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
            Everyone shares this one word/phrase. Changing it here updates it for the whole crew.
          </p>
          <div className="toolbar" style={{ marginTop: 16 }}>
            <button className="btn brass" onClick={() => setGear(false)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

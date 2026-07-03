import { useState } from 'react'
import { useData } from '../../context/DataContext'
import Editable from '../common/Editable'

export default function FundsTab() {
  const { funds, ledger, patchSingleton, addItem, removeItem, canEdit } = useData()
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [sign, setSign] = useState(1)
  const [category, setCategory] = useState('')

  const total = ledger.reduce((s, e) => s + Number(e.amount || 0), 0)

  const addEntry = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!desc || !amt) return
    await addItem('ledger', { description: desc, amount: sign * Math.abs(amt), category })
    setDesc(''); setAmount(''); setCategory(''); setSign(1)
  }

  const purse = funds || { gold: 0, silver: 0, copper: 0 }

  return (
    <div>
      <h2 className="section-title">Funds & Ledger</h2>

      <div className="panel-grid" style={{ gridTemplateColumns: 'minmax(240px,1fr) 1.6fr', marginTop: 12 }}>
        {/* Purse */}
        <div className="card">
          <div className="eyebrow">The Purse</div>
          <hr className="rule" />
          {['gold', 'silver', 'copper'].map((coin) => (
            <div className="row-between" key={coin} style={{ marginBottom: 10 }}>
              <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                <span className={`coin ${coin}`}>{coin[0].toUpperCase()}</span>
                <span style={{ textTransform: 'capitalize' }}>{coin}</span>
              </span>
              <strong style={{ fontSize: 20 }}>
                <Editable type="number" value={purse[coin]} onCommit={(v) => patchSingleton('funds', { [coin]: v })} />
              </strong>
            </div>
          ))}
          <hr className="rule" />
          <div className="row-between">
            <span className="eyebrow">Ledger balance</span>
            <strong style={{ fontSize: 22, color: total < 0 ? 'var(--wax-red)' : 'var(--ink)' }}>
              {total} <span className="muted" style={{ fontSize: 14 }}>gp</span>
            </strong>
          </div>
        </div>

        {/* Ledger */}
        <div>
          {canEdit && (
            <form className="toolbar card" onSubmit={addEntry} style={{ marginBottom: 12 }}>
              <input className="input grow" style={{ width: 'auto' }} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <input className="input" style={{ width: 110 }} placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <button type="button" className={`btn small ${sign > 0 ? 'brass' : 'danger'}`} onClick={() => setSign((s) => -s)}>
                {sign > 0 ? '+ Income' : '– Expense'}
              </button>
              <input className="input" style={{ width: 90 }} type="number" placeholder="gp" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button className="btn brass" type="submit">Record</button>
            </form>
          )}

          <div className="list">
            {ledger.length === 0 && <span className="muted">No entries in the ledger yet.</span>}
            {[...ledger].reverse().map((e) => (
              <div className="card row-between" key={e.id}>
                <div className="grow">
                  <strong>{e.description}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {e.entry_date}{e.category ? ` · ${e.category}` : ''}
                  </div>
                </div>
                <strong style={{ color: Number(e.amount) < 0 ? 'var(--wax-red)' : '#2e7a3a', fontSize: 18 }}>
                  {Number(e.amount) > 0 ? '+' : ''}{e.amount} gp
                </strong>
                {canEdit && <button className="btn small danger" onClick={() => removeItem('ledger', e.id)}>✕</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useData } from '../../context/DataContext'
import Editable from '../common/Editable'

export default function JournalTab() {
  const { journal, addItem, patchItem, removeItem, canEdit } = useData()
  const [openIds, setOpenIds] = useState(() => new Set())

  // Newest first: by session number, then by creation time.
  const entries = [...journal].sort((a, b) => {
    const an = a.session_no ?? -Infinity
    const bn = b.session_no ?? -Infinity
    if (an !== bn) return bn - an
    return (a.created_at || '') < (b.created_at || '') ? 1 : -1
  })

  const nextNo = journal.reduce((m, e) => Math.max(m, e.session_no ?? -1), -1) + 1

  const addEntry = async () => {
    const row = await addItem('journal', {
      title: `Session ${nextNo} Recap`,
      session_no: nextNo,
      body: '',
      sort_order: journal.length + 1,
    })
    setOpenIds((s) => new Set(s).add(row.id))
  }

  const toggle = (id) =>
    setOpenIds((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  return (
    <div>
      <div className="row-between">
        <div>
          <h2 className="section-title">Ship's Journal</h2>
          <p className="muted" style={{ margin: 0 }}>Session recaps and summaries for the crew to look back on.</p>
        </div>
        {canEdit && <button className="btn brass" onClick={addEntry}>+ New entry</button>}
      </div>
      <hr className="rule" />

      {entries.length === 0 && <p className="muted">No entries yet. The tale begins soon.</p>}

      <div className="list">
        {entries.map((e) => {
          const open = openIds.has(e.id)
          return (
            <div className="card journal-entry" key={e.id}>
              <div className="row-between" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <h3 className="journal-title" style={{ margin: 0 }}>
                    <Editable value={e.title} onCommit={(v) => patchItem('journal', e.id, { title: v })} />
                  </h3>
                  <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>
                    Session <Editable type="number" value={e.session_no ?? ''} placeholder="#" onCommit={(v) => patchItem('journal', e.id, { session_no: v })} />
                    {' · '}
                    <Editable value={e.session_date} placeholder="date" onCommit={(v) => patchItem('journal', e.id, { session_date: v })} />
                  </div>
                </div>
                <div className="toolbar">
                  <button className="btn small ghost" onClick={() => toggle(e.id)}>{open ? 'Collapse' : 'Read'}</button>
                  {canEdit && <button className="btn small danger" onClick={() => { if (confirm('Delete this journal entry?')) removeItem('journal', e.id) }}>✕</button>}
                </div>
              </div>

              {open && (
                <div className="journal-body" style={{ marginTop: 12 }}>
                  <Editable
                    as="div"
                    multiline
                    placeholder="Write the recap of this session…"
                    value={e.body}
                    onCommit={(v) => patchItem('journal', e.id, { body: v })}
                  />
                </div>
              )}
              {!open && e.body && (
                <p className="muted journal-preview" style={{ marginTop: 8 }}>
                  {e.body.length > 160 ? e.body.slice(0, 160) + '…' : e.body}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useData } from '../../context/DataContext'
import Editable from '../common/Editable'

function QuestCard({ q, patchItem, removeItem, canEdit }) {
  const toggle = () => patchItem('quests', q.id, { status: q.status === 'active' ? 'completed' : 'active' })
  return (
    <div className={`parchment quest ${q.status === 'completed' ? 'done' : ''}`} style={{ transform: `rotate(${(q.sort_order % 3) - 1}deg)` }}>
      <div className="pin-tack" />
      <div className="row-between">
        <span className={`badge ${q.type}`}>{q.type === 'main' ? 'Main Quest' : 'Side Quest'}</span>
        {canEdit && (
          <select className="select" style={{ width: 90, fontSize: 12, padding: '2px 4px' }} value={q.type} onChange={(e) => patchItem('quests', q.id, { type: e.target.value })}>
            <option value="main">main</option>
            <option value="side">side</option>
          </select>
        )}
      </div>
      <h3 className="quest-title" style={{ marginTop: 8 }}>
        <Editable value={q.title} onCommit={(v) => patchItem('quests', q.id, { title: v })} />
      </h3>
      <Editable as="p" multiline placeholder="Describe the job…" value={q.description} onCommit={(v) => patchItem('quests', q.id, { description: v })} />
      <div className="muted" style={{ fontSize: 14 }}>
        <strong>Reward:</strong> <Editable value={q.reward} placeholder="—" onCommit={(v) => patchItem('quests', q.id, { reward: v })} />
      </div>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className={`btn small ${q.status === 'completed' ? 'ghost' : 'brass'}`} onClick={toggle}>
          {q.status === 'completed' ? '↺ Reopen' : '✓ Mark done'}
        </button>
        {canEdit && <button className="btn small danger" onClick={() => removeItem('quests', q.id)}>Remove</button>}
      </div>
    </div>
  )
}

export default function QuestsTab() {
  const { quests, addItem, patchItem, removeItem, canEdit } = useData()
  const active = quests.filter((q) => q.status === 'active')
  const done = quests.filter((q) => q.status === 'completed')

  const addQuest = async (type) => {
    const title = prompt(`New ${type} quest title`)
    if (title) await addItem('quests', { title, type, status: 'active', sort_order: quests.length + 1 })
  }

  return (
    <div>
      <div className="row-between">
        <h2 className="section-title">The Posterboard</h2>
        {canEdit && (
          <div className="toolbar">
            <button className="btn small brass" onClick={() => addQuest('main')}>+ Main quest</button>
            <button className="btn small" onClick={() => addQuest('side')}>+ Side quest</button>
          </div>
        )}
      </div>

      <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22, marginTop: 16 }}>
        {active.length === 0 && <p className="muted">No open jobs. Time to make trouble.</p>}
        {active.map((q) => <QuestCard key={q.id} q={q} patchItem={patchItem} removeItem={removeItem} canEdit={canEdit} />)}
      </div>

      {done.length > 0 && (
        <>
          <h3 className="section-title small" style={{ marginTop: 28 }}>Resolved</h3>
          <hr className="rule" />
          <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22 }}>
            {done.map((q) => <QuestCard key={q.id} q={q} patchItem={patchItem} removeItem={removeItem} canEdit={canEdit} />)}
          </div>
        </>
      )}
    </div>
  )
}

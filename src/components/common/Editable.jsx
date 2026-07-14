import { useEffect, useRef, useState } from 'react'
import { useData } from '../../context/DataContext'

// Inline-editable text. Reads like part of the log; click to edit when the
// party has unlocked editing. Commits on blur / Enter (Shift+Enter for newline
// in multiline mode).
export default function Editable({
  value,
  onCommit,
  multiline = false,
  placeholder = '—',
  className = '',
  as: Tag = 'span',
  type = 'text',
  editable, // optional override — defaults to the app-wide canEdit flag, but
  // callers can extend editing to e.g. a crew member's own linked character.
}) {
  const { canEdit: appCanEdit } = useData()
  const canEdit = editable ?? appCanEdit
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const ref = useRef(null)

  useEffect(() => setDraft(value ?? ''), [value])
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      if (ref.current.select) ref.current.select()
    }
  }, [editing])

  if (!canEdit) {
    const display =
      value === '' || value == null ? <span className="muted">{placeholder}</span> : String(value)
    return <Tag className={className}>{display}</Tag>
  }

  const commit = () => {
    setEditing(false)
    const next = type === 'number' ? Number(draft) : draft
    if (next !== value) onCommit?.(next)
  }

  if (!editing) {
    return (
      <Tag className={`editable ${className}`} onClick={() => setEditing(true)} title="Click to edit">
        {value === '' || value == null ? <span className="muted">{placeholder}</span> : String(value)}
      </Tag>
    )
  }

  if (multiline) {
    return (
      <textarea
        ref={ref}
        className="textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
        }}
      />
    )
  }

  return (
    <input
      ref={ref}
      className="input"
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
      }}
    />
  )
}

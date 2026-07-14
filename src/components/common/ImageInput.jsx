import { useState } from 'react'
import { uploadImage } from '../../lib/upload'
import { assetUrl } from '../../lib/asset'

// Reusable image chooser used everywhere the app edits an image (crew art, the
// ship, Scuttlebutt posts, …). Upload a file straight from the device (primary)
// or paste a URL (fallback), with an optional preview and a clear button.
// Persists the resulting URL — or null when cleared — via onCommit.
export default function ImageInput({
  value,
  onCommit,
  folder = 'misc',        // storage sub-folder, keeps uploads tidy per feature
  label,
  showPreview = true,
  previewClassName = 'imageinput-preview',
}) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [urlMode, setUrlMode] = useState(false)
  const [draft, setDraft] = useState(value || '')

  const pick = async (file) => {
    if (!file) return
    setErr('')
    setUploading(true)
    try {
      const url = await uploadImage(file, folder)
      onCommit(url)
    } catch (e) {
      console.error('image upload failed', e)
      setErr('Upload failed — the storage bucket may not be set up yet.')
    } finally {
      setUploading(false)
    }
  }

  const commitUrl = () => {
    setUrlMode(false)
    const v = draft.trim()
    if (v !== (value || '')) onCommit(v || null)
  }

  return (
    <div className="imageinput">
      {label && <label className="eyebrow">{label}</label>}
      {showPreview && value && (
        <img className={previewClassName} src={assetUrl(value)} alt="" loading="lazy" />
      )}
      <div className="imageinput-btns">
        <label className={`btn small ghost imageinput-upload ${uploading ? 'disabled' : ''}`}>
          {uploading ? 'Uploading…' : (value ? '📷 Replace' : '📷 Upload image')}
          <input type="file" accept="image/*" hidden disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f) }} />
        </label>
        <button type="button" className="btn small ghost"
          onClick={() => { setDraft(value || ''); setUrlMode((m) => !m) }}>🔗 URL</button>
        {value && (
          <button type="button" className="btn small ghost" onClick={() => onCommit(null)}>Clear</button>
        )}
      </div>
      {urlMode && (
        <input className="input" autoFocus value={draft}
          placeholder="paste an image link"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { setDraft(value || ''); setUrlMode(false) }
          }} />
      )}
      {err && <p className="muted" style={{ color: 'var(--wax-red)', margin: '4px 0 0' }}>{err}</p>}
    </div>
  )
}

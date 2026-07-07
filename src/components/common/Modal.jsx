import { useEffect } from 'react'

export default function Modal({ children, onClose, className = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`parchment modal ${className}`} style={{ position: 'relative' }}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-scroll">{children}</div>
      </div>
    </div>
  )
}

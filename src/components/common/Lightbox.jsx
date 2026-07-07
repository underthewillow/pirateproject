import { useEffect } from 'react'

// Full-screen in-app image viewer — replaces `target="_blank"` links, which
// escape the app entirely (and break outright in an installed/standalone PWA).
export default function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lightbox-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">✕</button>
      <img className="lightbox-img" src={src} alt={alt} />
    </div>
  )
}

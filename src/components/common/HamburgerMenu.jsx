import { useEffect } from 'react'

// Slide-in nav drawer — same escape/backdrop-click-to-close pattern as Modal.jsx.
export default function HamburgerMenu({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="drawer parchment">{children}</div>
    </div>
  )
}

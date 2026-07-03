import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { playDice, isMuted, setMuted } from '../lib/sound'

const RollCtx = createContext(null)
export const useRoller = () => useContext(RollCtx)

// Global roll toaster: any roll anywhere in the app funnels through show(),
// which plays the dice sound and pops an animated overlay so nobody has to
// scroll to see the result.
export function RollProvider({ children }) {
  const [roll, setRoll] = useState(null)
  const [muted, setMutedState] = useState(isMuted())
  const timer = useRef(null)
  const counter = useRef(0)

  const show = useCallback((entry) => {
    setRoll({ ...entry, id: ++counter.current })
    playDice()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setRoll(null), 3400)
  }, [])

  const toggleMute = () => { const v = !muted; setMuted(v); setMutedState(v) }

  return (
    <RollCtx.Provider value={{ show }}>
      {children}
      {roll && (
        <div className="roll-overlay" key={roll.id} onClick={() => setRoll(null)}>
          <div className={`roll-card ${roll.crit ? 'crit' : ''} ${roll.fumble ? 'fumble' : ''}`}>
            <div className="roll-die">
              <svg viewBox="0 0 100 100" className="d20-svg" aria-hidden="true">
                <polygon points="50,4 92,28 92,72 50,96 8,72 8,28"
                  fill="rgba(255,250,235,0.12)" stroke="currentColor" strokeWidth="3" />
                <polygon points="50,4 92,28 50,50 8,28" fill="rgba(255,255,255,0.08)" />
                <polygon points="92,28 92,72 50,50" fill="rgba(0,0,0,0.10)" />
                <polygon points="8,28 8,72 50,50" fill="rgba(0,0,0,0.18)" />
              </svg>
              {roll.face != null && <span className="roll-face">{roll.face}</span>}
            </div>
            <div className="roll-info">
              <div className="roll-total">{roll.total}</div>
              <div className="roll-label">{roll.label}</div>
              {roll.detail && <div className="roll-detail">{roll.detail}</div>}
            </div>
          </div>
          <button
            className="roll-mute"
            onClick={(e) => { e.stopPropagation(); toggleMute() }}
            title={muted ? 'Unmute dice' : 'Mute dice'}
          >{muted ? '🔇' : '🔊'}</button>
        </div>
      )}
    </RollCtx.Provider>
  )
}

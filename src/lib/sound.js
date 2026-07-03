// Tiny synthesized dice sound via the Web Audio API — no audio files to host.
// A few short filtered-noise "clacks" like dice settling on a table.
let ctx
const audioCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) ctx = new AC()
  }
  return ctx
}

export const isMuted = () => {
  try { return localStorage.getItem('diceMuted') === '1' } catch { return false }
}
export const setMuted = (v) => {
  try { localStorage.setItem('diceMuted', v ? '1' : '0') } catch { /* ignore */ }
}

export function playDice() {
  if (isMuted()) return
  const c = audioCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume()
  const now = c.currentTime
  const n = 3 + Math.floor(Math.random() * 2)
  for (let i = 0; i < n; i++) {
    const t = now + i * 0.055 + Math.random() * 0.02
    const len = Math.floor(c.sampleRate * 0.05)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let s = 0; s < len; s++) d[s] = (Math.random() * 2 - 1) * Math.pow(1 - s / len, 3)
    const src = c.createBufferSource(); src.buffer = buf
    const filt = c.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1100 + Math.random() * 900; filt.Q.value = 0.8
    const gain = c.createGain(); gain.gain.value = 0.18 + Math.random() * 0.1
    src.connect(filt); filt.connect(gain); gain.connect(c.destination)
    src.start(t); src.stop(t + 0.06)
  }
}

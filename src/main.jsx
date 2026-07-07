import React from 'react'
import ReactDOM from 'react-dom/client'
import { DataProvider } from './context/DataContext'
import { AppAuthProvider } from './context/AuthContext'
import { RollProvider } from './context/RollContext'
import App from './App'
import './styles/theme.css'
import './styles/additions.css'

// One-time cleanup: a brief PWA experiment registered a service worker that
// precached the app shell. It's been reverted, but service workers don't
// uninstall themselves — devices that visited during that window can keep
// running the old worker and serving stale cached pages indefinitely. Force
// it off for everyone; safe to remove once we're confident it's cleared out.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister())
  })
}
if ('caches' in window) {
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DataProvider>
      <AppAuthProvider>
        <RollProvider>
          <App />
        </RollProvider>
      </AppAuthProvider>
    </DataProvider>
  </React.StrictMode>
)

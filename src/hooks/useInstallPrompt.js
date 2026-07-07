import { useEffect, useState } from 'react'

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// Captures the browser's deferred `beforeinstallprompt` event so we can
// trigger the native "Add to Home Screen" flow from our own drawer button
// instead of waiting for the browser's own (often hidden) install UI.
export default function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredEvent(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferredEvent) return
    deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredEvent(null)
  }

  return { canInstall: !!deferredEvent && !installed, promptInstall }
}

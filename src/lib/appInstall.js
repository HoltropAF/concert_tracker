// Shared "the browser will let us install" state.
//
// `beforeinstallprompt` fires once, on App, and the event object it hands over is
// the only thing that can trigger an install — it can't be recreated later. So App
// captures it here and anything else (currently Settings) can offer the install
// too, which means dismissing the banner is "not now" rather than "never".
//
// Same shape and reasoning as lib/swUpdate.js.

import { useEffect, useState } from 'react'

let state = { available: false, prompt: null }
const listeners = new Set()

export function publishInstallState(next) {
  state = { ...state, ...next }
  listeners.forEach(fn => fn(state))
}

// * Returns { available, prompt }. `prompt` shows the browser's own install dialog
// * and can only be used once, so callers should treat a successful call as final.
export function useAppInstall() {
  const [snapshot, setSnapshot] = useState(state)
  useEffect(() => {
    listeners.add(setSnapshot)
    setSnapshot(state)
    return () => listeners.delete(setSnapshot)
  }, [])
  return snapshot
}

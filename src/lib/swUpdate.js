// Shared "an update is waiting" state.
//
// The service-worker registration lives inside SWUpdateBanner, which is lazily
// loaded and deliberately isolated so a failure in useRegisterSW can't crash the
// app. But Settings needs to know about a pending update too — so that dismissing
// the banner means "later", not "never".
//
// Rather than hoisting the SW hook up into App (which would remove that isolation),
// the banner publishes into this tiny store and anything else subscribes. If the
// banner chunk fails to load, the store simply stays empty and nothing is shown.

import { useEffect, useState } from 'react'

let state = { pending: false, apply: null }
const listeners = new Set()

export function publishUpdateState(next) {
  state = { ...state, ...next }
  listeners.forEach(fn => fn(state))
}

// * Returns { pending, apply }. `apply` reloads into the new version; it is null
// * until the banner has registered, so always check before calling.
export function useSWUpdate() {
  const [snapshot, setSnapshot] = useState(state)
  useEffect(() => {
    listeners.add(setSnapshot)
    setSnapshot(state) // catch anything published before this subscribed
    return () => listeners.delete(setSnapshot)
  }, [])
  return snapshot
}

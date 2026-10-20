// Wait for the download to finish before reporting whether an update exists.
export async function checkAppUpdate(registration, { online = true, timeout = 20000 } = {}) {
  if (!online) return 'offline'
  if (!registration) return 'unsupported'
  let timer, worker, listener, finished = false
  try {
    return await Promise.race([
      (async () => {
        await registration.update()
        if (finished) return 'failed'
        if (registration.waiting) return 'found'
        worker = registration.installing
        if (worker) {
          await new Promise((resolve, reject) => {
            listener = () => {
              if (worker.state === 'installed' || worker.state === 'activated') resolve()
              if (worker.state === 'redundant') reject(new Error('Installation failed'))
            }
            worker.addEventListener('statechange', listener)
            listener()
          })
        }
        return registration.waiting ? 'found' : 'current'
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Check timed out')), timeout) }),
    ])
  } catch {
    return 'failed'
  } finally {
    finished = true
    clearTimeout(timer)
    if (worker && listener) worker.removeEventListener('statechange', listener)
  }
}

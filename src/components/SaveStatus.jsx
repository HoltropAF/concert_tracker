import {useEffect,useState} from 'react'

export default function SaveStatus({status,onRetry,sync}) {
  const [dismissed,setDismissed] = useState(0)
  const {visiblePending = 0, savedVersion = 0} = status
  useEffect(() => {
    if (visiblePending || !savedVersion) return
    const timer = setTimeout(() => setDismissed(savedVersion), 3000)
    return () => clearTimeout(timer)
  }, [visiblePending, savedVersion])
  const pending = sync?.pending || 0
  const showSync = !!sync && (!sync.connected || !!sync.error || pending > 0)
  const count = pending === 1 ? '1 change' : `${pending} changes`
  const syncLabel = !sync?.online
    ? pending ? `Offline · ${count} saved here` : 'Offline'
    : !sync.connected ? 'Reconnecting · library saved here'
    : sync.error ? pending ? `${count} waiting to sync` : 'Library couldn’t refresh'
    : `Syncing ${count}…`
  if (!visiblePending && !status.failed && savedVersion === dismissed && !showSync) return null
  return <div role={status.failed ? 'alert' : 'status'} aria-live="polite" style={{position:'fixed',bottom:'calc(76px + env(safe-area-inset-bottom, 0px))',left:'max(12px, calc((100vw - 480px) / 2 + 12px))',zIndex:500,padding:'8px 12px',borderRadius:10,background:'#13131f',color:status.failed?'#fda4af':'#c4c2f0',border:'1px solid #3d3564',fontSize:12,maxWidth:240}}>
    {visiblePending ? `Saving${visiblePending > 1 ? ` (${visiblePending})` : ''}…` : status.failed ? 'Some changes couldn’t be saved.' : showSync ? syncLabel : 'Saved'}
    {!!status.failed && <button disabled={!!status.pending} onClick={onRetry} style={{marginLeft:8}}>Retry saves</button>}
    {!status.failed && sync?.online && sync.error && <button disabled={sync.syncing} onClick={sync.retry} style={{marginLeft:8}}>Retry sync</button>}
  </div>
}

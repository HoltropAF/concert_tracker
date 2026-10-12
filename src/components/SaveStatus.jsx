export default function SaveStatus({status,onRetry}) {
  if (!status.pending && !status.failed && !status.completed) return null
  return <div role={status.failed ? 'alert' : 'status'} aria-live="polite" style={{position:'fixed',bottom:76,right:12,zIndex:500,padding:'8px 12px',borderRadius:10,background:'#13131f',color:status.failed?'#fda4af':'#c4c2f0',border:'1px solid #3d3564',fontSize:12,maxWidth:280}}>
    {status.pending ? `Saving${status.pending > 1 ? ` (${status.pending})` : ''}…` : status.failed ? 'Some changes couldn’t be saved.' : 'Saved'}
    {!!status.failed && <button disabled={!!status.pending} onClick={onRetry} style={{marginLeft:8}}>Retry saves</button>}
  </div>
}

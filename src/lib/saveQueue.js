// Serialize writes so optimistic rollback cannot undo a later successful save.
export function createSaveQueue(onChange = () => {}) {
  let tail = Promise.resolve(), pending = 0, completed = false, visiblePending = 0, savedVersion = 0
  const failed = new Map()
  const publish = () => onChange({pending,failed:failed.size,completed,visiblePending,savedVersion})
  const run = (key,action,{notify = false} = {}) => {
    pending++; if (notify) visiblePending++; publish()
    const job = tail.then(async()=>{
      try {
        const result = await action()
        if (result?.error) throw result.error
        failed.delete(key); completed = true
        if (notify) savedVersion++
        return result || {error:null}
      } catch(error) {
        failed.set(key,action)
        return {error}
      } finally {pending--; if (notify) visiblePending--; publish()}
    })
    tail = job.then(()=>{})
    return job
  }
  return {run,retry:()=>Promise.all([...failed].map(([key,action])=>run(key,action,{notify:true})))}
}

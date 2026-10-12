// Serialize writes so optimistic rollback cannot undo a later successful save.
export function createSaveQueue(onChange = () => {}) {
  let tail = Promise.resolve(), pending = 0, completed = false
  const failed = new Map()
  const publish = () => onChange({pending,failed:failed.size,completed})
  const run = (key,action) => {
    pending++; publish()
    const job = tail.then(async()=>{
      try {
        const result = await action()
        if (result?.error) throw result.error
        failed.delete(key); completed = true
        return result || {error:null}
      } catch(error) {
        failed.set(key,action)
        return {error}
      } finally {pending--;publish()}
    })
    tail = job.then(()=>{})
    return job
  }
  return {run,retry:()=>Promise.all([...failed].map(([key,action])=>run(key,action)))}
}

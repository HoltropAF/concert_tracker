// One browser event must close only the foremost page, never every open layer.
export function createBackStack(){
  const entries=[]
  let discardPop = false
  return {
    add(callback){const entry={callback};entries.push(entry);return ()=>{const i=entries.indexOf(entry);if(i>=0)entries.splice(i,1)}},
    discardNextPop(){discardPop = true},
    back(){if (discardPop) discardPop = false; else entries.at(-1)?.callback()},
    get size(){return entries.length},
  }
}

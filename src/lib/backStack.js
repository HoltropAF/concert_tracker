// One browser event must close only the foremost page, never every open layer.
export function createBackStack(){
  const entries=[]
  return {
    add(callback){const entry={callback};entries.push(entry);return ()=>{const i=entries.indexOf(entry);if(i>=0)entries.splice(i,1)}},
    back(){entries.at(-1)?.callback()},
    get size(){return entries.length},
  }
}

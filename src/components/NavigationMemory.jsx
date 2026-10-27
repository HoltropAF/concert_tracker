import {createContext,useContext,useRef,useState,useEffect} from 'react'

const Context=createContext(null)
export function NavigationMemory({children}){
  const memory=useRef(new Map())
  return <Context.Provider value={memory.current}>{children}</Context.Provider>
}

export function useChangedValue(effect,value){
  const previous=useRef(value)
  useEffect(()=>{
    if(Object.is(previous.current,value))return
    previous.current=value
    return effect()
  },[value])
}

// Keep navigation choices when opening a detail temporarily unmounts its list.
// Memory belongs to the signed-in app instance; it is never written to account data.
export function useRememberedState(key,initial){
  const memory=useContext(Context)
  const [value,setValue]=useState(()=>memory?.has(key)?memory.get(key):typeof initial==='function'?initial():initial)
  const current=useRef(value)
  const set=next=>{
    const resolved=typeof next==='function'?next(current.current):next
    current.current=resolved
    memory?.set(key,resolved)
    setValue(resolved)
  }
  return [value,set]
}

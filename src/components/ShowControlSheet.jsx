import {useEffect,useRef} from 'react'
import {createPortal} from 'react-dom'
export default function ShowControlSheet({title,onClose,children}) {
  const ref=useRef(null)
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close()},[])
  return createPortal(<dialog ref={ref} data-theme-shell aria-label={title} onCancel={e=>{e.preventDefault();onClose()}} style={{position:'fixed',inset:'auto 0 0',margin:'0 auto',width:'min(480px,100vw)',maxWidth:'100vw',maxHeight:'80dvh',padding:0,border:'1px solid #2e2e50',borderRadius:'16px 16px 0 0',background:'#13131f',color:'#e2e0ff',filter:'var(--settracker-display-filter,none)'}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',position:'sticky',top:0,background:'#13131f',zIndex:1,borderBottom:'1px solid #1f1f35'}}><h2 style={{fontFamily:"'Syne',sans-serif",fontSize:18}}>{title}</h2><button onClick={onClose} aria-label={'Close '+title} style={{background:'none',border:0,color:'#9491b8',width:44,height:44,fontSize:24}}>×</button></header>
    <div style={{padding:'14px 16px'}}>{children}</div>
    <footer style={{position:'sticky',bottom:0,padding:'10px 16px calc(12px + env(safe-area-inset-bottom,0px))',background:'#13131f',borderTop:'1px solid #1f1f35'}}><button onClick={onClose} style={{width:'100%',minHeight:44,background:'#a78bfa',color:'#0c0c14',border:0,borderRadius:9,fontWeight:700}}>Done</button></footer>
  </dialog>,document.body)
}

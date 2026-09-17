import { useId } from 'react'

export const editorSectionTab = title => ['Photo', 'Your experience', 'Notes'].includes(title) ? 'memories' : title === 'Financial' ? 'costs' : title === 'Acts seen' ? 'setlist' : 'show'

export default function ConcertEditorTabs({ value, onChange, festival = false }) {
  const id = useId()
  const tabs = [['show', 'Show'], ['setlist', festival ? 'Lineup' : 'Setlist'], ['memories', 'Memories'], ['costs', 'Costs']]
  return <div role="tablist" aria-label="Concert editor sections" style={{ display: 'flex', background: '#0c0c14', borderBottom: '1px solid #30273f', padding: '0 12px', flexShrink: 0 }}>
    {tabs.map(([key, title], index) => <button key={key} id={`${id}-${key}`} type="button" role="tab" aria-selected={value === key} tabIndex={value === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? 3 : (index + (e.key === 'ArrowRight' ? 1 : 3)) % 4
      onChange(tabs[next][0]); document.getElementById(`${id}-${tabs[next][0]}`)?.focus()
    }} style={{ flex: 1, minHeight: 46, border: 0, borderBottom: `2px solid ${value === key ? '#a78bfa' : 'transparent'}`, background: 'none', color: value === key ? '#c4b5fd' : '#aaa3bc', fontSize: 13, cursor: 'pointer' }}>{title}</button>)}
  </div>
}

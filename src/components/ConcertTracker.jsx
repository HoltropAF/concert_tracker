import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { uploadConcertPhoto, deleteConcertPhoto, getPhotoUrl } from '../lib/photos'
import { startSpotifyAuth, getValidSpotifyToken } from '../lib/spotify'
import { requestPermission as requestNotifyPermission, canNotify, reScheduleAll } from '../lib/notifications'
import SpotifyMatcher from './SpotifyMatcher'

function PhotoImg({ path, style, pos }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { let on = true; getPhotoUrl(path).then(u => { if (on) setUrl(u) }); return () => { on = false } }, [path])
  const objectPosition = pos ? `${pos.x ?? 50}% ${pos.y ?? 50}%` : '50% 50%'
  if (!url) return <div style={{ ...style, background: '#13131f' }} />
  return <img src={url} alt="" loading="lazy" style={{ ...style, objectFit: 'cover', objectPosition, display: 'block' }} />
}

function PhotoAdjust({ path, pos, onChange }) {
  const [url, setUrl] = useState(null)
  const boxRef = useRef(null)
  const drag = useRef(null)
  useEffect(() => { let on = true; getPhotoUrl(path).then(u => { if (on) setUrl(u) }); return () => { on = false } }, [path])
  const p = pos || { x: 50, y: 50 }
  const start = (cx, cy) => { drag.current = { x: cx, y: cy, px: p.x ?? 50, py: p.y ?? 50 } }
  const move = (cx, cy) => {
    if (!drag.current || !boxRef.current) return
    const rect = boxRef.current.getBoundingClientRect()
    const nx = Math.max(0, Math.min(100, drag.current.px - ((cx - drag.current.x) / rect.width) * 100))
    const ny = Math.max(0, Math.min(100, drag.current.py - ((cy - drag.current.y) / rect.height) * 100))
    onChange({ x: Math.round(nx), y: Math.round(ny) })
  }
  return (
    <div>
      <div ref={boxRef}
        onTouchStart={e => { const t = e.touches[0]; start(t.clientX, t.clientY) }}
        onTouchMove={e => { const t = e.touches[0]; move(t.clientX, t.clientY) }}
        onTouchEnd={() => { drag.current = null }}
        onMouseDown={e => start(e.clientX, e.clientY)}
        onMouseMove={e => { if (e.buttons === 1) move(e.clientX, e.clientY) }}
        onMouseUp={() => { drag.current = null }}
        onMouseLeave={() => { drag.current = null }}
        style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', touchAction: 'none', cursor: 'grab', background: '#13131f', position: 'relative' }}>
        {url && <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${p.x ?? 50}% ${p.y ?? 50}%`, display: 'block', pointerEvents: 'none' }} />}
        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: '#e2e0ff', background: '#0c0c14aa', padding: '3px 8px', borderRadius: 99, fontFamily: "'DM Mono', monospace", pointerEvents: 'none' }}>↕↔ drag to reframe</div>
      </div>
      <button onClick={() => onChange({ x: 50, y: 50 })} style={{ marginTop: 6, background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#6b6a8f', fontSize: 11, padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>center</button>
    </div>
  )
}

// ============================================================
// HELPERS
// ============================================================

const APP_VERSION = '1.0.1'
// TODO: bump APP_VERSION in every release and update public/changelog.md before going public

const CHART_GROUP_IDS = [
  { id: "activity",  label: "Activity"  },
  { id: "friends",   label: "Friends"   },
  { id: "places",    label: "Places"    },
  { id: "financial", label: "Financial" },
  { id: "music",     label: "Music"     },
];

function useBackButton(onBack, enabled = true) {
  const cb = useRef(onBack);
  const pushed = useRef(false);
  cb.current = onBack;
  useEffect(() => {
    if (!enabled) {
      if (pushed.current) { pushed.current = false; history.go(-1); }
      return;
    }
    history.pushState({ appBack: true }, '');
    pushed.current = true;
    const handler = () => { pushed.current = false; cb.current(); };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [enabled]);
}

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const getYear = (dateStr) => dateStr.slice(0, 4);

const today = new Date();
const isPast = (dateStr) => new Date(dateStr + "T00:00:00") <= today;
const isWish = c => !!c?.wishlist;
const isOnline = c => c?.attendanceMode === 'online';
const ONLINE_COLOR = "#22d3ee";
const onlineTypeLabel = c => c?.onlineType === 'fanmeeting' ? 'Fanmeeting' : 'Concert';
const formatOnlineLocation = c => {
  const bits = [onlineTypeLabel(c)];
  if (c?.platform) bits.push(c.platform);
  return bits.join(' · ');
};

const getSupportName = s => typeof s === 'string' ? s : (s?.name || '');
const getSupportRole = s => typeof s === 'string' ? 'support' : (s?.role || 'support');
const getFriends = c => Array.isArray(c?.friends) ? c.friends : [];
const getGenres = c => Array.isArray(c?.genre) ? c.genre.filter(Boolean) : (c?.genre ? [c.genre] : []);

// * Songs are stored as a plain string OR { name, info?, cover?, spotifyId? }.
// * Always use these helpers — never access song fields directly.
// TODO: add spotifyId support once Spotify matching is built (docs/spotify-integration-plan.md)
const getSongName = s => typeof s === 'string' ? s : (s?.name || '');
const getSongInfo = s => typeof s === 'string' || !s ? null : (s.info || null);
const getSongCover = s => typeof s === 'string' || !s ? null : (s.cover || null);
const getSongList = songs => Array.isArray(songs) ? songs.filter(Boolean) : [];
const formatDuration = ms => { if (!ms) return null; const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// Extra costs beyond ticket price: travel, stay (accommodation), food, other misc.
// Falls back to the legacy single `otherCost` number for shows saved before this breakdown existed.
const extraCostTotal = c => {
  if (c && c.costBreakdown) {
    const b = c.costBreakdown;
    return (b.travel || 0) + (b.stay || 0) + (b.food || 0) + (b.other || 0);
  }
  return (c && c.otherCost) || 0;
};

const DONUT_PALETTE = ["#a78bfa","#f472b6","#38bdf8","#34d399","#fb923c","#818cf8","#e879f9","#22d3ee","#facc15","#fb7185"];
const GENRE_COLORS = DONUT_PALETTE;
const GENRE_COLORS_PASTEL = ["#d4c4fd","#fbb3d4","#9dd9f9","#96e9cd","#fdc898","#bbbcf9","#f3b6fb","#90eaf7","#fde98a","#fdb4bf"];
const VENUE_COLORS = DONUT_PALETTE;

const loadXlsx = () => import('xlsx');

// ============================================================
// COMPONENTS
// ============================================================

function StarRating({ value, onChange, max = 5 }) {
  return (
    <div style={{ display: "flex", gap: max === 10 ? 3 : 6 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: max === 10 ? 18 : 22, color: n <= (value || 0) ? "#a78bfa" : "#2e2e4a",
            padding: 0, lineHeight: 1
          }}
        >★</button>
      ))}
    </div>
  );
}

function DropdownSelect({ options, selected, onToggle, multi = false, placeholder = "Select...", accentColor = "#a78bfa", onAddNew = null }) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newValue, setNewValue] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const selectedArr = Array.isArray(selected) ? selected : selected ? [selected] : [];
  const summary = selectedArr.length === 0 ? placeholder : selectedArr.join(', ');
  const submitNew = () => {
    const v = newValue.trim();
    if (v && onAddNew) onAddNew(v);
    setNewValue('');
    setAddingNew(false);
    if (!multi) setOpen(false);
  };
  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: '#0c0c14', border: `1px solid ${open ? accentColor : '#2e2e50'}`, borderRadius: 8, color: selectedArr.length ? '#c4c2f0' : '#4a4870', padding: '8px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{summary}</span>
        <span style={{ color: '#4a4870', fontSize: 10, marginLeft: 8, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#13131f', border: `1px solid ${accentColor}44`, borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px #00000060' }}>
          {options.map(opt => {
            const isSelected = selectedArr.includes(opt);
            return (
              <button key={opt} onClick={() => { onToggle(opt); if (!multi) setOpen(false); }} style={{ width: '100%', background: isSelected ? `${accentColor}18` : 'none', border: 'none', borderBottom: '1px solid #1f1f35', color: isSelected ? '#e2e0ff' : '#6b6a8f', padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 16, flexShrink: 0, color: '#34d399', fontSize: 14 }}>{isSelected ? '✓' : ''}</span>
                {opt}
              </button>
            );
          })}
          {onAddNew && (
            addingNew ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px' }}>
                <input
                  autoFocus value={newValue} onChange={e => setNewValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setNewValue(''); setAddingNew(false); } }}
                  placeholder="New option…" style={{ flex: 1, background: '#0c0c14', border: `1px solid ${accentColor}`, borderRadius: 6, color: '#e2e0ff', padding: '5px 8px', fontFamily: "'DM Mono', monospace", fontSize: 12, outline: 'none' }}
                />
                <button onClick={submitNew} style={{ background: 'none', border: 'none', color: accentColor, fontSize: 15, cursor: 'pointer', padding: '0 4px' }}>✓</button>
              </div>
            ) : (
              <button onClick={() => setAddingNew(true)} style={{ width: '100%', background: 'none', border: 'none', color: accentColor, padding: '9px 12px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>+ Add new…</button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ children, color = "#1a2e26" }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 99,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      background: color, color: "#a78bfa", border: "1px solid #2a3d35"
    }}>{children}</span>
  );
}

// Itemized extra-cost entry: travel, stay (accommodation), food, other misc.
// Writes to form.costBreakdown = {travel, stay, food, other}; shows a running subtotal.
function CostBreakdownFields({ value, onChange, labelStyle, inputStyle }) {
  const b = value || {};
  const set = (key, v) => onChange({ ...b, [key]: v ? parseFloat(v) : null });
  const subtotal = (b.travel || 0) + (b.stay || 0) + (b.food || 0) + (b.other || 0);
  const rows = [
    ['travel', '✈️ Travel'],
    ['stay', '🛏️ Stay'],
    ['food', '🍔 Food'],
    ['other', 'Other'],
  ];
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={labelStyle}>Extra costs</div>
      {rows.map(([key, label]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 13, color: '#c4c2f0' }}>{label}</span>
          <span style={{ color: '#6b6a8f' }}>€</span>
          <input type="number" value={b[key] || ''} placeholder="0.00" onChange={e => set(key, e.target.value)} style={{ ...inputStyle, width: 90 }} />
        </div>
      ))}
      {subtotal > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
          <span>Extra costs subtotal</span>
          <span style={{ color: '#a78bfa' }}>€{subtotal.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// Small confirmation popup: "Add 'X' to your saved [tags]?" — used when someone types
// a brand-new custom value (merch category, genre, etc.) directly on a show, so they
// can optionally promote it to a permanent, reusable option without going to Settings.
function SaveTagPrompt({ value, label, onConfirm, onDismiss }) {
  if (!value || !value.trim()) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 400,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }} onClick={onDismiss}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#13131f", border: "1px solid #2e2e50", borderRadius: 14,
        padding: "20px 18px", maxWidth: 320, width: "100%", textAlign: "center"
      }}>
        <div style={{ fontSize: 14, color: "#e2e0ff", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
          Save <span style={{ color: "#a78bfa", fontWeight: 700 }}>"{value.trim()}"</span> to your {label}?
        </div>
        <div style={{ fontSize: 12, color: "#6b6a8f", marginBottom: 18, fontFamily: "'DM Mono', monospace", lineHeight: 1.5 }}>
          You'll be able to pick it from the list next time.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onDismiss} style={{ flex: 1, padding: "10px", borderRadius: 9, background: "none", border: "1px solid #2e2e50", color: "#6b6a8f", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>Just this once</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px", borderRadius: 9, background: "#a78bfa", border: "1px solid #a78bfa", color: "#0c0c14", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>Save it</button>
        </div>
      </div>
    </div>
  );
}

// "+ Add new" pill that expands into a small inline text input. Used next to genre/subgenre/
// language/venue-size pill rows so a brand-new option can be typed directly on a show, instead
// of only being addable from Settings. On confirm, calls onAdd(value) which the caller is
// expected to use to both apply the value to the current show AND offer SaveTagPrompt.
function AddNewTagPill({ onAdd, accentColor = '#a78bfa' }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)} style={{
        padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
        background: 'none', color: accentColor, border: `1px dashed ${accentColor}66`, fontWeight: 600
      }}>+ Add new</button>
    );
  }

  const submit = () => {
    const v = value.trim();
    if (v) onAdd(v);
    setValue('');
    setAdding(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        autoFocus value={value} onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setValue(''); setAdding(false); } }}
        onBlur={() => { if (!value.trim()) setAdding(false); }}
        placeholder="New…" style={{
          width: 90, padding: '4px 8px', borderRadius: 99, fontSize: 12,
          background: '#0c0c14', border: `1px solid ${accentColor}`, color: '#e2e0ff',
          fontFamily: "'DM Mono', monospace", outline: 'none'
        }}
      />
      <button onClick={submit} style={{ background: 'none', border: 'none', color: accentColor, fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>✓</button>
    </div>
  );
}

function ToastHost({ toast, onDismiss }) {
  if (!toast) return null;
  const palette = toast.type === 'error'
    ? { border: '#f472b6', color: '#f472b6', bg: '#1a1020' }
    : { border: '#a78bfa', color: '#a78bfa', bg: '#13131f' };
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 82, transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448, zIndex: 300,
      background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 10,
      boxShadow: '0 10px 28px rgba(0,0,0,0.5)', padding: '11px 12px',
      display: 'flex', alignItems: 'center', gap: 10
    }}>
      <div style={{ flex: 1, color: palette.color, fontSize: 12, fontFamily: "'DM Mono', monospace", lineHeight: 1.4 }}>{toast.message}</div>
      <button onClick={onDismiss} style={{ width: 32, height: 32, background: 'none', border: 'none', color: '#6b6a8f', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>x</button>
    </div>
  );
}

function EmptyState({ title, detail, actionLabel, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '42px 18px', border: '1px dashed #1f1f35', borderRadius: 12, background: '#10101b', margin: '14px 0' }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: '#c4c2f0', marginBottom: 8 }}>{title}</div>
      {detail && <div style={{ color: '#6b6a8f', fontSize: 12, lineHeight: 1.6, fontFamily: "'DM Mono', monospace", marginBottom: actionLabel ? 16 : 0 }}>{detail}</div>}
      {actionLabel && <button onClick={onAction} style={{ minHeight: 40, padding: '9px 14px', borderRadius: 8, border: '1px solid #a78bfa', background: '#1a1a30', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{actionLabel}</button>}
    </div>
  );
}

function festivalDays(startDate, endDate) {
  if (!startDate) return 1;
  if (!endDate || endDate <= startDate) return 1;
  return Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
}

function FestivalActsSection({ acts = [], onChange, startDate, endDate, readOnly = false, ratingMax = 5 }) {
  const [input, setInput] = useState('');
  const [day, setDay] = useState(1);
  const [urlInput, setUrlInput] = useState('');
  const [importState, setImportState] = useState('idle');
  const [importError, setImportError] = useState('');
  const numDays = festivalDays(startDate, endDate);

  const add = () => {
    const name = input.trim();
    if (!name || acts.some(a => a.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...acts, { name, day: numDays > 1 ? day : null, highlight: false, rating: null }]);
    setInput('');
  };

  const update = (i, patch) => onChange(acts.map((a, j) => j === i ? { ...a, ...patch } : a));
  const remove = (i) => onChange(acts.filter((_, j) => j !== i));

  const importFromUrl = async () => {
    const url = urlInput.trim();
    if (!url.includes('setlist.fm/festival/')) { setImportError('Paste a setlist.fm/festival/ URL'); setImportState('error'); return; }
    setImportState('loading'); setImportError('');
    try {
      const r = await fetch(`/api/festival?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setImportError(data.error || 'Could not load the page'); setImportState('error'); return; }

      // Map each day's date to a day number using startDate
      const newActs = [...acts];
      const seen = new Set(acts.map(a => a.name.toLowerCase()));
      for (const { date, artists } of data.days) {
        let dayNum = null;
        if (startDate && date) {
          const diff = Math.round((new Date(date) - new Date(startDate)) / 86400000);
          if (diff >= 0) dayNum = diff + 1;
        }
        for (const name of artists) {
          if (!seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            newActs.push({ name, day: numDays > 1 ? dayNum : null, highlight: false, rating: null });
          }
        }
      }
      onChange(newActs);
      setUrlInput(''); setImportState('idle');
    } catch (e) {
      setImportError('Something went wrong. Try again.'); setImportState('error');
    }
  };

  const days = numDays > 1 ? Array.from({ length: numDays }, (_, i) => i + 1) : [];
  const byDay = numDays > 1
    ? days.map(d => ({ d, list: acts.filter(a => a.day === d) })).concat(acts.filter(a => !a.day).length ? [{ d: null, list: acts.filter(a => !a.day) }] : [])
    : [{ d: null, list: acts }];

  const inputStyle = { background: '#13131f', border: '1px solid #2a4a3a', borderRadius: 8, color: '#c4c2f0', padding: '7px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12 };
  const labelStyle = { fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 };

  return (
    <div>
      {!readOnly && (
        <div style={{ marginBottom: acts.length ? 12 : 10 }}>
          {importState === 'error' && (
            <div style={{ fontSize: 11, color: '#f472b6', fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
              {importError} <button onClick={() => setImportState('idle')} style={{ background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer' }}>dismiss</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && urlInput && importFromUrl()} placeholder="Paste setlist.fm/festival/… URL to import lineup" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={importFromUrl} disabled={!urlInput.trim() || importState === 'loading'} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '0 12px', cursor: 'pointer', opacity: !urlInput.trim() ? 0.4 : 1, flexShrink: 0 }}>
              {importState === 'loading' ? '…' : 'Import'}
            </button>
          </div>
        </div>
      )}
      {byDay.map(({ d, list }) => (
        <div key={d ?? 'none'}>
          {numDays > 1 && <div style={{ ...labelStyle, marginTop: d ? 10 : 0 }}>{d ? `Day ${d}` : 'Untagged'}</div>}
          {list.map((act) => {
            const i = acts.indexOf(act);
            return (
              <div key={act.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                {numDays > 1 && !readOnly && (
                  <select value={act.day ?? ''} onChange={e => update(i, { day: e.target.value ? parseInt(e.target.value) : null })}
                    style={{ ...inputStyle, padding: '4px 6px', width: 62, flexShrink: 0 }}>
                    <option value=''>—</option>
                    {days.map(d2 => <option key={d2} value={d2}>Day {d2}</option>)}
                  </select>
                )}
                <span style={{ flex: 1, fontSize: 13, color: act.highlight ? '#f472b6' : '#c4c2f0', fontWeight: act.highlight ? 600 : 400 }}>{act.name}</span>
                {!readOnly && (
                  <button onClick={() => update(i, { highlight: !act.highlight })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: act.highlight ? '#f472b6' : '#2e2e4a', padding: 0, lineHeight: 1 }}>♥</button>
                )}
                {readOnly && act.highlight && <span style={{ fontSize: 12, color: '#f472b6' }}>♥</span>}
                {!readOnly ? (
                  <div style={{ display: 'flex', gap: 2 }}>
                    {Array.from({ length: ratingMax }, (_, ri) => (
                      <button key={ri} onClick={() => update(i, { rating: act.rating === ri + 1 ? null : ri + 1 })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: act.rating >= ri + 1 ? '#a78bfa' : '#2e2e4a', padding: 0, lineHeight: 1 }}>★</button>
                    ))}
                  </div>
                ) : act.rating ? (
                  <span style={{ fontSize: 11, color: '#a78bfa' }}>{'★'.repeat(act.rating)}</span>
                ) : null}
                {!readOnly && <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>}
              </div>
            );
          })}
        </div>
      ))}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6, marginTop: acts.length ? 10 : 0 }}>
          {numDays > 1 && (
            <select value={day} onChange={e => setDay(parseInt(e.target.value))} style={{ ...inputStyle, padding: '6px 8px', width: 72, flexShrink: 0 }}>
              {days.map(d => <option key={d} value={d}>Day {d}</option>)}
            </select>
          )}
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Or add artist manually…" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={add} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '0 12px', cursor: 'pointer', flexShrink: 0 }}>+</button>
        </div>
      )}
      {readOnly && acts.length === 0 && <div style={{ fontSize: 11, color: '#2e2e4a', fontFamily: "'DM Mono', monospace" }}>no acts logged</div>}
    </div>
  );
}

// Month-grid calendar with status/mode dot indicators per day, plus a list of that
// day's shows underneath. Operates on the full concerts list (not the filtered/sorted
// list used by the regular Shows list) so every status — want to go, upcoming, went,
// online, offline — stays visible regardless of the List view's filters/sort.
function CalendarMode({ concerts, month, onMonthChange, selectedDate, onSelectDate, onOpen }) {
  const { year, month: monthIdx } = month;

  const byDate = useMemo(() => {
    const map = {};
    const addToDay = (key, c) => {
      if (!map[key]) map[key] = [];
      map[key].push(c);
    };
    for (const c of concerts) {
      if (!c.date) continue;
      const startKey = c.date.slice(0, 10);
      // Festivals (and any show with a later endDate) span multiple days — register
      // the show on every day in its range, not just the start date, so a 3-day
      // festival shows dots and appears in the day-list for each of its days.
      if (c.endDate && c.endDate > c.date) {
        let cursor = new Date(startKey + 'T00:00:00');
        const end = new Date(c.endDate.slice(0, 10) + 'T00:00:00');
        let guard = 0;
        while (cursor <= end && guard < 60) { // 60-day cap as a sanity guard against bad data
          const key = cursor.toISOString().slice(0, 10);
          addToDay(key, c);
          cursor.setDate(cursor.getDate() + 1);
          guard++;
        }
      } else {
        addToDay(startKey, c);
      }
    }
    return map;
  }, [concerts]);

  const statusOf = (c) => isWish(c) ? 'wish' : isPast(c.date) ? 'went' : 'upcoming';
  const STATUS_COLOR = { wish: '#34d399', upcoming: '#818cf8', went: '#a78bfa' };
  const isMultiDay = (c) => !!(c.endDate && c.endDate > c.date);

  const firstOfMonth = new Date(year, monthIdx, 1);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null); // pad to full weeks for clean bar rendering
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const dateKeyFor = (d) => `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const monthStartKey = dateKeyFor(1);
  const monthEndKey = dateKeyFor(daysInMonth);

  // Multi-day festivals (bars), one row per festival that overlaps this month, broken
  // into per-week segments so each segment can be drawn within a single grid row —
  // a festival spanning a week boundary gets two segments, one per row.
  const multiDayFestivals = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const c of concerts) {
      if (!isMultiDay(c) || seen.has(c.id)) continue;
      const startKey = c.date.slice(0, 10);
      const endKey = c.endDate.slice(0, 10);
      if (endKey < monthStartKey || startKey > monthEndKey) continue; // doesn't overlap this month
      seen.add(c.id);
      list.push(c);
    }
    return list;
  }, [concerts, monthStartKey, monthEndKey]);

  const festivalRowSegments = (week, weekIdx) => {
    // For a given week (array of 7 day-numbers or null), find every festival bar segment
    // that should render on this row, with its start column and column span clamped to the week.
    return multiDayFestivals.map((c, fi) => {
      const startKey = c.date.slice(0, 10);
      const endKey = c.endDate.slice(0, 10);
      let firstCol = -1, lastCol = -1;
      week.forEach((d, col) => {
        if (d === null) return;
        const key = dateKeyFor(d);
        if (key >= startKey && key <= endKey) {
          if (firstCol === -1) firstCol = col;
          lastCol = col;
        }
      });
      if (firstCol === -1) return null;
      return { concert: c, startCol: firstCol, span: lastCol - firstCol + 1, colorIndex: fi };
    }).filter(Boolean);
  };

  const FESTIVAL_BAR_COLORS = ['#f472b6', '#fb923c', '#facc15', '#60a5fa', '#34d399'];

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const goPrevMonth = () => onMonthChange(monthIdx === 0 ? { year: year - 1, month: 11 } : { year, month: monthIdx - 1 });
  const goNextMonth = () => onMonthChange(monthIdx === 11 ? { year: year + 1, month: 0 } : { year, month: monthIdx + 1 });

  const selectedShows = selectedDate ? (byDate[selectedDate] || []) : [];

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={goPrevMonth} style={{ background: 'none', border: '1px solid #1f1f35', borderRadius: 8, color: '#6b6a8f', width: 30, height: 30, cursor: 'pointer', fontSize: 14 }}>‹</button>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#e2e0ff' }}>{monthLabel}</div>
        <button onClick={goNextMonth} style={{ background: 'none', border: '1px solid #1f1f35', borderRadius: 8, color: '#6b6a8f', width: 30, height: 30, cursor: 'pointer', fontSize: 14 }}>›</button>
      </div>

      {/* Weekday labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Day grid — rendered week by week so multi-day festival bars can span columns within a row */}
      <div style={{ marginBottom: 16 }}>
        {weeks.map((week, weekIdx) => {
          const segments = festivalRowSegments(week, weekIdx);
          return (
            <div key={weekIdx} style={{ position: 'relative', marginBottom: segments.length > 0 ? 8 + segments.length * 7 : 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {week.map((d, col) => {
                  if (d === null) return <div key={col} />;
                  const dateKey = dateKeyFor(d);
                  const allShows = byDate[dateKey] || [];
                  const shows = allShows.filter(c => !isMultiDay(c)); // multi-day festivals get a bar, not a dot
                  const isToday = dateKey === todayKey;
                  const isSelected = dateKey === selectedDate;
                  const statuses = [...new Set(shows.map(statusOf))];
                  const hasOnline = shows.some(isOnline);
                  const hasOffline = shows.some(c => !isOnline(c));
                  return (
                    <button
                      key={col}
                      onClick={() => onSelectDate(allShows.length > 0 ? (isSelected ? null : dateKey) : null)}
                      style={{
                        aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: isSelected ? '#1a1a30' : 'none',
                        border: isToday ? '1px solid #a78bfa' : isSelected ? '1px solid #2e2e50' : '1px solid transparent',
                        borderRadius: 8, cursor: allShows.length > 0 ? 'pointer' : 'default', padding: 0, position: 'relative'
                      }}
                    >
                      <span style={{ fontSize: 12, color: isToday ? '#a78bfa' : allShows.length > 0 ? '#e2e0ff' : '#4a4870', fontWeight: isToday ? 700 : 400 }}>{d}</span>
                      {shows.length > 0 && (
                        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                          {statuses.slice(0, 2).map(s => (
                            <span key={s} style={{ width: 4, height: 4, borderRadius: 99, background: STATUS_COLOR[s], display: 'inline-block' }} />
                          ))}
                          {(hasOnline && hasOffline) ? (
                            <>
                              <span style={{ width: 4, height: 4, borderRadius: 99, background: ONLINE_COLOR, display: 'inline-block' }} />
                              <span style={{ width: 4, height: 4, borderRadius: 99, background: '#6b6a8f', display: 'inline-block' }} />
                            </>
                          ) : hasOnline ? (
                            <span style={{ width: 4, height: 4, borderRadius: 99, background: ONLINE_COLOR, display: 'inline-block' }} />
                          ) : null}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Festival bars for this week, stacked below the day cells */}
              {segments.map((seg, si) => (
                <button
                  key={seg.concert.id}
                  onClick={() => { const sk = seg.concert.date.slice(0,10); const ek = seg.concert.endDate.slice(0,10); const within = selectedDate >= sk && selectedDate <= ek; onSelectDate(within ? null : sk); }}
                  title={seg.concert.artist}
                  style={{
                    position: 'absolute', left: `calc(${seg.startCol} * (100% / 7) + 2px)`,
                    width: `calc(${seg.span} * (100% / 7) - 4px)`,
                    top: `calc(100% + ${si * 7}px)`, height: 5, borderRadius: 3,
                    background: FESTIVAL_BAR_COLORS[seg.colorIndex % FESTIVAL_BAR_COLORS.length],
                    border: 'none', padding: 0, cursor: 'pointer',
                    opacity: byDate[selectedDate]?.some(c => c.id === seg.concert.id) ? 1 : 0.85
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16, fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>
        {[['wish', 'Want to go'], ['upcoming', 'Upcoming'], ['went', 'Went']].map(([k, label]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: STATUS_COLOR[k], display: 'inline-block' }} />{label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: ONLINE_COLOR, display: 'inline-block' }} />Online
        </span>
        {multiDayFestivals.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, borderRadius: 3, background: FESTIVAL_BAR_COLORS[0], display: 'inline-block' }} />Multi-day festival
          </span>
        )}
      </div>

      {/* Selected day's shows */}
      <div style={{ borderTop: '1px solid #1f1f35', paddingTop: 14 }}>
        {!selectedDate ? (
          <div style={{ textAlign: 'center', color: '#4a4870', fontSize: 12, fontFamily: "'DM Mono', monospace", padding: '20px 0' }}>
            Tap a date with a dot to see its shows.
          </div>
        ) : selectedShows.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#4a4870', fontSize: 12, fontFamily: "'DM Mono', monospace", padding: '20px 0' }}>
            No shows on {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} — {selectedShows.length} show{selectedShows.length > 1 ? 's' : ''}
            </div>
            {selectedShows.map(c => {
              const isMultiDay = c.endDate && c.endDate > c.date;
              let dayLabel = null;
              if (isMultiDay) {
                const dayNum = Math.round((new Date(selectedDate + 'T00:00:00') - new Date(c.date.slice(0, 10) + 'T00:00:00')) / 86400000) + 1;
                const totalDays = Math.round((new Date(c.endDate.slice(0, 10) + 'T00:00:00') - new Date(c.date.slice(0, 10) + 'T00:00:00')) / 86400000) + 1;
                dayLabel = `Day ${dayNum} of ${totalDays}`;
              }
              return (
                <div key={c.id}>
                  {dayLabel && (
                    <div style={{ fontSize: 10, color: '#f472b6', fontFamily: "'DM Mono', monospace", marginBottom: 4, paddingLeft: 2 }}>{dayLabel}</div>
                  )}
                  <ConcertCard concert={c} onOpen={onOpen} compact={false} />
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}


function ConcertCard({ concert, onOpen, compact = false, showPhoto = true, showVenue = true, showGenreTags = true }) {
  const past = isPast(concert.date) && !concert.wishlist;
  const effectiveCompact = compact || !past;
  const isFestival = concert.type === "festival";
  const online = isOnline(concert);
  const accentColor = online ? ONLINE_COLOR : isFestival ? "#f472b6" : past ? "#a78bfa" : concert.wishlist ? "#34d399" : "#818cf8";

  if (effectiveCompact) {
    return (
      <button onClick={() => onOpen(concert)} style={{
        width: "100%", textAlign: "left", background: past ? "#17172a" : "#0d1a15",
        border: `1px solid ${past ? "#1f1f35" : "#2e2e50"}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8, padding: "7px 12px", cursor: "pointer", marginBottom: 4,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: "#e2e0ff", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {concert.artist}
        </span>
        <span style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
          {concert.date && concert.date !== '9999-12-31' ? formatDate(concert.date) : ''}
        </span>
        {concert.rating ? (
          <span style={{ color: "#a78bfa", fontSize: 11, flexShrink: 0 }}>{"★".repeat(Math.min(concert.rating, 10))}</span>
        ) : concert.wishlist ? (
          <span style={{ fontSize: 10, color: "#34d399", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>optional</span>
        ) : !past ? (
          <span style={{ fontSize: 10, color: "#818cf8", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>upcoming</span>
        ) : null}
        {concert.wishlist && concert.ticketSaleAt && (
          <span style={{ fontSize: 11, flexShrink: 0 }}>🔔</span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => onOpen(concert)}
      style={{
        width: "100%", textAlign: "left", background: past ? "#17172a" : "#0d1a15",
        border: `1px solid ${past ? "#1f1f35" : "#2e2e50"}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 12, padding: "14px 16px", cursor: "pointer",
        transition: "all 0.15s ease", marginBottom: 8
      }}
    >
      {showPhoto && concert.photo && past && (
        <PhotoImg path={concert.photo} pos={concert.photoPos} style={{ width: "100%", aspectRatio: "5 / 2", borderRadius: 8, marginBottom: 10 }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {isFestival && <Badge color="#1a1a30">FEST</Badge>}
            <span style={{
              fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
              color: "#e2e0ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
            }}>{concert.artist}</span>
            {concert.seenAs && !isFestival && (() => {
              const cfg = {
                Support: { bg: "#1a2a3d", color: "#60a5fa" },
                Guest:   { bg: "#2d2010", color: "#fbbf24" },
              }[concert.seenAs];
              return cfg ? (
                <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: "0.05em", padding: "2px 6px", borderRadius: 99, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{concert.seenAs.toUpperCase()}</span>
              ) : null;
            })()}
          </div>
          {concert.tour && !isFestival && (
            <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {concert.tour}
            </div>
          )}
          <div style={{ display: showVenue ? "block" : "none", fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
            {online
              ? <>{formatDate(concert.date)} · {formatOnlineLocation(concert)}</>
              : <>{formatDate(concert.date)}{concert.endDate && concert.endDate !== concert.date ? ` – ${formatDate(concert.endDate)}` : ''} · {concert.venue}{concert.room ? ` · ${concert.room}` : ""} · {concert.city}</>}
          </div>
          {!showVenue && (
            <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
              {formatDate(concert.date)}{concert.city ? ` · ${concert.city}` : ""}
            </div>
          )}
          {getFriends(concert).length > 0 && (
            <div style={{ fontSize: 11, color: "#5a5880", marginTop: 4 }}>
              w. {getFriends(concert).join(", ")}
            </div>
          )}
          {concert.solo && getFriends(concert).length === 0 && (
            <div style={{ fontSize: 11, color: "#5a5880", marginTop: 4, fontStyle: "italic" }}>solo</div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {concert.rating && (
            <div style={{ color: "#a78bfa", fontSize: 13 }}>
              {"★".repeat(Math.min(concert.rating, 10))}
            </div>
          )}
          {!past && (
            <div style={{ fontSize: 10, color: "#818cf8", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
              upcoming
            </div>
          )}
          {(getSongList(concert.setlist).length > 0 || Object.values(concert.supportSetlists || {}).some(s => getSongList(s).length > 0)) && (
            <div style={{ fontSize: 11, color: "#4a4870", marginTop: 4 }}>♪</div>
          )}
        </div>
      </div>
      {showGenreTags && (getGenres(concert).length > 0 || concert.subgenre) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {getGenres(concert).map(g => <Badge key={g} color="#13131f">{g}</Badge>)}
          {concert.subgenre && <Badge color="#13131f">{concert.subgenre}</Badge>}
        </div>
      )}
    </button>
  );
}

function SetlistSection({ concert, settings, onSaveSetlist, overrideSongs = null, overrideArtist = null, readOnly = false, headlinerSongs = [], allArtists = [] }) {
  const effectKey = concert.id + (overrideArtist || '');
  const sourceSongs = overrideSongs ?? concert.setlist;
  const [songs, setSongs] = useState(() => getSongList(sourceSongs));
  const [songInput, setSongInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [fetchState, setFetchState] = useState('idle');
  const [fetchError, setFetchError] = useState('');
  const [editCoverIdx, setEditCoverIdx] = useState(null);
  const [coverInput, setCoverInput] = useState('');
  const [editNoteIdx, setEditNoteIdx] = useState(null);
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => { setSongs(getSongList(sourceSongs)); }, [effectKey, overrideSongs, concert.setlist]);

  const save = (newSongs) => {
    const next = getSongList(newSongs);
    setSongs(next);
    onSaveSetlist?.(next);
  };

  const addSong = () => {
    const t = songInput.trim();
    if (!t) return;
    save([...songs, t]);
    setSongInput('');
  };

  const applyCover = (idx, artist) => {
    save(songs.map((s, i) => {
      if (i !== idx) return s;
      const name = getSongName(s); const info = getSongInfo(s);
      if (!artist) return info ? { name, info } : name;
      const cover = artist === true ? true : artist;
      return info ? { name, info, cover } : { name, cover };
    }));
    setEditCoverIdx(null);
    setCoverInput('');
  };

  const applyNote = (idx, note) => {
    save(songs.map((s, i) => {
      if (i !== idx) return s;
      const name = getSongName(s); const cover = getSongCover(s);
      const trimmed = (note || '').trim();
      if (!trimmed) return cover ? { name, cover } : name;
      return cover ? { name, info: trimmed, cover } : { name, info: trimmed };
    }));
    setEditNoteIdx(null);
    setNoteInput('');
  };

  const coverSuggestions = coverInput.length > 0
    ? allArtists.filter(a => String(a || '').toLowerCase().includes(coverInput.toLowerCase())).slice(0, 5)
    : [];

  const fetchByUrl = async () => {
    const url = urlInput.trim();
    if (!url.includes('setlist.fm/setlist/')) { setFetchError('bad_url'); setFetchState('error'); return; }
    setFetchState('loading');
    setFetchError('');
    try {
      const r = await fetch(`/api/setlist?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
      const data = await r.json().catch(() => ({}));
      if (r.status === 422) { if (data.debug) console.warn('[setlist] parse failed:', data.debug); throw new Error('parse_error'); }
      if (!r.ok) throw new Error('fetch_error');
      if (!data.songs?.length) throw new Error('parse_error');
      save(data.songs);
      setUrlInput('');
      setFetchState('idle');
    } catch (e) {
      setFetchError(e.message);
      setFetchState('error');
    }
  };

  const errorMsg = {
    bad_url: 'Paste a full setlist.fm show URL (setlist.fm/setlist/…)',
    fetch_error: 'Could not load the page — check your connection.',
    parse_error: 'Could not read the songs from that page. Try adding them manually.',
  };

  const searchArtist = overrideArtist || concert.artist;
  const searchUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(searchArtist)}${concert.venue ? '+' + encodeURIComponent(concert.venue) : ''}+${concert.date.slice(0, 4)}`;
  const inputStyle = { flex: 1, background: '#13131f', border: '1px solid #2a4a3a', borderRadius: 8, color: '#c4c2f0', padding: '7px 12px', fontFamily: "'DM Mono', monospace", fontSize: 13 };

  return (
    <div>
      {songs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {songs.map((song, i) => {
            const name = getSongName(song);
            const info = getSongInfo(song);
            const cover = getSongCover(song);
            const isEditingCover = editCoverIdx === i;
            const isEditingNote = editNoteIdx === i;
            return (
              <div key={`${name}-${i}`} style={{ marginBottom: (isEditingCover || isEditingNote) ? 8 : (info || cover ? 6 : 4) }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: '#4a4870', fontSize: 10, fontFamily: "'DM Mono', monospace", width: 18, textAlign: 'right', flexShrink: 0, paddingTop: 2 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: '#c4c2f0', fontSize: 13 }}>{name}</span>
                      {song?.spotifyId && <span title="Linked to Spotify" style={{ color: '#1DB954', fontSize: 9, lineHeight: 1 }}>●</span>}
                    </div>
                    {info && <div style={{ color: '#4a4870', fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{info}</div>}
                    {cover && <div style={{ color: '#fb923c', fontSize: 10, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>↩ {typeof cover === 'string' ? cover : 'cover'}</div>}
                  </div>
                  {!readOnly && (
                    <button onClick={() => { if (isEditingNote) { setEditNoteIdx(null); setNoteInput(''); } else { setEditNoteIdx(i); setNoteInput(info || ''); setEditCoverIdx(null); } }}
                      style={{ background: 'none', border: 'none', color: info || isEditingNote ? '#a78bfa' : '#4a4870', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1, paddingTop: 2 }}>✎</button>
                  )}
                  {!readOnly && (
                    <button onClick={() => { if (isEditingCover) { setEditCoverIdx(null); setCoverInput(''); } else { setEditCoverIdx(i); setCoverInput(cover || ''); setEditNoteIdx(null); } }}
                      style={{ background: 'none', border: 'none', color: cover || isEditingCover ? '#fb923c' : '#4a4870', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1, paddingTop: 2 }}>↩</button>
                  )}
                  {!readOnly && <button onClick={() => save(songs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1, paddingTop: 2 }}>×</button>}
                </div>
                {isEditingNote && (
                  <div style={{ paddingLeft: 26, marginTop: 4 }}>
                    <input
                      autoFocus value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') applyNote(i, noteInput); if (e.key === 'Escape') { setEditNoteIdx(null); setNoteInput(''); } }}
                      placeholder="Note, e.g. switched lyrics, acoustic version…"
                      style={{ width: '100%', background: '#0c0c14', border: '1px solid #a78bfa44', borderRadius: 7, color: '#c4c2f0', padding: '5px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button onMouseDown={() => applyNote(i, noteInput)} style={{ background: 'none', border: '1px solid #a78bfa55', borderRadius: 6, color: '#a78bfa', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                        Save note
                      </button>
                      {info && <button onMouseDown={() => applyNote(i, '')} style={{ background: 'none', border: '1px solid #2e2e50', borderRadius: 6, color: '#4a4870', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Remove</button>}
                    </div>
                  </div>
                )}
                {isEditingCover && (
                  <div style={{ paddingLeft: 26, marginTop: 4 }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        autoFocus value={coverInput}
                        onChange={e => setCoverInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') applyCover(i, coverInput.trim() || true); if (e.key === 'Escape') { setEditCoverIdx(null); setCoverInput(''); } }}
                        placeholder="Original artist…"
                        style={{ width: '100%', background: '#0c0c14', border: '1px solid #fb923c44', borderRadius: 7, color: '#c4c2f0', padding: '5px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, boxSizing: 'border-box' }}
                      />
                      {coverSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#13131f', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 20, overflow: 'hidden', marginTop: 2 }}>
                          {coverSuggestions.map(a => (
                            <button key={a} onMouseDown={() => applyCover(i, a)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #1a1a2e', color: '#c4c2f0', padding: '7px 10px', fontFamily: "'DM Sans', sans-serif", fontSize: 12, cursor: 'pointer' }}>{a}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button onMouseDown={() => applyCover(i, coverInput.trim() || true)} style={{ background: 'none', border: '1px solid #fb923c55', borderRadius: 6, color: '#fb923c', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                        {coverInput.trim() ? 'Save cover' : 'Mark as cover'}
                      </button>
                      {cover && <button onMouseDown={() => applyCover(i, null)} style={{ background: 'none', border: '1px solid #2e2e50', borderRadius: 6, color: '#4a4870', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Remove</button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && headlinerSongs.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pick from headliner setlist</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {headlinerSongs.map(s => {
              const name = getSongName(s);
              const active = songs.some(x => getSongName(x) === name);
              return (
                <button key={name} onClick={() => save(active ? songs.filter(x => getSongName(x) !== name) : [...songs, s])}
                  style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
                    background: active ? '#f472b6' : '#13131f',
                    color: active ? '#0c0c14' : '#6b6a8f',
                    border: `1px solid ${active ? '#f472b6' : '#2e2e50'}`,
                    fontWeight: active ? 700 : 400, fontFamily: "'DM Mono', monospace" }}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          {fetchState === 'error' && (
            <div style={{ marginBottom: 8, fontSize: 11, color: '#f472b6', fontFamily: "'DM Mono', monospace" }}>
              {errorMsg[fetchError] || 'Something went wrong.'}
              <button onClick={() => setFetchState('idle')} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer' }}>dismiss</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && urlInput && fetchByUrl()} placeholder="Paste setlist.fm show URL…" style={inputStyle} />
            <button onClick={fetchByUrl} disabled={!urlInput.trim() || fetchState === 'loading'} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '0 12px', cursor: 'pointer', opacity: !urlInput.trim() ? 0.4 : 1 }}>
              {fetchState === 'loading' ? '…' : 'Import'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={songInput} onChange={e => setSongInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSong()} placeholder="Or add song manually…" style={inputStyle} />
            <button onClick={addSong} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '0 12px', cursor: 'pointer' }}>+</button>
          </div>
          <a href={searchUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#4a4870', textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}>
            Find on setlist.fm ↗
          </a>
        </>
      )}
    </div>
  );
}

function normalizeConcertForm(concert) {
  return {
    ...concert,
    friends: Array.isArray(concert.friends) ? concert.friends : [],
    support: Array.isArray(concert.support) ? concert.support : [],
    merch: Array.isArray(concert.merch) ? concert.merch : [],
    ticketAddons: Array.isArray(concert.ticketAddons) ? concert.ticketAddons : [],
    acts: Array.isArray(concert.acts) ? concert.acts : [],
  };
}

function ConcertDetail({ concert, onClose, onSave, settings = {}, onUpdateSetting = null, onUpdateSettings = null, friends = [], onDelete, onNotify = () => {}, allArtists = [], photosEnabled = false, onNavigate = () => {} }) {
  useBackButton(onClose);
  const merchCategories = settings.merchCategories || ["T-shirt","Hoodie","Crewneck","Tote bag","Poster","Hat / Cap","Other"];
  const [editing, setEditing] = useState(false);
  // { value, settingsKey, label } — a value typed fresh on this show, offered for saving to Settings.
  const [pendingTag, setPendingTag] = useState(null);
  const [form, setForm] = useState(() => normalizeConcertForm(concert));
  useEffect(() => { setForm(normalizeConcertForm(concert)); setEditing(false); }, [concert.id]);
  const photoInputRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [friendInput, setFriendInput] = useState('');
  const [supportInput, setSupportInput] = useState('');
  const [supportRole, setSupportRole] = useState('support');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [expandedSupportSetlists, setExpandedSupportSetlists] = useState(new Set());
  const [spotifyMatcher, setSpotifyMatcher] = useState(null);
  const toggleSupportSetlist = (name) => setExpandedSupportSetlists(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleFriend = (name) => {
    setForm(f => ({
      ...f,
      friends: f.friends.includes(name)
        ? f.friends.filter(x => x !== name)
        : [...f.friends, name],
      solo: false
    }));
  };

  const addCustomFriend = () => {
    const name = friendInput.trim();
    if (!name || form.friends.includes(name)) return;
    setForm(f => ({ ...f, friends: [...f.friends, name], solo: false }));
    setFriendInput('');
  };

  const addMerchItem = () => {
    const defaultCat = (settings.merchCategories || ["T-shirt"])[0];
    setForm(f => ({ ...f, merch: [...(f.merch || []), { item: defaultCat, price: "" }] }));
  };

  const updateMerch = (idx, key, val) => {
    setForm(f => {
      const m = [...(f.merch || [])];
      m[idx] = { ...m[idx], [key]: val };
      return { ...f, merch: m };
    });
  };

  const removeMerch = (idx) => {
    setForm(f => ({ ...f, merch: (f.merch || []).filter((_, i) => i !== idx) }));
  };

  const addSupport = () => {
    const t = supportInput.trim();
    if (!t || (form.support || []).some(x => getSupportName(x) === t)) return;
    setForm(f => ({ ...f, support: [...(f.support || []), { name: t, role: supportRole }] }));
    setSupportInput('');
  };
  const removeSupport = (s) => setForm(f => ({ ...f, support: (f.support || []).filter(x => getSupportName(x) !== getSupportName(s)) }));

  const handleShare = () => {
    const lines = [
      `🎤 ${concert.artist}${concert.tour ? ` — ${concert.tour}` : ''}`,
      `📅 ${formatDate(concert.date)} · ${isOnline(concert) ? formatOnlineLocation(concert) : `${concert.venue}${concert.room ? ` · ${concert.room}` : ''} · ${concert.city}`}`,
      getFriends(concert).length > 0 ? `👥 w. ${getFriends(concert).join(', ')}` : '👤 solo',
      concert.rating ? `⭐ ${'★'.repeat(concert.rating)}` : null,
      concert.notes ? `📝 ${concert.notes}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(lines);
    onNotify('Copied share text');
  };

  const allFriendChoices = [...new Set([...friends, ...form.friends])].sort();
  const isFestival = concert.type === "festival";
  const online = isOnline(concert);
  const past = isPast(concert.date);

  const labelStyle = { fontSize: 11, color: "#6b6a8f", marginBottom: 4, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.08em" };

  const inputStyle = {
    width: "100%", background: "#13131f", border: "1px solid #2a4a3a",
    borderRadius: 8, color: "#c4c2f0", padding: "8px 12px",
    fontFamily: "'DM Mono', monospace", fontSize: 13, boxSizing: "border-box"
  };

  const sec = (label) => (
    <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
  );
  const detailCard = { background: "#13131f", border: "1px solid #1f1f35", borderRadius: 10, padding: "14px" };

  if (!editing) {
    const langs = Array.isArray(concert.language) ? concert.language : concert.language ? [concert.language] : [];
    const merchTotal = (concert.merch || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
    const totalCost = (concert.ticketPrice || 0) + merchTotal + extraCostTotal(concert);
    const companions = getFriends(concert);
    // Ticket sale block for wishlist items
    const ticketSaleBlock = concert.wishlist && concert.ticketSaleAt ? (() => {
      const saleDate = new Date(concert.ticketSaleAt);
      const now = new Date();
      const diff = saleDate - now;
      const isPast = diff < 0;
      const label = isPast ? 'Sale started' : diff < 30*60*1000 ? 'Sale starting soon!' : `Sale in ${diff < 3600000 ? Math.round(diff/60000)+' min' : diff < 86400000 ? Math.round(diff/3600000)+'h' : Math.round(diff/86400000)+'d'}`;
      return (
        <div style={{ margin: '0 0 14px', background: '#0a1a12', border: '1px solid #2a4a3a', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#34d399', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>🎫 Ticket sale</span>
            <span style={{ fontSize: 10, color: isPast ? '#6b6a8f' : '#4ade80', fontFamily: "'DM Mono', monospace" }}>{label}</span>
          </div>
          <div style={{ fontSize: 12, color: '#c4c2f0', fontFamily: "'DM Mono', monospace" }}>
            {saleDate.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })} · {saleDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {concert.ticketSaleNote && <div style={{ fontSize: 11, color: '#6b6a8f', marginTop: 3 }}>{concert.ticketSaleNote}</div>}
          {concert.ticketSaleLink && <a href={concert.ticketSaleLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 11, color: '#a78bfa', marginTop: 4, wordBreak: 'break-all' }}>↗ {concert.ticketSaleLink}</a>}
        </div>
      );
    })() : null;

    const statCards = [
      past && { label: "Rating", value: concert.rating ? "★".repeat(Math.min(concert.rating, settings.ratingSystem || 5)) : "—", nav: null },
      concert.ticketPrice ? { label: concert.ticketType ? `Ticket · ${concert.ticketType}` : "Ticket", value: `€${concert.ticketPrice}`, nav: null } : null,
      past && companions.length > 0 && { label: "With", value: companions.length === 1 ? companions[0] : `${companions.length} friends`, nav: 'friends' },
      past && companions.length === 0 && { label: "With", value: "Solo", nav: null },
    ].filter(Boolean);
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0c0c14", overflowY: "auto", zIndex: 100 }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, background: "#0c0c14", borderBottom: "1px solid #1e3028", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, zIndex: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <button onClick={() => onNavigate({ view: 'artists' })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: "#e2e0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", maxWidth: "100%" }}>{concert.artist} ›</button>
            <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{formatDate(concert.date)}{concert.endDate && concert.endDate !== concert.date ? ` – ${formatDate(concert.endDate)}` : ''} · {online ? formatOnlineLocation(concert) : concert.city}</div>
          </div>
          <button onClick={handleShare} style={{ background: "none", border: "1px solid #1f1f35", color: "#6b6a8f", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>Share</button>
          <button onClick={() => setEditing(true)} style={{ background: "#1a1a30", border: "1px solid #2e2e50", color: "#a78bfa", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>Edit</button>
        </div>

        {/* Venue + tour hero */}
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ marginBottom: 14 }}>
            {online ? (
              <>
                <div style={{ fontSize: 16, color: "#c4c2f0", fontWeight: 600 }}>{onlineTypeLabel(concert)}</div>
                {concert.platform && <div style={{ fontSize: 13, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{concert.platform}</div>}
              </>
            ) : (
              <>
                <button onClick={() => onNavigate({ view: 'venues' })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 16, color: "#c4c2f0", fontWeight: 600, textAlign: "left" }}>{concert.venue}{concert.room ? ` · ${concert.room}` : ""} ›</button>
                <div style={{ fontSize: 13, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{concert.city}, {concert.country}</div>
              </>
            )}
            {concert.tour && <div style={{ fontSize: 12, color: "#4a4870", marginTop: 4 }}>{concert.tour}</div>}
          </div>

          {/* Photo */}
          {concert.photo && (
            <div style={{ marginBottom: 14 }}>
              <PhotoImg path={concert.photo} pos={concert.photoPos} style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12 }} />
            </div>
          )}

          {ticketSaleBlock}
          {/* Stat cards */}
          {statCards.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${statCards.length}, 1fr)`, gap: 8, marginBottom: 14 }}>
              {statCards.map(({ label, value, nav }) => (
                <div key={label} onClick={nav ? () => onNavigate({ view: nav }) : undefined} style={{ background: "#13131f", borderRadius: 10, padding: "10px 8px", textAlign: "center", cursor: nav ? "pointer" : "default" }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: label === "Rating" ? 13 : 15, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{value}{nav ? <span style={{ fontSize: 10, color: "#6b6a8f", marginLeft: 2 }}>›</span> : null}</div>
                  <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tag pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {isFestival && <Badge color="#1a1030">🎪 Festival</Badge>}
            {concert.wishlist ? <Badge color="#0a1a12">want to go</Badge> : !past && <Badge color="#0d1a15">upcoming</Badge>}
            {concert.seenAs && <Badge color="#1a1a30">{concert.seenAs}</Badge>}
            {(concert.ticketAddons || []).map(a => <Badge key={a} color="#1a1030">{a}</Badge>)}
            {concert.venueSize && <Badge color="#13131f">{concert.venueSize}</Badge>}
            {getGenres(concert).map(g => <Badge key={g} color="#13131f">{g}</Badge>)}
            {concert.subgenre && <Badge color="#13131f">{concert.subgenre}</Badge>}
            {langs.map(l => <Badge key={l} color="#13131f">{l}</Badge>)}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #1a1a2e" }} />

        <div style={{ padding: "16px 20px 100px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Costs */}
          {(concert.ticketPrice || extraCostTotal(concert) || merchTotal > 0) && (
            <div style={detailCard}>
              {sec("Costs")}
              {[
                concert.ticketPrice ? [`Ticket${concert.ticketType ? ` (${concert.ticketType}${(concert.ticketAddons || []).length ? ' + ' + concert.ticketAddons.join(', ') : ''})` : (concert.ticketAddons || []).length ? ` (+ ${concert.ticketAddons.join(', ')})` : ''}`, concert.ticketPrice] : null,
                merchTotal > 0 ? ["Merch", merchTotal] : null,
                ...(concert.costBreakdown ? [
                  concert.costBreakdown.travel ? ["Travel", concert.costBreakdown.travel] : null,
                  concert.costBreakdown.stay ? ["Stay", concert.costBreakdown.stay] : null,
                  concert.costBreakdown.food ? ["Food", concert.costBreakdown.food] : null,
                  concert.costBreakdown.other ? ["Other", concert.costBreakdown.other] : null,
                ] : [concert.otherCost ? [isFestival ? "Travel & other" : "Other costs", concert.otherCost] : null]),
              ].filter(Boolean).map(([label, amount]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1a2e" }}>
                  <span style={{ color: "#6b6a8f", fontSize: 12 }}>{label}</span>
                  <span style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>€{Number(amount).toFixed(2)}</span>
                </div>
              ))}
              {totalCost > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 7 }}>
                  <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700 }}>Total</span>
                  <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>€{totalCost.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {concert.notes && (
            <div style={detailCard}>
              {sec("Notes")}
              <div style={{ color: "#c4c2f0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{concert.notes}</div>
            </div>
          )}

          {/* Merch */}
          {(concert.merch || []).length > 0 && (
            <div style={detailCard}>
              {sec("Merch")}
              {concert.merch.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < concert.merch.length - 1 ? "1px solid #1a1a2e" : "none" }}>
                  <span style={{ color: "#c4c2f0", fontSize: 13 }}>{m.item}</span>
                  {m.price && <span style={{ color: "#a78bfa", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>€{parseFloat(m.price).toFixed(2)}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Acts — festivals */}
          {isFestival && (concert.acts || []).length > 0 && (
            <div style={detailCard}>
              {sec("Acts seen")}
              <FestivalActsSection
                acts={concert.acts || []}
                onChange={() => {}}
                startDate={concert.date}
                endDate={concert.endDate}
                readOnly
                ratingMax={settings.ratingSystem || 5}
              />
            </div>
          )}

          {/* Setlist — headliner + support + guests, all as collapsible colour-coded rows */}
          {past && !isFestival && (() => {
            const roleConfig = {
              headliner: { color: '#a78bfa', bg: '#1a1a30' },
              support:   { color: '#818cf8', bg: '#131328' },
              guest:     { color: '#f472b6', bg: '#1a1030' },
            };
            const performers = [
              { key: '__headliner__', name: concert.artist, role: 'headliner',
                songs: getSongList(concert.setlist),
                onSaveSetlist: (s) => onSave({ ...concert, setlist: s }) },
              ...(concert.support || []).map(s => {
                const name = getSupportName(s); const role = getSupportRole(s);
                return { key: name, name, role,
                  songs: getSongList((concert.supportSetlists || {})[name]),
                  onSaveSetlist: (ns) => onSave({ ...concert, supportSetlists: { ...(concert.supportSetlists || {}), [name]: ns } }) };
              }),
            ];
            return (
              <div style={detailCard}>
                {sec("Setlist")}
                {performers.map(({ key, name, role, songs, onSaveSetlist: save }) => {
                  const { color, bg } = roleConfig[role] || roleConfig.support;
                  const isOpen = expandedSupportSetlists.has(key);
                  return (
                    <div key={key} style={{ marginBottom: 6 }}>
                      <button onClick={() => toggleSupportSetlist(key)} style={{
                        width: '100%', textAlign: 'left', background: '#13131f',
                        border: '1px solid #1f1f35', borderLeft: `3px solid ${color}`,
                        borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 9, color, fontFamily: "'DM Mono', monospace", padding: '1px 5px', background: bg, borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{role}</span>
                          <span onClick={e => { e.stopPropagation(); onNavigate({ view: 'artists' }); }} style={{ color: '#c4c2f0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {songs.length > 0
                            ? <span style={{ color: '#6b6a8f', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>♫ {songs.length}</span>
                            : <span style={{ color: '#4a4870', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>+ setlist</span>}
                          <span style={{ color: '#4a4870', fontSize: 10, lineHeight: 1 }}>{isOpen ? '▴' : '▾'}</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: `2px solid ${color}44` }}>
                          {songs.length > 0
                            ? <SetlistSection
                                concert={concert} settings={settings}
                                overrideSongs={key === '__headliner__' ? undefined : songs}
                                overrideArtist={key === '__headliner__' ? undefined : name}
                                onSaveSetlist={save}
                                readOnly
                              />
                            : <div style={{ fontSize: 11, color: '#2e2e4a', fontFamily: "'DM Mono', monospace", padding: '8px 0' }}>no setlist logged</div>
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0c0c14",
      overflowY: "auto", zIndex: 100
    }}>
      {/* Edit mode header */}
      <div style={{
        position: "sticky", top: 0, background: "#0c0c14",
        borderBottom: "1px solid #1e3028", padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 12, zIndex: 10
      }}>
        <button onClick={() => setEditing(false)} style={{
          background: "none", border: "none", color: "#a78bfa",
          fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: "#e2e0ff" }}>{concert.artist}</div>
          <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{formatDate(concert.date)} · {concert.city}</div>
        </div>
        <button onClick={async () => { const result = await onSave(form); if (!result?.error) setEditing(false); }} style={{ background: "#a78bfa", border: "1px solid #a78bfa", color: "#0c0c14", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>Save</button>
      </div>

      <div style={{ padding: "20px" }}>

        {/* Cards */}
        {[

          /* ── PHOTO ── */
          ...(photosEnabled ? [{ title: 'Photo', content: <>
            {form.photo ? <>
              <PhotoAdjust path={form.photo} pos={form.photoPos} onChange={v => update('photoPos', v)} />
              <div style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginTop: 6 }}>Drag the image to choose which part shows in the rectangle. Applies to the show page and list banner.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => photoInputRef.current?.click()} disabled={photoBusy} style={{ flex: 1, background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#a78bfa', fontSize: 12, padding: '8px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>{photoBusy ? 'Uploading…' : '📷 Replace photo'}</button>
                <button onClick={() => { if (window.confirm('Remove this photo?')) setForm(f => ({ ...f, photo: null, photoPos: null })); }} disabled={photoBusy} style={{ background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#f87171', fontSize: 12, padding: '8px 14px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>✕ Remove</button>
              </div>
            </> : (
              <button onClick={() => photoInputRef.current?.click()} disabled={photoBusy} style={{ width: '100%', aspectRatio: '16 / 5', background: 'none', border: '1px dashed #2e2e50', borderRadius: 12, color: '#4a4870', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>{photoBusy ? 'Uploading…' : '📷 Add a photo'}</button>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
              const file = e.target.files?.[0]; e.target.value = '';
              if (!file) return;
              setPhotoBusy(true);
              try {
                const path = await uploadConcertPhoto(concert.id, file);
                setForm(f => ({ ...f, photo: path }));
              } catch (err) { onNotify(err.message || 'Upload failed', 'error'); }
              setPhotoBusy(false);
            }} />
          </> }] : []),

          /* ── WISHLIST STATUS (first card when editing a wish) ── */
          ...(form.wishlist !== undefined ? [{ title: 'Wishlist', content: <>
            <button onClick={() => {
              update('wishlist', !form.wishlist);
            }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: `1px solid ${form.wishlist ? '#1f1f35' : '#34d399'}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', marginBottom: 10 }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${form.wishlist ? '#3d3564' : '#34d399'}`, background: form.wishlist ? 'none' : '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#0c0c14', lineHeight: 1 }}>{form.wishlist ? '' : '✓'}</span>
              <div>
                <div style={{ fontSize: 13, color: form.wishlist ? '#6b6a8f' : '#34d399', fontWeight: form.wishlist ? 400 : 700 }}>{form.wishlist ? 'No tickets yet' : 'Tickets bought ✓'}</div>
                <div style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{form.wishlist ? 'Tap to mark tickets as bought' : 'Tap to change back to want to go'}</div>
              </div>
            </button>
            {form.wishlist && (
              <div style={{ padding: '10px 12px', background: '#0a1a12', border: '1px solid #2a4a3a', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: '#34d399', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Ticket sale</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div><div style={labelStyle}>Date</div><input type="date" value={(form.ticketSaleAt||'').slice(0,10)} onChange={e => update('ticketSaleAt', e.target.value ? e.target.value + (form.ticketSaleAt?.slice(10)||'T10:00') : '')} style={inputStyle} /></div>
                  <div><div style={labelStyle}>Time</div><input type="time" value={(form.ticketSaleAt||'').slice(11,16)||'10:00'} onChange={e => update('ticketSaleAt', ((form.ticketSaleAt||new Date().toISOString().slice(0,10)).slice(0,10)) + 'T' + e.target.value)} style={inputStyle} /></div>
                </div>
                <input value={form.ticketSaleLink||''} onChange={e => update('ticketSaleLink', e.target.value)} placeholder="Ticket link (optional)" style={{ ...inputStyle, marginBottom: 8 }} />
                <input value={form.ticketSaleNote||''} onChange={e => update('ticketSaleNote', e.target.value)} placeholder="Note (optional)" style={inputStyle} />
              </div>
            )}
          </> }] : []),

          /* ── WAY OF ATTENDING ── */
          { title: 'Way of attending', content: <>
            <div style={{ display: 'flex', gap: 8, marginBottom: form.attendanceMode === 'online' ? 12 : 0 }}>
              <button onClick={() => update('attendanceMode', 'in_person')} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: form.attendanceMode !== 'online' ? '#1a1a30' : '#0c0c14', border: `1px solid ${form.attendanceMode !== 'online' ? '#a78bfa' : '#2e2e50'}`, color: form.attendanceMode !== 'online' ? '#a78bfa' : '#6b6a8f', fontWeight: form.attendanceMode !== 'online' ? 700 : 400, fontFamily: "'DM Sans',sans-serif" }}>📍 In person</button>
              <button onClick={() => update('attendanceMode', 'online')} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: form.attendanceMode === 'online' ? '#0a2a30' : '#0c0c14', border: `1px solid ${form.attendanceMode === 'online' ? ONLINE_COLOR : '#2e2e50'}`, color: form.attendanceMode === 'online' ? ONLINE_COLOR : '#6b6a8f', fontWeight: form.attendanceMode === 'online' ? 700 : 400, fontFamily: "'DM Sans',sans-serif" }}>💻 Online</button>
            </div>
            {form.attendanceMode === 'online' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[{ id: 'concert', label: 'Concert' }, { id: 'fanmeeting', label: 'Fanmeeting' }].map(t => (
                    <button key={t.id} onClick={() => update('onlineType', t.id)} style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: (form.onlineType || 'concert') === t.id ? '#0a2a30' : '#0c0c14', border: `1px solid ${(form.onlineType || 'concert') === t.id ? ONLINE_COLOR : '#2e2e50'}`, color: (form.onlineType || 'concert') === t.id ? ONLINE_COLOR : '#6b6a8f', fontWeight: (form.onlineType || 'concert') === t.id ? 700 : 400, fontFamily: "'DM Sans',sans-serif" }}>{t.label}</button>
                  ))}
                </div>
                <div style={labelStyle}>Platform</div>
                <input value={form.platform || ''} onChange={e => update('platform', e.target.value)} placeholder="e.g. Beyond Live, Netflix, Weverse… (optional)" style={inputStyle} />
              </>
            )}
          </> },

          /* ── SHOW ── */
          { title: form.type === 'festival' ? 'Festival' : 'Show', content: <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[{id:"concert",label:"🎤 Concert"},{id:"festival",label:"🎪 Festival"}].map(t => (
                <button key={t.id} onClick={() => update("type", t.id)} style={{ flex:1, padding:"8px", borderRadius:8, fontSize:13, cursor:"pointer", background: form.type===t.id ? "#1a1a30" : "#0c0c14", border: `1px solid ${form.type===t.id ? "#a78bfa" : "#2e2e50"}`, color: form.type===t.id ? "#a78bfa" : "#6b6a8f", fontWeight: form.type===t.id ? 700 : 400, fontFamily:"'DM Sans',sans-serif" }}>{t.label}</button>
              ))}
            </div>
            <div style={labelStyle}>{form.type === 'festival' ? 'Festival name' : 'Artist'}</div>
            <input value={form.artist} onChange={e=>update("artist",e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
            {form.type === 'festival' ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom: 10 }}>
                <div><div style={labelStyle}>Start date</div><input type="date" value={form.date} onChange={e=>update("date",e.target.value)} style={inputStyle} /></div>
                <div><div style={labelStyle}>End date</div><input type="date" value={form.endDate||""} onChange={e=>update("endDate",e.target.value)} style={inputStyle} /></div>
              </div>
            ) : (
              <><div style={labelStyle}>Date</div><input type="date" value={form.date} onChange={e=>update("date",e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} /></>
            )}
            <div style={labelStyle}>{form.type === 'festival' ? 'Edition / year' : 'Tour'}</div>
            <input value={form.tour || ""} onChange={e=>update("tour",e.target.value)} placeholder={form.type === 'festival' ? 'e.g. Lowlands 2024 (optional)' : 'Tour name (optional)'} style={inputStyle} />
          </> },

          /* ── VENUE ── */
          ...(form.attendanceMode !== 'online' ? [{ title: 'Venue', content: <>
            {(settings.savedVenues || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {(settings.savedVenues || []).map((v, i) => {
                  const active = form.venue === v.name && form.city === v.city && form.country === v.country;
                  return <button key={i} onClick={() => setForm(f => ({ ...f, venue: v.name, room: v.room || f.room, city: v.city, country: v.country }))} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: active ? '#a78bfa' : '#0c0c14', color: active ? '#0c0c14' : '#6b6a8f', border: `1px solid ${active ? '#a78bfa' : '#2e2e50'}`, fontWeight: active ? 700 : 400 }}>{v.name}{v.room ? ` · ${v.room}` : ''}</button>;
                })}
              </div>
            )}
            <div style={labelStyle}>Location</div>
            <input value={form.venue} onChange={e=>update("venue",e.target.value)} placeholder="Venue name" style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={form.room||""} onChange={e=>update("room",e.target.value)} placeholder="Room / stage (optional)" style={{ ...inputStyle, marginBottom: 8 }} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom: 14 }}>
              <input value={form.city} onChange={e=>update("city",e.target.value)} placeholder="City" style={inputStyle} />
              <input value={form.country} onChange={e=>update("country",e.target.value)} placeholder="Country" style={inputStyle} />
            </div>
            <div style={labelStyle}>Venue size</div>
            <DropdownSelect
              options={settings.venueSizes||[]}
              selected={form.venueSize||[]}
              onToggle={vs => update("venueSize", form.venueSize===vs ? null : vs)}
              placeholder="Select venue size..."
              onAddNew={v => { update("venueSize", v); setPendingTag({ value: v, settingsKey: 'venueSizes', label: 'venue sizes' }); }}
            />
          </> }] : []),

          /* ── LINEUP ── */
          { title: 'Lineup', content: <>
            <div style={labelStyle}>Seen as</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", marginBottom: 14 }}>
              {["Headliner","Support","Guest","Festival"].map(opt => (
                <button key={opt} onClick={() => update("seenAs", form.seenAs === opt ? null : opt)} style={{ padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer", background: form.seenAs === opt ? "#a78bfa" : "#0c0c14", color: form.seenAs === opt ? "#0c0c14" : "#6b6a8f", border: `1px solid ${form.seenAs === opt ? "#a78bfa" : "#2e2e50"}`, fontWeight: form.seenAs === opt ? 700 : 400 }}>{opt}</button>
              ))}
            </div>
            <div style={labelStyle}>Support acts</div>
            {(form.support || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                {(form.support || []).map(s => {
                  const name = getSupportName(s); const role = getSupportRole(s);
                  const toggleRole = () => setForm(f => ({ ...f, support: f.support.map(x => getSupportName(x) === name ? { name, role: getSupportRole(x) === 'guest' ? 'support' : 'guest' } : x) }));
                  return (
                    <span key={name} style={{ display:"flex", alignItems:"center", gap:4, background:"#1a1a30", border:"1px solid #2e2e50", borderRadius:99, padding:"3px 10px", fontSize:12, color:"#a78bfa" }}>
                      {name}
                      <button onClick={toggleRole} style={{ fontSize:9, color: role==='guest' ? "#f472b6" : "#4a4870", fontFamily:"'DM Mono',monospace", padding:"1px 4px", background: role==='guest' ? "#1a1030" : "none", borderRadius:99, border:`1px solid ${role==='guest' ? "#f472b6" : "#2e2e50"}`, cursor:"pointer", lineHeight:1.4 }}>{role}</button>
                      <button onClick={() => removeSupport(s)} style={{ background:"none", border:"none", color:"#6b6a8f", cursor:"pointer", fontSize:13, padding:0, lineHeight:1 }}>×</button>
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ display:"flex", gap:6, marginBottom:6 }}>
              {['support','guest'].map(r => (
                <button key={r} onClick={() => setSupportRole(r)} style={{ padding:"3px 10px", borderRadius:99, fontSize:11, cursor:"pointer", background: supportRole===r ? "#a78bfa" : "#0c0c14", color: supportRole===r ? "#0c0c14" : "#6b6a8f", border:`1px solid ${supportRole===r ? "#a78bfa" : "#2e2e50"}`, fontWeight: supportRole===r ? 700 : 400, fontFamily:"'DM Mono',monospace" }}>{r}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom: 14 }}>
              <input value={supportInput} onChange={e=>setSupportInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSupport()} placeholder="Add support act..." style={{ ...inputStyle, flex:1 }} />
              <button onClick={addSupport} style={{ background:"none", border:"1px solid #2a4a3a", borderRadius:6, color:"#a78bfa", fontSize:11, padding:"0 12px", cursor:"pointer" }}>+</button>
            </div>
            <div style={labelStyle}>Genre</div>
            <DropdownSelect
              options={settings.genres||[]}
              selected={getGenres(form)}
              onToggle={g => { const cur=getGenres(form); const next=cur.includes(g)?cur.filter(x=>x!==g):[...cur,g]; update("genre", next.length===0?null:next.length===1?next[0]:next); }}
              multi
              placeholder="Select genre(s)..."
              onAddNew={v => { const cur=getGenres(form); update("genre", [...cur, v]); setPendingTag({ value: v, settingsKey: 'genres', label: 'genres' }); }}
            />
            <div style={labelStyle}>Subgenre</div>
            <DropdownSelect
              options={settings.subgenres||[]}
              selected={form.subgenre||[]}
              onToggle={g => update("subgenre", form.subgenre===g ? null : g)}
              placeholder="Select subgenre..."
              accentColor="#38bdf8"
              onAddNew={v => { update("subgenre", v); setPendingTag({ value: v, settingsKey: 'subgenres', label: 'subgenres' }); }}
            />
            <div style={labelStyle}>Language</div>
            <DropdownSelect
              options={settings.languages||[]}
              selected={Array.isArray(form.language) ? form.language : form.language ? [form.language] : []}
              onToggle={l => { const langs = Array.isArray(form.language) ? form.language : form.language ? [form.language] : []; update("language", langs.includes(l) ? langs.filter(x=>x!==l) : [...langs, l]); }}
              multi
              placeholder="Select language(s)..."
              onAddNew={v => { const langs = Array.isArray(form.language) ? form.language : form.language ? [form.language] : []; update("language", [...langs, v]); setPendingTag({ value: v, settingsKey: 'languages', label: 'languages' }); }}
            />
          </> },

          /* ── YOUR EXPERIENCE ── */
          { title: 'Your experience', content: <>
            <div style={labelStyle}>Went with</div>
            {(settings.friendGroups || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {(settings.friendGroups || []).map((g, i) => {
                  const active = g.friends.every(f => form.friends.includes(f));
                  return <button key={i} onClick={() => setForm(f => ({ ...f, friends: [...new Set([...f.friends, ...g.friends])], solo: false }))} style={{ padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer", background: active ? "#818cf8" : "#0c0c14", color: active ? "#0c0c14" : "#6b6a8f", border:`1px solid ${active ? "#818cf8" : "#2e2e50"}`, fontWeight: active ? 700 : 400 }}>{g.name}</button>;
                })}
              </div>
            )}
            {allFriendChoices.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {allFriendChoices.map(name => (
                  <button key={name} onClick={() => toggleFriend(name)} style={{ padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer", background: form.friends.includes(name) ? "#a78bfa" : "#0c0c14", color: form.friends.includes(name) ? "#0c0c14" : "#6b6a8f", border:`1px solid ${form.friends.includes(name) ? "#a78bfa" : "#2e2e50"}`, fontWeight: form.friends.includes(name) ? 700 : 400 }}>{name}</button>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:8, marginBottom: 8 }}>
              <input value={friendInput} onChange={e=>setFriendInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomFriend()} placeholder="Add friend..." style={{ flex:1, background:"#0c0c14", border:"1px solid #2a4a3a", borderRadius:8, color:"#c4c2f0", padding:"6px 10px", fontFamily:"'DM Mono',monospace", fontSize:12 }} />
              <button onClick={addCustomFriend} style={{ background:"none", border:"1px solid #2a4a3a", borderRadius:6, color:"#a78bfa", fontSize:11, padding:"0 12px", cursor:"pointer" }}>+</button>
            </div>
            <button onClick={()=>setForm(f=>({...f,solo:!f.solo,friends:[]}))} style={{ padding:"5px 12px", borderRadius:99, fontSize:12, cursor:"pointer", background: form.solo ? "#a78bfa" : "#0c0c14", color: form.solo ? "#0c0c14" : "#6b6a8f", border:`1px solid ${form.solo ? "#a78bfa" : "#2e2e50"}`, fontWeight: form.solo ? 700 : 400 }}>solo</button>
            {past && <div style={{ marginTop: 14 }}>
              <div style={labelStyle}>Rating</div>
              <StarRating value={form.rating} onChange={v => update("rating", v)} max={settings.ratingSystem || 5} />
            </div>}
          </> },

          /* ── FINANCIAL ── */
          { title: 'Financial', content: <>
            <div style={labelStyle}>Ticket type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {(settings.ticketTypes || ['GA','GC','Seated']).map(t => <button key={t} onClick={() => update('ticketType', form.ticketType === t ? null : t)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: form.ticketType === t ? '#a78bfa' : '#0c0c14', color: form.ticketType === t ? '#0c0c14' : '#6b6a8f', border: `1px solid ${form.ticketType === t ? '#a78bfa' : '#2e2e50'}`, fontWeight: form.ticketType === t ? 700 : 400 }}>{t}</button>)}
            </div>
            <div style={labelStyle}>Add-ons</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {(settings.ticketAddons || ['Barricade','VIP','Soundcheck','Hi-touch','Send-off','Early entry']).map(a => { const on = (form.ticketAddons || []).includes(a); return <button key={a} onClick={() => update('ticketAddons', on ? (form.ticketAddons || []).filter(x => x !== a) : [...(form.ticketAddons || []), a])} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: on ? '#f472b6' : '#0c0c14', color: on ? '#0c0c14' : '#6b6a8f', border: `1px solid ${on ? '#f472b6' : '#2e2e50'}`, fontWeight: on ? 700 : 400 }}>{a}</button>; })}
            </div>
            <div style={labelStyle}>Ticket price</div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: 14 }}>
              <span style={{ color:"#6b6a8f" }}>€</span>
              <input type="number" value={form.ticketPrice || ""} placeholder="0.00" onChange={e => update("ticketPrice", e.target.value ? parseFloat(e.target.value) : null)} style={{ ...inputStyle, width: 100 }} />
            </div>
            <CostBreakdownFields value={form.costBreakdown} onChange={v => update('costBreakdown', v)} labelStyle={{ fontSize: 11, color: '#6b6a8f', marginBottom: 4 }} inputStyle={inputStyle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 8 }}>
              <div style={labelStyle}>Merch</div>
              <button onClick={addMerchItem} style={{ background:"none", border:"1px solid #2a4a3a", borderRadius:6, color:"#a78bfa", fontSize:11, padding:"3px 10px", cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>+ Add item</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(form.merch || []).map((m, i) => (
                <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ flex:1, position:"relative" }}>
                    <select value={merchCategories.includes(m.item) ? m.item : "__custom__"} onChange={e => updateMerch(i, "item", e.target.value)} style={{ ...inputStyle, width:"100%", appearance:"none", paddingRight:24 }}>
                      {merchCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="__custom__">Custom...</option>
                    </select>
                    <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", color:"#6b6a8f", fontSize:10, pointerEvents:"none" }}>▾</span>
                  </div>
                  {(!merchCategories.includes(m.item) || m.item === "") && (
                    <input
                      value={m.item === "__custom__" ? "" : m.item}
                      placeholder="Custom item..."
                      onChange={e => updateMerch(i, "item", e.target.value)}
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (v && !merchCategories.some(c => c.toLowerCase() === v.toLowerCase())) setPendingTag({ value: v, settingsKey: 'merchCategories', label: 'merch tags' });
                      }}
                      style={{ ...inputStyle, flex:1 }} autoFocus
                    />
                  )}
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ color:"#6b6a8f", fontSize:12 }}>€</span>
                    <input type="number" value={m.price} placeholder="0" onChange={e => updateMerch(i, "price", e.target.value)} style={{ ...inputStyle, width:70 }} />
                  </div>
                  <button onClick={() => removeMerch(i)} style={{ background:"none", border:"none", color:"#4a6a5a", fontSize:16, cursor:"pointer", padding:0 }}>×</button>
                </div>
              ))}
            </div>
          </> },

          /* ── NOTES ── */
          { title: 'Notes', content:
            <textarea value={form.notes || ""} onChange={e => update("notes", e.target.value)} rows={3} style={{ ...inputStyle, resize:"vertical" }} placeholder="Any notes..." />
          },

        ].map(({ title, content }) => (
          <div key={title} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "16px", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: "#e2e0ff", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #1a1a2e" }}>{title}</div>
            {content}
          </div>
        ))}

        {/* Acts — festivals only */}
        {form.type === 'festival' && (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "16px", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: "#e2e0ff", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #1a1a2e" }}>Acts seen</div>
            <FestivalActsSection
              acts={form.acts || []}
              onChange={v => update('acts', v)}
              startDate={form.date}
              endDate={form.endDate}
              ratingMax={settings.ratingSystem || 5}
            />
          </div>
        )}

        {/* Setlist — concerts only, editable in edit mode */}
        {past && form.type !== 'festival' && (() => {
          const roleConfig = {
            headliner: { color: '#a78bfa', bg: '#1a1a30' },
            support:   { color: '#818cf8', bg: '#131328' },
            guest:     { color: '#f472b6', bg: '#1a1030' },
          };
          const performers = [
            { key: '__headliner__', name: concert.artist, role: 'headliner',
              songs: getSongList(form.setlist),
              onSaveSetlist: (s) => update('setlist', s) },
            ...(concert.support || []).map(s => {
              const name = getSupportName(s); const role = getSupportRole(s);
              return { key: name, name, role,
                songs: getSongList((form.supportSetlists || {})[name]),
                onSaveSetlist: (ns) => setForm(f => ({ ...f, supportSetlists: { ...(f.supportSetlists || {}), [name]: ns } })) };
            }),
          ];
          return (
            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>Setlist</div>
              {performers.map(({ key, name, role, songs, onSaveSetlist: save }) => {
                const { color, bg } = roleConfig[role] || roleConfig.support;
                const isOpen = expandedSupportSetlists.has(key);
                return (
                  <div key={key} style={{ marginBottom: 6 }}>
                    <button onClick={() => toggleSupportSetlist(key)} style={{
                      width: '100%', textAlign: 'left', background: '#13131f',
                      border: '1px solid #1f1f35', borderLeft: `3px solid ${color}`,
                      borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, color, fontFamily: "'DM Mono', monospace", padding: '1px 5px', background: bg, borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{role}</span>
                        <span style={{ color: '#c4c2f0', fontSize: 13, fontWeight: 500 }}>{name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {songs.length > 0
                          ? <span style={{ color: '#6b6a8f', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>♫ {songs.length}</span>
                          : <span style={{ color: '#4a4870', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>+ setlist</span>}
                        <span style={{ color: '#4a4870', fontSize: 10, lineHeight: 1 }}>{isOpen ? '▴' : '▾'}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: `2px solid ${color}44` }}>
                        {songs.length > 0 && settings.spotifyAccessToken && (
                          <button
                            onClick={() => setSpotifyMatcher({ songs, artist: name, onSave: save })}
                            style={{ background: 'none', border: '1px solid #1DB95444', borderRadius: 6, color: '#1DB954', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", marginBottom: 8, display: 'block' }}
                          >
                            {songs.every(s => s && typeof s === 'object' && s.spotifyId)
                              ? 'Manage Spotify links →'
                              : 'Link to Spotify →'}
                          </button>
                        )}
                        <SetlistSection
                          concert={concert} settings={settings}
                          overrideSongs={songs}
                          overrideArtist={key === '__headliner__' ? undefined : name}
                          onSaveSetlist={save}
                          headlinerSongs={role === 'guest' && key !== '__headliner__' ? getSongList(form.setlist) : []}
                          allArtists={allArtists}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Delete */}
        {onDelete && (
          <div style={{ marginTop: 8, paddingTop: 20, borderTop: "1px solid #1a1a2e" }}>
            {!deleteConfirm ? (
              <button onClick={()=>setDeleteConfirm(true)} style={{
                width:"100%", padding:"10px", borderRadius:8, fontSize:12, cursor:"pointer",
                background:"none", border:"1px solid #2e2e50", color:"#4a4870",
                fontFamily:"'DM Mono',monospace"
              }}>Delete concert</button>
            ) : (
              <div style={{ background:"#1a0a0a", border:"1px solid #4a1a1a", borderRadius:8, padding:"14px" }}>
                <div style={{ fontSize:13, color:"#f472b6", marginBottom:12 }}>Delete this concert? This can't be undone.</div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setDeleteConfirm(false)} style={{ flex:1, padding:"8px", borderRadius:8, fontSize:12, cursor:"pointer", background:"none", border:"1px solid #2e2e50", color:"#6b6a8f", fontFamily:"'DM Mono',monospace" }}>Cancel</button>
                  <button onClick={async ()=>{ const result = await onDelete(concert.id); onNotify(result?.error ? 'Could not delete show' : 'Show deleted', result?.error ? 'error' : 'success'); if (!result?.error) onClose(); }} style={{ flex:1, padding:"8px", borderRadius:8, fontSize:12, cursor:"pointer", background:"#f472b6", border:"none", color:"#0c0c14", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {spotifyMatcher && (
        <SpotifyMatcher
          artist={spotifyMatcher.artist}
          songs={spotifyMatcher.songs}
          settings={settings}
          saveSettings={onUpdateSettings || (() => {})}
          onSave={spotifyMatcher.onSave}
          onClose={() => setSpotifyMatcher(null)}
        />
      )}
      {pendingTag && (
        <SaveTagPrompt
          value={pendingTag.value}
          label={pendingTag.label}
          onDismiss={() => setPendingTag(null)}
          onConfirm={() => {
            if (onUpdateSetting) onUpdateSetting(pendingTag.settingsKey, [...(settings[pendingTag.settingsKey] || []), pendingTag.value.trim()]);
            setPendingTag(null);
          }}
        />
      )}
    </div>
  );
}

function Collapsible({ title, defaultOpen = true, children, open: controlledOpen, onToggle }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const toggle = onToggle || (() => setInternalOpen(o => !o));
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={toggle} style={{
        width: "100%", background: "none", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 0 8px", borderBottom: `1px solid ${open ? "#2e2e50" : "#1f1f35"}`
      }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: open ? "#c4c2f0" : "#6b6a8f" }}>{title}</span>
        <span style={{ color: "#6b6a8f", fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
      </button>
      {open && <div style={{ paddingTop: 10 }}>{children}</div>}
    </div>
  );
}

function StatsView({ concerts, settings = {}, onNavigate = () => {}, onUpdateSetting = () => {}, statsTab, setStatsTab, chartGroup, setChartGroup, onOpen = () => {}, hideTabs = false, fillHeight = false }) {
  const {
    topArtistsRows = 6, topFriendsRows = 8,
    topVenuesRows = 5, topExpensiveRows = 10,
    defaultStatsTab = "summary"
  } = settings;
  const [chartType, setChartType] = useState('all');
  const typeMatch = c => chartType === 'all' || c.type === (chartType === 'festivals' ? 'festival' : 'concert');
  const pastAll = concerts.filter(c => !isWish(c) && isPast(c.date));
  const concertsT = concerts.filter(c => !isWish(c) && typeMatch(c));
  const past = pastAll.filter(typeMatch);
  const shows = past.filter(c => c.type === "concert");
  const festivals = past.filter(c => c.type === "festival");
  const solo = past.filter(c => getFriends(c).length === 0);
  const withFriends = past.filter(c => getFriends(c).length > 0);

  const totalSpent = past.reduce((sum, c) => {
    const ticket = c.ticketPrice || 0;
    const merch = (c.merch || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
    return sum + ticket + merch;
  }, 0);

  // Artists frequency (headliner + support + guest + festival acts)
  const artistCount = {};
  past.forEach(c => {
    if (c.type !== 'festival') {
      const key = c.artist.trim();
      if (!artistCount[key]) artistCount[key] = { headliner: 0, support: 0, guest: 0, festival: 0 };
      artistCount[key].headliner += 1;
    }
    (c.support || []).forEach(s => {
      const name = getSupportName(s).trim();
      const role = getSupportRole(s);
      if (!artistCount[name]) artistCount[name] = { headliner: 0, support: 0, guest: 0, festival: 0 };
      artistCount[name][role] = (artistCount[name][role] || 0) + 1;
    });
    (c.acts || []).forEach(act => {
      const name = (act.name || '').trim();
      if (!artistCount[name]) artistCount[name] = { headliner: 0, support: 0, guest: 0, festival: 0 };
      artistCount[name].festival = (artistCount[name].festival || 0) + 1;
    });
  });
  const topArtists = Object.entries(artistCount)
    .map(([name, counts]) => [name, counts])
    .sort((a, b) => {
      const totA = a[1].headliner + a[1].support + a[1].guest + (a[1].festival || 0);
      const totB = b[1].headliner + b[1].support + b[1].guest + (b[1].festival || 0);
      return totB - totA;
    })
    .slice(0, topArtistsRows);

  // Songs frequency — grouped by song + artist (covers attributed to the original artist)
  const songCount = {};
  past.forEach(c => {
    const tally = (song, performer) => {
      const n = getSongName(song); if (!n) return;
      const cov = getSongCover(song);
      const a = (typeof cov === 'string' && cov) || performer || '';
      const k = `${n}\u0000${a}`;
      if (!songCount[k]) songCount[k] = { name: n, artist: a, count: 0 };
      songCount[k].count += 1;
    };
    getSongList(c.setlist).forEach(song => tally(song, c.artist));
    Object.entries(c.supportSetlists || {}).forEach(([artistName, songs]) => getSongList(songs).forEach(song => tally(song, artistName)));
  });
  const topSongsRows = settings.topSongsRows || 10;
  const topSongs = Object.values(songCount).sort((a,b) => b.count - a.count).slice(0, topSongsRows);

  // All covers witnessed
  const coversList = [];
  past.forEach(c => {
    const collect = (songList, performer) => getSongList(songList).forEach(song => {
      const cov = getSongCover(song);
      if (cov) coversList.push({ name: getSongName(song), performer, original: typeof cov === 'string' ? cov : null, concert: c });
    });
    collect(c.setlist, c.artist);
    Object.entries(c.supportSetlists || {}).forEach(([a, songs]) => collect(songs, a));
  });

  // Friends frequency
  const friendCount = {};
  past.forEach(c => getFriends(c).forEach(f => { friendCount[f] = (friendCount[f] || 0) + 1; }));
  const topFriends = Object.entries(friendCount).sort((a,b) => b[1]-a[1]).slice(0, topFriendsRows);

  // Venues
  const venueCount = {};
  past.forEach(c => { venueCount[c.venue] = (venueCount[c.venue] || 0) + 1; });
  const topVenues = Object.entries(venueCount).sort((a,b) => b[1]-a[1]).slice(0, topVenuesRows);

  const venueRoomCount = {};
  past.forEach(c => {
    const key = c.room ? `${c.venue} · ${c.room}` : c.venue;
    venueRoomCount[key] = (venueRoomCount[key] || 0) + 1;
  });
  const topVenuesByRoom = Object.entries(venueRoomCount).sort((a,b) => b[1]-a[1]).slice(0, topVenuesRows);

  // Countries
  const countryCount = {};
  past.forEach(c => { const k = (c.country || '').trim(); countryCount[k] = (countryCount[k] || 0) + 1; });

  // Years
  const yearCount = {};
  const yearSpend = {};
  const yearConcertSpend = {};
  const yearFestivalSpend = {};
  past.forEach(c => {
    const y = getYear(c.date);
    yearCount[y] = (yearCount[y] || 0) + 1;
    const spent = (c.ticketPrice || 0) + (c.merch || []).reduce((s,m) => s + (parseFloat(m.price)||0), 0) + extraCostTotal(c);
    yearSpend[y] = (yearSpend[y] || 0) + spent;
    if (c.type === 'festival') yearFestivalSpend[y] = (yearFestivalSpend[y] || 0) + spent;
    else yearConcertSpend[y] = (yearConcertSpend[y] || 0) + spent;
  });
  const years = Object.keys(yearCount).sort();

  // Year counts including upcoming
  const allYearCount = {};
  const upcomingYearCount = {};
  concertsT.forEach(c => {
    const y = getYear(c.date);
    allYearCount[y] = (allYearCount[y] || 0) + 1;
    if (!isPast(c.date)) upcomingYearCount[y] = (upcomingYearCount[y] || 0) + 1;
  });
  const allYears = Object.keys(allYearCount).sort();

  // Month counts including upcoming — respects chartType filter via concertsT
  const allYearMonthCount = {};
  concertsT.forEach(c => {
    const m = parseInt(c.date.split("-")[1]) - 1;
    const y = getYear(c.date);
    if (!allYearMonthCount[y]) allYearMonthCount[y] = {};
    allYearMonthCount[y][m] = (allYearMonthCount[y][m] || 0) + 1;
  });

  // Avg ticket price per year
  const yearTicketSum = {};
  const yearTicketCount = {};
  past.filter(c => c.ticketPrice).forEach(c => {
    const y = getYear(c.date);
    yearTicketSum[y] = (yearTicketSum[y] || 0) + c.ticketPrice;
    yearTicketCount[y] = (yearTicketCount[y] || 0) + 1;
  });

  // Merch per year
  const yearMerchSpend = {};
  const yearOtherSpend = {};
  const totalMerch = past.reduce((sum, c) => {
    const m = (c.merch || []).reduce((s,x) => s + (parseFloat(x.price)||0), 0);
    const y = getYear(c.date);
    yearMerchSpend[y] = (yearMerchSpend[y] || 0) + m;
    if (extraCostTotal(c)) yearOtherSpend[y] = (yearOtherSpend[y] || 0) + extraCostTotal(c);
    return sum + m;
  }, 0);
  const totalTickets = past.reduce((sum,c) => sum + (c.ticketPrice||0), 0);


  const monthCount = {};
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const yearMonthCount = {};
  past.forEach(c => {
    const m = parseInt(c.date.split("-")[1]) - 1;
    const y = getYear(c.date);
    monthCount[m] = (monthCount[m] || 0) + 1;
    if (!yearMonthCount[y]) yearMonthCount[y] = {};
    yearMonthCount[y][m] = (yearMonthCount[y][m] || 0) + 1;
  });

  // Top 10 most expensive
  const topExpensive = [...past]
    .filter(c => c.ticketPrice)
    .sort((a,b) => b.ticketPrice - a.ticketPrice)
    .slice(0, topExpensiveRows);

  // Cumulative shows over time
  const sortedPast = [...past].sort((a,b) => a.date.localeCompare(b.date));
  const cumulative = sortedPast.map((c, i) => ({ date: c.date.slice(0,7), count: i+1, artist: c.artist }));

  // Venue size buckets (field-based, dynamic)
  const venueSizeCount = {};
  past.forEach(c => {
    const sz = c.type === "festival" ? "Festival" : c.venueSize;
    if (sz) venueSizeCount[sz] = (venueSizeCount[sz] || 0) + 1;
  });
  const venueEntries = Object.entries(venueSizeCount).sort((a,b) => b[1]-a[1]);

  // Avg shows per year
  const avgPerYear = years.length ? (past.length / years.length).toFixed(1) : null;

  // Genre breakdown
  const genreCount = {};
  past.forEach(c => { getGenres(c).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }); });
  const topGenres = Object.entries(genreCount).sort((a,b) => b[1]-a[1]);
  const subgenreCount = {};
  past.forEach(c => { if (c.subgenre) subgenreCount[c.subgenre] = (subgenreCount[c.subgenre] || 0) + 1; });
  const topSubgenres = Object.entries(subgenreCount).sort((a,b) => b[1]-a[1]);

  // Ratings
  const rated = past.filter(c => c.rating);
  const avgRating = rated.length ? (rated.reduce((s,c) => s + c.rating, 0) / rated.length).toFixed(1) : null;
  const ratingDist = {1:0,2:0,3:0,4:0,5:0};
  rated.forEach(c => { ratingDist[c.rating]++; });

  // Merch stats
  const allMerchItems = past.flatMap(c => (c.merch || []).map(m => ({ ...m, artist: c.artist, date: c.date })));
  const totalMerchSpend = allMerchItems.reduce((s, m) => s + (parseFloat(m.price) || 0), 0);

  // Item type frequency (normalize to lowercase)
  const itemTypeCount = {};
  allMerchItems.forEach(m => {
    if (!m.item) return;
    const key = m.item.toLowerCase().trim();
    itemTypeCount[key] = (itemTypeCount[key] || 0) + 1;
  });
  const topMerchTypes = Object.entries(itemTypeCount).sort((a,b) => b[1]-a[1]).slice(0, 10);

  // Top 3 most expensive individual items
  const topMerchItems = [...allMerchItems]
    .filter(m => parseFloat(m.price) > 0)
    .sort((a,b) => parseFloat(b.price) - parseFloat(a.price))
    .slice(0, 3);

  // Merch spend per artist
  const artistMerchSpend = {};
  past.forEach(c => {
    const spend = (c.merch || []).reduce((s,m) => s + (parseFloat(m.price)||0), 0);
    if (spend > 0) artistMerchSpend[c.artist] = (artistMerchSpend[c.artist] || 0) + spend;
  });
  const topArtistMerch = Object.entries(artistMerchSpend).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const maxYearSpend = Math.max(...Object.values(yearSpend), 1);
  const maxMonth = Math.max(...Object.values(monthCount), 1);

  // Friends group-size distribution
  const groupSizeDist = {};
  past.forEach(c => {
    const n = getFriends(c).length;
    const key = n >= 6 ? "6+" : String(n);
    groupSizeDist[key] = (groupSizeDist[key] || 0) + 1;
  });

  // Average rating per year
  const ratingByYear = {};
  rated.forEach(c => {
    const y = getYear(c.date);
    if (!ratingByYear[y]) ratingByYear[y] = { sum: 0, count: 0 };
    ratingByYear[y].sum += c.rating;
    ratingByYear[y].count++;
  });

  // Most expensive shows including merch cost
  const topExpensiveIncMerch = [...past]
    .filter(c => c.ticketPrice || c.merch?.length > 0)
    .map(c => ({ ...c, totalCost: (c.ticketPrice || 0) + (c.merch || []).reduce((s,m) => s + (parseFloat(m.price)||0), 0) }))
    .sort((a,b) => b.totalCost - a.totalCost)
    .slice(0, topExpensiveRows);


  const StatBox = ({ label, value, sub }) => (
    <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "16px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: "#a78bfa" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const BarRow = ({ label, value, max, color = "#a78bfa", suffix = "", prefix = "" }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 38, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "#13131f", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 4, background: color, width: `${Math.max(2, (value/max)*100)}%`, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 48, textAlign: "right", flexShrink: 0 }}>{prefix}{typeof value === "number" && value % 1 !== 0 ? value.toFixed(0) : value}{suffix}</span>
    </div>
  );

  const ListStat = ({ title, items, suffix = "" }) => (
    <div style={{ marginBottom: 4 }}>
      {items.map(([name, count], i) => (
        <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18 }}>#{i+1}</span>
            <span style={{ color: "#c4c2f0", fontSize: 13 }}>{name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ height: 4, borderRadius: 2, background: "#a78bfa", width: Math.max(16, (count / items[0][1]) * 80) }} />
            <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 28, textAlign: "right" }}>{count}{suffix}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // Donut chart (SVG)
  // labelTexts: array of strings to show on arcs instead of %; null = show %
  // centerText: string to show in center; null = hide center; undefined = show total count
  const Donut = ({ segments, size = 120, label = "total", showLabels = false, labelTexts = null, centerText = undefined, labelPad = 0.18 }) => {
    const total = segments.reduce((s, x) => s + x.value, 0);
    if (total === 0) return null;
    const cx = size/2, cy = size/2, r = size*0.36, stroke = size*0.15;
    const labelR = r + stroke + size*labelPad;
    const GAP = segments.length > 1 ? 3 : 0;
    let angle = -90;
    const arcs = segments.map((seg, idx) => {
      const pct = seg.value / total;
      const segDeg = pct * 360 - GAP;
      const midDeg = angle + GAP/2 + Math.max(0.1, segDeg)/2;
      const s = ((angle + GAP/2) * Math.PI) / 180;
      const e = ((angle + GAP/2 + Math.max(0.1, segDeg)) * Math.PI) / 180;
      const midRad = (midDeg * Math.PI) / 180;
      angle += pct * 360;
      const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
      const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
      const lx = cx + labelR * Math.cos(midRad), ly = cy + labelR * Math.sin(midRad);
      const rawLabel = labelTexts ? labelTexts[idx] : `${Math.round(pct*100)}%`;
      const arcLabel = (!labelTexts && rawLabel && rawLabel.length > 7) ? rawLabel.slice(0, 6) + '…' : rawLabel;
      return { ...seg, pct, lx, ly, arcLabel, d: segDeg <= 0 ? null : `M ${x1} ${y1} A ${r} ${r} 0 ${segDeg > 180 ? 1 : 0} 1 ${x2} ${y2}` };
    });
    const pad = showLabels ? Math.max(size*0.1, labelR - size/2 + size*0.14) : 0;
    const vb = `${-pad} ${-pad} ${size + pad*2} ${size + pad*2}`;
    return (
      <svg overflow="visible" width={size + pad*2} height={size + pad*2} viewBox={vb} style={{ overflow: "visible", display: "block" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0d0d1a" strokeWidth={stroke} />
        {arcs.map((a, i) => a.d && (
          <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="butt" />
        ))}
        {showLabels && arcs.map((a, i) => a.pct > 0.05 && a.d && a.arcLabel && (
          <text key={`l${i}`} x={a.lx} y={a.ly} textAnchor="middle" dominantBaseline="middle" fill={a.color} fontSize={size*0.09} fontFamily="'DM Mono',monospace" fontWeight="600">{a.arcLabel}</text>
        ))}
        {centerText === undefined ? (
          <>
            <text x={cx} y={cy - size*0.08} textAnchor="middle" dominantBaseline="middle" fill="#e2e0ff" fontSize={size*0.16} fontFamily="'Syne',sans-serif" fontWeight="800">{label.split(' ')[0]}</text>
            {label.split(' ').length > 1 && <text x={cx} y={cy + size*0.11} textAnchor="middle" dominantBaseline="middle" fill="#6b6a8f" fontSize={size*0.10} fontFamily="'DM Mono',monospace">{label.split(' ').slice(1).join(' ')}</text>}
          </>
        ) : centerText !== null ? (
          Array.isArray(centerText) ? (
            centerText.map((line, li) => (
              <text key={li} x={cx} y={cy + (li - (centerText.length - 1) / 2) * size * 0.13 + 2} textAnchor="middle" dominantBaseline="middle" fill="#6b6a8f" fontSize={size*0.11} fontFamily="'DM Mono',monospace">{line}</text>
            ))
          ) : (
            <text x={cx} y={cy+2} textAnchor="middle" dominantBaseline="middle" fill="#6b6a8f" fontSize={size*0.11} fontFamily="'DM Mono',monospace">{centerText}</text>
          )
        ) : null}
      </svg>
    );
  };

  const ChartToggle = ({ options, value, onChange, color = "#a78bfa" }) => (
    <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          padding: "3px 10px", borderRadius: 99, fontSize: 10, cursor: "pointer",
          fontFamily: "'DM Mono', monospace", fontWeight: 600,
          background: value === o.id ? color : "none",
          color: value === o.id ? "#0c0c14" : "#5a5880",
          border: `1px solid ${value === o.id ? color : "#1f1f35"}`,
        }}>{o.label}</button>
      ))}
    </div>
  );

  const CHART_GROUPS = [
    {
      id: "activity", label: "Activity",
      charts: [
        { id: "artists",    label: "Artist overview" },
        { id: "shows",      label: "Shows over time" },
        { id: "day-pixels", label: "Year in pixels" },
        { id: "genres-pie", label: "Genres" },
        { id: "language",   label: "Language" },
        { id: "ratings",    label: "Ratings" },
      ]
    },
    {
      id: "friends", label: "Friends",
      charts: [
        { id: "solo", label: "Friends & group size" },
      ]
    },
    {
      id: "places", label: "Places",
      charts: [
        { id: "venues",        label: "Top venues" },
        { id: "venue-loyalty", label: "Venue loyalty" },
      ]
    },
    {
      id: "financial", label: "Financial",
      charts: [
        { id: "year-spend", label: "Spending per year" },
        { id: "averages",   label: "Averages" },
        { id: "expensive",  label: "Most expensive shows" },
        { id: "merch-overview", label: "Merch" },
      ]
    },
    {
      id: "music", label: "Music",
      charts: [
        ...(topSongs.length > 0 ? [{ id: "songs", label: "Top songs" }] : []),
        ...(coversList.length > 0 ? [{ id: "covers", label: "Covers" }] : []),
      ].filter(Boolean)
    },
  ].filter(g => g.charts.length > 0);

  useBackButton(() => setStatsTab("summary"), statsTab === "charts" || statsTab === "friends");
  const swipeTouchStart = useRef({ x: 0, y: 0, t: 0 });
  const handleSwipeStart = (e) => { swipeTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; };
  const handleSwipeEnd = (e) => {
    if (!chartGroup) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStart.current.x;
    const dy = e.changedTouches[0].clientY - swipeTouchStart.current.y;
    const dt = Date.now() - swipeTouchStart.current.t;
    const idx = visibleChartGroups.findIndex(g => g.id === chartGroup);
    if (idx < 0 || Math.abs(dx) < 12 || Math.abs(dy) > Math.abs(dx) * 2) return;
    if (dx < 0 && idx < visibleChartGroups.length - 1) { const nextG = visibleChartGroups[idx + 1]; setChartGroup(nextG.id); setSelectedChart(getOrderedCharts(nextG)[0]?.id); }
    else if (dx > 0 && idx > 0) { const prevG = visibleChartGroups[idx - 1]; const prevCharts = getOrderedCharts(prevG); setChartGroup(prevG.id); setSelectedChart(prevCharts[prevCharts.length - 1]?.id); }
  };
  const [selectedChart, setSelectedChart] = useState("shows");
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  useBackButton(() => setSelectedSong(null), selectedSong !== null);
  useBackButton(() => setSelectedVenue(null), selectedVenue !== null);
  const [chartOptions, setChartOptions] = useState({});
  const [showMoreArtistStats, setShowMoreArtistStats] = useState(false);
  // Chart reorder state
  const [chartOrder, setChartOrder] = useState(settings.chartOrder || {});
  const [sectionOrder, setSectionOrder] = useState(settings.sectionOrder || {});
  const [sectionEditChart, setSectionEditChart] = useState(null); // which chart is in section-edit mode

  const getOrderedSections = (chartId, sections) => {
    const order = sectionOrder[chartId];
    if (!order) return sections;
    return [...sections].sort((a, b) => {
      const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  };

  // SectionReorder: wraps a multi-section chart with touch-first drag-to-reorder UI
  const SectionReorder = ({ chartId, sections }) => {
    const isEditing = sectionEditChart === chartId;
    const ordered = getOrderedSections(chartId, sections);

    const saveOrder = (newSections) => {
      const newOrder = { ...sectionOrder, [chartId]: newSections.map(s => s.id) };
      setSectionOrder(newOrder);
      onUpdateSetting('sectionOrder', newOrder);
    };

    const moveTo = (fromIdx, toPos) => {
      // toPos is 1-based
      const toIdx = toPos - 1;
      if (toIdx === fromIdx) return;
      const arr = [...ordered];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      saveOrder(arr);
    };

    return (
      <div>
        {/* Edit toggle */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button onClick={() => setSectionEditChart(isEditing ? null : chartId)}
            style={{ background: isEditing ? "#a78bfa" : "none", border: `1px solid ${isEditing ? "#a78bfa" : "#1f1f35"}`, borderRadius: 99, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontFamily: "'DM Mono', monospace", color: isEditing ? "#0c0c14" : "#5a5880", fontWeight: isEditing ? 700 : 400 }}>
            {isEditing ? "Done" : "✎ edit"}
          </button>
        </div>

        {isEditing ? (
          <div>
            <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Set position with the number
            </div>
            {ordered.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "11px 14px", marginBottom: 8 }}>
                <select
                  value={i + 1}
                  onChange={e => moveTo(i, parseInt(e.target.value))}
                  style={{
                    background: "#0c0c14", border: "1px solid #a78bfa", borderRadius: 8,
                    color: "#a78bfa", fontFamily: "'DM Mono', monospace", fontSize: 14,
                    fontWeight: 700, padding: "4px 6px", cursor: "pointer", flexShrink: 0,
                    WebkitAppearance: "none", appearance: "none", textAlign: "center", width: 44,
                  }}
                >
                  {ordered.map((_, j) => (
                    <option key={j + 1} value={j + 1}>{j + 1}</option>
                  ))}
                </select>
                <div style={{ fontSize: 13, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, flex: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ordered.map(s => <div key={s.id}>{s.content}</div>)}
          </div>
        )}
      </div>
    );
  };
  const [reorderMode, setReorderMode] = useState(false);
  const longPressTimer = useRef(null);
  const getOrderedCharts = (group) => {
    const order = chartOrder[group.id];
    if (!order) return group.charts;
    return [...group.charts].sort((a, b) => {
      const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  };
  const chartOpt = (id, def) => chartOptions[id] ?? def;
  const setChartOpt = (id, val) => setChartOptions(o => ({ ...o, [id]: val }));
  const summaryYear = settings.summaryYear || 'all';
  const summaryFinType = settings.summaryFinType || 'all';
  const showsChartRef = useRef(null);
  const [showsChartDims, setShowsChartDims] = useState({ w: 300, h: 200 });
  useEffect(() => {
    const el = showsChartRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width || el.offsetWidth;
      // Use the chartAreaRef height (already bounded by flex layout) as h
      const areaEl = chartAreaRef.current;
      const h = areaEl ? Math.max(140, areaEl.getBoundingClientRect().height - 32) : Math.max(140, window.innerHeight * 0.55);
      setShowsChartDims({ w, h });
    };
    // Delay slightly to let layout settle
    const t = setTimeout(measure, 50);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [statsTab, chartGroup]);
  const summaryPast = pastAll.filter(c => summaryYear === 'all' || c.date.slice(0,4) === summaryYear);

  // Measure available chart height so content never overflows
  const chartAreaRef = useRef(null);
  const [chartHeight, setChartHeight] = useState(400);
  useEffect(() => {
    if (!fillHeight) return;
    const update = () => {
      const el = chartAreaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) setChartHeight(rect.height);
    };
    update();
    const obs = new ResizeObserver(update);
    if (chartAreaRef.current) obs.observe(chartAreaRef.current);
    window.addEventListener('resize', update);
    return () => { obs.disconnect(); window.removeEventListener('resize', update); };
  }, [fillHeight, statsTab]);

  const hiddenChartGroups = settings.hiddenChartGroups || [];
  const hiddenCharts = settings.hiddenCharts || [];
  const visibleChartGroups = CHART_GROUPS
    .filter(g => !hiddenChartGroups.includes(g.id))
    .map(g => ({ ...g, charts: g.charts.filter(c => !hiddenCharts.includes(c.id)) }))
    .filter(g => g.charts.length > 0);
  const activeGroup = visibleChartGroups.find(g => g.id === chartGroup) || visibleChartGroups[0] || null;
  const activeGroupCharts = activeGroup ? getOrderedCharts(activeGroup) : [];
  const activeChart = activeGroupCharts.find(c => c.id === selectedChart) || activeGroupCharts[0];

  const renderChart = (id, chartHeight = 400) => {
    switch(id) {
      case "shows": {
        const sView = chartOpt("shows", "bars");
        const wishYearCount = {};
        concerts.filter(c => isWish(c) && c.date && c.date !== '9999-12-31').forEach(c => {
          const y = getYear(c.date);
          if (y) wishYearCount[y] = (wishYearCount[y] || 0) + 1;
        });
        const allYearsWithWish = [...new Set([...Object.keys(allYearCount), ...Object.keys(wishYearCount)])].sort();
        const maxAllWithWish = Math.max(...allYearsWithWish.map(y => (allYearCount[y] || 0) + (wishYearCount[y] || 0)), 1);
        const hmAllYears = Object.keys(allYearMonthCount).sort();
        const hmMax = Math.max(...hmAllYears.flatMap(y => Array.from({length:12}, (_,m) => allYearMonthCount[y]?.[m] || 0)), 1);
        const todayYear = new Date().getFullYear().toString();

        const BarsChart = ({ w = 300, h = 160 }) => {
          const BAR_H = Math.max(80, h - 120); // 14+14 padding + 24 legend + 18 x-labels + 10 border/gap slack
          const Y_PAD = 28; // left space for y-axis labels
          const hasWish = Object.keys(wishYearCount).length > 0;
          const midVal = Math.round(maxAllWithWish / 2);
          return (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                {[["#a78bfa","Past"],["#34d399","Upcoming"],...(hasWish ? [["#f472b6","Want to go"]] : [])].map(([color, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex" }}>
                {/* Y axis */}
                <div style={{ width: Y_PAD, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingBottom: 18, flexShrink: 0 }}>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{maxAllWithWish}</span>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{midVal}</span>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>0</span>
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  {/* Gridlines */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: BAR_H, pointerEvents: "none" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, borderTop: "1px solid #1f1f35" }} />
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed #1a1a2e" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid #1f1f35" }} />
                  </div>
                  {/* Bars */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: BAR_H, paddingBottom: 1 }}>
                    {allYearsWithWish.map(y => {
                      const total = allYearCount[y] || 0;
                      const upcoming = upcomingYearCount[y] || 0;
                      const pastCount = total - upcoming;
                      const wish = wishYearCount[y] || 0;
                      const grandTotal = total + wish;
                      const barH = Math.max(2, (grandTotal / maxAllWithWish) * (BAR_H - 2));
                      const pastH = grandTotal > 0 ? (pastCount / grandTotal) * barH : 0;
                      const upH = grandTotal > 0 ? (upcoming / grandTotal) * barH : 0;
                      const wishH = grandTotal > 0 ? (wish / grandTotal) * barH : 0;
                      return (
                        <div key={y} onClick={() => onUpdateSetting('summaryYear', y)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", cursor: "pointer" }}>
                          <div style={{ width: "100%", display: "flex", flexDirection: "column", borderRadius: "3px 3px 0 0", overflow: "hidden" }}>
                            {wishH > 0 && <div style={{ height: wishH, background: "#f472b6", opacity: 0.7 }} />}
                            {upH > 0 && <div style={{ height: upH, background: "#34d399" }} />}
                            {pastH > 0 && <div style={{ height: pastH, background: "#a78bfa" }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* X axis labels */}
                  <div style={{ display: "flex", gap: 3, borderTop: "1px solid #1f1f35", paddingTop: 3 }}>
                    {allYearsWithWish.map(y => (
                      <div key={y} style={{ flex: 1, textAlign: "center" }}>
                        <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{y.slice(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        };

        const LineChart = ({ w = 300, h = 160 }) => {
          const sortedYearsAsc = Object.keys(allYearCount).sort();
          const maxAll = Math.max(...Object.values(allYearCount), 1);
          const midAll = Math.round(maxAll / 2);
          const n = sortedYearsAsc.length;
          if (n < 2) return <div style={{ color: "#2e2e4a", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Need at least 2 years of data</div>;
          const W = Math.max(200, w - 32), H = Math.max(60, h - 70);
          const Y_PAD = 28;
          const xOf = i => (i / (n - 1)) * (W - 6) + 3;
          const yOf = v => H - 4 - (v / maxAll) * (H - 14);
          const splitIdx = sortedYearsAsc.findIndex(y => y >= todayYear);
          const pastYears = splitIdx === -1 ? sortedYearsAsc : sortedYearsAsc.slice(0, splitIdx + 1);
          const futureYears = splitIdx === -1 ? [] : sortedYearsAsc.slice(splitIdx);
          const pastPath = pastYears.length > 1 ? "M " + pastYears.map((y, i) => `${xOf(sortedYearsAsc.indexOf(y))},${yOf(allYearCount[y])}`).join(" L ") : null;
          const futurePath = futureYears.length > 1 ? "M " + futureYears.map(y => `${xOf(sortedYearsAsc.indexOf(y))},${yOf(allYearCount[y])}`).join(" L ") : null;
          const firstPastX = xOf(0);
          const lastPastX = pastYears.length ? xOf(pastYears.length - 1) : 3;
          return (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 2, background: "#a78bfa", borderRadius: 1 }} /><span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Past</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 2, background: "#34d399", borderRadius: 1 }} /><span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Upcoming</span></div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                {/* Y axis labels */}
                <div style={{ width: Y_PAD, display: "flex", flexDirection: "column", justifyContent: "space-between", height: H + 14, paddingBottom: 14, flexShrink: 0 }}>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{maxAll}</span>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{midAll}</span>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>0</span>
                </div>
                <svg style={{ flex: 1 }} height={H + 14} viewBox={`0 0 ${W} ${H + 14}`} preserveAspectRatio="none">
                  <defs><linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2"/><stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/></linearGradient></defs>
                  {/* Gridlines */}
                  <line x1={0} y1={yOf(maxAll)} x2={W} y2={yOf(maxAll)} stroke="#1f1f35" strokeWidth="1" />
                  <line x1={0} y1={yOf(midAll)} x2={W} y2={yOf(midAll)} stroke="#1a1a2e" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1={0} y1={yOf(0)} x2={W} y2={yOf(0)} stroke="#1f1f35" strokeWidth="1" />
                  {/* X axis year labels */}
                  {sortedYearsAsc.map((y, i) => (
                    <text key={y} x={xOf(i)} y={H + 11} textAnchor="middle" fill="#4a4870" fontSize="8" fontFamily="DM Mono,monospace">{y.slice(2)}</text>
                  ))}
                  {pastPath && <path d={pastPath + ` L ${lastPastX},${yOf(0)} L ${firstPastX},${yOf(0)} Z`} fill="url(#sGrad)" />}
                  {pastPath && <path d={pastPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {futurePath && <path d={futurePath} fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />}
                  {sortedYearsAsc.map((y, i) => <circle key={y} cx={xOf(i)} cy={yOf(allYearCount[y])} r="3" fill={parseInt(y) >= parseInt(todayYear) && (upcomingYearCount[y] || 0) > 0 ? "#34d399" : "#a78bfa"} />)}
                </svg>
              </div>
            </div>
          );
        };

        const Heatmap = ({ w = 300, h = 160 }) => (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
            <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Monthly heatmap</div>
            <div style={{ display: "flex", marginLeft: 28 }}>
              {monthNames.map((name, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 7, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{name[0]}</div>)}
            </div>
            {hmAllYears.map(y => (
              <div key={y} style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
                <span style={{ width: 28, fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{y.slice(2)}</span>
                {Array.from({length: 12}, (_, m) => {
                  const count = allYearMonthCount[y]?.[m] || 0;
                  const pastC = yearMonthCount[y]?.[m] || 0;
                  const isUpcoming = count > 0 && pastC === 0;
                  const intensity = count / hmMax;
                  const color = isUpcoming ? `rgba(52,211,153,${0.15 + intensity * 0.85})` : `rgba(167,139,250,${0.15 + intensity * 0.85})`;
                  const textColor = intensity > 0.55 ? "#0c0c14" : (isUpcoming ? "#34d399" : "#a78bfa");
                  const cellH = Math.max(14, Math.floor((h - 65) / Math.max(hmAllYears.length, 1)) - 2);
                  return (
                    <div key={m} style={{ flex: 1, height: cellH, borderRadius: 2, margin: "0 1px", background: count > 0 ? color : "#0e0e1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {count > 0 && <span style={{ fontSize: Math.max(6, Math.min(10, cellH - 6)), color: textColor, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{count}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );

        const CumulativeChart = ({ w = 300, h = 160 }) => {
          const cumSorted = [...concertsT].filter(c => !isWish(c) && c.date && c.date.length === 10).sort((a, b) => a.date.localeCompare(b.date));
          if (cumSorted.length < 2) return <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", color: "#2e2e4a", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Not enough data yet</div>;
          const nowMs = Date.now();
          const cumPast = cumSorted.filter(c => new Date(c.date + 'T00:00:00').getTime() <= nowMs);
          const cumUpcoming = cumSorted.filter(c => new Date(c.date + 'T00:00:00').getTime() > nowMs);
          const n = cumSorted.length;
          const W = Math.max(200, w - 28), H = Math.max(70, h - 110); // 14+14 padding + 20 date labels + 16 count line + 16 legend + slack
          const firstMs = new Date(cumSorted[0].date + 'T00:00:00').getTime();
          const lastMs = new Date(cumSorted[n - 1].date + 'T00:00:00').getTime();
          const rangeMs = Math.max(lastMs - firstMs, 1);
          const todayMs2 = Math.min(nowMs, lastMs);
          const todayX = ((todayMs2 - firstMs) / rangeMs) * (W - 6) + 3;
          const xOf = c => ((new Date(c.date + 'T00:00:00').getTime() - firstMs) / rangeMs) * (W - 6) + 3;
          const yOf = i => H - 6 - ((i + 1) / n) * (H - 16);
          const pastCoords = cumPast.map((c, i) => ({ x: xOf(c), y: yOf(i) }));
          const upcomingCoords = cumUpcoming.map((c, i) => ({ x: xOf(c), y: yOf(cumPast.length + i) }));
          const todayY = pastCoords.length > 0 ? pastCoords[pastCoords.length - 1].y : yOf(-1);
          const pastPath = pastCoords.length > 1 ? "M " + pastCoords.map(p => `${p.x},${p.y}`).join(" L ") : null;
          const upcomingPath = upcomingCoords.length > 0 ? `M ${todayX},${todayY} L ` + upcomingCoords.map(p => `${p.x},${p.y}`).join(" L ") : null;
          const areaPath = pastCoords.length > 1 ? pastPath + ` L ${todayX},${H - 4} L ${pastCoords[0].x},${H - 4} Z` : null;
          const yearLabels = [...new Set(cumSorted.map(c => c.date.slice(0, 4)))].map(y => ({
            y, x: Math.max(8, Math.min(W - 16, ((new Date(`${y}-01-01`).getTime() - firstMs) / rangeMs) * (W - 6) + 3))
          }));
          return (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 2, background: "#a78bfa", borderRadius: 1 }} /><span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Past</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 2, background: "#34d399", borderRadius: 1, opacity: 0.8 }} /><span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Upcoming</span></div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: H + 10, paddingBottom: 14 }}>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{n}</span>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{Math.round(n / 2)}</span>
                  <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>0</span>
                </div>
                <svg style={{ flex: 1 }} height={H + 10} viewBox={`0 0 ${W} ${H + 10}`} preserveAspectRatio="none">
                  <defs><linearGradient id="cumGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25"/><stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/></linearGradient></defs>
                  {yearLabels.map(({ y, x }) => (
                    <g key={y}>
                      <line x1={x} y1={0} x2={x} y2={H - 4} stroke="#1f1f35" strokeWidth="1" strokeDasharray="3,3" />
                      <text x={x} y={H + 8} textAnchor="middle" fill="#4a4870" fontSize="8" fontFamily="DM Mono,monospace">{y}</text>
                    </g>
                  ))}
                  {areaPath && <path d={areaPath} fill="url(#cumGrad2)" />}
                  {pastPath && <path d={pastPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {upcomingPath && <path d={upcomingPath} fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />}
                  <line x1={todayX} y1={0} x2={todayX} y2={H - 4} stroke="#2e2e50" strokeWidth="1" />
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{cumSorted[0].date.slice(0, 7)}</span>
                <span style={{ fontSize: 9, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>{cumPast.length} past · {cumUpcoming.length} upcoming</span>
                <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{cumSorted[n - 1].date.slice(0, 7)}</span>
              </div>
            </div>
          );
        };

        const showsViews = [
          { id: "bars",       label: "Bars" },
          { id: "line",       label: "Line" },
          { id: "heatmap",    label: "Heat" },
          { id: "cumulative", label: "Cumul" },
        ];

        return (
          <div>
            {/* Toggle */}
            <div style={{ display: "flex", background: "#0c0c14", borderRadius: 10, padding: 3, marginBottom: 10, gap: 2 }}>
              {showsViews.map(({ id, label }) => (
                <button key={id} onClick={() => setChartOpt("shows", id)} style={{
                  flex: 1, padding: "6px 4px", borderRadius: 8, fontSize: 11,
                  cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: sView === id ? 700 : 400,
                  background: sView === id ? "#a78bfa" : "none",
                  border: "none",
                  color: sView === id ? "#0c0c14" : "#4a4870",
                  letterSpacing: "0.03em",
                }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Fill available height using component-level ref */}
            <div ref={showsChartRef} style={{ width: "100%" }}>
              {sView === "bars"       && <BarsChart       w={showsChartDims.w} h={showsChartDims.h} />}
              {sView === "line"       && <LineChart        w={showsChartDims.w} h={showsChartDims.h} />}
              {sView === "heatmap"    && <Heatmap          w={showsChartDims.w} h={showsChartDims.h} />}
              {sView === "cumulative" && <CumulativeChart  w={showsChartDims.w} h={showsChartDims.h} />}
            </div>
          </div>
        );
      }
      case "day-pixels": {
        const pyKey = "day-pixels-year";
        const allDatedYears = [...new Set(concerts.filter(c => !isWish(c) && c.date && c.date.length === 10).map(c => c.date.slice(0, 4)))].sort();
        const todayYearStr = String(new Date().getFullYear());
        const defaultPixelYear = allDatedYears.includes(todayYearStr) ? todayYearStr : (allDatedYears[allDatedYears.length - 1] || todayYearStr);
        const pixelYear = chartOpt(pyKey, defaultPixelYear);
        const yIdx = allDatedYears.indexOf(pixelYear);

        // Map every date in the year to the shows that happened on it
        const dayMap = {};
        concerts.filter(c => !isWish(c) && c.date && c.date.slice(0, 4) === pixelYear).forEach(c => {
          const key = c.date;
          if (!dayMap[key]) dayMap[key] = [];
          dayMap[key].push(c);
        });
        const maxDayCount = Math.max(...Object.values(dayMap).map(l => l.length), 1);

        const jan1 = new Date(`${pixelYear}-01-01T00:00:00`);
        const dec31 = new Date(`${pixelYear}-12-31T00:00:00`);
        const gridStart = new Date(jan1); gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // back up to Sunday
        const totalDays = Math.round((dec31 - gridStart) / 86400000) + 1;
        const totalWeeks = Math.ceil(totalDays / 7);
        const CELL = 11, GAP = 3;

        const monthLabels = [];
        for (let m = 0; m < 12; m++) {
          const first = new Date(pixelYear, m, 1);
          const dayIdx = Math.round((first - gridStart) / 86400000);
          monthLabels.push({ label: monthNames[m], col: Math.floor(dayIdx / 7) });
        }

        const cellsByWeek = Array.from({ length: totalWeeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
          const date = new Date(gridStart); date.setDate(date.getDate() + w * 7 + d);
          if (date.getFullYear().toString() !== pixelYear) return null;
          const key = date.toISOString().slice(0, 10);
          const shows = dayMap[key] || [];
          return { date: key, shows };
        }));

        const totalShowsThisYear = Object.values(dayMap).reduce((s, l) => s + l.length, 0);
        const daysWithShows = Object.keys(dayMap).length;

        return (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button onClick={() => yIdx > 0 && setChartOptions(o => ({ ...o, [pyKey]: allDatedYears[yIdx - 1] }))} disabled={yIdx <= 0} style={{ background: "none", border: "none", color: yIdx > 0 ? "#a78bfa" : "#2e2e4a", fontSize: 16, cursor: yIdx > 0 ? "pointer" : "default", padding: "0 6px" }}>‹</button>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: "#e2e0ff" }}>{pixelYear}</div>
              <button onClick={() => yIdx < allDatedYears.length - 1 && setChartOptions(o => ({ ...o, [pyKey]: allDatedYears[yIdx + 1] }))} disabled={yIdx >= allDatedYears.length - 1 || yIdx < 0} style={{ background: "none", border: "none", color: (yIdx >= 0 && yIdx < allDatedYears.length - 1) ? "#a78bfa" : "#2e2e4a", fontSize: 16, cursor: (yIdx >= 0 && yIdx < allDatedYears.length - 1) ? "pointer" : "default", padding: "0 6px" }}>›</button>
            </div>
            <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>
              {totalShowsThisYear} show{totalShowsThisYear !== 1 ? "s" : ""} · {daysWithShows} day{daysWithShows !== 1 ? "s" : ""} out {pixelYear === todayYearStr ? "so far" : "that year"}
            </div>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{ position: "relative", width: totalWeeks * (CELL + GAP), paddingLeft: 20 }}>
                {monthLabels.map(({ label, col }) => (
                  <div key={label} style={{ position: "absolute", left: 20 + col * (CELL + GAP), top: 0, fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{label[0]}</div>
                ))}
                <div style={{ display: "flex", gap: GAP, marginTop: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: GAP, marginRight: 2, flexShrink: 0, marginLeft: -20 }}>
                    {["", "M", "", "W", "", "F", ""].map((d, i) => (
                      <div key={i} style={{ width: 16, height: CELL, fontSize: 7, color: "#4a4870", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>{d}</div>
                    ))}
                  </div>
                  {cellsByWeek.map((week, wi) => (
                    <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                      {week.map((cell, di) => {
                        if (!cell) return <div key={di} style={{ width: CELL, height: CELL }} />;
                        const count = cell.shows.length;
                        const hasFest = cell.shows.some(c => c.type === "festival");
                        const intensity = count > 0 ? 0.25 + (count / maxDayCount) * 0.75 : 0;
                        const color = count === 0 ? "#0e0e1a" : hasFest ? `rgba(244,114,182,${intensity})` : `rgba(167,139,250,${intensity})`;
                        return (
                          <button key={di} onClick={() => count > 0 && onOpen(cell.shows[0])} title={count > 0 ? `${formatDate(cell.date)} — ${cell.shows.map(c => c.artist).join(', ')}` : formatDate(cell.date)}
                            style={{ width: CELL, height: CELL, borderRadius: 2, background: color, border: "none", padding: 0, cursor: count > 0 ? "pointer" : "default" }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>less</span>
              {[0, 0.3, 0.55, 0.8, 1].map(v => (
                <div key={v} style={{ width: CELL, height: CELL, borderRadius: 2, background: v === 0 ? "#0e0e1a" : `rgba(167,139,250,${v})` }} />
              ))}
              <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>more</span>
              <span style={{ width: CELL, height: CELL, borderRadius: 2, background: "rgba(244,114,182,0.85)", marginLeft: 10 }} />
              <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>festival</span>
            </div>
          </div>
        );
      }
      case "year-count": {
        const ycView = chartOpt("year-count", "bars");
        const sortedYears = Object.keys(yearCount).sort();
        const maxYC = Math.max(...Object.values(yearCount), 1);
        return (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"bars",label:"Bars"},{id:"line",label:"Line"}]} value={ycView} onChange={v => setChartOpt("year-count", v)} />
            {ycView === "bars" ? (
              Object.entries(yearCount).sort((a,b) => b[0].localeCompare(a[0])).map(([y, count]) => (
                <div key={y} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: "#c4c2f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", width: 36, flexShrink: 0 }}>{y}</span>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                    <div style={{ height: 4, borderRadius: 2, background: "#a78bfa", width: Math.max(16, (count / maxYC) * 80) }} />
                    <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 28, textAlign: "right" }}>{count}</span>
                  </div>
                </div>
              ))
            ) : (() => {
              const counts = sortedYears.map(y => yearCount[y]);
              const n = sortedYears.length;
              if (n < 2) return <div style={{ color: "#2e2e4a", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Need at least 2 years of data</div>;
              const pts = sortedYears.map((y, i) => `${(i / (n - 1)) * 274 + 3},${86 - (counts[i] / maxYC) * 76}`);
              const linePath = "M " + pts.join(" L ");
              return (
                <>
                  <svg width="100%" height={100} viewBox="0 0 280 92" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="ycGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2"/>
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d={linePath + ` L ${(n-1)/(n-1)*274+3},88 L 3,88 Z`} fill="url(#ycGrad)" />
                    <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {sortedYears.map((y, i) => (
                      <circle key={y} cx={(i / (n - 1)) * 274 + 3} cy={86 - (counts[i] / maxYC) * 76} r="3" fill="#a78bfa" />
                    ))}
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{sortedYears[0]}</span>
                    <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{sortedYears[sortedYears.length - 1]}</span>
                  </div>
                </>
              );
            })()}
          </div>
        );
      }
      case "year-spend": {
        const ysView = chartOpt("year-spend", "bars");
        const activeYearsYS = years.filter(y => yearSpend[y] > 0);
        const maxSpendYS = Math.max(...activeYearsYS.map(y => yearSpend[y]), 1);
        const thisYearFS = String(new Date().getFullYear());
        const thisYearPast = past.filter(c => getYear(c.date) === thisYearFS);
        const thisYearConcerts = thisYearPast.filter(c => c.type !== 'festival' && c.ticketPrice);
        const thisYearFestivals = thisYearPast.filter(c => c.type === 'festival' && c.ticketPrice);
        const avgTicketConcert = thisYearConcerts.length ? thisYearConcerts.reduce((s,c) => s + c.ticketPrice, 0) / thisYearConcerts.length : null;
        const avgTicketFestival = thisYearFestivals.length ? thisYearFestivals.reduce((s,c) => s + c.ticketPrice, 0) / thisYearFestivals.length : null;
        const costOf = c => (c.ticketPrice || 0) + (c.merch || []).reduce((ms, m) => ms + (parseFloat(m.price) || 0), 0) + extraCostTotal(c);
        // Upcoming spend per year (committed costs not yet past)
        const upcomingConcertSpend = {};
        const upcomingFestivalSpend = {};
        concerts.filter(c => !isWish(c) && !isPast(c.date) && c.ticketPrice && typeMatch(c)).forEach(c => {
          const y = getYear(c.date);
          const spend = (c.ticketPrice || 0) + (c.merch || []).reduce((s,m) => s + (parseFloat(m.price)||0), 0) + extraCostTotal(c);
          if (c.type === 'festival') upcomingFestivalSpend[y] = (upcomingFestivalSpend[y] || 0) + spend;
          else upcomingConcertSpend[y] = (upcomingConcertSpend[y] || 0) + spend;
        });
        const _nextYear = String(new Date().getFullYear() + 1);
        const _upcomingYearsAll = [...new Set([...Object.keys(upcomingConcertSpend), ...Object.keys(upcomingFestivalSpend)])];
        return (
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
          <ChartToggle options={[{id:"bars",label:"Bars"},{id:"line",label:"Line"}]} value={ysView} onChange={v => setChartOpt("year-spend", v)} />
          {ysView === "bars" && <>
          <div style={{ display: "flex", flexWrap: "nowrap", gap: 8, marginBottom: 14, overflowX: "auto" }}>
            {[
              { color: "#a78bfa", label: "Concerts", striped: false },
              { color: "#fb923c", label: "Festivals", striped: false },
              { color: "#38bdf8", label: "Other", striped: false },
              { color: "#34d399", label: "Merch", striped: false },
              { color: "#a78bfa", label: "Upcoming", striped: true },
            ].map(({ color, label, striped }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: striped ? `repeating-linear-gradient(45deg, ${color} 0px, ${color} 3px, ${color}33 3px, ${color}33 7px)` : color, border: striped ? `1px solid ${color}88` : "none" }} />
                <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
              </div>
            ))}
          </div>
          {(() => {
            const allUpcomingYears = _upcomingYearsAll.filter(y => y <= _nextYear);
            const activeYears = [...new Set([...years.filter(y => yearSpend[y] > 0), ...allUpcomingYears])].sort();
            const maxSpend = Math.max(
              ...activeYears.map(y => (yearSpend[y] || 0) + (upcomingConcertSpend[y] || 0) + (upcomingFestivalSpend[y] || 0)),
              1
            );
            const midSpend = Math.round(maxSpend / 2);
            const stripe = color => `repeating-linear-gradient(45deg, ${color} 0px, ${color} 3px, ${color}33 3px, ${color}33 7px)`;
            return (
              <>
                <div style={{ display: "flex", marginBottom: 4 }}>
                  <div style={{ width: 36, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>€0</span>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>€{Math.round(midSpend)}</span>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>€{Math.round(maxSpend)}</span>
                  </div>
                </div>
                {activeYears.map(y => {
                  const concerts_ = yearConcertSpend[y] || 0;
                  const festivals_ = yearFestivalSpend[y] || 0;
                  const other = yearOtherSpend[y] || 0;
                  const merch = yearMerchSpend[y] || 0;
                  const upConcerts = upcomingConcertSpend[y] || 0;
                  const upFestivals = upcomingFestivalSpend[y] || 0;
                  // Stacked bar: solid past + striped upcoming extension joined as one bar
                  const stackedBar = (past_, upcoming_, color, opacity = 1) => {
                    if (past_ === 0 && upcoming_ === 0) return null;
                    const totalVal = past_ + upcoming_;
                    const pastW = (past_ / maxSpend) * 100;
                    const upW = (upcoming_ / maxSpend) * 100;
                    const totalW = Math.max(2, (totalVal / maxSpend) * 100);
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: `${totalW}%`, height: 7, borderRadius: 3, overflow: "hidden", display: "flex", transition: "width 0.5s ease", flexShrink: 0 }}>
                          {past_ > 0 && <div style={{ width: `${(pastW / totalW) * 100}%`, height: "100%", background: color, opacity, flexShrink: 0 }} />}
                          {upcoming_ > 0 && <div style={{ flex: 1, height: "100%", background: stripe(color), flexShrink: 0 }} />}
                        </div>
                        <span style={{ fontSize: 10, color, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", opacity }}>
                          €{Math.round(past_)}{upcoming_ > 0 ? <span style={{ opacity: 0.5 }}> +€{Math.round(upcoming_)}</span> : null}
                        </span>
                      </div>
                    );
                  };
                  return (
                    <div key={y} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Sans', sans-serif", width: 36, flexShrink: 0 }}>{y}</span>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        {stackedBar(concerts_, upConcerts, "#a78bfa")}
                        {stackedBar(festivals_, upFestivals, "#fb923c")}
                        {other > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: `${Math.max(2, (other / maxSpend) * 100)}%`, height: 7, borderRadius: 3, background: "#38bdf8", opacity: 0.8, transition: "width 0.5s ease" }} />
                            <span style={{ fontSize: 10, color: "#38bdf8", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", opacity: 0.8 }}>€{Math.round(other)}</span>
                          </div>
                        )}
                        {merch > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: `${Math.max(2, (merch / maxSpend) * 100)}%`, height: 7, borderRadius: 3, background: "#34d399", opacity: 0.85, transition: "width 0.5s ease" }} />
                            <span style={{ fontSize: 10, color: "#34d399", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", opacity: 0.85 }}>€{Math.round(merch)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
          </>}
          {ysView === "line" && (() => {
            const n = activeYearsYS.length;
            if (n < 2) return <div style={{ color: "#2e2e4a", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Need at least 2 years of data</div>;
            const leftPad = 40;
            const chartW = 280;
            const totalW = leftPad + chartW;
            const xOf = i => leftPad + (i / (n - 1)) * (chartW - 6) + 3;
            const yTop = 8; const yBot = 86;
            const yOf = v => yBot - (v / maxSpendYS) * (yBot - yTop);
            const mid = maxSpendYS / 2;
            const concertPts = activeYearsYS.map((y, i) => ({ x: xOf(i), y: yOf(yearConcertSpend[y] || 0), v: yearConcertSpend[y] || 0 }));
            const festivalPts = activeYearsYS.map((y, i) => ({ x: xOf(i), y: yOf(yearFestivalSpend[y] || 0), v: yearFestivalSpend[y] || 0 }));
            const concertPath = "M " + concertPts.map(p => `${p.x},${p.y}`).join(" L ");
            const festivalPath = festivalPts.some(p => p.v > 0) ? "M " + festivalPts.map(p => `${p.x},${p.y}`).join(" L ") : null;
            const otherPts = activeYearsYS.map((y, i) => ({ x: xOf(i), y: yOf(yearOtherSpend[y] || 0), v: yearOtherSpend[y] || 0 }));
            const otherPath = otherPts.some(p => p.v > 0) ? "M " + otherPts.map(p => `${p.x},${p.y}`).join(" L ") : null;
            const merchPts = activeYearsYS.map((y, i) => ({ x: xOf(i), y: yOf(yearMerchSpend[y] || 0) }));
            const merchPath = "M " + merchPts.map(p => `${p.x},${p.y}`).join(" L ");
            return (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
                  {[
                    { color: "#a78bfa", label: "Concerts" },
                    ...(festivalPath ? [{ color: "#fb923c", label: "Festivals" }] : []),
                    ...(otherPath ? [{ color: "#38bdf8", label: "Other costs" }] : []),
                    { color: "#34d399", label: "Merch" },
                  ].map(({ color, label }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
                      <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
                    </div>
                  ))}
                </div>
                <svg width="100%" height={100} viewBox={`0 0 ${totalW} 92`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="ysGradC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity="0.15"/><stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/></linearGradient>
                    <linearGradient id="ysGradF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb923c" stopOpacity="0.15"/><stop offset="100%" stopColor="#fb923c" stopOpacity="0"/></linearGradient>
                  </defs>
                  {/* Gridlines */}
                  <line x1={leftPad} y1={yTop} x2={totalW} y2={yTop} stroke="#1f1f35" strokeWidth="1" />
                  <line x1={leftPad} y1={yOf(mid)} x2={totalW} y2={yOf(mid)} stroke="#1f1f35" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1={leftPad} y1={yBot} x2={totalW} y2={yBot} stroke="#1f1f35" strokeWidth="1" />
                  {/* Y axis labels */}
                  <text x={leftPad - 4} y={yTop + 3} textAnchor="end" fill="#4a4870" fontSize="7" fontFamily="monospace">€{Math.round(maxSpendYS)}</text>
                  <text x={leftPad - 4} y={yOf(mid) + 3} textAnchor="end" fill="#4a4870" fontSize="7" fontFamily="monospace">€{Math.round(mid)}</text>
                  <text x={leftPad - 4} y={yBot + 1} textAnchor="end" fill="#4a4870" fontSize="7" fontFamily="monospace">€0</text>
                  {/* Concert line */}
                  <path d={concertPath + ` L ${concertPts[n-1].x},${yBot} L ${concertPts[0].x},${yBot} Z`} fill="url(#ysGradC)" />
                  <path d={concertPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {concertPts.map((pt, i) => <circle key={activeYearsYS[i] + 'c'} cx={pt.x} cy={pt.y} r="3" fill="#a78bfa" />)}
                  {/* Festival line */}
                  {festivalPath && <path d={festivalPath + ` L ${festivalPts[n-1].x},${yBot} L ${festivalPts[0].x},${yBot} Z`} fill="url(#ysGradF)" />}
                  {festivalPath && <path d={festivalPath} fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {festivalPath && festivalPts.map((pt, i) => pt.v > 0 && <circle key={activeYearsYS[i] + 'f'} cx={pt.x} cy={pt.y} r="3" fill="#fb923c" />)}
                  {/* Other costs line */}
                  {otherPath && <path d={otherPath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {otherPath && otherPts.map((pt, i) => pt.v > 0 && <circle key={activeYearsYS[i] + 'o'} cx={pt.x} cy={pt.y} r="3" fill="#38bdf8" />)}
                  {/* Merch line */}
                  <path d={merchPath} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {merchPts.map((pt, i) => <circle key={activeYearsYS[i] + 'm'} cx={pt.x} cy={pt.y} r="3" fill="#34d399" />)}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingLeft: leftPad }}>
                  <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{activeYearsYS[0]}</span>
                  <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{activeYearsYS[activeYearsYS.length - 1]}</span>
                </div>
              </>
            );
          })()}
        </div>
        );
      }
      case "avg-ticket": return null;
      case "expensive": {
        const exView = chartOpt("expensive", "ticket");
        const exList = exView === "merch" ? topExpensiveIncMerch : topExpensive;
        const exMax = exView === "merch"
          ? (exList[0]?.totalCost || 1)
          : (exList[0]?.ticketPrice || 1);
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"ticket",label:"Ticket only"},{id:"merch",label:"Inc. merch"}]} value={exView} onChange={v => setChartOpt("expensive", v)} />
            {exList.map((c, i) => {
              const amount = exView === "merch" ? c.totalCost : c.ticketPrice;
              return (
                <button key={c.id} onClick={() => onOpen(c)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                  <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#c4c2f0", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.artist}</div>
                    <div style={{ color: "#4a4870", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{c.date.slice(0,4)} · {isOnline(c) ? formatOnlineLocation(c) : c.venue}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <div style={{ height: 4, borderRadius: 2, background: "#a78bfa", width: Math.max(12, (amount / exMax) * 50) }} />
                    <span style={{ color: "#a78bfa", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 50, textAlign: "right" }}>€{amount?.toFixed(0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        );
      }
      case "over-time": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          {(() => {
            const allSorted = [...concerts].filter(c => !isWish(c) && c.date && c.date.length === 10).sort((a, b) => a.date.localeCompare(b.date));
            if (allSorted.length < 2) return <div style={{ color: "#2e2e4a", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Not enough data yet</div>;
            const nowMs = Date.now();
            const W = 300, H = 96;
            const firstMs = new Date(allSorted[0].date + 'T00:00:00').getTime();
            const lastMs = new Date(allSorted[allSorted.length - 1].date + 'T00:00:00').getTime();
            const rangeMs = Math.max(lastMs - firstMs, 1);
            const todayMs = Math.min(nowMs, lastMs);
            const todayX = ((todayMs - firstMs) / rangeMs) * (W - 6) + 3;
            const n = allSorted.length;
            const xOf = c => ((new Date(c.date + 'T00:00:00').getTime() - firstMs) / rangeMs) * (W - 6) + 3;
            const yOf = i => H - 4 - ((i + 1) / n) * (H - 14);
            const cumPast = allSorted.filter(c => new Date(c.date + 'T00:00:00').getTime() <= nowMs);
            const cumUp = allSorted.filter(c => new Date(c.date + 'T00:00:00').getTime() > nowMs);
            const pastCoords = cumPast.map((c, i) => ({ x: xOf(c), y: yOf(i) }));
            const upCoords = cumUp.map((c, i) => ({ x: xOf(c), y: yOf(cumPast.length + i) }));
            const todayY = pastCoords.length > 0 ? pastCoords[pastCoords.length - 1].y : yOf(-1);
            const pastPath = pastCoords.length > 1 ? "M " + pastCoords.map(p => `${p.x},${p.y}`).join(" L ") : null;
            const upPath = upCoords.length > 0 ? `M ${todayX},${todayY} L ` + upCoords.map(p => `${p.x},${p.y}`).join(" L ") : null;
            const areaPath = pastCoords.length > 1 ? pastPath + ` L ${todayX},${H} L ${pastCoords[0].x},${H} Z` : null;
            return (<>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 120, paddingTop: 2, paddingBottom: 6 }}>
                  <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{n}</span>
                  <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{Math.round(n / 2)}</span>
                  <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>0</span>
                </div>
                <svg style={{ flex: 1 }} height={120} viewBox={`0 0 ${W} ${H + 4}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  {areaPath && <path d={areaPath} fill="url(#lineGrad)" />}
                  {pastPath && <path d={pastPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {upPath && <path d={upPath} fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />}
                  <line x1={todayX} y1={0} x2={todayX} y2={H} stroke="#2e2e50" strokeWidth="1" />
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{allSorted[0].date.slice(0,7)}</span>
                <span style={{ fontSize: 10, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>{cumPast.length} past · {cumUp.length} upcoming</span>
                <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{allSorted[allSorted.length-1].date.slice(0,7)}</span>
              </div>
            </>);
          })()}
        </div>
      );
      case "months": {
        const mView = chartOpt("months", "bars");
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"bars",label:"Bars"},{id:"heatmap",label:"Heatmap"}]} value={mView} onChange={v => setChartOpt("months", v)} />
            {mView === "bars" ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginBottom: 6 }}>
                  {monthNames.map((name, i) => {
                    const count = monthCount[i] || 0;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ fontSize: 9, color: count > 0 ? "#a78bfa" : "transparent", fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>{count || ""}</div>
                        <div style={{ width: "100%", background: count > 0 ? "#a78bfa" : "#0e0e1a", borderRadius: "2px 2px 0 0", height: `${Math.max(3, (count / Math.max(maxMonth, 1)) * 60)}px` }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {monthNames.map((name, i) => (
                    <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{name[0]}</div>
                  ))}
                </div>
              </>
            ) : (() => {
              const hmYears = Object.keys(yearMonthCount).sort();
              const hmMax = Math.max(...hmYears.flatMap(y => Array.from({length:12}, (_,m) => yearMonthCount[y]?.[m] || 0)), 1);
              return (
                <>
                  <div style={{ display: "flex", marginLeft: 30 }}>
                    {monthNames.map((name, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{name[0]}</div>
                    ))}
                  </div>
                  {hmYears.map(y => (
                    <div key={y} style={{ display: "flex", alignItems: "center", marginTop: 3 }}>
                      <span style={{ width: 30, fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{y}</span>
                      {Array.from({length: 12}, (_, m) => {
                        const count = yearMonthCount[y]?.[m] || 0;
                        const intensity = count / hmMax;
                        return (
                          <div key={m} style={{
                            flex: 1, aspectRatio: "1", borderRadius: 2, margin: "0 1px",
                            background: count > 0 ? `rgba(167,139,250,${0.15 + intensity * 0.85})` : "#0e0e1a",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {count > 0 && <span style={{ fontSize: 7, color: intensity > 0.55 ? "#0c0c14" : "#a78bfa", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{count}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        );
      }
      case "friends-chart": return null; // merged into solo card below
      case "solo": {
        const groupSizeLabels = ["0","1","2","3","4","5","6+"];
        const groupSizeColors = ["#6b6a8f","#a78bfa","#818cf8","#60a5fa","#34d399","#fbbf24","#f472b6"];
        const gsLegendLabels = groupSizeLabels.map(k => k === "0" ? "Solo" : k === "1" ? "1 friend" : k === "6+" ? "6+ friends" : `${k} friends`);
        const allGs = groupSizeLabels.map((k, i) => ({ label: gsLegendLabels[i], count: groupSizeDist[k] || 0, color: groupSizeColors[i] })).filter(x => x.count > 0).sort((a,b) => b.count - a.count);
        const top4Gs = allGs.slice(0, 4);
        const othersGs = allGs.slice(4).reduce((s, x) => s + x.count, 0);
        const soloDonut = (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Donut showLabels segments={[{ value: withFriends.length, color: "#a78bfa" }, { value: solo.length, color: "#6b6a8f" }]} size={80} centerText={[String(past.length), "shows"]} />
              <div style={{ flex: 1 }}>
                {[{ label: `With friends`, value: withFriends.length, color: "#a78bfa" }, { label: `Solo`, value: solo.length, color: "#6b6a8f" }].map(s => (
                  <div key={s.label} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: s.color, flexShrink: 0 }} />
                      <span style={{ color: "#c4c2f0", fontSize: 12 }}>{s.label}</span>
                    </div>
                    <div style={{ marginLeft: 11, height: 4, background: "#0e0e1a", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: s.color, width: `${past.length ? (s.value / past.length) * 100 : 0}%` }} />
                    </div>
                    <div style={{ marginLeft: 11, fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{s.value} · {past.length ? Math.round(s.value / past.length * 100) : 0}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        const groupSizeCard = (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Donut showLabels size={80} centerText={["Group", "size"]} segments={[
                ...top4Gs.map(x => ({ value: x.count, color: x.color })),
                ...(othersGs > 0 ? [{ value: othersGs, color: "#4a4870" }] : [])
              ]} />
              <div style={{ flex: 1 }}>
                {[...top4Gs, ...(othersGs > 0 ? [{ label: "Others", color: "#4a4870", count: othersGs }] : [])].map(x => (
                  <div key={x.label} style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: x.color, flexShrink: 0 }} />
                      <span style={{ color: x.label === "Others" ? "#4a4870" : "#c4c2f0", fontSize: 11 }}>{x.label}</span>
                    </div>
                    <div style={{ marginLeft: 11, height: 4, background: "#0e0e1a", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: x.color, width: `${past.length ? (x.count / past.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        const mostShowsWith = topFriends.length > 0 ? (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Most shows with</div>
            {topFriends.map(([name, count], i) => (
              <button key={name} onClick={() => { setStatsTab("friends"); }} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                <span style={{ fontSize: 9, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18 }}>#{i+1}</span>
                <span style={{ color: "#c4c2f0", fontSize: 12, flex: 1 }}>{name}</span>
                <div style={{ width: 80, height: 4, background: "#0e0e1a", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: "#a78bfa", width: `${(count / (topFriends[0]?.[1] || 1)) * 100}%` }} />
                </div>
                <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace", width: 28, textAlign: "right" }}>{count}x</span>
              </button>
            ))}
          </div>
        ) : null;
        const soloSections = [
          { id: "solo-donut", label: "Solo vs friends", content: soloDonut },
          { id: "group-size", label: "Group size", content: groupSizeCard },
          ...(topFriends.length > 0 ? [{ id: "most-with", label: "Most shows with", content: mostShowsWith }] : []),
        ];
        return <SectionReorder chartId="solo" sections={soloSections} />;
      }
      case "venue-size": return null; // merged into venues below
      case "countries": return null; // merged into venues below
      case "venues": {
        const vView = chartOpt("venues", "venue");
        const vItems = vView === "room" ? topVenuesByRoom : topVenues;
        const top4VS = venueEntries.slice(0, 4);
        const othersVS = venueEntries.slice(4).reduce((s,[,n])=>s+n,0);
        const maxCountry = Math.max(...Object.values(countryCount), 1);
        const venueListCard = (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Favourite venues</div>
            <ChartToggle options={[{id:"venue",label:"By venue"},{id:"room",label:"By room"}]} value={vView} onChange={v => setChartOpt("venues", v)} />
            {vItems.map(([name, count], i) => (
              <button key={name} onClick={() => onNavigate({ view: 'venues' })} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                <span style={{ fontSize: 9, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
                <span style={{ color: "#c4c2f0", fontSize: 12, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                <div style={{ width: 60, height: 4, background: "#0e0e1a", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: "#a78bfa", width: `${(count / (vItems[0]?.[1] || 1)) * 100}%` }} />
                </div>
                <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace", width: 24, textAlign: "right", flexShrink: 0 }}>{count}x</span>
              </button>
            ))}
          </div>
        );
        const venueSizeCard = venueEntries.length > 0 ? (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Donut showLabels size={80} centerText={["Venue", "size"]} segments={[
                ...top4VS.map(([name, n], i) => ({ value: n, color: VENUE_COLORS[i] })),
                ...(othersVS > 0 ? [{ value: othersVS, color: "#4a4870" }] : [])
              ]} />
              <div style={{ flex: 1 }}>
                {[...top4VS, ...(othersVS > 0 ? [["Others", othersVS]] : [])].map(([name, count], i) => (
                  <div key={name} style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: i < 4 ? VENUE_COLORS[i] : "#4a4870", flexShrink: 0 }} />
                      <span style={{ color: name === "Others" ? "#4a4870" : "#c4c2f0", fontSize: 11 }}>{name}</span>
                    </div>
                    <div style={{ marginLeft: 11, height: 4, background: "#0e0e1a", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: i < 4 ? VENUE_COLORS[i] : "#4a4870", width: `${(count / (venueEntries[0]?.[1] || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null;
        const countriesCard = Object.keys(countryCount).length > 0 ? (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
            <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Countries</div>
            {Object.entries(countryCount).sort((a,b)=>b[1]-a[1]).map(([country, count]) => (
              <div key={country} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Sans', sans-serif", width: 90, flexShrink: 0 }}>{country}</span>
                <div style={{ flex: 1, height: 4, background: "#0e0e1a", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: "#38bdf8", width: `${(count / maxCountry) * 100}%` }} />
                </div>
                <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace", width: 20, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        ) : null;
        const venueSections = [
          { id: "venue-list", label: "Favourite venues", content: venueListCard },
          ...(venueEntries.length > 0 ? [{ id: "venue-size", label: "Venue size", content: venueSizeCard }] : []),
          ...(Object.keys(countryCount).length > 0 ? [{ id: "countries", label: "Countries", content: countriesCard }] : []),
        ];
        return <SectionReorder chartId="venues" sections={venueSections} />;
      }
      case "ratings": return null; // merged into genres-pie
      case "artists": {
        // Extra stats
        const mostSeenA = topArtists[0];
        const withUpcomingA = [...new Set(concerts.filter(c => !isWish(c) && !isPast(c.date)).map(c => c.artist))].length;
        const thisYearA = String(new Date().getFullYear());
        const newThisYearA = Object.entries(
          past.reduce((m, c) => { if (!m[c.artist]) m[c.artist] = c.date; else if (c.date < m[c.artist]) m[c.artist] = c.date; return m; }, {})
        ).filter(([, d]) => d.startsWith(thisYearA)).length;
        const supportDiscoveredA = [...new Set(past.flatMap(c => (c.support||[]).map(s => getSupportName(s)).filter(Boolean)))]
          .filter(n => !past.some(c => c.artist === n)).length;
        const headlinerOnlyA = topArtists.filter(([name]) =>
          !past.some(c => (c.support||[]).some(s => getSupportName(s) === name))
        ).length;
        const longestGapA = topArtists.map(([name]) => {
          const last = past.filter(c => c.artist === name).sort((a,b) => b.date.localeCompare(a.date))[0];
          if (!last) return null;
          const months = Math.floor((Date.now() - new Date(last.date + 'T00:00:00').getTime()) / (1000*60*60*24*30));
          return { name, months };
        }).filter(Boolean).filter(a => a.months > 6).sort((a,b) => b.months - a.months)[0];
        const [showMoreStats, setShowMoreStats] = [showMoreArtistStats, setShowMoreArtistStats];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Callout lines */}
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 10, padding: "10px 12px" }}>
              {mostSeenA && (mostSeenA[1].headliner + mostSeenA[1].support + (mostSeenA[1].festival||0)) > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: withUpcomingA > 0 ? 6 : 0, marginBottom: withUpcomingA > 0 ? 6 : 0, borderBottom: withUpcomingA > 0 ? "1px solid #1a1a2e" : "none" }}>
                  <span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>most seen</span>
                  <span style={{ fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                    {mostSeenA[0]} <span style={{ color: "#a78bfa" }}>{mostSeenA[1].headliner + mostSeenA[1].support + (mostSeenA[1].festival||0)}×</span>
                  </span>
                </div>
              )}
              {withUpcomingA > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>with upcoming shows</span>
                  <span style={{ fontSize: 12, color: "#34d399", fontFamily: "'DM Mono', monospace" }}>{withUpcomingA} artist{withUpcomingA !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
            {/* Collapsible */}
            <div>
              <button onClick={() => setShowMoreStats(o => !o)} style={{ width: "100%", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0 4px", cursor: "pointer" }}>
                <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>more stats</span>
                <span style={{ fontSize: 11, color: "#4a4870" }}>{showMoreStats ? "▴" : "▾"}</span>
              </button>
              {showMoreStats && (
                <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 10, padding: "10px 12px" }}>
                  {[
                    newThisYearA > 0 && ["new this year", `${newThisYearA} artist${newThisYearA !== 1 ? "s" : ""}`],
                    supportDiscoveredA > 0 && ["discovered as support", `${supportDiscoveredA} artist${supportDiscoveredA !== 1 ? "s" : ""}`],
                    headlinerOnlyA > 0 && ["headliner only", `${headlinerOnlyA} artist${headlinerOnlyA !== 1 ? "s" : ""}`],
                    longestGapA && ["longest gap", `${longestGapA.name} · ${longestGapA.months < 12 ? `${longestGapA.months}m` : `${Math.floor(longestGapA.months/12)}y`} ago`],
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #16162a" }}>
                      <span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{label}</span>
                      <span style={{ fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif" }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "merch-breakdown": return null; // merged into merch-overview below
      case "merch-overview": {
        const moView = chartOpt("merch-overview", "price");
        const mbView = chartOpt("merch-breakdown", "types");
        const noMerch = topMerchTypes.length === 0 && topArtistMerch.length === 0;
        return (
          <div>
            {/* Summary tiles */}
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "total spent", value: `€${totalMerchSpend.toFixed(0)}`, color: "#f472b6" },
                  { label: "items bought", value: allMerchItems.length, color: "#a78bfa" },
                  { label: "shows w. merch", value: past.filter(c => c.merch?.length > 0).length, color: "#38bdf8" },
                ].map(b => (
                  <div key={b.label} style={{ background: "#0c0c14", borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 700, color: b.color, lineHeight: 1 }}>{b.value}</div>
                    <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>{b.label}</div>
                  </div>
                ))}
              </div>
              {(topMerchItems.length > 0 || topMerchTypes.length > 0) && <>
                <ChartToggle options={[{id:"price",label:"Top 3 by price"},{id:"count",label:"Top 3 by count"}]} value={moView} onChange={v => setChartOpt("merch-overview", v)} />
                {moView === "price"
                  ? topMerchItems.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#e2e0ff" }}>{m.item}</div>
                        <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{m.artist}</div>
                      </div>
                      <span style={{ color: "#f472b6", fontSize: 13, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>€{parseFloat(m.price).toFixed(2)}</span>
                    </div>
                  ))
                  : topMerchTypes.slice(0, 3).map(([type, count], i) => (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
                      <span style={{ fontSize: 13, color: "#e2e0ff", flex: 1, textTransform: "capitalize" }}>{type}</span>
                      <span style={{ color: "#a78bfa", fontSize: 13, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{count}x</span>
                    </div>
                  ))
                }
              </>}
            </div>
            {/* Breakdown */}
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Breakdown</div>
              <ChartToggle options={[{id:"types",label:"By type"},{id:"artists",label:"By artist"}]} value={mbView} onChange={v => setChartOpt("merch-breakdown", v)} />
              {noMerch
                ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Log merch on a show to see this</div>
                : mbView === "types"
                  ? topMerchTypes.map(([type, count], i) => (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
                      <span style={{ color: "#c4c2f0", fontSize: 12, flex: 1, textTransform: "capitalize" }}>{type}</span>
                      <div style={{ width: 60, height: 4, background: "#0e0e1a", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                        <div style={{ height: "100%", borderRadius: 2, background: "#a78bfa", width: `${(count / topMerchTypes[0][1]) * 100}%` }} />
                      </div>
                      <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace", width: 24, textAlign: "right", flexShrink: 0 }}>{count}x</span>
                    </div>
                  ))
                  : topArtistMerch.map(([artist, spend], i) => (
                    <div key={artist} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
                      <span style={{ color: "#c4c2f0", fontSize: 12, flex: 1 }}>{artist}</span>
                      <div style={{ width: 60, height: 4, background: "#0e0e1a", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                        <div style={{ height: "100%", borderRadius: 2, background: "#f472b6", width: `${(spend / topArtistMerch[0][1]) * 100}%` }} />
                      </div>
                      <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace", width: 40, textAlign: "right", flexShrink: 0 }}>€{spend.toFixed(0)}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        );
      }
      case "genres": {
        const glView = chartOpt("genres", "main");
        const glItems = glView === "sub" ? topSubgenres : topGenres;
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"main",label:"Main"},{id:"sub",label:"Subgenre"}]} value={glView} onChange={v => setChartOpt("genres", v)} />
            {glItems.length === 0
              ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Tag shows with {glView === "sub" ? "subgenres" : "genres"} to see this</div>
              : <ListStat title="" items={glItems} suffix="x" />
            }
          </div>
        );
      }
      case "genres-pie": {
        const gpView = chartOpt("gp-view", "pie");
        const top4G = topGenres.slice(0, 4);
        const othersG = topGenres.slice(4).reduce((s, [,n]) => s + n, 0);
        const top4S = topSubgenres.slice(0, 4);
        const othersS = topSubgenres.slice(4).reduce((s, [,n]) => s + n, 0);

        const maxRatingDist = Math.max(...Object.values(ratingDist), 1);
        const rView = chartOpt("ratings", "dist");
        const ratingYears = Object.keys(ratingByYear).sort();

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Two donuts side by side */}
            <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <ChartToggle options={[{id:"pie",label:"Pie"},{id:"list",label:"List"}]} value={gpView} onChange={v => setChartOpt("gp-view", v)} />
              </div>
              {gpView === "list" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[{ label: "Genres", items: topGenres }, { label: "Subgenres", items: topSubgenres }].map(({ label, items }) => (
                    <div key={label}>
                      <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</div>
                      {items.length === 0
                        ? <div style={{ color: "#2e2e4a", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>none</div>
                        : items.slice(0, 5).map(([name, count]) => (
                            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 11, color: "#c4c2f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 6 }}>{name}</span>
                              <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{count}x</span>
                            </div>
                          ))
                      }
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "start" }}>
                  {[
                    { title: "Genres", top4: top4G, others: othersG, source: topGenres, centerText: [String(topGenres.length), "genres"], colors: GENRE_COLORS },
                    { title: "Subgenres", top4: top4S, others: othersS, source: topSubgenres, centerText: [String(topSubgenres.length), "sub", "genres"], colors: GENRE_COLORS_PASTEL },
                  ].map(({ title, top4, others, source, centerText, colors }) => (
                    <div key={title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      {source.length === 0
                        ? <div style={{ color: "#2e2e4a", fontSize: 10, fontFamily: "'DM Mono', monospace", textAlign: "center" }}>none tagged</div>
                        : <>
                          <Donut size={80} showLabels centerText={centerText} segments={[
                            ...top4.map(([, n], i) => ({ value: n, color: colors[i] })),
                            ...(others > 0 ? [{ value: others, color: "#4a4870" }] : []),
                          ]} />
                          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "2px 8px" }}>
                            {[...top4, ...(others > 0 ? [["Others", others]] : [])].map(([name], i) => (
                              <div key={name} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <div style={{ width: 5, height: 5, borderRadius: 1, background: i < 4 ? colors[i] : "#4a4870", flexShrink: 0 }} />
                                <span style={{ color: name === "Others" ? "#4a4870" : "#c4c2f0", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ratings below */}
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ratings · {rated.length} shows</div>
                {rated.length > 0 && <ChartToggle options={[{id:"dist",label:"Dist"},{id:"year",label:"Year"}]} value={rView} onChange={v => setChartOpt("ratings", v)} />}
              </div>
              {rated.length === 0
                ? <div style={{ color: "#2e2e4a", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>Rate shows by opening one and tapping the stars</div>
                : rView === "dist" ? (
                  <>
                    {[5,4,3,2,1].map(n => (
                      <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ color: "#a78bfa", fontSize: 10, width: 50, flexShrink: 0, letterSpacing: "-1px" }}>{"★".repeat(n)}</span>
                        <div style={{ flex: 1, height: 6, background: "#0e0e1a", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: "#a78bfa", width: `${(ratingDist[n] / maxRatingDist) * 100}%` }} />
                        </div>
                        <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace", width: 20, textAlign: "right" }}>{ratingDist[n]}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #1f1f35", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>average</span>
                      <span style={{ color: "#a78bfa", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{avgRating} ★</span>
                    </div>
                  </>
                ) : (
                  ratingYears.map(y => (
                    <div key={y} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ color: "#6b6a8f", fontSize: 10, fontFamily: "'DM Mono', monospace", width: 32, flexShrink: 0 }}>{y}</span>
                      <div style={{ flex: 1, height: 6, background: "#0e0e1a", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, background: "#a78bfa", width: `${((ratingByYear[y].sum / ratingByYear[y].count) / 5) * 100}%` }} />
                      </div>
                      <span style={{ color: "#a78bfa", fontSize: 10, fontFamily: "'DM Mono', monospace", width: 28, textAlign: "right" }}>{(ratingByYear[y].sum / ratingByYear[y].count).toFixed(1)} ★</span>
                    </div>
                  ))
                )
              }
            </div>
          </div>
        );
      }
      case "language": {
        const languageCount = {};
        past.forEach(c => {
          const langs = Array.isArray(c.language) ? c.language : c.language ? [c.language] : [];
          langs.forEach(l => { if (l) languageCount[l] = (languageCount[l] || 0) + 1; });
        });
        const languageEntries = Object.entries(languageCount).sort((a,b) => b[1]-a[1]);
        const langView = chartOpt("language", "list");
        const top4Lang = languageEntries.slice(0, 4);
        const langOthers = languageEntries.slice(4).reduce((s,[,n]) => s+n, 0);
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            {languageEntries.length === 0
              ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Tag shows with a language to see this</div>
              : <>
                  <ChartToggle options={[{id:"list",label:"List"},{id:"pie",label:"Pie"}]} value={langView} onChange={v => setChartOpt("language", v)} />
                  {langView === "list"
                    ? <ListStat title="" items={languageEntries} suffix="x" />
                    : <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Donut showLabels size={110} centerText="Language" segments={[
                          ...top4Lang.map(([,n],i) => ({ value: n, color: GENRE_COLORS[i] })),
                          ...(langOthers > 0 ? [{ value: langOthers, color: "#4a4870" }] : [])
                        ]} />
                        <div style={{ flex: 1 }}>
                          {[...top4Lang, ...(langOthers > 0 ? [["Others", langOthers]] : [])].map(([name], i) => (
                            <div key={name} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 1, background: i < 4 ? GENRE_COLORS[i] : "#4a4870", flexShrink: 0 }} />
                              <span style={{ color: name === "Others" ? "#4a4870" : "#c4c2f0", fontSize: 11 }}>{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                  }
                </>
            }
          </div>
        );
      }
      case "songs": {
        if (topSongs.length === 0) return (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>No setlist data yet</div>
            <div style={{ fontSize: 11, color: "#2e2e50", fontFamily: "'DM Mono', monospace" }}>Add songs when logging a show to see them here</div>
          </div>
        );
        const medals = ["🥇","🥈","🥉"];
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            {topSongs.length === 0
              ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Log setlists on your shows to see this</div>
              : topSongs.map(({ name: song, artist, count }, i) => (
                <button key={`${song}\u0000${artist}`} onClick={() => setSelectedSong({ name: song, artist })} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: i < 3 ? 14 : 10, width: 20, textAlign: "center", flexShrink: 0, color: "#2e2e50", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                      {i < 3 ? medals[i] : `#${i+1}`}
                    </span>
                    <span style={{ color: "#c4c2f0", fontSize: 13 }}>{song}<br/><span style={{ color: "#6b6a8f", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{artist}</span></span>
                  </div>
                  <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{count}×</span>
                </button>
              ))
            }
          </div>
        );
      }
      case "covers": {
        if (coversList.length === 0) return (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>No covers logged yet</div>
            <div style={{ fontSize: 11, color: "#2e2e50", fontFamily: "'DM Mono', monospace" }}>Mark songs as covers when adding setlists</div>
          </div>
        );
        const byOriginal = {};
        coversList.forEach(cv => { const k = cv.original || "unknown original"; byOriginal[k] = (byOriginal[k] || 0) + 1; });
        const topOriginals = Object.entries(byOriginal).sort((a,b) => b[1]-a[1]).slice(0, 5);
        const sorted = [...coversList].sort((a,b) => b.concert.date.localeCompare(a.concert.date));
        return (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
            <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Most covered artists</div>
            {topOriginals.map(([name, count], i) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18 }}>#{i+1}</span>
                  <span style={{ color: "#c4c2f0", fontSize: 12 }}>{name}</span>
                </div>
                <span style={{ color: "#fb923c", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{count}×</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px", paddingTop: 12, borderTop: "1px solid #1f1f35" }}>All covers witnessed · {coversList.length}</div>
            {(() => {
              const byArtist = {};
              sorted.forEach(cv => { const k = cv.original || '—'; if (!byArtist[k]) byArtist[k] = []; byArtist[k].push(cv); });
              const groups = Object.entries(byArtist).sort((a,b) => b[1].length - a[1].length);
              return groups.map(([artist, covers]) => (
                <div key={artist} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#fb923c", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>↩ {artist}</span>
                    <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{covers.length}×</span>
                  </div>
                  {covers.map((cv, i) => (
                    <button key={`${cv.concert.id}-${cv.name}-${i}`} onClick={() => onOpen(cv.concert)} style={{ display: "flex", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "4px 0 4px 12px", borderBottom: i < covers.length - 1 ? "1px solid #16162a" : "none", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ color: "#c4c2f0", fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cv.name}</div>
                      <div style={{ color: "#6b6a8f", fontSize: 10, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{cv.performer} · {cv.concert.date.slice(0,4)}</div>
                    </button>
                  ))}
                </div>
              ));
            })()}
          </div>
        );
      }
      case "venue-loyalty": {
        const topV = topVenues[0];
        const pct = topV && past.length ? Math.round((topV[1] / past.length) * 100) : 0;
        const firstSeen = {};
        [...past].sort((a,b) => a.date.localeCompare(b.date)).forEach(c => { if (c.venue && !firstSeen[c.venue]) firstSeen[c.venue] = c.date.slice(0,4); });
        const newPerYear = {};
        Object.values(firstSeen).forEach(y => { newPerYear[y] = (newPerYear[y] || 0) + 1; });
        const yearsDesc = Object.keys(newPerYear).sort((a,b) => b.localeCompare(a));
        const maxNew = Math.max(...Object.values(newPerYear), 1);
        return (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
            {topV && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 24, fontWeight: 700, color: "#a78bfa", lineHeight: 1 }}>{pct}%</div>
                <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>of your shows were at <span style={{ color: "#c4c2f0" }}>{topV[0]}</span> ({topV[1]}×)</div>
              </div>
            )}
            <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>New venues discovered per year</div>
            {yearsDesc.map(y => (
              <div key={y} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ color: "#c4c2f0", fontSize: 12, width: 36, flexShrink: 0 }}>{y}</span>
                <div style={{ height: 4, borderRadius: 2, background: "#38bdf8", width: Math.max(8, (newPerYear[y] / maxNew) * 110) }} />
                <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{newPerYear[y]}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 10 }}>{Object.keys(firstSeen).length} venues visited in total</div>
          </div>
        );
      }
      case "averages": {
        const cs = past.filter(c => c.type === "concert");
        const fs = past.filter(c => c.type === "festival");
        const avg = (arr, f) => { const v = arr.map(f).filter(x => x > 0); return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null; };
        const med = (arr, f) => { const v = arr.map(f).filter(x => x > 0).sort((a,b)=>a-b); return v.length ? v[Math.floor(v.length/2)] : null; };
        const merchOf = c => (c.merch || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
        const totalOf = c => (c.ticketPrice || 0) + merchOf(c) + extraCostTotal(c);
        const avgTotalAll = avg(past, totalOf);
        const avgTotalC = avg(cs, totalOf);
        const avgTotalF = avg(fs, totalOf);
        const avgTicketC = avg(cs, c => c.ticketPrice || 0);
        const avgTicketF = avg(fs, c => c.ticketPrice || 0);
        const medTicketC = med(cs, c => c.ticketPrice || 0);
        const avgMerchC = avg(cs.filter(c => merchOf(c) > 0), merchOf);
        const avgMerchF = avg(fs.filter(c => merchOf(c) > 0), merchOf);
        const avgOtherC = avg(cs.filter(c => extraCostTotal(c) > 0), c => extraCostTotal(c));
        const avgOtherF = avg(fs.filter(c => extraCostTotal(c) > 0), c => extraCostTotal(c));
        const withMerchPct = past.length ? Math.round((past.filter(c => merchOf(c) > 0).length / past.length) * 100) : 0;
        // Ticket price trend years
        const ticketTrendYears = Object.keys(yearTicketCount).sort().slice(-6);
        const ticketTrendAvgs = ticketTrendYears.map(y => yearTicketSum[y] / yearTicketCount[y]);
        const ticketMax = Math.max(...ticketTrendAvgs, 1);
        const ticketMin = Math.min(...ticketTrendAvgs.filter(x => x > 0));
        // Most expensive month on average
        const monthSpend = {}; const monthCount2 = {};
        past.filter(c => c.ticketPrice).forEach(c => {
          const m = parseInt(c.date.slice(5,7)) - 1;
          monthSpend[m] = (monthSpend[m] || 0) + c.ticketPrice;
          monthCount2[m] = (monthCount2[m] || 0) + 1;
        });
        const monthAvgs = Object.entries(monthSpend).map(([m, s]) => [parseInt(m), s / monthCount2[m]]);
        const priceyMonth = monthAvgs.sort((a,b) => b[1]-a[1])[0];
        const monthNames2 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const maxComparison = Math.max(avgTotalC || 0, avgTotalF || 0, 1);
        const StatLabel = ({ children }) => (
          <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{children}</div>
        );
        const Row = ({ label, value, sub }) => value == null ? null : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #16162a" }}>
            <span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{label}</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Mono', monospace" }}>€{value.toFixed(0)}</span>
              {sub != null && <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginLeft: 6 }}>median €{sub.toFixed(0)}</span>}
            </div>
          </div>
        );
        const avgSections = [
          avgTotalAll != null && { id: "avg-hero", label: "Avg cost per show", content: (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "16px 14px" }}>
              <StatLabel>avg cost per show · all</StatLabel>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>€{avgTotalAll.toFixed(0)}</div>
              <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>ticket · merch · other combined · {past.filter(c => totalOf(c) > 0).length} shows logged</div>
            </div>
          )},
          (avgTotalC != null || avgTotalF != null) && { id: "avg-comparison", label: "Concerts vs festivals", content: (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
              <StatLabel>avg total cost · concerts vs festivals</StatLabel>
              {avgTotalC != null && (<div style={{ marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>concerts</span><span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>€{avgTotalC.toFixed(0)}</span></div><div style={{ height: 7, background: "#0e0e1a", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", background: "#a78bfa", borderRadius: 3, width: `${(avgTotalC / maxComparison) * 100}%` }} /></div></div>)}
              {avgTotalF != null && (<div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 11, color: "#fb923c", fontFamily: "'DM Mono', monospace" }}>festivals</span><span style={{ fontSize: 11, color: "#fb923c", fontFamily: "'DM Mono', monospace" }}>€{avgTotalF.toFixed(0)}</span></div><div style={{ height: 7, background: "#0e0e1a", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", background: "#fb923c", borderRadius: 3, width: `${(avgTotalF / maxComparison) * 100}%` }} /></div></div>)}
            </div>
          )},
          ticketTrendYears.length >= 2 && { id: "avg-trend", label: "Ticket price trend", content: (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
              <StatLabel>avg ticket price per year</StatLabel>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48, marginBottom: 6 }}>
                {ticketTrendYears.map((y, i) => { const v = ticketTrendAvgs[i]; const h = Math.max(4, (v / ticketMax) * 44); const isLast = i === ticketTrendYears.length - 1; return (<div key={y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 2 }}><span style={{ fontSize: 8, color: isLast ? "#a78bfa" : "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>€{Math.round(v)}</span><div style={{ width: "100%", height: h, background: isLast ? "#a78bfa" : "#2e2e50", borderRadius: "2px 2px 0 0" }} /></div>); })}
              </div>
              <div style={{ display: "flex", gap: 4 }}>{ticketTrendYears.map(y => (<div key={y} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{y.slice(2)}</div>))}</div>
              {medTicketC != null && avgTicketC != null && (<div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 8 }}>all-time avg <span style={{ color: "#c4c2f0" }}>€{avgTicketC.toFixed(0)}</span> · median <span style={{ color: "#c4c2f0" }}>€{medTicketC.toFixed(0)}</span></div>)}
            </div>
          )},
          (cs.length > 0 && (avgTicketC || avgMerchC || avgOtherC)) && { id: "avg-concerts", label: "Concerts breakdown", content: (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
              <StatLabel>concerts · breakdown</StatLabel>
              <Row label="avg ticket" value={avgTicketC} sub={medTicketC} />
              <Row label={`avg merch (${cs.filter(c=>merchOf(c)>0).length} shows)`} value={avgMerchC} />
              <Row label={`avg other (${cs.filter(c=>extraCostTotal(c)>0).length} shows)`} value={avgOtherC} />
            </div>
          )},
          (fs.length > 0 && (avgTicketF || avgMerchF || avgOtherF)) && { id: "avg-festivals", label: "Festivals breakdown", content: (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
              <StatLabel>festivals · breakdown</StatLabel>
              <Row label="avg ticket" value={avgTicketF} />
              <Row label={`avg merch (${fs.filter(c=>merchOf(c)>0).length} shows)`} value={avgMerchF} />
              <Row label={`avg travel & other (${fs.filter(c=>extraCostTotal(c)>0).length} shows)`} value={avgOtherF} />
            </div>
          )},
          (withMerchPct > 0 || priceyMonth) && { id: "avg-patterns", label: "Patterns", content: (
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
              <StatLabel>patterns</StatLabel>
              {withMerchPct > 0 && (<div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #16162a" }}><span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>shows where you bought merch</span><span style={{ fontSize: 12, color: "#34d399", fontFamily: "'DM Mono', monospace" }}>{withMerchPct}%</span></div>)}
              {priceyMonth && (<div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>priciest month on avg</span><span style={{ fontSize: 12, color: "#fbbf24", fontFamily: "'DM Mono', monospace" }}>{monthNames2[priceyMonth[0]]} · €{priceyMonth[1].toFixed(0)}</span></div>)}
            </div>
          )},
          (() => {
            const topC = past.filter(c => c.type !== 'festival' && c.ticketPrice).sort((a,b) => b.ticketPrice - a.ticketPrice)[0];
            const topF = past.filter(c => c.type === 'festival' && c.ticketPrice).sort((a,b) => b.ticketPrice - a.ticketPrice)[0];
            const showC = chartType !== 'festivals' && topC;
            const showF = chartType !== 'concerts' && topF;
            if (!showC && !showF) return null;
            return { id: "avg-priciest", label: "Priciest shows", content: (
              <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
                <StatLabel>priciest shows</StatLabel>
                {showC && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: showF ? "1px solid #16162a" : "none" }}>
                    <div>
                      <span style={{ fontSize: 9, color: "#a78bfa", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>concert</span>
                      <div style={{ fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif", marginTop: 1 }}>{topC.artist}</div>
                    </div>
                    <span style={{ fontSize: 13, color: "#a78bfa", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>€{topC.ticketPrice}</span>
                  </div>
                )}
                {showF && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                    <div>
                      <span style={{ fontSize: 9, color: "#fb923c", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>festival</span>
                      <div style={{ fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif", marginTop: 1 }}>{topF.artist}</div>
                    </div>
                    <span style={{ fontSize: 13, color: "#fb923c", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>€{topF.ticketPrice}</span>
                  </div>
                )}
              </div>
            )};
          })(),
        ].filter(Boolean);
        return <SectionReorder chartId="averages" sections={avgSections} />;
      }
      default: return null;
    }
  };

  return (
    <div style={{ padding: fillHeight ? "0" : "0 0 100px", flex: fillHeight ? 1 : undefined, display: fillHeight ? "flex" : undefined, flexDirection: fillHeight ? "column" : undefined, minHeight: fillHeight ? 0 : undefined }}>
      {selectedSong && (() => {
        const matchSong = (s, performer) => {
          if (getSongName(s) !== selectedSong.name) return false;
          const cov = getSongCover(s);
          return ((typeof cov === 'string' && cov) || performer || '') === selectedSong.artist;
        };
        const appearances = past.flatMap(c => {
          const result = [];
          const mainMatches = getSongList(c.setlist).filter(s => matchSong(s, c.artist));
          mainMatches.forEach(s => result.push({ concert: c, artist: c.artist, info: getSongInfo(s), cover: getSongCover(s), isSupport: false }));
          Object.entries(c.supportSetlists || {}).forEach(([artistName, songs]) => {
            const matches = getSongList(songs).filter(x => matchSong(x, artistName));
            matches.forEach(s => result.push({ concert: c, artist: artistName, info: getSongInfo(s), cover: getSongCover(s), isSupport: true }));
          });
          // Tag each occurrence with its position among repeats in the same show, so
          // "played twice in one show" is visible (e.g. festival version + acoustic encore).
          const perConcertCount = {};
          result.forEach(r => { perConcertCount[r.concert.id] = (perConcertCount[r.concert.id] || 0) + 1; });
          let seen = {};
          result.forEach(r => {
            seen[r.concert.id] = (seen[r.concert.id] || 0) + 1;
            r.occurrenceIndex = seen[r.concert.id];
            r.occurrenceTotal = perConcertCount[r.concert.id];
          });
          return result;
        }).sort((a, b) => b.concert.date.localeCompare(a.concert.date));
        return (
          <div>
            <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setSelectedSong(null)} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>{selectedSong.name}</div>
                <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{selectedSong.artist} · {appearances.length}× live</div>
              </div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              {appearances.map(({ concert: c, artist, info, cover, isSupport, occurrenceIndex, occurrenceTotal }, i) => {
                const online = isOnline(c);
                return (
                <button key={`${c.id}-${artist}-${occurrenceIndex}`} onClick={() => onOpen(c)} style={{
                  width: "100%", textAlign: "left", background: "#0e0e1a", border: "1px solid #1f1f35",
                  borderLeft: `3px solid ${online ? ONLINE_COLOR : isSupport ? "#3d3564" : "#a78bfa"}`,
                  borderRadius: 10, padding: "11px 14px", cursor: "pointer", marginBottom: 6, display: "flex", flexDirection: "column", gap: 2
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#e2e0ff", fontWeight: 500 }}>{formatDate(c.date)}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {occurrenceTotal > 1 && <span style={{ fontSize: 9, color: "#34d399", fontFamily: "'DM Mono', monospace", padding: "1px 5px", background: "#0a1a12", borderRadius: 99 }}>{occurrenceIndex}/{occurrenceTotal} this show</span>}
                      {isSupport && <span style={{ fontSize: 9, color: "#a78bfa", fontFamily: "'DM Mono', monospace", padding: "1px 5px", background: "#1a1a30", borderRadius: 99 }}>support</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#c4c2f0", fontWeight: 600 }}>{artist}{cover ? <span style={{ color: "#fb923c", fontWeight: 400 }}> · cover</span> : null}</div>
                  <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{online ? formatOnlineLocation(c) : <>{c.venue}{c.room ? ` · ${c.room}` : ""} · {c.city}</>}</div>
                  {info && <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{info}</div>}
                </button>
              )})}
            </div>
          </div>
        );
      })()}
      {!selectedSong && selectedVenue && (() => {
        const atVenue = concerts.filter(c => c.venue === selectedVenue).sort((a, b) => b.date.localeCompare(a.date));
        const pastAt = atVenue.filter(c => isPast(c.date));
        return (
          <div>
            <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setSelectedVenue(null)} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>{selectedVenue}</div>
                <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{pastAt.length}× visited{atVenue[0]?.city ? ` · ${atVenue[0].city}` : ""}</div>
              </div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              {atVenue.map(c => (
                <button key={c.id} onClick={() => onOpen(c)} style={{
                  width: "100%", textAlign: "left", background: "#0e0e1a", border: "1px solid #1f1f35",
                  borderLeft: `3px solid ${isPast(c.date) ? "#a78bfa" : "#38bdf8"}`,
                  borderRadius: 10, padding: "11px 14px", cursor: "pointer", marginBottom: 6, display: "flex", flexDirection: "column", gap: 2
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#e2e0ff", fontWeight: 500 }}>{formatDate(c.date)}</span>
                    {!isPast(c.date) && <span style={{ fontSize: 9, color: "#38bdf8", fontFamily: "'DM Mono', monospace", padding: "1px 5px", background: "#0e2030", borderRadius: 99 }}>upcoming</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#c4c2f0", fontWeight: 600 }}>{c.artist}</div>
                  <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{c.room ? `${c.room} · ` : ""}{c.rating ? `★ ${c.rating}` : ""}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      {!selectedSong && !selectedVenue && <>
      {/* Tab switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid #0d1a14", marginBottom: 0, alignItems: "stretch" }}>
        {!hideTabs && [{ id: "summary", label: "Summary" }, { id: "charts", label: "Charts" }, { id: "friends", label: "Friends" }].map(t => (
          <button key={t.id} onClick={() => setStatsTab(t.id)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            padding: "14px 0 12px", fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800,
            color: statsTab === t.id ? "#a78bfa" : "#5a5880",
            borderBottom: `2px solid ${statsTab === t.id ? "#a78bfa" : "transparent"}`,
            marginBottom: -1
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── SUMMARY ── */}
      {statsTab === "summary" && (
        <div style={{ padding: "16px 16px 0", flex: fillHeight ? 1 : undefined, overflowY: fillHeight ? "auto" : undefined, minHeight: 0 }}>

          {/* Year scope toggle */}
          {(() => {
            const allDataYears = [...new Set(pastAll.map(c => c.date.slice(0,4)).filter(Boolean))].sort();
            const curYear = String(new Date().getFullYear());
            const recentYears = [curYear, String(curYear - 1), String(curYear - 2)].filter(y => allDataYears.includes(y));
            const olderYears = allDataYears.filter(y => !recentYears.includes(y)).reverse();
            const pills = [{ id: 'all', label: 'All' }, ...recentYears.map(y => ({ id: y, label: y }))];
            return (
              <div style={{ display: "flex", gap: 4, marginBottom: 10, alignItems: "center" }}>
                {pills.map(({ id, label }) => (
                  <button key={id} onClick={() => onUpdateSetting('summaryYear', id)} style={{
                    background: summaryYear === id ? "#a78bfa" : "none",
                    border: `1px solid ${summaryYear === id ? "#a78bfa" : "#1f1f35"}`,
                    borderRadius: 99, cursor: "pointer", padding: "3px 10px", flexShrink: 0,
                    fontSize: 11, fontFamily: "'DM Mono', monospace",
                    color: summaryYear === id ? "#0c0c14" : "#4a4870",
                    fontWeight: summaryYear === id ? 700 : 400,
                  }}>{label}</button>
                ))}
                {olderYears.length > 0 && (
                  <select
                    value={olderYears.includes(summaryYear) ? summaryYear : ''}
                    onChange={e => e.target.value && onUpdateSetting('summaryYear', e.target.value)}
                    style={{
                      background: olderYears.includes(summaryYear) ? "#a78bfa" : "#0c0c14",
                      border: `1px solid ${olderYears.includes(summaryYear) ? "#a78bfa" : "#1f1f35"}`,
                      borderRadius: 99, cursor: "pointer", padding: "3px 10px",
                      fontSize: 11, fontFamily: "'DM Mono', monospace",
                      color: olderYears.includes(summaryYear) ? "#0c0c14" : "#4a4870",
                      WebkitAppearance: "none", appearance: "none",
                    }}
                  >
                    <option value="">older ▾</option>
                    {olderYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
              </div>
            );
          })()}

          {/* Row 1: shows / festivals / countries / avg per year */}
          {!(settings.hiddenSummaryBlocks||[]).includes("stats1") && (() => {
            const currentYearStr = String(new Date().getFullYear());
            const sp = summaryPast;
            const spShows = sp.filter(c => c.type === 'concert');
            const spFests = sp.filter(c => c.type === 'festival');
            const spCountries = {};
            sp.forEach(c => { const k = (c.country||'').trim(); if (k) spCountries[k] = (spCountries[k]||0)+1; });
            const spYears = [...new Set(sp.map(c => getYear(c.date)))];
            const spAvg = summaryYear === 'all' && spYears.length ? (sp.length / spYears.length).toFixed(1) : null;
            return (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${spAvg !== null ? 4 : 3}, 1fr)`, gap: 6, marginBottom: 8 }}>
                {[
                  { label: "shows", value: spShows.length, nav: { view: 'home', filterType: 'concerts' } },
                  { label: "festivals", value: spFests.length, nav: { view: 'home', filterType: 'festivals' } },
                  { label: "countries", value: Object.keys(spCountries).length, nav: { view: 'stats', chart: 'venues' } },
                  ...(spAvg !== null ? [{ label: "avg / year", value: spAvg, nav: null }] : []),
                ].map(b => (
                  <div key={b.label} onClick={b.nav ? () => { if (b.nav.chart) { setStatsTab("charts"); setChartGroup('places'); setSelectedChart(b.nav.chart); } else { onNavigate(b.nav); } } : undefined} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 8, padding: "6px 4px", textAlign: "center", cursor: b.nav ? "pointer" : "default" }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "#a78bfa", lineHeight: 1 }}>{b.value}</div>
                    <div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}


          {/* Cumulative line chart */}
          {!(settings.hiddenSummaryBlocks||[]).includes("cumulative") && <div onClick={() => { setStatsTab("charts"); setChartGroup('activity'); setSelectedChart("shows"); document.getElementById('content-scroll')?.scrollTo(0,0); }} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 12, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>{summaryYear === 'all' ? "cumulative shows" : "shows per month"}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 2, background: "#a78bfa", borderRadius: 1 }} />
                  <span style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>past</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 2, background: "#38bdf8", borderRadius: 1, opacity: 0.7 }} />
                  <span style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>upcoming</span>
                </div>
              </div>
            </div>
            {(() => {
              if (summaryYear !== 'all') {
                const monthLabels = ["J","F","M","A","M","J","J","A","S","O","N","D"];
                const pastM = Array(12).fill(0), upM = Array(12).fill(0);
                concerts.filter(c => c.date.slice(0,4) === summaryYear).forEach(c => {
                  const m = parseInt(c.date.slice(5,7), 10) - 1;
                  if (m >= 0 && m < 12) (isPast(c.date) ? pastM : upM)[m] += 1;
                });
                const maxM = Math.max(...pastM.map((v, i) => v + upM[i]), 1);
                const H = 64;
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, paddingTop: 8 }}>
                    {monthLabels.map((ml, i) => {
                      const total = pastM[i] + upM[i];
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                          <div style={{ fontSize: 8, color: total > 0 ? "#6b6a8f" : "transparent", fontFamily: "'DM Mono', monospace", marginBottom: 2, lineHeight: 1 }}>{total || 0}</div>
                          <div style={{ width: "100%", maxWidth: 14, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: H }}>
                            {upM[i] > 0 && <div style={{ height: Math.max(2, (upM[i] / maxM) * H), background: "#38bdf8", opacity: 0.85, borderRadius: "3px 3px 0 0" }} />}
                            {pastM[i] > 0 && <div style={{ height: Math.max(2, (pastM[i] / maxM) * H), background: "#a78bfa", borderRadius: upM[i] > 0 ? 0 : "3px 3px 0 0" }} />}
                            {total === 0 && <div style={{ height: 2, background: "#1f1f35", borderRadius: 1 }} />}
                          </div>
                          <div style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{ml}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              const allSorted = [...concerts].filter(c => !isWish(c) && c.date && c.date.length === 10).sort((a,b) => a.date.localeCompare(b.date));
              if (allSorted.length < 2) return null;
              const n = allSorted.length;
              const W = 300, H = 80;
              const firstMs = new Date(allSorted[0].date + 'T00:00:00').getTime();
              const lastMs = new Date(allSorted[n-1].date + 'T00:00:00').getTime();
              const rangeMs = Math.max(lastMs - firstMs, 1);
              const todayMs = Date.now();
              const todayX = Math.min(W - 3, ((todayMs - firstMs) / rangeMs) * (W - 6) + 3);

              const coords = allSorted.map((c, i) => ({
                x: ((new Date(c.date + 'T00:00:00').getTime() - firstMs) / rangeMs) * (W - 6) + 3,
                y: H - 6 - ((i + 1) / n) * (H - 14),
                isPast: new Date(c.date + 'T00:00:00').getTime() <= todayMs,
              }));

              // Split into past and upcoming segments — join at today
              const pastCoords = coords.filter(p => p.isPast);
              const upcomingCoords = coords.filter(p => !p.isPast);

              // Find y at today's x by interpolating between last past and first upcoming
              let todayY = pastCoords.length > 0 ? pastCoords[pastCoords.length - 1].y : coords[0].y;

              const pastPath = pastCoords.length > 0
                ? "M " + pastCoords.map(p => `${p.x},${p.y}`).join(" L ")
                : null;

              const upcomingPath = upcomingCoords.length > 0
                ? `M ${todayX},${todayY} L ` + upcomingCoords.map(p => `${p.x},${p.y}`).join(" L ")
                : null;

              const areaPath = pastCoords.length > 0
                ? pastPath + ` L ${todayX},${H-4} L ${pastCoords[0].x},${H-4} Z`
                : null;

              const yearLabels = [...new Set(allSorted.map(c => c.date.slice(0,4)))].map(y => ({
                y, x: Math.max(8, Math.min(W-16, ((new Date(`${y}-01-01`).getTime() - firstMs) / rangeMs) * (W-6) + 3))
              }));

              return (
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingBottom: 14, flexShrink: 0 }}>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{n}</span>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{Math.round(n/2)}</span>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>0</span>
                  </div>
                  <svg style={{ flex: 1, overflow: "visible" }} viewBox={`0 0 ${W} ${H+14}`}>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2"/>
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    {yearLabels.map(({y, x}) => (
                      <g key={y}>
                        <line x1={x} y1={0} x2={x} y2={H-4} stroke="#1f1f35" strokeWidth="1" strokeDasharray="3,3" />
                        <text x={x} y={H+10} textAnchor="middle" fill="#4a4870" fontSize="8" fontFamily="DM Sans,sans-serif">{y}</text>
                      </g>
                    ))}
                    <line x1={todayX} y1={0} x2={todayX} y2={H-4} stroke="#2e2e50" strokeWidth="1" />
                    {areaPath && <path d={areaPath} fill="url(#cumGrad)" />}
                    {pastPath && <path d={pastPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                    {upcomingPath && <path d={upcomingPath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" opacity="0.8" />}
                    {pastCoords.length > 0 && <circle cx={pastCoords[0].x} cy={pastCoords[0].y} r="3" fill="#a78bfa" />}
                    {pastCoords.length > 0 && <circle cx={todayX} cy={todayY} r="3" fill="#a78bfa" />}
                    {upcomingCoords.length > 0 && <circle cx={upcomingCoords[upcomingCoords.length-1].x} cy={upcomingCoords[upcomingCoords.length-1].y} r="3" fill="#38bdf8" opacity="0.8" />}
                  </svg>
                </div>
              );
            })()}
          </div>}

          {/* Donut cards — stacked full width */}
          {!(settings.hiddenSummaryBlocks||[]).includes("pies") && (() => {
            const gCount = {};
            summaryPast.forEach(c => { getGenres(c).forEach(g => { gCount[g] = (gCount[g] || 0) + 1; }); });
            const topGenres = Object.entries(gCount).sort((a,b) => b[1] - a[1]);
            const vsCount = {};
            summaryPast.forEach(c => { const sz = c.type === "festival" ? "Festival" : c.venueSize; if (sz) vsCount[sz] = (vsCount[sz] || 0) + 1; });
            const venueEntries = Object.entries(vsCount).sort((a,b) => b[1] - a[1]);
            const titleStyle = { fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 };
            const placeholderStyle = { color: "#2e2e4a", fontSize: 11, fontFamily: "'DM Mono', monospace", textAlign: "center", padding: "20px 0" };
            const legendItem = (color, name) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              </div>
            );
            return (
              <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, marginBottom: 12, display: "flex", overflow: "hidden" }}>
                {/* Genre */}
                <div onClick={() => { setStatsTab("charts"); setChartGroup('activity'); setSelectedChart("genres-pie"); document.getElementById('content-scroll')?.scrollTo(0,0); }} style={{ flex: 1, padding: "12px", cursor: "pointer", borderRight: "1px solid #1f1f35" }}>
                  {topGenres.length === 0 ? (
                    <div style={placeholderStyle}>add genres to shows</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <Donut size={62} showLabels labelPad={0.06} centerText="Genres" segments={[
                          ...topGenres.slice(0,3).map(([g,n],i) => ({ value: n, color: GENRE_COLORS[i] })),
                          ...(topGenres.length > 3 ? [{ value: topGenres.slice(3).reduce((s,[,n])=>s+n,0), color: "#4a4870" }] : [])
                        ]} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 6px", marginTop: 8 }}>
                        {[...topGenres.slice(0,3), ...(topGenres.length > 3 ? [["Others"]] : [])].map(([name], i) => (
                          <div key={name} style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}>
                            <div style={{ width: 5, height: 5, borderRadius: 1, background: i < 3 ? GENRE_COLORS[i] : "#4a4870", flexShrink: 0 }} />
                            <span style={{ fontSize: 8, color: name === "Others" ? "#4a4870" : "#c4c2f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Venue size */}
                <div onClick={() => { setStatsTab("charts"); setChartGroup('places'); setSelectedChart("venue-size"); document.getElementById('content-scroll')?.scrollTo(0,0); }} style={{ flex: 1, padding: "12px", cursor: "pointer" }}>
                  {venueEntries.length === 0 ? (
                    <div style={placeholderStyle}>set venue size on shows</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <Donut size={62} showLabels labelPad={0.06} centerText={["VENUE", "SIZE"]} segments={[
                          ...venueEntries.slice(0,3).map(([name,n],i) => ({ value: n, color: VENUE_COLORS[i] })),
                          ...(venueEntries.length > 3 ? [{ value: venueEntries.slice(3).reduce((s,[,n])=>s+n,0), color: "#4a4870" }] : [])
                        ]} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 6px", marginTop: 8 }}>
                        {[...venueEntries.slice(0,3), ...(venueEntries.length > 3 ? [["Others"]] : [])].map(([name], i) => (
                          <div key={name} style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}>
                            <div style={{ width: 5, height: 5, borderRadius: 1, background: i < 3 ? VENUE_COLORS[i] : "#4a4870", flexShrink: 0 }} />
                            <span style={{ fontSize: 8, color: name === "Others" ? "#4a4870" : "#c4c2f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Countdown — next 3 upcoming shows */}
          {!(settings.hiddenSummaryBlocks||[]).includes("upnext") && (() => {
            const upcoming = concerts
              .filter(c => !isPast(c.date))
              .sort((a,b) => a.date.localeCompare(b.date))
              .slice(0, 3);
            if (upcoming.length === 0) return null;
            const todayMs = new Date().setHours(0,0,0,0);
            return (
              <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Up next</div>
                {upcoming.map((c, i) => {
                  const days = Math.ceil((new Date(c.date).setHours(0,0,0,0) - todayMs) / 86400000);
                  return (
                    <button key={c.id} onClick={() => onOpen(c)} style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                      background: "none", border: "none", cursor: "pointer",
                      paddingBottom: i < upcoming.length - 1 ? 6 : 0,
                      marginBottom: i < upcoming.length - 1 ? 6 : 0,
                      borderBottom: i < upcoming.length - 1 ? "1px solid #1a1a2e" : "none"
                    }}>
                      <div style={{
                        background: days <= 7 ? "#2a1a3a" : "#17172a",
                        border: `1px solid ${days <= 7 ? "#a78bfa" : "#2e2e4a"}`,
                        borderRadius: 6, padding: "3px 6px", textAlign: "center", flexShrink: 0, minWidth: 36
                      }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, color: days <= 7 ? "#a78bfa" : "#c4c2f0", lineHeight: 1 }}>{days}</div>
                        <div style={{ fontSize: 7, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>days</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e0ff", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.artist}</div>
                        <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>{isOnline(c) ? formatOnlineLocation(c) : `${c.venue} · ${c.city}`}</div>
                      </div>
                      <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                        {new Date(c.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}


        </div>
      )}
      {statsTab === "charts" && activeGroup && (() => {
        const charts = getOrderedCharts(activeGroup);
        const chartIdx = Math.max(0, charts.findIndex(c => c.id === (activeChart?.id)));
        const carouselSwipeStart = { x: 0, y: 0 };
        const goTo = (idx) => { if (charts[idx]) setSelectedChart(charts[idx].id); };
        const hiddenCharts = settings.hiddenCharts || [];
        const hiddenChartGroups = settings.hiddenChartGroups || [];

        // All charts in the group (including hidden) for edit mode
        const allGroupCharts = getOrderedCharts({ ...activeGroup, charts: CHART_GROUPS.find(g => g.id === activeGroup.id)?.charts || activeGroup.charts });

        const toggleChart = (id) => {
          const next = hiddenCharts.includes(id) ? hiddenCharts.filter(x => x !== id) : [...hiddenCharts, id];
          onUpdateSetting('hiddenCharts', next);
        };
        const toggleGroup = (id) => {
          const next = hiddenChartGroups.includes(id) ? hiddenChartGroups.filter(x => x !== id) : [...hiddenChartGroups, id];
          onUpdateSetting('hiddenChartGroups', next);
        };

        const saveOrder = (newCharts) => {
          const newOrder = { ...chartOrder, [activeGroup.id]: newCharts.map(c => c.id) };
          setChartOrder(newOrder);
          onUpdateSetting('chartOrder', newOrder);
        };

        const displayCharts = charts;

        return (
          <div style={{ padding: "0", display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: 0 }}>
            {/* Header */}
            <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "#0c0c14", zIndex: 5, flexShrink: 0 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#e2e0ff" }}>{activeGroup.label}</div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                {!reorderMode && [['all','All'],['concerts','Conc'],['festivals','Fest']].map(([id, label]) => (
                  <button key={id} onClick={() => setChartType(id)} style={{ padding: "3px 9px", borderRadius: 99, fontSize: 9, cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: chartType === id ? 700 : 400, background: chartType === id ? (id === 'festivals' ? '#f472b6' : '#a78bfa') : 'none', color: chartType === id ? '#0c0c14' : '#5a5880', border: `1px solid ${chartType === id ? (id === 'festivals' ? '#f472b6' : '#a78bfa') : '#1f1f35'}` }}>{label}</button>
                ))}
                {charts.length > 1 && (
                  <button onClick={() => { setReorderMode(r => !r); setDragIdx(null); setDragOverIdx(null); }} style={{ padding: "3px 9px", borderRadius: 99, fontSize: 9, cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: reorderMode ? 700 : 400, background: reorderMode ? "#a78bfa" : "none", color: reorderMode ? "#0c0c14" : "#5a5880", border: `1px solid ${reorderMode ? "#a78bfa" : "#1f1f35"}` }}>
                    {reorderMode ? "Done" : "✎ edit"}
                  </button>
                )}
              </div>
            </div>

            {/* Reorder mode — drag list */}
            {reorderMode && (
              <div style={{ flex: 1, padding: "0 16px", overflowY: "auto" }}>
                {/* Hide entire group */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{activeGroup.label}</div>
                    <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>entire group</div>
                  </div>
                  <button onClick={() => toggleGroup(activeGroup.id)} style={{ background: hiddenChartGroups.includes(activeGroup.id) ? "none" : "rgba(167,139,250,0.1)", border: `1px solid ${hiddenChartGroups.includes(activeGroup.id) ? "#2e2e50" : "#a78bfa"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace", color: hiddenChartGroups.includes(activeGroup.id) ? "#4a4870" : "#a78bfa" }}>
                    {hiddenChartGroups.includes(activeGroup.id) ? "hidden" : "visible"}
                  </button>
                </div>

                <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Charts — set position &amp; visibility
                </div>
                {allGroupCharts.map((c, i) => {
                  const isHidden = hiddenCharts.includes(c.id);
                  const visibleCharts = allGroupCharts.filter(ch => !hiddenCharts.includes(ch.id));
                  const visibleIdx = visibleCharts.findIndex(ch => ch.id === c.id);
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#13131f", border: `1px solid ${isHidden ? "#1a1a1a" : "#1f1f35"}`, borderRadius: 12, padding: "11px 14px", marginBottom: 8, opacity: isHidden ? 0.45 : 1 }}>
                      {!isHidden ? (
                        <select
                          value={visibleIdx + 1}
                          onChange={e => {
                            const toVisibleIdx = parseInt(e.target.value) - 1;
                            if (toVisibleIdx === visibleIdx) return;
                            const arr = [...visibleCharts];
                            const [moved] = arr.splice(visibleIdx, 1);
                            arr.splice(toVisibleIdx, 0, moved);
                            // Merge back with hidden charts in their relative positions
                            const newOrder = [...allGroupCharts];
                            let vi = 0;
                            newOrder.forEach((ch, ni) => { if (!hiddenCharts.includes(ch.id)) { newOrder[ni] = arr[vi++]; } });
                            saveOrder(newOrder);
                            goTo(arr.findIndex(ch => ch.id === c.id));
                          }}
                          style={{ background: "#0c0c14", border: "1px solid #a78bfa", borderRadius: 8, color: "#a78bfa", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, padding: "4px 6px", cursor: "pointer", flexShrink: 0, WebkitAppearance: "none", appearance: "none", textAlign: "center", width: 44 }}
                        >
                          {visibleCharts.map((_, j) => <option key={j+1} value={j+1}>{j+1}</option>)}
                        </select>
                      ) : (
                        <div style={{ width: 44, height: 34, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ color: "#2e2e50", fontSize: 16 }}>—</span>
                        </div>
                      )}
                      <div style={{ flex: 1, fontSize: 13, color: isHidden ? "#4a4870" : "#c4c2f0", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{c.label}</div>
                      <button onClick={() => toggleChart(c.id)} style={{ background: isHidden ? "none" : "rgba(167,139,250,0.1)", border: `1px solid ${isHidden ? "#2e2e50" : "#a78bfa"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace", color: isHidden ? "#4a4870" : "#a78bfa", flexShrink: 0 }}>
                        {isHidden ? "off" : "on"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {!reorderMode && (
              <>
                {/* Chart label */}
                <div style={{ padding: "0 16px 6px", flexShrink: 0 }}>
                  <div
                    style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer" }}
                    onTouchStart={() => { longPressTimer.current = setTimeout(() => { setReorderMode(true); }, 600); }}
                    onTouchEnd={() => clearTimeout(longPressTimer.current)}
                    onTouchMove={() => clearTimeout(longPressTimer.current)}
                  >
                    {activeChart?.label}
                  </div>
                </div>

                {/* Swipeable chart area */}
                <div
                  ref={chartAreaRef}
                  style={{ flex: 1, padding: "0 16px", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
                  onTouchStart={e => { carouselSwipeStart.x = e.touches[0].clientX; carouselSwipeStart.y = e.touches[0].clientY; }}
                  onTouchEnd={e => {
                    const dx = e.changedTouches[0].clientX - carouselSwipeStart.x;
                    const dy = e.changedTouches[0].clientY - carouselSwipeStart.y;
                    if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx) * 1.2) return;
                    if (dx < 0) {
                      if (chartIdx < charts.length - 1) goTo(chartIdx + 1);
                      else {
                        const gIdx = visibleChartGroups.findIndex(g => g.id === chartGroup);
                        if (gIdx < visibleChartGroups.length - 1) { const nextG = visibleChartGroups[gIdx + 1]; setChartGroup(nextG.id); setSelectedChart(getOrderedCharts(nextG)[0]?.id); }
                      }
                    } else {
                      if (chartIdx > 0) goTo(chartIdx - 1);
                      else {
                        const gIdx = visibleChartGroups.findIndex(g => g.id === chartGroup);
                        if (gIdx > 0) { const prevG = visibleChartGroups[gIdx - 1]; const prevCharts = getOrderedCharts(prevG); setChartGroup(prevG.id); setSelectedChart(prevCharts[prevCharts.length - 1]?.id); }
                      }
                    }
                  }}
                >
                  {renderChart(activeChart?.id, chartHeight)}
                </div>

                {/* Dots */}
                {charts.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "14px 0 8px", flexShrink: 0 }}>
                    {charts.map((c, i) => (
                      <button key={c.id} onClick={() => goTo(i)} style={{
                        width: i === chartIdx ? 18 : 7,
                        height: 7,
                        borderRadius: 99,
                        background: i === chartIdx ? "#a78bfa" : "#2e2e50",
                        border: "none", cursor: "pointer", padding: 0,
                        transition: "all 0.2s",
                      }} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
      {statsTab === "friends" && <FriendsView concerts={concerts} onOpen={onOpen} settings={settings} onUpdateSetting={onUpdateSetting} />}
      </>}
    </div>
  );
}

function FriendsView({ concerts, onOpen, settings = {}, onUpdateSetting }) {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('most-shows');
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null); // { name, nickname, contact, note }
  const [filterType, setFilterType] = useState('all');

  const friendProfiles = settings.friendProfiles || {};
  const getProfile = name => friendProfiles[name] || {};
  const saveProfile = (name, profile) => {
    const updated = { ...friendProfiles, [name]: { ...getProfile(name), ...profile } };
    onUpdateSetting?.('friendProfiles', updated);
  };
  const displayName = name => getProfile(name).nickname || name;

  const past = concerts.filter(c => isPast(c.date));
  const allFriends = [...new Set(past.flatMap(c => getFriends(c)))].sort();

  const friendGroups = settings.friendGroups || [];
  const groupEntries = friendGroups.map(g => {
    const shows = past.filter(c => g.friends.length > 0 && g.friends.every(f => getFriends(c).includes(f)));
    const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    return { ...g, shows, sorted, lastShow: sorted[sorted.length - 1] || null };
  });

  const friendEntries = allFriends.map(name => {
    const shows = past.filter(c => getFriends(c).includes(name));
    const sortedShows = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    const firstShow = sortedShows[0] || null;
    const lastShow = sortedShows[sortedShows.length - 1] || null;
    const upcoming = concerts.filter(c => !isPast(c.date) && getFriends(c).includes(name));
    const genreCount = {};
    shows.forEach(c => { getGenres(c).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }); });
    const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
    const artistCount = {};
    shows.forEach(c => { artistCount[c.artist] = (artistCount[c.artist] || 0) + 1; });
    const topArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]);
    const concertCount = shows.filter(c => c.type === 'concert').length;
    const festivalCount = shows.filter(c => c.type === 'festival').length;
    return { name, shows, sortedShows, firstShow, lastShow, upcoming, topGenres, topArtists, concertCount, festivalCount };
  });

  const filtered = friendEntries
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))
    .filter(f => filterType === 'all' || (filterType === 'concerts' ? f.concertCount > 0 : f.festivalCount > 0))
    .sort((a, b) => {
      if (sortBy === 'most-shows') return b.shows.length - a.shows.length;
      if (sortBy === 'alpha') return a.name.localeCompare(b.name);
      if (sortBy === 'recent') return (b.lastShow?.date || '').localeCompare(a.lastShow?.date || '');
      return 0;
    });

  useBackButton(() => { if (selectedFriend) setSelectedFriend(null); else if (selectedGroup) setSelectedGroup(null); }, selectedFriend !== null || selectedGroup !== null);

  if (selectedGroup !== null) {
    const g = groupEntries[selectedGroup];
    if (!g) return null;
    const sectionLabel = { fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 };
    return (
      <div style={{ padding: "0 0 100px" }}>
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSelectedGroup(null)} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>{g.name}</div>
            <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{g.friends.join(', ')}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#6b6a8f" }}>{g.shows.length}</div>
            <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>show{g.shows.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {g.shows.length === 0
            ? <div style={{ textAlign: "center", color: "#2e2e4a", padding: "40px 0", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>no shows found where all members attended</div>
            : <>
                <div style={sectionLabel}>Shows together</div>
                {[...g.sorted].reverse().map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
              </>
          }
        </div>
      </div>
    );
  }

  if (selectedFriend) {
    const f = friendEntries.find(fd => fd.name === selectedFriend);
    if (!f) return null;
    const profile = getProfile(f.name);
    const yearSpan = f.firstShow && f.lastShow && f.firstShow.date.slice(0,4) !== f.lastShow.date.slice(0,4)
      ? `${f.firstShow.date.slice(0,4)} – ${f.lastShow.date.slice(0,4)}`
      : f.firstShow ? f.firstShow.date.slice(0,4) : '';
    const sectionLabel = { fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 };
    const card = { background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 12 };

    return (
      <div style={{ padding: "0 0 100px" }}>
        {/* Edit profile modal */}
        {editingProfile && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000000cc", display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", background: "#13131f", borderRadius: "16px 16px 0 0", padding: "20px 20px 40px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#e2e0ff" }}>Edit profile</div>
                <button onClick={() => setEditingProfile(null)} style={{ background: "none", border: "none", color: "#6b6a8f", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
              </div>
              {[
                { key: "nickname", label: "Nickname", placeholder: "e.g. Soph, DJ Max…" },
                { key: "contact", label: "Contact", placeholder: "Phone, email, @handle…" },
                { key: "note", label: "Note", placeholder: "Met at Lowlands, college friend…" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</div>
                  <input
                    value={editingProfile[key] || ""}
                    onChange={e => setEditingProfile(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ width: "100%", boxSizing: "border-box", background: "#0c0c14", border: "1px solid #2e2e50", borderRadius: 8, color: "#c4c2f0", padding: "9px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
                  />
                </div>
              ))}
              <button onClick={() => {
                saveProfile(f.name, editingProfile);
                setEditingProfile(null);
              }} style={{ width: "100%", background: "#a78bfa", border: "none", borderRadius: 10, color: "#0c0c14", fontSize: 14, fontWeight: 700, padding: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Save</button>
            </div>
          </div>
        )}

        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSelectedFriend(null)} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>
              {displayName(f.name)}
              {profile.nickname && <span style={{ fontSize: 12, color: "#4a4870", fontFamily: "'DM Mono', monospace", fontWeight: 400, marginLeft: 8 }}>{f.name}</span>}
            </div>
            <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
              {f.shows.length} show{f.shows.length !== 1 ? 's' : ''} together{yearSpan ? ` · ${yearSpan}` : ''}
            </div>
            {profile.contact && <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{profile.contact}</div>}
            {profile.note && <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Sans', sans-serif", fontStyle: "italic", marginTop: 2 }}>{profile.note}</div>}
          </div>
          <button onClick={() => setEditingProfile({ nickname: profile.nickname || "", contact: profile.contact || "", note: profile.note || "" })} style={{ background: "none", border: "1px solid #2e2e50", borderRadius: 8, color: "#6b6a8f", fontSize: 11, padding: "5px 10px", cursor: "pointer", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>Edit</button>
        </div>

        <div style={{ padding: "16px 20px" }}>
          {/* Timeline */}
          <div style={card}>
            <div style={sectionLabel}>Timeline</div>
            <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
              {f.firstShow && (
                <div>
                  <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", marginBottom: 3 }}>First together</div>
                  <div style={{ fontSize: 12, color: "#c4c2f0" }}>{formatDate(f.firstShow.date)}</div>
                  <div style={{ fontSize: 11, color: "#6b6a8f" }}>{f.firstShow.artist}</div>
                </div>
              )}
              {f.lastShow && f.firstShow && f.lastShow.id !== f.firstShow.id && (
                <div>
                  <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", marginBottom: 3 }}>Most recent</div>
                  <div style={{ fontSize: 12, color: "#c4c2f0" }}>{formatDate(f.lastShow.date)}</div>
                  <div style={{ fontSize: 11, color: "#6b6a8f" }}>{f.lastShow.artist}</div>
                </div>
              )}
            </div>
            {(f.concertCount > 0 || f.festivalCount > 0) && (
              <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>
                {f.concertCount > 0 && `${f.concertCount} concert${f.concertCount !== 1 ? 's' : ''}`}
                {f.concertCount > 0 && f.festivalCount > 0 && ' · '}
                {f.festivalCount > 0 && `${f.festivalCount} festival${f.festivalCount !== 1 ? 's' : ''}`}
              </div>
            )}
          </div>

          {/* Photos together */}
          {(() => {
            const photos = f.shows.filter(c => c.photo).sort((a, b) => b.date.localeCompare(a.date));
            if (photos.length === 0) return null;
            return (
              <div style={card}>
                <div style={sectionLabel}>Photos together</div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  {photos.map(c => (
                    <button key={c.id} onClick={() => onOpen && onOpen(c)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                      <PhotoImg path={c.photo} pos={c.photoPos} style={{ width: 150, aspectRatio: "16 / 10", borderRadius: 10 }} />
                      <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3, textAlign: "left" }}>{c.artist} · {c.date.slice(0, 4)}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Together stats */}
          {(() => {
            const rated = f.shows.filter(c => c.rating);
            const avgR = rated.length ? (rated.reduce((a, c) => a + c.rating, 0) / rated.length).toFixed(1) : null;
            const aCount = {}; f.shows.forEach(c => { if (c.type !== 'festival') aCount[c.artist] = (aCount[c.artist] || 0) + 1; });
            const topA = Object.entries(aCount).sort((a, b) => b[1] - a[1])[0];
            const vCount = {}; f.shows.forEach(c => { if (c.venue) vCount[c.venue] = (vCount[c.venue] || 0) + 1; });
            const topV = Object.entries(vCount).sort((a, b) => b[1] - a[1])[0];
            if (!avgR && !topA && !topV) return null;
            return (
              <div style={card}>
                <div style={sectionLabel}>Together</div>
                {[avgR && ["avg rating", `★ ${avgR}`], topA && topA[1] > 1 && ["most seen artist", `${topA[0]} (${topA[1]}×)`], topV && topV[1] > 1 && ["usual spot", `${topV[0]} (${topV[1]}×)`]].filter(Boolean).map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1a2e" }}>
                    <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{l}</span>
                    <span style={{ color: "#c4c2f0", fontSize: 12 }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Taste profile */}
          {f.topGenres.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>Taste profile</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {f.topGenres.map(([genre, count]) => (
                  <div key={genre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#c4c2f0", minWidth: 90 }}>{genre}</span>
                    <div style={{ flex: 1, height: 6, background: "#0c0c14", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: "#a78bfa", width: `${(count / f.topGenres[0][1]) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", width: 20, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top artists together */}
          {f.topArtists.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>Top artists together</div>
              {f.topArtists.slice(0, 6).map(([artist, count], i) => (
                <div key={artist} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < Math.min(f.topArtists.length, 6) - 1 ? 8 : 0 }}>
                  <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18 }}>#{i+1}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "#c4c2f0" }}>{artist}</span>
                  <span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{count}×</span>
                </div>
              ))}
            </div>
          )}

          {/* Highly rated shows together */}
          {(() => {
            const minRating = settings.ratingSystem === 10 ? 8 : 4;
            const highlights = f.sortedShows.filter(c => c.rating && c.rating >= minRating);
            if (highlights.length === 0) return null;
            return (
              <div style={card}>
                <div style={sectionLabel}>Highlights together · {highlights.length}</div>
                {[...highlights].sort((a,b) => b.date.localeCompare(a.date)).map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
              </div>
            );
          })()}

          {/* Upcoming together */}
          {f.upcoming.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...sectionLabel, marginBottom: 8 }}>Upcoming together</div>
              {[...f.upcoming].sort((a,b) => a.date.localeCompare(b.date)).map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
            </div>
          )}

          {/* All shows */}
          <div>
            <div style={{ ...sectionLabel, marginBottom: 8 }}>All shows together</div>
            {[...f.sortedShows].reverse().map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 100px" }}>
      {/* Stat tiles */}
      {!search && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
            {[
              { value: allFriends.length, label: "friends" },
              { value: friendEntries.filter(f => f.shows.length > 1).length, label: "regulars" },
              { value: past.filter(c => getFriends(c).length === 0).length, label: "solo" },
              { value: friendEntries.sort((a,b) => b.shows.length - a.shows.length)[0]?.shows.length ?? "—", label: friendEntries.sort((a,b) => b.shows.length - a.shows.length)[0] ? `w. ${(friendEntries.sort((a,b) => b.shows.length - a.shows.length)[0]?.name || '').split(' ')[0]}` : "top" },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 10, padding: "9px 6px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Search + sort */}
      <div style={{ padding: "12px 16px 0", position: "relative", zIndex: 10 }}>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#4a4870", fontSize: 13, pointerEvents: "none" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friend..."
            style={{ width: "100%", background: "#13131f", border: `1px solid ${search ? "#a78bfa" : "#1f1f35"}`, borderRadius: 10, color: "#c4c2f0", padding: "9px 32px 9px 32px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4a4870", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>}
        </div>
        <div style={{ display: "flex", gap: 6, paddingBottom: 10, alignItems: "center" }}>
          {[['all','All'],['concerts','Shows'],['festivals','Fest']].map(([id,label]) => (
            <button key={id} onClick={() => setFilterType(id)} style={{ background: filterType===id?'#a78bfa':'none', border: `1px solid ${filterType===id?'#a78bfa':'#1f1f35'}`, borderRadius:99, padding:'5px 11px', cursor:'pointer', color:filterType===id?'#0c0c14':'#6b6a8f', fontSize:12, fontFamily:"'DM Mono', monospace", fontWeight:filterType===id?700:400, flexShrink:0 }}>{label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowSortPanel(p => !p)} style={{ background: showSortPanel || sortBy !== 'most-shows' ? '#1a1a30' : 'none', border: `1px solid ${showSortPanel || sortBy !== 'most-shows' ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: sortBy !== 'most-shows' ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: sortBy !== 'most-shows' ? 700 : 400, flexShrink: 0 }}>
            Sort{sortBy !== 'most-shows' ? ' ↕' : ''}
          </button>
        </div>
        {showSortPanel && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            {sortBy !== 'most-shows' && <button onClick={() => setSortBy('most-shows')} style={{ marginBottom: 10, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
            <div style={{ display: 'flex', gap: 6 }}>
              {[{id:'most-shows',label:'Most shows'},{id:'alpha',label:'A–Z'},{id:'recent',label:'Most recent'}].map(s => (
                <button key={s.id} onClick={() => setSortBy(s.id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortBy === s.id ? '#a78bfa' : '#0c0c14', color: sortBy === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortBy === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Groups */}
      {groupEntries.length > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 4 }}>
          <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, paddingLeft: 2 }}>Groups</div>
          {groupEntries.map((g, i) => (
            <button key={g.name} onClick={() => setSelectedGroup(i)} style={{
              width: "100%", textAlign: "left", background: "#13131f",
              border: "1px solid #1f1f35", borderLeft: "3px solid #3d3564",
              borderRadius: 10, padding: "10px 14px", cursor: "pointer", marginBottom: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#e2e0ff", marginBottom: 2 }}>{g.name}</div>
                <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.friends.join(', ')}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#6b6a8f" }}>{g.shows.length}</div>
                <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>show{g.shows.length !== 1 ? 's' : ''}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Friend list */}
      <div style={{ padding: "0 16px" }}>
        {filtered.map(({ name, shows, lastShow, topGenres, upcoming }) => (
          <button key={name} onClick={() => setSelectedFriend(name)} style={{
            width: "100%", textAlign: "left", background: "#13131f",
            border: "1px solid #1f1f35", borderLeft: "3px solid #2e2e4a",
            borderRadius: 10, padding: "12px 14px", cursor: "pointer", marginBottom: 8,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#e2e0ff", marginBottom: 3 }}>{displayName(name)}</div>
              {lastShow && (() => {
                const monthsAgo = Math.floor((Date.now() - new Date(lastShow.date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24 * 30));
                const recencyColor = monthsAgo <= 3 ? "#34d399" : monthsAgo <= 12 ? "#a78bfa" : "#4a4870";
                const recencyLabel = monthsAgo === 0 ? "this month" : monthsAgo === 1 ? "1 month ago" : monthsAgo < 12 ? `${monthsAgo}m ago` : monthsAgo < 24 ? "1y ago" : `${Math.floor(monthsAgo/12)}y ago`;
                return <div style={{ fontSize: 10, color: recencyColor, fontFamily: "'DM Mono', monospace", marginBottom: topGenres.length ? 4 : 0 }}>{recencyLabel} · {lastShow.artist}</div>;
              })()}
              {topGenres.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {topGenres.slice(0, 3).map(([g]) => (
                    <span key={g} style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", padding: "2px 6px", borderRadius: 99, background: "#1a1a30", color: "#6b6a8f" }}>{g}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#6b6a8f" }}>{shows.length}</span>
                <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginLeft: 3 }}>shows</span>
              </div>
              {upcoming.length > 0 && <div style={{ fontSize: 9, color: "#818cf8", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>+{upcoming.length} soon</div>}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <EmptyState title="No friends found" detail="Try another search, or add friends to a show." />
        )}
      </div>
    </div>
  );
}

function ArtistsView({ concerts, onOpen, onNavigate = () => {} }) {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("most-seen");
  const [filterGenre, setFilterGenre] = useState("all");
  const [filterMinSeen, setFilterMinSeen] = useState(0);
  const [filterUpcoming, setFilterUpcoming] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [filterType, setFilterType] = useState('all');

  // Group headliner shows by artist (festivals excluded — their name is not an artist)
  const artistMap = {};
  concerts.forEach(c => {
    if (c.type === 'festival') return;
    const key = c.artist.trim();
    if (!artistMap[key]) artistMap[key] = [];
    artistMap[key].push(c);
  });

  // Build support/guest/festival appearance map
  const supportAppearancesMap = {};
  concerts.forEach(c => {
    (c.support || []).forEach(s => {
      const name = getSupportName(s).trim();
      const role = getSupportRole(s);
      if (!supportAppearancesMap[name]) supportAppearancesMap[name] = [];
      supportAppearancesMap[name].push({ concert: c, role });
    });
    (c.acts || []).forEach(act => {
      const name = (act.name || '').trim();
      if (!supportAppearancesMap[name]) supportAppearancesMap[name] = [];
      supportAppearancesMap[name].push({ concert: c, role: 'festival' });
    });
  });

  // Include support/festival-only artists in artistMap so they appear in the list
  Object.keys(supportAppearancesMap).forEach(name => {
    if (!artistMap[name]) artistMap[name] = [];
  });

  const allGenres = [...new Set(concerts.flatMap(c => getGenres(c)))].sort();

  const artistEntries = Object.entries(artistMap).map(([name, shows]) => {
    const pastShows = shows.filter(c => isPast(c.date));
    const upcomingShows = shows.filter(c => !isPast(c.date));
    const rated = pastShows.filter(c => c.rating);
    const avgRating = rated.length ? rated.reduce((s, c) => s + c.rating, 0) / rated.length : null;
    const sortedPast = [...pastShows].sort((a, b) => a.date.localeCompare(b.date));
    const firstShow = sortedPast[0] || null;
    const lastShow = sortedPast[sortedPast.length - 1] || null;
    const genreCount = {};
    shows.forEach(c => { getGenres(c).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }); });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const supportApps = (supportAppearancesMap[name] || []).filter(a => isPast(a.concert.date));
    const upcomingSupportApps = (supportAppearancesMap[name] || []).filter(a => !isPast(a.concert.date));
    const supportCount = supportApps.filter(a => a.role === 'support').length;
    const guestCount = supportApps.filter(a => a.role === 'guest').length;
    const festivalCount = supportApps.filter(a => a.role === 'festival').length;
    return { name, shows, pastShows, upcomingShows, upcomingSupportApps, pastCount: pastShows.length, avgRating, firstShow, lastShow, topGenre, supportApps, supportCount, guestCount, festivalCount };
  });

  const activeFilterCount = [filterGenre !== 'all', filterMinSeen > 0, filterUpcoming].filter(Boolean).length;

  const sorted = artistEntries
    .filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGenre !== 'all' && a.topGenre !== filterGenre) return false;
      if (filterMinSeen > 0 && (a.pastCount + a.supportCount + a.guestCount + a.festivalCount) < filterMinSeen) return false;
      if (filterUpcoming && a.upcomingShows.length === 0 && a.upcomingSupportApps.length === 0) return false;
      if (filterType === 'concerts' && a.pastCount === 0) return false;
      if (filterType === 'festivals' && a.festivalCount === 0 && a.upcomingSupportApps.filter(u => u.role === 'festival').length === 0) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'most-seen') {
        const totA = a.pastCount + a.supportCount + a.guestCount + a.festivalCount;
        const totB = b.pastCount + b.supportCount + b.guestCount + b.festivalCount;
        return totB - totA || a.name.localeCompare(b.name);
      }
      if (sortBy === 'alpha') return a.name.localeCompare(b.name);
      if (sortBy === 'recently-seen') return (b.lastShow?.date || '').localeCompare(a.lastShow?.date || '');
      if (sortBy === 'rating') return (b.avgRating || 0) - (a.avgRating || 0) || b.pastCount - a.pastCount;
      return 0;
    });

  const getBorderColor = (count) => {
    if (count >= 5) return '#a78bfa';
    if (count >= 3) return '#6d5fa8';
    if (count >= 2) return '#3d3564';
    return '#2e2e4a';
  };

  useBackButton(() => setSelectedArtist(null), selectedArtist !== null);

  if (selectedArtist) {
    const shows = (artistMap[selectedArtist] || []).sort((a,b) => b.date.localeCompare(a.date));
    const pastShows = shows.filter(c => isPast(c.date));
    const upcomingShows = shows.filter(c => !isPast(c.date));
    const rated = pastShows.filter(c => c.rating);
    const avgRating = rated.length ? (rated.reduce((s,c) => s + c.rating, 0) / rated.length).toFixed(1) : null;
    const sinceYear = pastShows.length ? [...pastShows].sort((a,b) => a.date.localeCompare(b.date))[0].date.slice(0,4) : null;
    const friendCount = {};
    pastShows.forEach(c => getFriends(c).forEach(f => { friendCount[f] = (friendCount[f] || 0) + 1; }));
    const topFriend = Object.entries(friendCount).sort((a,b) => b[1]-a[1])[0] || null;
    const supportApps = (supportAppearancesMap[selectedArtist] || []).filter(a => isPast(a.concert.date)).sort((a,b) => b.concert.date.localeCompare(a.concert.date));
    const upcomingSupportApps = (supportAppearancesMap[selectedArtist] || []).filter(a => !isPast(a.concert.date)).sort((a,b) => a.concert.date.localeCompare(b.concert.date));
    const allUpcoming = [...upcomingShows, ...upcomingSupportApps.map(a => a.concert)].sort((a,b) => a.date.localeCompare(b.date));
    const supportOnlyCount = supportApps.filter(a => a.role === 'support').length;
    const guestOnlyCount = supportApps.filter(a => a.role === 'guest').length;
    const festivalOnlyCount = supportApps.filter(a => a.role === 'festival').length;
    const totalAppearances = pastShows.length + supportApps.length;
    const roleParts = [pastShows.length > 0 && `${pastShows.length} headliner`, supportOnlyCount > 0 && `${supportOnlyCount} support`, guestOnlyCount > 0 && `${guestOnlyCount} guest`, festivalOnlyCount > 0 && `${festivalOnlyCount} festival`].filter(Boolean);
    const artistSongCount = {};
    pastShows.forEach(c => getSongList(c.setlist).forEach(song => { const n = getSongName(song); artistSongCount[n] = (artistSongCount[n] || 0) + 1; }));
    supportApps.forEach(({ concert: c }) => getSongList((c.supportSetlists || {})[selectedArtist]).forEach(song => { const n = getSongName(song); artistSongCount[n] = (artistSongCount[n] || 0) + 1; }));
    const artistSongs = Object.entries(artistSongCount).sort((a,b) => b[1]-a[1]);

    // Songs of this artist covered by others
    const coversByOthers = [];
    concerts.filter(c => isPast(c.date)).forEach(c => {
      const checkSongs = (songList, performingArtist) => {
        if (performingArtist === selectedArtist) return;
        getSongList(songList).forEach(song => {
          if (getSongCover(song) === selectedArtist) {
            coversByOthers.push({ songName: getSongName(song), concert: c, performingArtist });
          }
        });
      };
      checkSongs(c.setlist, c.artist);
      Object.entries(c.supportSetlists || {}).forEach(([a, songs]) => checkSongs(songs, a));
    });
    return (
      <div style={{ padding: "0 0 100px" }}>
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSelectedArtist(null)} style={{
            background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1
          }}>←</button>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>{selectedArtist}</div>
            <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
              {totalAppearances} appearance{totalAppearances !== 1 ? "s" : ""}{roleParts.length > 0 && pastShows.length !== totalAppearances ? ` · ${roleParts.join(' · ')}` : ''}{allUpcoming.length > 0 ? ` · ${allUpcoming.length} upcoming` : ""}
            </div>
          </div>
        </div>
        {/* Hero count + money stats */}
        {(() => {
          const priced = pastShows.filter(c => c.ticketPrice > 0);
          const avgTicket = priced.length ? priced.reduce((a, c) => a + c.ticketPrice, 0) / priced.length : null;
          const totalSpentOnArtist = pastShows.reduce((s, c) => s + (c.ticketPrice || 0) + (c.merch || []).reduce((m, x) => m + (parseFloat(x.price) || 0), 0), 0);
          const totalSongsHeard = pastShows.reduce((s, c) => s + getSongList(c.setlist).length, 0);
          const costPerSong = totalSongsHeard > 0 && totalSpentOnArtist > 0 ? totalSpentOnArtist / totalSongsHeard : null;
          const merchItems = pastShows.flatMap(c => c.merch || []);
          const merchSpend = merchItems.reduce((a, m) => a + (parseFloat(m.price) || 0), 0);
          const photos = pastShows.filter(c => c.photo);
          return (
            <>
              <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{totalAppearances}×</span>
                <span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>seen live</span>
                {avgTicket !== null && <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>avg ticket <span style={{ color: "#c4c2f0" }}>€{avgTicket.toFixed(0)}</span></span>}
              </div>
              {(merchItems.length > 0) && (
                <div style={{ padding: "4px 16px 0", fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
                  {merchItems.length} merch item{merchItems.length !== 1 ? 's' : ''} bought · €{merchSpend.toFixed(0)}
                </div>
              )}
              {(totalSongsHeard > 0 || costPerSong) && (
                <div style={{ padding: "4px 16px 0", fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
                  {totalSongsHeard} songs heard live{costPerSong ? <span> · <span style={{ color: "#c4c2f0" }}>€{costPerSong.toFixed(2)}</span> / song</span> : null}
                </div>
              )}
              {photos.length > 0 && (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 16px 0", WebkitOverflowScrolling: "touch" }}>
                  {photos.map(c => (
                    <button key={c.id} onClick={() => onOpen(c)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                      <PhotoImg path={c.photo} pos={c.photoPos} style={{ width: 150, aspectRatio: "16 / 10", borderRadius: 10 }} />
                      <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3, textAlign: "left" }}>{c.date.slice(0, 4)} · {isOnline(c) ? formatOnlineLocation(c) : c.venue}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}
        {/* Quick stats row */}
        {(avgRating || sinceYear || topFriend) && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${[avgRating, sinceYear, topFriend].filter(Boolean).length}, 1fr)`, gap: 8, padding: "12px 16px", borderBottom: "1px solid #1f1f35" }}>
            {sinceYear && (
              <div style={{ background: "#13131f", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{sinceYear}</div>
                <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>since</div>
              </div>
            )}
            {avgRating && (
              <div style={{ background: "#13131f", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>★ {avgRating}</div>
                <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>avg rating</div>
              </div>
            )}
            {topFriend && (
              <div onClick={() => onNavigate({ view: 'friends' })} style={{ background: "#13131f", borderRadius: 10, padding: "10px 8px", textAlign: "center", cursor: "pointer" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: "#a78bfa", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{topFriend[0]} ›</div>
                <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>top friend · {topFriend[1]}×</div>
              </div>
            )}
          </div>
        )}
        <div style={{ padding: "14px 16px" }}>
          {allUpcoming.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Upcoming</div>
              {allUpcoming.map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
            </div>
          )}
          {pastShows.length > 0 && (
            <div style={{ marginBottom: supportApps.length > 0 ? 16 : 0 }}>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Headliner</div>
              {pastShows.map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
            </div>
          )}
          {artistSongs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Songs heard live · {artistSongs.length} unique
              </div>
              <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 10, padding: "10px 12px" }}>
                {artistSongs.map(([song, count], i) => (
                  <div key={song} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: i < artistSongs.length - 1 ? 6 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#4a4870", fontSize: 10, fontFamily: "'DM Mono', monospace", width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ color: "#c4c2f0", fontSize: 12 }}>{song}</span>
                    </div>
                    {count > 1 && <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{count}×</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {coversByOthers.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Covered by others · {coversByOthers.length} {coversByOthers.length === 1 ? 'time' : 'times'}
              </div>
              <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 10, padding: "10px 12px" }}>
                {coversByOthers.map(({ songName, concert: c, performingArtist }, i) => (
                  <button key={`cover-${i}`} onClick={() => onOpen(c)} style={{
                    width: "100%", textAlign: "left", background: "none", border: "none",
                    borderBottom: i < coversByOthers.length - 1 ? "1px solid #1f1f35" : "none",
                    padding: "6px 0", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#c4c2f0", fontSize: 12, fontWeight: 500 }}>{songName}</div>
                      <div style={{ color: "#fb923c", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>↩ {performingArtist}</div>
                    </div>
                    <div style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace", flexShrink: 0, textAlign: "right" }}>
                      {formatDate(c.date)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {supportApps.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Support, guest & festival</div>
              {supportApps.map(({ concert: c, role }) => {
                const isFestRole = role === 'festival';
                const online = isOnline(c);
                const borderColor = online ? ONLINE_COLOR : role === 'guest' ? '#f472b6' : isFestRole ? '#f472b633' : '#3d3564';
                const badgeBg = role === 'guest' ? '#1a1030' : isFestRole ? '#1a1030' : '#1a1a30';
                const badgeColor = role === 'guest' ? '#f472b6' : isFestRole ? '#f472b6' : '#a78bfa';
                return (
                  <button key={`${c.id}-${role}`} onClick={() => onOpen(c)} style={{
                    width: "100%", textAlign: "left", background: "#0e0e1a",
                    border: "1px solid #1f1f35", borderLeft: `3px solid ${borderColor}`,
                    borderRadius: 10, padding: "11px 14px", cursor: "pointer", marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 12
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 600, padding: "1px 5px", borderRadius: 99, background: badgeBg, color: badgeColor, textTransform: "uppercase" }}>{isFestRole ? 'festival' : role}</span>
                        <span style={{ fontSize: 13, color: "#e2e0ff", fontWeight: 500 }}>{formatDate(c.date)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#c4c2f0", fontWeight: 500 }}>{c.artist}</div>
                      <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
                        {online ? formatOnlineLocation(c) : <>{c.venue}{c.room ? ` · ${c.room}` : ""} · {c.city}</>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Artist overview stats ───────────────────────────────────────────────────
  const totalArtists = artistEntries.length;
  const uniqueGenres = new Set(artistEntries.flatMap(a => a.shows.flatMap(c => getGenres(c)))).size;
  const pastArtists = artistEntries.filter(a => a.pastCount > 0);
  const avgShowsPerArtist = pastArtists.length ? (pastArtists.reduce((s, a) => s + a.pastCount, 0) / pastArtists.length).toFixed(1) : null;
  const thisYear = String(new Date().getFullYear());
  const newThisYear = artistEntries.filter(a => {
    const pastSorted = [...a.pastShows].sort((x,y) => x.date.localeCompare(y.date));
    return pastSorted[0]?.date.startsWith(thisYear);
  }).length;
  const withUpcoming = artistEntries.filter(a => a.upcomingShows.length > 0).length;
  const headlinerOnly = artistEntries.filter(a => a.pastCount > 0 && a.supportCount === 0 && a.guestCount === 0 && a.festivalCount === 0).length;
  const supportDiscovered = artistEntries.filter(a => a.pastCount === 0 && (a.supportCount > 0 || a.guestCount > 0 || a.festivalCount > 0)).length;
  const mostSeen = [...artistEntries].sort((a,b) => b.pastCount - a.pastCount)[0];
  const longestGap = [...pastArtists]
    .map(a => ({ name: a.name, lastDate: a.lastShow?.date, gap: a.lastShow ? Math.floor((Date.now() - new Date(a.lastShow.date + 'T00:00:00').getTime()) / (1000*60*60*24*30)) : null }))
    .filter(a => a.gap !== null && a.gap > 6)
    .sort((a,b) => b.gap - a.gap)[0];

  return (
    <div style={{ padding: "0 0 100px" }}>
      {/* Artist overview header */}
      {!search && activeFilterCount === 0 && (
        <div style={{ padding: "12px 16px 0" }}>
          {/* Primary tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
            {[
              { value: totalArtists, label: "artists" },
              { value: uniqueGenres, label: "genres" },
              { value: newThisYear, label: `new in ${thisYear.slice(2)}` },
              { value: avgShowsPerArtist ?? "—", label: "avg shows" },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 10, padding: "9px 6px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Search + controls */}
      <div style={{ padding: "12px 16px 0", position: "relative", zIndex: 10 }}>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#4a4870", fontSize: 13, pointerEvents: "none" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search artist..."
            style={{
              width: "100%", background: "#13131f", border: `1px solid ${search ? "#a78bfa" : "#1f1f35"}`,
              borderRadius: 10, color: "#c4c2f0", padding: "9px 32px 9px 32px",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: "border-box"
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "#4a4870", cursor: "pointer", fontSize: 14, padding: 0
            }}>×</button>
          )}
        </div>

        {/* Sort + Filter pill row */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowTypeDropdown(d => !d)} style={{ minHeight: 30, background: filterType !== 'all' ? '#a78bfa' : 'none', border: `1px solid ${filterType !== 'all' ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: filterType !== 'all' ? '#0c0c14' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: filterType !== 'all' ? 700 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
              {filterType === 'all' ? 'All' : filterType === 'concerts' ? 'Shows' : 'Fest'}
              <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
            </button>
            {showTypeDropdown && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#13131f', border: '1px solid #2e2e50', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 100 }}>
                {[['all','All'],['concerts','Shows'],['festivals','Fest']].map(([id,label], i) => (
                  <button key={id} onClick={() => { setFilterType(id); setShowTypeDropdown(false); }} style={{ width: '100%', background: filterType === id ? '#1a1a30' : 'none', border: 'none', borderBottom: i < 2 ? '1px solid #0c0c14' : 'none', padding: '9px 14px', cursor: 'pointer', textAlign: 'left', color: filterType === id ? '#a78bfa' : '#c4c2f0', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{label}</button>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setShowSort(s => !s); setShowFilters(false); }} style={{ background: showSort || sortBy !== 'most-seen' ? '#1a1a30' : 'none', border: `1px solid ${showSort || sortBy !== 'most-seen' ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: sortBy !== 'most-seen' ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: sortBy !== 'most-seen' ? 700 : 400, flexShrink: 0 }}>
            Sort{sortBy !== 'most-seen' ? ' ↕' : ''}
          </button>
          <button onClick={() => { setShowFilters(f => !f); setShowSort(false); }} style={{ background: showFilters || activeFilterCount > 0 ? '#1a1a30' : 'none', border: `1px solid ${showFilters || activeFilterCount > 0 ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: activeFilterCount > 0 ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: activeFilterCount > 0 ? 700 : 400, flexShrink: 0 }}>
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </button>
        </div>

        {showSort && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            {sortBy !== 'most-seen' && <button onClick={() => setSortBy('most-seen')} style={{ marginBottom: 10, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[{id:'most-seen',label:'Most seen'},{id:'alpha',label:'A–Z'},{id:'recently-seen',label:'Recently seen'},{id:'rating',label:'Avg rating'}].map(s => (
                <button key={s.id} onClick={() => setSortBy(s.id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortBy === s.id ? '#a78bfa' : '#0c0c14', color: sortBy === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortBy === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
              ))}
            </div>
          </div>
        )}

        {showFilters && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10, maxHeight: '55vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            {activeFilterCount > 0 && <button onClick={() => { setFilterGenre('all'); setFilterMinSeen(0); setFilterUpcoming(false); }} style={{ marginBottom: 10, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Times seen</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{v:0,label:'All'},{v:2,label:'2+'},{v:3,label:'3+'},{v:5,label:'5+'}].map(opt => (
                  <button key={opt.v} onClick={() => setFilterMinSeen(opt.v)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterMinSeen === opt.v ? '#a78bfa' : '#0c0c14', color: filterMinSeen === opt.v ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterMinSeen === opt.v ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{opt.label}</button>
                ))}
              </div>
            </div>
            {allGenres.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Genre</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(() => {
                    const _top = allGenres.slice(0,3); const _rest = allGenres.slice(3);
                    return (<>
                      <button onClick={() => setFilterGenre('all')} style={{ padding:'4px 10px', borderRadius:99, fontSize:11, cursor:'pointer', background:filterGenre==='all'?'#a78bfa':'#0c0c14', color:filterGenre==='all'?'#0c0c14':'#6b6a8f', border:`1px solid ${filterGenre==='all'?'#a78bfa':'#1f1f35'}`, fontFamily:"'DM Mono', monospace" }}>All</button>
                      {_top.map(g => <button key={g} onClick={() => setFilterGenre(filterGenre===g?'all':g)} style={{ padding:'4px 10px', borderRadius:99, fontSize:11, cursor:'pointer', background:filterGenre===g?'#a78bfa':'#0c0c14', color:filterGenre===g?'#0c0c14':'#6b6a8f', border:`1px solid ${filterGenre===g?'#a78bfa':'#1f1f35'}`, fontFamily:"'DM Mono', monospace" }}>{g}</button>)}
                      {_rest.length > 0 && <select value={_rest.includes(filterGenre)?filterGenre:''} onChange={e => e.target.value && setFilterGenre(e.target.value)} style={{ background:_rest.includes(filterGenre)?'#a78bfa':'#0c0c14', border:`1px solid ${_rest.includes(filterGenre)?'#a78bfa':'#1f1f35'}`, borderRadius:99, color:_rest.includes(filterGenre)?'#0c0c14':'#6b6a8f', fontFamily:"'DM Mono', monospace", fontSize:11, padding:'4px 8px', cursor:'pointer', WebkitAppearance:'none', appearance:'none' }}><option value=''>more ▾</option>{_rest.map(g => <option key={g} value={g}>{g}</option>)}</select>}
                    </>);
                  })()}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Upcoming only</div>
              <button onClick={() => setFilterUpcoming(f => !f)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterUpcoming ? '#818cf8' : '#0c0c14', color: filterUpcoming ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterUpcoming ? '#818cf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Has upcoming</button>
            </div>
          </div>
        )}
      </div>

      {/* Artist list */}
      <div style={{ padding: "0 16px" }}>
        {sorted.map(({ name, pastCount, upcomingShows, upcomingSupportApps, firstShow, lastShow, avgRating, topGenre, supportCount, guestCount, festivalCount, supportApps }) => {
          const total = pastCount + supportCount + guestCount + festivalCount;
          const latestSupportDate = supportApps.length > 0 ? supportApps.slice().sort((a,b) => b.concert.date.localeCompare(a.concert.date))[0].concert.date : null;
          const displayDate = lastShow ? lastShow.date : latestSupportDate;
          const soonCount = upcomingShows.length + upcomingSupportApps.length;
          return (
          <button key={name} onClick={() => setSelectedArtist(name)} style={{
            width: "100%", textAlign: "left", background: "#13131f",
            border: "1px solid #1f1f35", borderLeft: `3px solid ${getBorderColor(total)}`,
            borderRadius: 10, padding: "12px 14px", cursor: "pointer", marginBottom: 8,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#e2e0ff" }}>{name}</span>
                {topGenre && (
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 99, background: '#1a1a30', color: '#6b6a8f', flexShrink: 0 }}>{topGenre}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
                {firstShow && lastShow && firstShow.date !== lastShow.date
                  ? `${firstShow.date.slice(0,4)} – ${lastShow.date.slice(0,4)} · last ${formatDate(lastShow.date)}`
                  : displayDate ? formatDate(displayDate) : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#6b6a8f', lineHeight: 1 }}>{total}</span>
                <span style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginLeft: 3 }}>time{total !== 1 ? 's' : ''}</span>
              </div>
              {(supportCount > 0 || guestCount > 0 || festivalCount > 0) && (
                <div style={{ fontSize: 9, color: '#4a4870', fontFamily: "'DM Mono', monospace", textAlign: 'right' }}>
                  {[pastCount > 0 && `${pastCount}h`, supportCount > 0 && `${supportCount}s`, guestCount > 0 && `${guestCount}g`, festivalCount > 0 && `${festivalCount}f`].filter(Boolean).join('·')}
                </div>
              )}
              {soonCount > 0 && (
                <div style={{ fontSize: 9, color: '#818cf8', fontFamily: "'DM Mono', monospace" }}>+{soonCount} soon</div>
              )}
            </div>
          </button>
        ); })}
        {sorted.length === 0 && (
          <EmptyState title="No artists found" detail="Try another search or filter." />
        )}
      </div>
    </div>
  );
}

function SongsView({ concerts, onOpen, settings, saveSettings, onLinkSong }) {
  const past = concerts.filter(c => isPast(c.date));
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('count');
  const [topN, setTopN] = useState(settings?.topSongsRows || 5);
  const [selectedSong, setSelectedSong] = useState(null);
  const [songMatcher, setSongMatcher] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterSpotify, setFilterSpotify] = useState('all'); // 'all' | 'linked' | 'unlinked'
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSongSort, setShowSongSort] = useState(false);
  const [showSongFilters, setShowSongFilters] = useState(false);
  const [refreshingInfo, setRefreshingInfo] = useState(false);
  const handleRefreshSongInfo = async () => {
    if (!selectedSong?.spotifyId || refreshingInfo) return;
    setRefreshingInfo(true);
    try {
      const token = await getValidSpotifyToken(settings, saveSettings);
      if (!token) return;
      const r = await fetch(`https://api.spotify.com/v1/tracks/${selectedSong.spotifyId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const t = await r.json();
        const data = {
          durationMs: t.duration_ms || null,
          popularity: typeof t.popularity === 'number' ? t.popularity : null,
          trackNumber: t.track_number || null,
          albumName: t.album?.name || selectedSong.albumName,
          albumId: t.album?.id || selectedSong.albumId,
          albumArt: t.album?.images?.at(-1)?.url || selectedSong.albumArt,
        };
        onLinkSong && onLinkSong(selectedSong.name, selectedSong.artist, data);
        setSelectedSong(prev => prev ? { ...prev, ...data } : prev);
      }
    } finally {
      setRefreshingInfo(false);
    }
  };
  useBackButton(() => setSelectedSong(null), selectedSong !== null);

  const songCount = {};
  past.filter(c => filterType === 'all' || (filterType === 'concerts' ? c.type !== 'festival' : c.type === 'festival')).forEach(c => {
    const tally = (s, performer) => {
      const n = getSongName(s); if (!n) return;
      const cov = getSongCover(s);
      const a = (typeof cov === 'string' && cov) || performer || '';
      const k = n + '\n' + a;
      const sp = (s && typeof s === 'object') ? s : null;
      if (!songCount[k]) songCount[k] = { name: n, artist: a, count: 0, spotifyId: null, spotifyName: null, albumName: null, albumId: null, albumArt: null, durationMs: null, popularity: null, trackNumber: null };
      songCount[k].count += 1;
      if (sp?.spotifyId && !songCount[k].spotifyId) {
        songCount[k].spotifyId = sp.spotifyId;
        songCount[k].spotifyName = sp.spotifyName || null;
        songCount[k].albumName = sp.albumName || null;
        songCount[k].albumId = sp.albumId || null;
        songCount[k].albumArt = sp.albumArt || null;
        songCount[k].durationMs = sp.durationMs || null;
        songCount[k].popularity = typeof sp.popularity === 'number' ? sp.popularity : null;
        songCount[k].trackNumber = sp.trackNumber || null;
      }
    };
    getSongList(c.setlist).forEach(s => tally(s, c.artist));
    Object.entries(c.supportSetlists || {}).forEach(([an, songs]) => getSongList(songs).forEach(s => tally(s, an)));
  });
  const songEntries = Object.values(songCount);
  const totalUnique = songEntries.length;
  const totalHeard = songEntries.reduce((a, e) => a + e.count, 0);
  const linkedCount = songEntries.filter(e => e.spotifyId).length;

  const byCount = [...songEntries].sort((a, b) => b.count - a.count);
  const topSet = topN ? new Set(byCount.slice(0, topN)) : null;
  const filtered = songEntries
    .filter(e => (!topSet || topSet.has(e))
      && (!search || e.name.toLowerCase().includes(search.toLowerCase()) || e.artist.toLowerCase().includes(search.toLowerCase()))
      && (filterSpotify === 'all' || (filterSpotify === 'linked' ? e.spotifyId : !e.spotifyId)))
    .sort((a, b) => sortBy === 'count' ? b.count - a.count : (a.name.localeCompare(b.name) || a.artist.localeCompare(b.artist)));

  if (selectedSong) {
    const matchSong = (s, performer) => {
      if (getSongName(s) !== selectedSong.name) return false;
      const cov = getSongCover(s);
      return ((typeof cov === 'string' && cov) || performer || '') === selectedSong.artist;
    };
    const appearances = past.flatMap(c => {
      const result = [];
      const mainMatches = getSongList(c.setlist).filter(s => matchSong(s, c.artist));
      mainMatches.forEach(s => result.push({ concert: c, artist: c.artist, info: getSongInfo(s), cover: getSongCover(s), isSupport: false }));
      Object.entries(c.supportSetlists || {}).forEach(([artistName, songs]) => {
        const matches = getSongList(songs).filter(x => matchSong(x, artistName));
        matches.forEach(s => result.push({ concert: c, artist: artistName, info: getSongInfo(s), cover: getSongCover(s), isSupport: true }));
      });
      const perConcertCount = {};
      result.forEach(r => { perConcertCount[r.concert.id] = (perConcertCount[r.concert.id] || 0) + 1; });
      let seen = {};
      result.forEach(r => {
        seen[r.concert.id] = (seen[r.concert.id] || 0) + 1;
        r.occurrenceIndex = seen[r.concert.id];
        r.occurrenceTotal = perConcertCount[r.concert.id];
      });
      return result;
    }).sort((a, b) => b.concert.date.localeCompare(a.concert.date));
    const duration = formatDuration(selectedSong.durationMs);
    return (
      <div style={{ padding: '0 0 100px' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #1f1f35', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelectedSong(null)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: '#e2e0ff', lineHeight: 1 }}>{selectedSong.name}</div>
            <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
              {selectedSong.artist}{duration ? ` · ${duration}` : ''}
            </div>
            {selectedSong.albumName && selectedSong.albumId && (
              <a href={`https://open.spotify.com/album/${selectedSong.albumId}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 4, textDecoration: 'none' }}>
                {selectedSong.trackNumber ? `Track ${selectedSong.trackNumber} · ` : ''}{selectedSong.albumName} ↗
              </a>
            )}
            {selectedSong.spotifyId && (
              <a href={`https://open.spotify.com/track/${selectedSong.spotifyId}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#1DB954', fontSize: 10, fontFamily: "'DM Mono', monospace", textDecoration: 'none' }}>
                ▶ Listen on Spotify
              </a>
            )}
            {selectedSong.spotifyId && !selectedSong.durationMs && (
              <button onClick={handleRefreshSongInfo} disabled={refreshingInfo}
                style={{ display: 'block', background: 'none', border: 'none', padding: '4px 0 0', color: '#4a4870', fontSize: 10, fontFamily: "'DM Mono', monospace", cursor: refreshingInfo ? 'default' : 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                {refreshingInfo ? 'fetching…' : 'fetch duration & track info'}
              </button>
            )}
            {!selectedSong.spotifyId && settings.spotifyAccessToken && (
              <button onClick={() => setSongMatcher(selectedSong)}
                style={{ background: 'none', border: 'none', padding: '4px 0 0', color: '#1DB954', fontSize: 10, fontFamily: "'DM Mono', monospace", cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, display: 'block' }}>
                Link to Spotify →
              </button>
            )}
          </div>
          {selectedSong.albumArt && (
            <img src={selectedSong.albumArt} alt="" style={{ width: 54, height: 54, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
          )}
        </div>
        {/* Stat tiles: times live, popularity */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${1 + (typeof selectedSong.popularity === 'number' ? 1 : 0)}, 1fr)`, gap: 6, padding: '12px 16px 0' }}>
          <div style={{ background: '#13131f', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{appearances.length}×</div>
            <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>live</div>
          </div>
          {typeof selectedSong.popularity === 'number' && (
            <div style={{ background: '#13131f', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#1DB954', lineHeight: 1 }}>{selectedSong.popularity}</div>
              <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>popularity</div>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 16px' }}>
          {appearances.map(({ concert: c, artist, info, cover, isSupport, occurrenceIndex, occurrenceTotal }) => {
            const online = isOnline(c);
            return (
            <button key={`${c.id}-${artist}-${occurrenceIndex}`} onClick={() => onOpen(c)} style={{
              width: '100%', textAlign: 'left', background: '#0e0e1a', border: '1px solid #1f1f35',
              borderLeft: `3px solid ${online ? ONLINE_COLOR : isSupport ? '#3d3564' : '#a78bfa'}`,
              borderRadius: 10, padding: '11px 14px', cursor: 'pointer', marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 2
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#e2e0ff', fontWeight: 500 }}>{formatDate(c.date)}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {occurrenceTotal > 1 && <span style={{ fontSize: 9, color: '#34d399', fontFamily: "'DM Mono', monospace", padding: '1px 5px', background: '#0a1a12', borderRadius: 99 }}>{occurrenceIndex}/{occurrenceTotal} this show</span>}
                  {isSupport && <span style={{ fontSize: 9, color: '#a78bfa', fontFamily: "'DM Mono', monospace", padding: '1px 5px', background: '#1a1a30', borderRadius: 99 }}>support</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#c4c2f0', fontWeight: 600 }}>{artist}{cover ? <span style={{ color: '#fb923c', fontWeight: 400 }}> · cover</span> : null}</div>
              <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>{online ? formatOnlineLocation(c) : <>{c.venue}{c.room ? ` · ${c.room}` : ''} · {c.city}</>}</div>
              {info && <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace" }}>{info}</div>}
            </button>
          )})}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 100px' }}>
      <div style={{ padding: '14px 16px 10px' }}>
        {/* Stat tiles */}
        {!search && totalUnique > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${linkedCount > 0 ? 4 : 3}, 1fr)`, gap: 6, marginBottom: 12 }}>
            {[
              { value: totalUnique, label: "unique" },
              { value: byCount[0]?.count ?? "—", label: byCount[0] ? byCount[0].name.slice(0, 8) : "top" },
              { value: [...new Set(songEntries.map(e => e.artist).filter(Boolean))].length, label: "artists" },
              ...(linkedCount > 0 ? [{ value: linkedCount, label: "linked" }] : []),
            ].map(({ value, label }) => (
              <div key={label} style={{ background: "#13131f", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#e2e0ff' }}>Songs</div>
          {totalUnique > 0 && <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace" }}>{totalUnique} unique · {totalHeard} total</div>}
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#4a4870', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search songs…"
            style={{ width: '100%', background: '#13131f', border: `1px solid ${search ? '#a78bfa' : '#1f1f35'}`, borderRadius: 10, color: '#c4c2f0', padding: '9px 32px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Type dropdown */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowTypeDropdown(d => !d)} style={{ minHeight: 30, padding: '5px 11px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterType !== 'all' ? '#a78bfa' : '#13131f', color: filterType !== 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterType !== 'all' ? '#a78bfa' : '#1f1f35'}`, fontWeight: filterType !== 'all' ? 700 : 400, fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
              {filterType === 'all' ? 'All' : filterType === 'concerts' ? 'Shows' : 'Fest'}
              <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
            </button>
            {showTypeDropdown && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#13131f', border: '1px solid #2e2e50', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 100 }}>
                {[['all','All'],['concerts','Shows'],['festivals','Fest']].map(([id,label], i) => (
                  <button key={id} onClick={() => { setFilterType(id); setShowTypeDropdown(false); }} style={{ width: '100%', background: filterType === id ? '#1a1a30' : 'none', border: 'none', borderBottom: i < 2 ? '1px solid #0c0c14' : 'none', padding: '9px 14px', cursor: 'pointer', textAlign: 'left', color: filterType === id ? '#a78bfa' : '#c4c2f0', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{label}</button>
                ))}
              </div>
            )}
          </div>
          {/* Sort toggle */}
          <button onClick={() => { setShowSongSort(s => !s); setShowSongFilters(false); }} style={{ minHeight: 30, background: showSongSort || sortBy !== 'count' || topN !== null ? '#1a1a30' : 'none', border: `1px solid ${showSongSort || sortBy !== 'count' || topN !== null ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: sortBy !== 'count' || topN !== null ? '#a78bfa' : '#6b6a8f', fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: sortBy !== 'count' || topN !== null ? 700 : 400, flexShrink: 0 }}>
            Sort{sortBy !== 'count' || topN !== null ? ' ↕' : ''}
          </button>
          {/* Linked/unlinked filter toggle */}
          {linkedCount > 0 && (
            <button onClick={() => { setShowSongFilters(f => !f); setShowSongSort(false); }} style={{ minHeight: 30, background: showSongFilters || filterSpotify !== 'all' ? '#1a1a30' : 'none', border: `1px solid ${showSongFilters || filterSpotify !== 'all' ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: filterSpotify !== 'all' ? '#a78bfa' : '#6b6a8f', fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: filterSpotify !== 'all' ? 700 : 400, flexShrink: 0 }}>
              {filterSpotify === 'all' ? 'Spotify' : filterSpotify === 'linked' ? 'Linked ●' : 'Unlinked'}
            </button>
          )}
        </div>
        {showSongSort && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '12px', marginTop: 8 }}>
            {(sortBy !== 'count' || topN !== null) && <button onClick={() => { setSortBy('count'); setTopN(null); }} style={{ marginBottom: 10, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
            <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Sort by</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[{id:'count',label:'Most heard'},{id:'alpha',label:'A–Z'}].map(o => (
                <button key={o.id} onClick={() => setSortBy(o.id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortBy===o.id ? '#a78bfa' : '#0c0c14', color: sortBy===o.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortBy===o.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace", fontWeight: sortBy===o.id ? 700 : 400 }}>{o.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Show</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[{v:null,label:'All'},{v:5,label:'Top 5'},{v:10,label:'Top 10'},{v:20,label:'Top 20'}].map(o => (
                <button key={o.label} onClick={() => setTopN(o.v)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: topN===o.v ? '#3d3564' : '#0c0c14', color: topN===o.v ? '#c4c2f0' : '#6b6a8f', border: `1px solid ${topN===o.v ? '#6d5fa8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace", fontWeight: topN===o.v ? 700 : 400 }}>{o.label}</button>
              ))}
            </div>
          </div>
        )}
        {showSongFilters && linkedCount > 0 && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '12px', marginTop: 8 }}>
            {filterSpotify !== 'all' && <button onClick={() => setFilterSpotify('all')} style={{ marginBottom: 10, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[['all','All'],['linked','Linked ●'],['unlinked','Unlinked']].map(([id, label]) => (
                <button key={id} onClick={() => setFilterSpotify(id)}
                  style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontWeight: filterSpotify === id ? 700 : 400,
                    background: filterSpotify === id ? (id === 'linked' ? '#0a2a18' : id === 'unlinked' ? '#1f1f35' : '#a78bfa') : '#0c0c14',
                    color: filterSpotify === id ? (id === 'linked' ? '#1DB954' : id === 'unlinked' ? '#c4c2f0' : '#0c0c14') : '#6b6a8f',
                    border: `1px solid ${filterSpotify === id ? (id === 'linked' ? '#1DB954' : id === 'unlinked' ? '#3a3858' : '#a78bfa') : '#1f1f35'}` }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '0 16px' }}>
        {totalUnique === 0 ? (
          <div style={{ textAlign: 'center', color: '#2e2e4a', padding: '40px 0', fontSize: 13, fontFamily: "'DM Mono', monospace" }}>log setlists on your shows to see songs here</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No songs found" detail="Add setlists to shows and songs will collect here." />
        ) : filtered.map((e, i) => (
          <button key={`${e.name}\n${e.artist}`} onClick={() => setSelectedSong({ name: e.name, artist: e.artist, spotifyId: e.spotifyId || null, spotifyName: e.spotifyName || null, albumName: e.albumName || null, albumId: e.albumId || null, albumArt: e.albumArt || null, durationMs: e.durationMs || null, popularity: typeof e.popularity === 'number' ? e.popularity : null, trackNumber: e.trackNumber || null })} style={{
            width: '100%', textAlign: 'left', background: '#13131f', border: '1px solid #1f1f35',
            borderLeft: `3px solid ${e.count >= 5 ? '#a78bfa' : e.count >= 3 ? '#6d5fa8' : e.count >= 2 ? '#3d3564' : '#2e2e4a'}`,
            borderRadius: 10, padding: '11px 14px', cursor: 'pointer', marginBottom: 6,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ color: '#4a4870', fontSize: 10, fontFamily: "'DM Mono', monospace", width: 20, textAlign: 'right', flexShrink: 0 }}>
                {sortBy === 'count' ? (i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`) : null}
              </span>
              {e.albumArt
                ? <img src={e.albumArt} alt="" style={{ width: 34, height: 34, borderRadius: 4, flexShrink: 0, objectFit: 'cover' }} />
                : null}
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ color: '#c4c2f0', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                  {e.spotifyId && !e.albumArt && <span title="Linked to Spotify" style={{ color: '#1DB954', fontSize: 9, flexShrink: 0, lineHeight: 1 }}>●</span>}
                </span>
                <span style={{ color: '#6b6a8f', fontSize: 10, fontFamily: "'DM Mono', monospace", display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.artist}</span>
              </span>
            </div>
            <span style={{ color: '#6b6a8f', fontSize: 11, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{e.count}×</span>
          </button>
        ))}
      </div>
      {songMatcher && (
        <SpotifyMatcher
          artist={songMatcher.artist}
          songs={[{ name: songMatcher.name, spotifyId: songMatcher.spotifyId, spotifyName: songMatcher.spotifyName, albumName: songMatcher.albumName, albumId: songMatcher.albumId, albumArt: songMatcher.albumArt, durationMs: songMatcher.durationMs, popularity: songMatcher.popularity, trackNumber: songMatcher.trackNumber }]}
          settings={settings}
          saveSettings={saveSettings || (() => {})}
          onSave={([updated]) => {
            if (updated?.spotifyId && onLinkSong) {
              const data = { spotifyId: updated.spotifyId, spotifyName: updated.spotifyName, albumName: updated.albumName, albumId: updated.albumId, albumArt: updated.albumArt, durationMs: updated.durationMs, popularity: updated.popularity, trackNumber: updated.trackNumber }
              onLinkSong(songMatcher.name, songMatcher.artist, data)
              setSelectedSong(prev => prev ? { ...prev, ...data } : prev)
            }
            setSongMatcher(null)
          }}
          onClose={() => setSongMatcher(null)}
        />
      )}
    </div>
  );
}

function ArtistShowRow({ concert, onOpen }) {
  const past = isPast(concert.date);
  const isFestival = concert.type === "festival";
  const online = isOnline(concert);
  return (
    <button onClick={() => onOpen(concert)} style={{
      width: "100%", textAlign: "left",
      background: isFestival ? "#0e0e16" : past ? "#0e0e1a" : "#13131f",
      border: `1px solid ${isFestival ? "#2a1f35" : "#1f1f35"}`,
      borderLeft: `3px solid ${online ? ONLINE_COLOR : isFestival ? "#f472b6" : "#2e2e4a"}`,
      borderRadius: 10, padding: "11px 14px",
      cursor: "pointer", marginBottom: 6, display: "flex", alignItems: "center", gap: 12
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          {isFestival && <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 600, padding: "1px 5px", borderRadius: 99, background: "#1a1030", color: "#f472b6" }}>FEST</span>}
          <span style={{ fontSize: 13, color: "#e2e0ff", fontWeight: 500 }}>{formatDate(concert.date)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
          {online ? formatOnlineLocation(concert) : <>{concert.venue}{concert.room ? ` · ${concert.room}` : ""} · {concert.city}</>}
        </div>
        {concert.tour && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2 }}>{concert.tour}</div>}
        {getFriends(concert).length > 0 && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2 }}>w. {getFriends(concert).join(", ")}</div>}
        {concert.rating && <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 3 }}>{"★".repeat(Math.min(concert.rating, 10))}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {concert.ticketPrice && <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>€{concert.ticketPrice}</div>}
        {!past && <div style={{ fontSize: 9, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>upcoming</div>}
      </div>
    </button>
  );
}

function VenuesView({ concerts, onOpen, settings, onUpdateSetting = () => {}, onNavigate = () => {} }) {
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('most-visited');
  const [showSort, setShowSort] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [showVenuePast, setShowVenuePast] = useState(false);
  const [showVenueUpcoming, setShowVenueUpcoming] = useState(false);
  const [editingVenueUrl, setEditingVenueUrl] = useState(false);
  const [venueUrlInput, setVenueUrlInput] = useState('');
  useEffect(() => { setShowVenuePast(false); setShowVenueUpcoming(false); setEditingVenueUrl(false); }, [selectedVenue]);

  useBackButton(() => setSelectedVenue(null), selectedVenue !== null);

  // Build venue map
  const venueMap = {};
  concerts.filter(c => !isWish(c) && c.venue).forEach(c => {
    const key = c.venue.trim();
    if (!venueMap[key]) venueMap[key] = [];
    venueMap[key].push(c);
  });

  const venueEntries = Object.entries(venueMap).map(([name, shows]) => {
    const past = shows.filter(c => isPast(c.date));
    const upcoming = shows.filter(c => !isPast(c.date));
    const rated = past.filter(c => c.rating);
    const avgRating = rated.length ? rated.reduce((s, c) => s + c.rating, 0) / rated.length : null;
    const priced = past.filter(c => c.ticketPrice > 0);
    const avgTicket = priced.length ? priced.reduce((s, c) => s + c.ticketPrice, 0) / priced.length : null;
    const city = shows[0]?.city || null;
    const country = shows[0]?.country || null;
    const lastVisit = past.sort((a,b) => b.date.localeCompare(a.date))[0] || null;
    const photos = past.filter(c => c.photo);
    return { name, shows, past, upcoming, pastCount: past.length, avgRating, avgTicket, city, country, lastVisit, photos };
  });

  const sorted = venueEntries
    .filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()))
    .filter(v => filterType === 'all' || (filterType === 'concerts' ? v.past.some(c => c.type !== 'festival') : v.past.some(c => c.type === 'festival')))
    .sort((a, b) => {
      if (sortBy === 'most-visited') return b.pastCount - a.pastCount || a.name.localeCompare(b.name);
      if (sortBy === 'alpha') return a.name.localeCompare(b.name);
      if (sortBy === 'recent') return (b.lastVisit?.date || '').localeCompare(a.lastVisit?.date || '');
      if (sortBy === 'rating') return (b.avgRating || 0) - (a.avgRating || 0) || b.pastCount - a.pastCount;
      return 0;
    });

  if (selectedVenue) {
    const v = venueEntries.find(x => x.name === selectedVenue);
    if (!v) return null;
    const allShows = v.shows.sort((a,b) => b.date.localeCompare(a.date));
    const totalSpent = v.past.reduce((s, c) => s + (c.ticketPrice || 0) + (c.merch || []).reduce((m, x) => m + (parseFloat(x.price) || 0), 0), 0);
    const artists = [...new Set(v.past.map(c => c.artist))];
    const friendCount = {};
    v.past.forEach(c => getFriends(c).forEach(f => { friendCount[f] = (friendCount[f] || 0) + 1; }));
    const topFriend = Object.entries(friendCount).sort((a,b) => b[1]-a[1])[0] || null;
    const rooms = [...new Set(v.past.filter(c => c.room).map(c => c.room))];
    return (
      <div style={{ padding: '0 0 100px' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #1f1f35', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelectedVenue(null)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#e2e0ff', lineHeight: 1 }}>{selectedVenue}</div>
            <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
              {v.city && `${v.city}${v.country ? `, ${v.country}` : ''} · `}{v.pastCount}× visited{v.upcoming.length > 0 ? ` · ${v.upcoming.length} upcoming` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([selectedVenue, v.city, v.country].filter(Boolean).join(' '))}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38bdf8', fontSize: 10, fontFamily: "'DM Mono', monospace", textDecoration: 'none' }}>
                📍 Open in Maps ↗
              </a>
              {(() => {
                const venueUrl = (settings.venueUrls || {})[selectedVenue] || '';
                return !editingVenueUrl ? (
                  <>
                    {venueUrl && (
                      <a href={venueUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38bdf8', fontSize: 10, fontFamily: "'DM Mono', monospace", textDecoration: 'none' }}>
                        🔗 Website ↗
                      </a>
                    )}
                    <button onClick={() => { setVenueUrlInput(venueUrl); setEditingVenueUrl(true); }} style={{ background: 'none', border: 'none', padding: 0, color: '#4a4870', fontSize: 10, fontFamily: "'DM Mono', monospace", cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      {venueUrl ? 'edit' : '+ add website'}
                    </button>
                  </>
                ) : null;
              })()}
            </div>
            {editingVenueUrl && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input value={venueUrlInput} onChange={e => setVenueUrlInput(e.target.value)} placeholder="https://venue-website.com" autoFocus
                  style={{ flex: 1, background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '6px 10px', fontFamily: "'DM Mono', monospace", fontSize: 11, boxSizing: 'border-box' }} />
                <button onClick={() => {
                  const next = { ...(settings.venueUrls || {}) };
                  const trimmed = venueUrlInput.trim();
                  if (trimmed) next[selectedVenue] = trimmed; else delete next[selectedVenue];
                  onUpdateSetting('venueUrls', next);
                  setEditingVenueUrl(false);
                }} style={{ background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 11, fontWeight: 700, padding: '0 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Save</button>
                <button onClick={() => setEditingVenueUrl(false)} style={{ background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#6b6a8f', fontSize: 11, padding: '0 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '14px 16px 0' }}>
          <div style={{ background: '#13131f', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{v.pastCount}×</div>
            <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>visited</div>
          </div>
          {v.avgTicket && (
            <div style={{ background: '#13131f', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>€{v.avgTicket.toFixed(0)}</div>
              <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>avg ticket</div>
            </div>
          )}
          {totalSpent > 0 && (
            <div style={{ background: '#13131f', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>€{totalSpent.toFixed(0)}</div>
              <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>total spent</div>
            </div>
          )}
          {v.avgRating && (
            <div style={{ background: '#13131f', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>★ {v.avgRating.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>avg rating</div>
            </div>
          )}
          {artists.length > 0 && (
            <div style={{ background: '#13131f', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{artists.length}</div>
              <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>artists seen</div>
            </div>
          )}
          {topFriend && (
            <div onClick={() => onNavigate({ view: 'friends' })} style={{ background: '#13131f', borderRadius: 10, padding: '10px 8px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: '#a78bfa', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topFriend[0]} ›</div>
              <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>top friend · {topFriend[1]}×</div>
            </div>
          )}
        </div>
        {rooms.length > 0 && <div style={{ padding: '10px 16px 0', fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>Rooms/stages: {rooms.join(', ')}</div>}

        {/* Photos */}
        {v.photos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }}>
            {v.photos.map(c => (
              <button key={c.id} onClick={() => onOpen(c)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                <PhotoImg path={c.photo} pos={c.photoPos} style={{ width: 150, aspectRatio: '16 / 10', borderRadius: 10 }} />
                <div style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{c.date.slice(0,4)} · {c.artist}</div>
              </button>
            ))}
          </div>
        )}

        {/* Shows list */}
        <div style={{ padding: '14px 16px' }}>
          {v.upcoming.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setShowVenueUpcoming(u => !u)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: '#34d399', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Upcoming</span>
                  <span style={{ fontSize: 10, color: '#2e4a3a', fontFamily: "'DM Mono', monospace", background: '#0a1a12', border: '1px solid #2a4a3a', borderRadius: 99, padding: '1px 7px' }}>{v.upcoming.length}</span>
                </div>
                <span style={{ fontSize: 11, color: '#34d399', transform: showVenueUpcoming ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
              </button>
              {showVenueUpcoming && v.upcoming.sort((a,b) => a.date.localeCompare(b.date)).map(c => (
                <button key={c.id} onClick={() => onOpen(c)} style={{ width: '100%', textAlign: 'left', background: '#0e0e1a', border: '1px solid #1f1f35', borderLeft: '3px solid #34d399', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#e2e0ff', fontWeight: 500 }}>{c.artist}</div>
                    <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>{formatDate(c.date)}{c.room ? ` · ${c.room}` : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowVenuePast(p => !p)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Past shows</span>
              <span style={{ fontSize: 10, color: '#2e2e50', fontFamily: "'DM Mono', monospace", background: '#13131f', border: '1px solid #1f1f35', borderRadius: 99, padding: '1px 7px' }}>{v.past.length}</span>
            </div>
            <span style={{ fontSize: 11, color: '#4a4870', transform: showVenuePast ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
          </button>
          {showVenuePast && v.past.sort((a,b) => b.date.localeCompare(a.date)).map(c => (
            <button key={c.id} onClick={() => onOpen(c)} style={{ width: '100%', textAlign: 'left', background: '#0e0e1a', border: '1px solid #1f1f35', borderLeft: '3px solid #a78bfa', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e0ff', fontWeight: 500 }}>{c.artist}</div>
                  <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>{formatDate(c.date)}{c.room ? ` · ${c.room}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  {c.rating && <div style={{ fontSize: 11, color: '#a78bfa', fontFamily: "'DM Mono', monospace" }}>★ {c.rating}</div>}
                  {c.ticketPrice && <div style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace" }}>€{c.ticketPrice}</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const totalVenues = venueEntries.filter(v => v.pastCount > 0).length;
  const uniqueCountries = [...new Set(venueEntries.flatMap(v => v.shows.map(c => c.country)).filter(Boolean))].length;
  const uniqueCities = [...new Set(venueEntries.flatMap(v => v.shows.map(c => c.city)).filter(Boolean))].length;
  const mostVisited = venueEntries.sort((a,b) => b.pastCount - a.pastCount)[0];

  return (
    <div style={{ padding: '0 0 100px' }}>
      {/* Stat tiles */}
      {!search && (
        <div style={{ padding: '10px 12px 0', marginBottom: 2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
            {[
              { value: totalVenues, label: "venues" },
              { value: uniqueCities, label: "cities" },
              { value: uniqueCountries, label: "countries" },
              { value: mostVisited?.pastCount ?? "—", label: mostVisited ? mostVisited.name.slice(0, 8) : "top" },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 10, padding: "9px 6px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Type pills */}
      <div style={{ padding: '10px 12px 0', display: 'flex', gap: 6 }}>
        {[['all','All'],['concerts','Shows'],['festivals','Fest']].map(([id,label]) => (
          <button key={id} onClick={() => setFilterType(id)} style={{ background:filterType===id?'#a78bfa':'none', border:`1px solid ${filterType===id?'#a78bfa':'#1f1f35'}`, borderRadius:99, padding:'5px 11px', cursor:'pointer', color:filterType===id?'#0c0c14':'#6b6a8f', fontSize:12, fontFamily:"'DM Mono', monospace", fontWeight:filterType===id?700:400, flexShrink:0 }}>{label}</button>
        ))}
      </div>
      {/* Search + sort */}
      <div style={{ padding: '8px 12px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search venues..."
          style={{ flex: 1, background: '#0c0c14', border: '1px solid #1f1f35', borderRadius: 8, color: '#c4c2f0', padding: '7px 11px', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
        />
        <button onClick={() => setShowSort(s => !s)} style={{ background: showSort || sortBy !== 'most-visited' ? '#1a1a30' : 'none', border: `1px solid ${showSort || sortBy !== 'most-visited' ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: sortBy !== 'most-visited' ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: sortBy !== 'most-visited' ? 700 : 400, flexShrink: 0 }}>
          Sort{sortBy !== 'most-visited' ? ' ↕' : ''}
        </button>
      </div>
      {showSort && (
        <div style={{ margin: '0 12px 8px', background: '#13131f', border: '1px solid #1f1f35', borderRadius: 10, padding: '10px 12px' }}>
          {sortBy !== 'most-visited' && <button onClick={() => setSortBy('most-visited')} style={{ marginBottom: 8, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[{id:'most-visited',label:'Most visited'},{id:'alpha',label:'A–Z'},{id:'recent',label:'Recently visited'},{id:'rating',label:'Best rated'}].map(s => (
              <button key={s.id} onClick={() => setSortBy(s.id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortBy === s.id ? '#a78bfa' : '#0c0c14', color: sortBy === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortBy === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Venue list */}
      <div style={{ padding: '0 12px' }}>
        {sorted.map(v => (
          <button key={v.name} onClick={() => setSelectedVenue(v.name)} style={{ width: '100%', textAlign: 'left', background: '#0e0e1a', border: '1px solid #1f1f35', borderLeft: `3px solid ${v.pastCount >= 5 ? '#a78bfa' : v.pastCount >= 3 ? '#6d5fa8' : v.pastCount >= 2 ? '#3d3564' : '#2e2e4a'}`, borderRadius: 10, padding: '11px 14px', cursor: 'pointer', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: '#e2e0ff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
              <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                {v.city ? `${v.city} · ` : ''}{v.pastCount}× past{v.upcoming.length > 0 ? ` · ${v.upcoming.length} upcoming` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {v.avgRating && <div style={{ fontSize: 11, color: '#a78bfa', fontFamily: "'DM Mono', monospace" }}>★ {v.avgRating.toFixed(1)}</div>}
              {v.avgTicket && <div style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace" }}>€{v.avgTicket.toFixed(0)} avg</div>}
            </div>
          </button>
        ))}
        {sorted.length === 0 && <div style={{ textAlign: 'center', color: '#2e2e4a', fontSize: 13, fontFamily: "'DM Mono', monospace", marginTop: 40 }}>No venues found</div>}
      </div>
    </div>
  );
}

function AddConcertForm({ onSave, onClose, settings = {}, onUpdateSetting = null, friends = [], allArtists = [], recentFriends = [], initialType = 'concert', concerts = [] }) {
  useBackButton(onClose);
  const [pendingTag, setPendingTag] = useState(null);
  const [form, setForm] = useState({
    artist: '', date: '', endDate: '', venue: '', room: '', city: '', country: settings.defaultCountry || [...concerts].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.country || '',
    type: initialType === 'wish' ? 'concert' : initialType, wishlist: initialType === 'wish', tour: '', support: [], friends: [], solo: false,
    rating: null, ticketPrice: null, otherCost: null, costBreakdown: null, merch: [], notes: '',
    ticketType: null, ticketAddons: [],
    genre: null, subgenre: null, language: [], venueSize: null, seenAs: 'Headliner',
    acts: [], attendanceMode: 'in_person', onlineType: 'concert', platform: '',
  })
  const [supportInput, setSupportInput] = useState('')
  const [supportRole, setSupportRole] = useState('support')
  const [friendInput, setFriendInput] = useState('')
  const [showFriendPicker, setShowFriendPicker] = useState(false)
  const [errors, setErrors] = useState({})
  const [sfStatus, setSfStatus] = useState(null)
  const [sfMsg, setSfMsg] = useState('')
  const [openCards, setOpenCards] = useState([])
  const [sfUrl, setSfUrl] = useState('')
  const fillFromSetlistUrl = async () => {
    if (!sfUrl.trim()) return;
    setSfStatus('loading'); setSfMsg('');
    try {
      const r = await fetch(`/api/setlist?url=${encodeURIComponent(sfUrl.trim())}`, { signal: AbortSignal.timeout(15000) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setSfStatus('error'); setSfMsg('Could not read that link — is it a setlist.fm setlist URL?'); return; }
      setForm(f => ({
        ...f,
        artist: f.artist || data.artist || f.artist,
        date: f.date || data.date || f.date,
        venue: f.venue || data.venue || f.venue,
        city: f.city || data.city || f.city,
        country: f.country || data.country || f.country,
        tour: f.tour || data.tour || f.tour,
        setlist: (f.setlist && f.setlist.length) ? f.setlist : (data.songs || []),
      }));
      setSfStatus('done');
      setSfMsg(`Filled${data.artist ? ` · ${data.artist}` : ''}${data.songs?.length ? ` · ${data.songs.length} songs` : ''}${!data.venue ? ' · details need API key' : ''}`);
      setSfUrl('');
    } catch (e) { setSfStatus('error'); setSfMsg('Fetch failed — check your connection'); }
  };
  const quickUpcoming = form.date && !isPast(form.date);
  const autoFillFromSearch = async () => {
    setSfStatus('loading'); setSfMsg('');
    try {
      const r = await fetch(`/api/setlist?artist=${encodeURIComponent(form.artist)}&date=${form.date}`, { signal: AbortSignal.timeout(15000) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSfStatus('error');
        setSfMsg(r.status === 404 ? 'No setlist found for that artist + date' : r.status === 501 ? 'Search not available (no API key configured)' : 'Fetch failed — try again');
        return;
      }
      setForm(f => ({
        ...f,
        venue: f.venue || data.venue || f.venue,
        city: f.city || data.city || f.city,
        country: f.country || data.country || f.country,
        tour: f.tour || data.tour || f.tour,
        setlist: (f.setlist && f.setlist.length) ? f.setlist : (data.songs || []),
      }));
      setSfStatus('done');
      setSfMsg(`Filled${data.venue ? ` · ${data.venue}` : ''}${data.songs?.length ? ` · ${data.songs.length} songs` : ' · no songs listed'}`);
    } catch (e) {
      setSfStatus('error'); setSfMsg('Fetch failed — check your connection');
    }
  };

  const [citySuggestions, setCitySuggestions] = useState([])
  const [countrySuggestions, setCountrySuggestions] = useState([])
  const cityBook = {};
  [...concerts].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(c => { if (c.city) cityBook[c.city] = c.country || ''; });
  const countryList = [...new Set(concerts.map(c => c.country).filter(Boolean))].sort();
  const handleCityChange = (val) => {
    update('city', val)
    if (val.trim().length > 0) setCitySuggestions(Object.keys(cityBook).filter(v => v.toLowerCase().includes(val.toLowerCase())).slice(0, 6))
    else setCitySuggestions([])
  }
  const selectCity = (v) => { setForm(f => ({ ...f, city: v, country: f.country || cityBook[v] || f.country })); setCitySuggestions([]) }
  const handleCountryChange = (val) => {
    update('country', val)
    if (val.trim().length > 0) setCountrySuggestions(countryList.filter(v => v.toLowerCase().includes(val.toLowerCase())).slice(0, 6))
    else setCountrySuggestions([])
  }
  const selectCountry = (v) => { update('country', v); setCountrySuggestions([]) }
  const [artistSuggestions, setArtistSuggestions] = useState([])
  const [showDetails, setShowDetails] = useState(false)
  const merchCategories = settings.merchCategories || ['T-shirt','Hoodie','Crewneck','Tote bag','Poster','Hat / Cap','Other']
  const addMerchItem = () => setForm(f => ({ ...f, merch: [...f.merch, { item: merchCategories[0], price: '' }] }))
  const updateMerch = (i, key, val) => setForm(f => ({ ...f, merch: f.merch.map((m, j) => j === i ? { ...m, [key]: val } : m) }))
  const removeMerch = (i) => setForm(f => ({ ...f, merch: f.merch.filter((_, j) => j !== i) }))

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleArtistChange = (val) => {
    update('artist', val)
    if (val.trim().length > 0) {
      const matches = allArtists.filter(a => a.toLowerCase().includes(val.toLowerCase())).slice(0, 6)
      setArtistSuggestions(matches)
    } else {
      setArtistSuggestions([])
    }
  }

  const [venueSuggestions, setVenueSuggestions] = useState([])
  const venueBook = {};
  [...concerts].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(c => {
    if (c.venue) venueBook[c.venue] = { city: c.city || '', country: c.country || '', venueSize: c.venueSize || null };
  });
  const handleVenueChange = (val) => {
    update('venue', val)
    if (val.trim().length > 0) setVenueSuggestions(Object.keys(venueBook).filter(v => v.toLowerCase().includes(val.toLowerCase())).slice(0, 6))
    else setVenueSuggestions([])
  }
  const selectVenue = (v) => {
    const b = venueBook[v] || {};
    setForm(f => ({ ...f, venue: v, city: f.city || b.city, country: f.country || b.country, venueSize: f.venueSize || b.venueSize }));
    setVenueSuggestions([])
  }

  const selectArtist = (name) => {
    const prev = concerts.filter(c => c.artist === name && c.genre).sort((a, b) => b.date.localeCompare(a.date))[0]
    setForm(f => ({
      ...f,
      artist: name,
      genre: prev?.genre || f.genre,
      subgenre: prev?.subgenre || f.subgenre,
    }))
    setArtistSuggestions([])
  }

  const toggleFriend = (name) => setForm(f => ({
    ...f,
    friends: f.friends.includes(name) ? f.friends.filter(x => x !== name) : [...f.friends, name],
    solo: false
  }))

  const addCustomFriend = () => {
    const name = friendInput.trim()
    if (!name || form.friends.includes(name)) return
    setForm(f => ({ ...f, friends: [...f.friends, name], solo: false }))
    setFriendInput('')
  }

  const addSupport = () => {
    const t = supportInput.trim()
    if (!t || form.support.some(x => getSupportName(x) === t)) return
    setForm(f => ({ ...f, support: [...f.support, { name: t, role: supportRole }] }))
    setSupportInput('')
  }

  const validate = () => {
    const e = {}
    if (!form.artist.trim()) e.artist = true
    if (!form.wishlist && !form.date) e.date = true
    if (!form.wishlist && form.attendanceMode !== 'online' && !form.venue.trim()) e.venue = true
    if (!form.wishlist && form.attendanceMode !== 'online' && !form.city.trim()) e.city = true
    if (!form.wishlist && form.attendanceMode !== 'online' && !form.country.trim()) e.country = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const entry = { ...form, id }
    if (form.wishlist && !form.date) entry.date = '9999-12-31' // far future so isPast never fires
    onSave(entry)
  }

  const inputStyle = {
    width: '100%', background: '#13131f', border: '1px solid #2a4a3a',
    borderRadius: 8, color: '#c4c2f0', padding: '8px 12px',
    fontFamily: "'DM Mono', monospace", fontSize: 13, boxSizing: 'border-box'
  }
  const errStyle = { ...inputStyle, border: '1px solid #f472b6' }
  const fieldLabel = (text) => (
    <div style={{ fontSize: 11, color: '#6b6a8f', marginBottom: 6, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{text}</div>
  )

  const allFriendChoices = [...new Set([...friends, ...form.friends])].sort()

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0c0c14', overflowY: 'auto', zIndex: 100 }}>
      <div style={{ position: 'sticky', top: 0, background: '#0c0c14', borderBottom: '1px solid #1e3028', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: form.type === 'festival' ? '#f472b6' : '#e2e0ff', flex: 1 }}>{form.type === 'festival' ? 'Add festival' : 'Add concert'}</div>
        <button onClick={handleSave} style={{ background: '#a78bfa', border: '1px solid #a78bfa', color: '#0c0c14', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Save</button>
      </div>
      <div style={{ padding: '20px' }}>
        {/* Type toggle — always at top */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[{ id: 'concert', label: '🎤 Concert' }, { id: 'festival', label: '🎪 Festival' }].map(t => (
            <button key={t.id} onClick={() => { update('type', t.id); if (t.id === 'festival') setShowDetails(true); }} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 14, cursor: 'pointer', background: form.type===t.id ? (t.id === 'festival' ? '#1a1030' : '#1a1a30') : '#0c0c14', border: `1px solid ${form.type===t.id ? (t.id === 'festival' ? '#f472b6' : '#a78bfa') : '#2e2e50'}`, color: form.type===t.id ? (t.id === 'festival' ? '#f472b6' : '#a78bfa') : '#6b6a8f', fontWeight: form.type===t.id ? 700 : 400, fontFamily: "'DM Sans', sans-serif" }}>{t.label}</button>
          ))}
        </div>
        {(() => {
          const isFest = form.type === 'festival';
          const card = (title, content) => (
            <div key={title} style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: '#e2e0ff', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1a1a2e' }}>{title}</div>
              {content}
            </div>
          );
          const foldCard = (title, content, hasData = false) => {
            const open = openCards.includes(title);
            return (
              <div key={title} style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                <button onClick={() => setOpenCards(o => open ? o.filter(t => t !== title) : [...o, title])} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px' }}>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: open ? '#e2e0ff' : '#9b97d4' }}>{title}{!open && hasData && <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 6 }}>●</span>}</span>
                  <span style={{ color: '#4a4870', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{open ? '−' : '+'}</span>
                </button>
                {open && <div style={{ padding: '0 16px 16px' }}>{content}</div>}
              </div>
            );
          };
          const financialContent = (
            <>
              <div style={{ marginBottom: 12 }}>
                {fieldLabel('Ticket type')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {(settings.ticketTypes || ['GA','GC','Seated']).map(t => <button key={t} onClick={() => update('ticketType', form.ticketType === t ? null : t)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: form.ticketType === t ? '#a78bfa' : '#0c0c14', color: form.ticketType === t ? '#0c0c14' : '#6b6a8f', border: `1px solid ${form.ticketType === t ? '#a78bfa' : '#2e2e50'}`, fontWeight: form.ticketType === t ? 700 : 400 }}>{t}</button>)}
                </div>
                {fieldLabel('Add-ons')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(settings.ticketAddons || ['Barricade','VIP','Soundcheck','Hi-touch','Send-off','Early entry']).map(a => { const on = (form.ticketAddons || []).includes(a); return <button key={a} onClick={() => update('ticketAddons', on ? (form.ticketAddons || []).filter(x => x !== a) : [...(form.ticketAddons || []), a])} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: on ? '#f472b6' : '#0c0c14', color: on ? '#0c0c14' : '#6b6a8f', border: `1px solid ${on ? '#f472b6' : '#2e2e50'}`, fontWeight: on ? 700 : 400 }}>{a}</button>; })}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div>{fieldLabel('Ticket')}<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: '#6b6a8f' }}>€</span><input type="number" value={form.ticketPrice || ''} placeholder="0.00" onChange={e => update('ticketPrice', e.target.value ? parseFloat(e.target.value) : null)} style={{ ...inputStyle, flex: 1 }} /></div></div>
              </div>
              <CostBreakdownFields value={form.costBreakdown} onChange={v => update('costBreakdown', v)} labelStyle={{ fontSize: 11, color: '#6b6a8f', marginBottom: 6, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }} inputStyle={inputStyle} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>{fieldLabel('Merch')}<button onClick={addMerchItem} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>+ Add item</button></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(form.merch || []).map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <select value={merchCategories.includes(m.item) ? m.item : '__custom__'} onChange={e => updateMerch(i, 'item', e.target.value)} style={{ ...inputStyle, width: '100%', appearance: 'none', paddingRight: 24 }}>
                        {merchCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        <option value='__custom__'>Custom…</option>
                      </select>
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#6b6a8f', fontSize: 10, pointerEvents: 'none' }}>▾</span>
                    </div>
                    {(!merchCategories.includes(m.item) || m.item === '') && <input value={m.item === '__custom__' ? '' : m.item} placeholder="Custom item…" onChange={e => updateMerch(i, 'item', e.target.value)} onBlur={e => { const v = e.target.value.trim(); if (v && !merchCategories.some(c => c.toLowerCase() === v.toLowerCase())) setPendingTag({ value: v, settingsKey: 'merchCategories', label: 'merch tags' }); }} style={{ ...inputStyle, flex: 1 }} autoFocus />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#6b6a8f', fontSize: 12 }}>€</span><input type="number" value={m.price} placeholder="0" onChange={e => updateMerch(i, 'price', e.target.value)} style={{ ...inputStyle, width: 70 }} /></div>
                    <button onClick={() => removeMerch(i)} style={{ background: 'none', border: 'none', color: '#4a6a5a', fontSize: 16, cursor: 'pointer', padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            </>
          );
          const experienceContent = (() => {
            const pill = (label, active, onClick, isRemove) => (
              <button key={label} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: active ? '#a78bfa' : '#0c0c14', color: active ? '#0c0c14' : '#6b6a8f', border: `1px solid ${active ? '#a78bfa' : '#2e2e50'}`, fontWeight: active ? 700 : 400, flexShrink: 0 }}>
                {label}{isRemove && <span style={{ fontSize: 13, lineHeight: 1, marginLeft: 2 }}>×</span>}
              </button>
            );
            const groupedFriends = new Set((settings.friendGroups || []).flatMap(g => g.friends));
            const pinnedFriends = recentFriends.filter(n => !groupedFriends.has(n));
            const extraSelected = form.friends.filter(n => !pinnedFriends.includes(n) && !groupedFriends.has(n));
            const pickerFriends = allFriendChoices.filter(n => !pinnedFriends.includes(n) && !groupedFriends.has(n));
            return (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: showFriendPicker ? 10 : 0 }}>
                  {pill('solo', form.solo, () => setForm(f => ({ ...f, solo: !f.solo, friends: [] })))}
                  {(settings.friendGroups || []).map((g, i) => { const active = g.friends.every(f => form.friends.includes(f)); return <button key={i} onClick={() => setForm(f => ({ ...f, friends: [...new Set([...f.friends, ...g.friends])], solo: false }))} style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: active ? '#818cf8' : '#0c0c14', color: active ? '#0c0c14' : '#6b6a8f', border: `1px solid ${active ? '#818cf8' : '#2e2e50'}`, fontWeight: active ? 700 : 400, flexShrink: 0 }}>{g.name}</button>; })}
                  {pinnedFriends.map(name => pill(name, form.friends.includes(name), () => toggleFriend(name)))}
                  {extraSelected.map(name => pill(name, true, () => toggleFriend(name), true))}
                  <button onClick={() => setShowFriendPicker(s => !s)} style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: showFriendPicker ? '#2a4a3a' : '#0c0c14', color: '#a78bfa', border: '1px solid #2a4a3a', fontWeight: 700, flexShrink: 0 }}>other +</button>
                </div>
                {showFriendPicker && (
                  <div style={{ background: '#0e0e1a', border: '1px solid #1f1f35', borderRadius: 10, padding: '12px' }}>
                    {pickerFriends.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{pickerFriends.map(name => <button key={name} onClick={() => toggleFriend(name)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: form.friends.includes(name) ? '#a78bfa' : '#13131f', color: form.friends.includes(name) ? '#0c0c14' : '#6b6a8f', border: `1px solid ${form.friends.includes(name) ? '#a78bfa' : '#2e2e50'}`, fontWeight: form.friends.includes(name) ? 700 : 400 }}>{name}</button>)}</div>}
                    <div style={{ display: 'flex', gap: 8 }}><input value={friendInput} onChange={e => setFriendInput(e.target.value)} onKeyDown={e => e.key==='Enter' && addCustomFriend()} placeholder="Add new friend…" style={{ ...inputStyle, flex: 1 }} /><button onClick={addCustomFriend} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '0 12px', cursor: 'pointer' }}>+</button></div>
                  </div>
                )}
              </>
            );
          })();
          if (!isFest && !showDetails) return (
            <>
              {card('Quick add', <>
                <button onClick={() => update('wishlist', !form.wishlist)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: `1px solid ${form.wishlist ? '#34d399' : '#1f1f35'}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', marginBottom: 12, textAlign: 'left' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${form.wishlist ? '#34d399' : '#3d3564'}`, background: form.wishlist ? '#34d399' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#0c0c14', lineHeight: 1 }}>{form.wishlist ? '✓' : ''}</span>
                  <span style={{ fontSize: 12, color: form.wishlist ? '#34d399' : '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>No tickets yet — save as "want to go"</span>
                </button>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <input value={sfUrl} onChange={e => setSfUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && fillFromSetlistUrl()} placeholder="✨ Paste setlist.fm link to auto-fill…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={fillFromSetlistUrl} disabled={!sfUrl.trim() || sfStatus === 'loading'} style={{ background: 'none', border: '1px solid #3d3564', borderRadius: 8, color: sfUrl.trim() ? '#a78bfa' : '#2e2e4a', fontSize: 12, padding: '0 14px', cursor: sfUrl.trim() ? 'pointer' : 'default', fontFamily: "'DM Mono', monospace" }}>{sfStatus === 'loading' ? '…' : 'Fill'}</button>
                </div>
                {sfMsg && <div style={{ fontSize: 10, color: sfStatus === 'error' ? '#f87171' : '#4ade80', fontFamily: "'DM Mono', monospace", marginBottom: 8, textAlign: 'center' }}>{sfMsg}</div>}
                <div style={{ height: 8 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>{fieldLabel('Date *')}<input type="date" value={form.date} onChange={e => update('date', e.target.value)} style={errors.date ? errStyle : inputStyle} /></div>
                  <div>{fieldLabel('Rating')}<div style={{ minHeight: 36, display: 'flex', alignItems: 'center' }}><StarRating value={form.rating} onChange={v => update('rating', v)} max={settings.ratingSystem || 5} /></div></div>
                </div>
                <div style={{ marginBottom: 10, position: 'relative' }}>
                  {fieldLabel('Artist *')}
                  <input value={form.artist} onChange={e => handleArtistChange(e.target.value)} onBlur={() => setTimeout(() => setArtistSuggestions([]), 150)} placeholder="Artist name" style={errors.artist ? errStyle : inputStyle} />
                  {artistSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{artistSuggestions.map(a => <button key={a} onMouseDown={() => selectArtist(a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{a}</button>)}</div>}
                </div>
                {form.artist && form.date && (
                  <a href={`https://www.setlist.fm/search?query=${encodeURIComponent(form.artist)}+${form.date.slice(0,4)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginBottom: 10, background: 'none', border: '1px solid #3d3564', borderRadius: 8, color: '#a78bfa', fontSize: 12, padding: '8px', textDecoration: 'none', fontFamily: "'DM Mono', monospace", boxSizing: 'border-box' }}>
                    Find on setlist.fm ↗
                  </a>
                )}
                <button disabled={!form.artist || !form.date || sfStatus === 'loading'} onClick={autoFillFromSearch} style={{ width: '100%', marginBottom: 12, background: 'none', border: '1px dashed #3d3564', borderRadius: 8, color: (!form.artist || !form.date) ? '#2e2e4a' : '#a78bfa', fontSize: 12, padding: '8px', cursor: (!form.artist || !form.date) ? 'default' : 'pointer', fontFamily: "'DM Mono', monospace" }}>{sfStatus === 'loading' ? 'Searching setlist.fm…' : '✨ Auto-fill from setlist.fm (artist + date)'}</button>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => update('attendanceMode', 'in_person')} style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: form.attendanceMode !== 'online' ? '#1a1a30' : '#0c0c14', border: `1px solid ${form.attendanceMode !== 'online' ? '#a78bfa' : '#2e2e50'}`, color: form.attendanceMode !== 'online' ? '#a78bfa' : '#6b6a8f', fontWeight: form.attendanceMode !== 'online' ? 700 : 400 }}>📍 In person</button>
                  <button onClick={() => update('attendanceMode', 'online')} style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: form.attendanceMode === 'online' ? '#0a2a30' : '#0c0c14', border: `1px solid ${form.attendanceMode === 'online' ? ONLINE_COLOR : '#2e2e50'}`, color: form.attendanceMode === 'online' ? ONLINE_COLOR : '#6b6a8f', fontWeight: form.attendanceMode === 'online' ? 700 : 400 }}>💻 Online</button>
                </div>
                {form.attendanceMode === 'online' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {[{ id: 'concert', label: 'Concert' }, { id: 'fanmeeting', label: 'Fanmeeting' }].map(t => (
                        <button key={t.id} onClick={() => update('onlineType', t.id)} style={{ flex: 1, padding: '6px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: (form.onlineType || 'concert') === t.id ? '#0a2a30' : '#0c0c14', border: `1px solid ${(form.onlineType || 'concert') === t.id ? ONLINE_COLOR : '#2e2e50'}`, color: (form.onlineType || 'concert') === t.id ? ONLINE_COLOR : '#6b6a8f', fontWeight: (form.onlineType || 'concert') === t.id ? 700 : 400 }}>{t.label}</button>
                      ))}
                    </div>
                    <input value={form.platform || ''} onChange={e => update('platform', e.target.value)} placeholder="Platform (optional)" style={inputStyle} />
                  </div>
                )}
{!form.wishlist && form.attendanceMode !== 'online' && <>
                {fieldLabel('Venue *')}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input value={form.venue} onChange={e => handleVenueChange(e.target.value)} onBlur={() => setTimeout(() => setVenueSuggestions([]), 150)} placeholder="Venue name" style={errors.venue ? errStyle : inputStyle} />
                  {venueSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{venueSuggestions.map(v => <button key={v} onMouseDown={() => selectVenue(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}<span style={{ color: '#6b6a8f', fontSize: 11 }}>{venueBook[v]?.city ? ` · ${venueBook[v].city}` : ''}</span></button>)}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ position: 'relative' }}>{fieldLabel('City *')}<input value={form.city} onChange={e => handleCityChange(e.target.value)} onBlur={() => setTimeout(() => setCitySuggestions([]), 150)} placeholder="City" style={errors.city ? errStyle : inputStyle} />{citySuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{citySuggestions.map(v => <button key={v} onMouseDown={() => selectCity(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}<span style={{ color: '#6b6a8f', fontSize: 11 }}>{cityBook[v] ? ` · ${cityBook[v]}` : ''}</span></button>)}</div>}</div>
                  <div style={{ position: 'relative' }}>{fieldLabel('Country *')}<input value={form.country} onChange={e => handleCountryChange(e.target.value)} onBlur={() => setTimeout(() => setCountrySuggestions([]), 150)} placeholder="Country" style={errors.country ? errStyle : inputStyle} />{countrySuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{countrySuggestions.map(v => <button key={v} onMouseDown={() => selectCountry(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}</button>)}</div>}</div>
                </div>
                </>}
                {quickUpcoming
                  ? <div style={{ fontSize: 11, color: '#38bdf8', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: '8px 0' }}>📅 upcoming show — rating & extras unlock after the date</div>
                  : <>
                    {fieldLabel('Went with')}
                    {experienceContent}
                  </>}
                <button onClick={() => setShowDetails(true)} style={{ width: '100%', marginTop: 14, minHeight: 40, borderRadius: 8, border: '1px solid #2e2e50', background: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>More details</button>
              </>)}
                {/* Ticket sale info */}
                <div style={{ borderTop: '1px solid #1a1a2e', marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Ticket sale</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>{fieldLabel('Date')}<input type="date" value={(form.ticketSaleAt||'').slice(0,10)} onChange={e => update('ticketSaleAt', e.target.value ? e.target.value + (form.ticketSaleAt?.slice(10)||'T10:00') : '')} style={inputStyle} /></div>
                    <div>{fieldLabel('Time')}<input type="time" value={(form.ticketSaleAt||'').slice(11,16)||'10:00'} onChange={e => update('ticketSaleAt', (form.ticketSaleAt||new Date().toISOString().slice(0,10))?.slice(0,10) + 'T' + e.target.value)} style={inputStyle} /></div>
                  </div>
                  <input value={form.ticketSaleLink||''} onChange={e => update('ticketSaleLink', e.target.value)} placeholder="Ticket link (optional)" style={{ ...inputStyle, marginBottom: 8 }} />
                  <input value={form.ticketSaleNote||''} onChange={e => update('ticketSaleNote', e.target.value)} placeholder="Note (e.g. presale code, queue link…)" style={{ ...inputStyle, marginBottom: 8 }} />
                </div>
            </>
          );
          if (isFest && !showDetails) return (
            <>
              {card('Quick add festival', <>
                <div style={{ marginBottom: 10, position: 'relative' }}>
                  {fieldLabel('Festival name *')}
                  <input value={form.artist} onChange={e => handleArtistChange(e.target.value)} onBlur={() => setTimeout(() => setArtistSuggestions([]), 150)} placeholder="Festival name" style={errors.artist ? errStyle : inputStyle} />
                  {artistSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{artistSuggestions.map(a => <button key={a} onMouseDown={() => selectArtist(a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{a}</button>)}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>{fieldLabel('Start date *')}<input type="date" value={form.date} onChange={e => update('date', e.target.value)} style={errors.date ? errStyle : inputStyle} /></div>
                  <div>{fieldLabel('End date')}<input type="date" value={form.endDate || ''} onChange={e => update('endDate', e.target.value)} style={inputStyle} /></div>
                </div>
                {fieldLabel('Festival site *')}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input value={form.venue} onChange={e => handleVenueChange(e.target.value)} onBlur={() => setTimeout(() => setVenueSuggestions([]), 150)} placeholder="Festival site / grounds" style={errors.venue ? errStyle : inputStyle} />
                  {venueSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{venueSuggestions.map(v => <button key={v} onMouseDown={() => selectVenue(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}<span style={{ color: '#6b6a8f', fontSize: 11 }}>{venueBook[v]?.city ? ` · ${venueBook[v].city}` : ''}</span></button>)}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ position: 'relative' }}>{fieldLabel('City *')}<input value={form.city} onChange={e => handleCityChange(e.target.value)} onBlur={() => setTimeout(() => setCitySuggestions([]), 150)} placeholder="City" style={errors.city ? errStyle : inputStyle} />{citySuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{citySuggestions.map(v => <button key={v} onMouseDown={() => selectCity(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}<span style={{ color: '#6b6a8f', fontSize: 11 }}>{cityBook[v] ? ` · ${cityBook[v]}` : ''}</span></button>)}</div>}</div>
                  <div style={{ position: 'relative' }}>{fieldLabel('Country *')}<input value={form.country} onChange={e => handleCountryChange(e.target.value)} onBlur={() => setTimeout(() => setCountrySuggestions([]), 150)} placeholder="Country" style={errors.country ? errStyle : inputStyle} />{countrySuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{countrySuggestions.map(v => <button key={v} onMouseDown={() => selectCountry(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}</button>)}</div>}</div>
                </div>
                {quickUpcoming
                  ? <div style={{ fontSize: 11, color: '#38bdf8', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: '8px 0' }}>📅 upcoming festival — acts & extras unlock after the date</div>
                  : <>
                    {fieldLabel('Went with')}
                    {experienceContent}
                  </>}
                <button onClick={() => setShowDetails(true)} style={{ width: '100%', marginTop: 14, minHeight: 40, borderRadius: 8, border: '1px solid #2e2e50', background: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>More details (acts, money, notes…)</button>
              </>)}
            </>
          );
          if (isFest) return (
            <>
              {card('Festival', <>
                {fieldLabel('Festival name *')}
                <div style={{ marginBottom: 10, position: 'relative' }}>
                  <input value={form.artist} onChange={e => handleArtistChange(e.target.value)} onBlur={() => setTimeout(() => setArtistSuggestions([]), 150)} placeholder="Festival name" style={{ ...(errors.artist ? errStyle : inputStyle) }} />
                  {artistSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{artistSuggestions.map(a => <button key={a} onMouseDown={() => selectArtist(a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{a}</button>)}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>{fieldLabel('Start date *')}<input type="date" value={form.date} onChange={e => update('date', e.target.value)} style={errors.date ? errStyle : inputStyle} /></div>
                  <div>{fieldLabel('End date')}<input type="date" value={form.endDate || ''} onChange={e => update('endDate', e.target.value)} style={inputStyle} /></div>
                </div>
                {fieldLabel('Edition / year')}
                <input value={form.tour} onChange={e => update('tour', e.target.value)} placeholder="e.g. Lowlands 2024 (optional)" style={inputStyle} />
              </>)}
              {card('Location', <>
                {(settings.savedVenues || []).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{(settings.savedVenues || []).map((v, i) => { const active = form.venue === v.name && form.city === v.city && form.country === v.country; return <button key={i} onClick={() => setForm(f => ({ ...f, venue: v.name, city: v.city, country: v.country }))} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: active ? '#a78bfa' : '#0c0c14', color: active ? '#0c0c14' : '#6b6a8f', border: `1px solid ${active ? '#a78bfa' : '#2e2e50'}`, fontWeight: active ? 700 : 400 }}>{v.name}</button>; })}</div>}
                {fieldLabel('Festival grounds')}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input value={form.venue} onChange={e => handleVenueChange(e.target.value)} onBlur={() => setTimeout(() => setVenueSuggestions([]), 150)} placeholder="Festival site / grounds" style={errors.venue ? errStyle : inputStyle} />
                  {venueSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{venueSuggestions.map(v => <button key={v} onMouseDown={() => selectVenue(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}<span style={{ color: '#6b6a8f', fontSize: 11 }}>{venueBook[v]?.city ? ` · ${venueBook[v].city}` : ''}</span></button>)}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ position: 'relative' }}>{fieldLabel('City *')}<input value={form.city} onChange={e => handleCityChange(e.target.value)} onBlur={() => setTimeout(() => setCitySuggestions([]), 150)} placeholder="City" style={errors.city ? errStyle : inputStyle} />{citySuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{citySuggestions.map(v => <button key={v} onMouseDown={() => selectCity(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}<span style={{ color: '#6b6a8f', fontSize: 11 }}>{cityBook[v] ? ` · ${cityBook[v]}` : ''}</span></button>)}</div>}</div>
                  <div style={{ position: 'relative' }}>{fieldLabel('Country *')}<input value={form.country} onChange={e => handleCountryChange(e.target.value)} onBlur={() => setTimeout(() => setCountrySuggestions([]), 150)} placeholder="Country" style={errors.country ? errStyle : inputStyle} />{countrySuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{countrySuggestions.map(v => <button key={v} onMouseDown={() => selectCountry(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}</button>)}</div>}</div>
                </div>
              </>)}
              {foldCard('Acts seen', <FestivalActsSection acts={form.acts || []} onChange={v => update('acts', v)} startDate={form.date} endDate={form.endDate} ratingMax={settings.ratingSystem || 5} />, (form.acts || []).length > 0)}
              {foldCard('Your experience', experienceContent, !!(form.rating || form.seenAs !== 'Headliner'))}
              {foldCard('Financial', financialContent, !!(form.ticketPrice || form.otherCost || extraCostTotal(form) || (form.merch || []).length))}
              {foldCard('Notes', <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Any notes..." />, !!form.notes)}
            </>
          );

          return (
            <>
              {card('Show', <>
                <div style={{ marginBottom: 10, position: 'relative' }}>
                  {fieldLabel('Artist *')}
                  <input value={form.artist} onChange={e => handleArtistChange(e.target.value)} onBlur={() => setTimeout(() => setArtistSuggestions([]), 150)} placeholder="Artist name" style={errors.artist ? errStyle : inputStyle} />
                  {artistSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{artistSuggestions.map(a => <button key={a} onMouseDown={() => selectArtist(a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{a}</button>)}</div>}
                </div>
                <div style={{ marginBottom: 10 }}>
                  {fieldLabel('Date *')}
                  <input type="date" value={form.date} onChange={e => update('date', e.target.value)} style={errors.date ? errStyle : inputStyle} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <button
                    disabled={!form.artist || !form.date || sfStatus === 'loading'}
                    onClick={autoFillFromSearch}
                    style={{ width: '100%', background: 'none', border: '1px dashed #3d3564', borderRadius: 8, color: (!form.artist || !form.date) ? '#2e2e4a' : '#a78bfa', fontSize: 12, padding: '8px', cursor: (!form.artist || !form.date) ? 'default' : 'pointer', fontFamily: "'DM Mono', monospace" }}>
                    {sfStatus === 'loading' ? 'Searching setlist.fm…' : '✨ Auto-fill from setlist.fm'}
                  </button>
                  {sfMsg && <div style={{ fontSize: 10, color: sfStatus === 'error' ? '#f87171' : '#4ade80', fontFamily: "'DM Mono', monospace", marginTop: 4, textAlign: 'center' }}>{sfMsg}</div>}
                </div>
                {fieldLabel('Tour')}
                <input value={form.tour} onChange={e => update('tour', e.target.value)} placeholder="Tour name (optional)" style={inputStyle} />
              </>)}
              {card('Way of attending', <>
                <div style={{ display: 'flex', gap: 8, marginBottom: form.attendanceMode === 'online' ? 12 : 0 }}>
                  <button onClick={() => update('attendanceMode', 'in_person')} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: form.attendanceMode !== 'online' ? '#1a1a30' : '#0c0c14', border: `1px solid ${form.attendanceMode !== 'online' ? '#a78bfa' : '#2e2e50'}`, color: form.attendanceMode !== 'online' ? '#a78bfa' : '#6b6a8f', fontWeight: form.attendanceMode !== 'online' ? 700 : 400 }}>📍 In person</button>
                  <button onClick={() => update('attendanceMode', 'online')} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: form.attendanceMode === 'online' ? '#0a2a30' : '#0c0c14', border: `1px solid ${form.attendanceMode === 'online' ? ONLINE_COLOR : '#2e2e50'}`, color: form.attendanceMode === 'online' ? ONLINE_COLOR : '#6b6a8f', fontWeight: form.attendanceMode === 'online' ? 700 : 400 }}>💻 Online</button>
                </div>
                {form.attendanceMode === 'online' && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {[{ id: 'concert', label: 'Concert' }, { id: 'fanmeeting', label: 'Fanmeeting' }].map(t => (
                        <button key={t.id} onClick={() => update('onlineType', t.id)} style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: (form.onlineType || 'concert') === t.id ? '#0a2a30' : '#0c0c14', border: `1px solid ${(form.onlineType || 'concert') === t.id ? ONLINE_COLOR : '#2e2e50'}`, color: (form.onlineType || 'concert') === t.id ? ONLINE_COLOR : '#6b6a8f', fontWeight: (form.onlineType || 'concert') === t.id ? 700 : 400 }}>{t.label}</button>
                      ))}
                    </div>
                    {fieldLabel('Platform')}
                    <input value={form.platform || ''} onChange={e => update('platform', e.target.value)} placeholder="e.g. Beyond Live, Netflix, Weverse… (optional)" style={inputStyle} />
                  </>
                )}
              </>)}
              {form.attendanceMode !== 'online' && card('Venue', <>
                {(settings.savedVenues || []).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{(settings.savedVenues || []).map((v, i) => { const active = form.venue===v.name && form.city===v.city && form.country===v.country; return <button key={i} onClick={() => setForm(f => ({ ...f, venue: v.name, room: v.room||f.room, city: v.city, country: v.country }))} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: active ? '#a78bfa' : '#0c0c14', color: active ? '#0c0c14' : '#6b6a8f', border: `1px solid ${active ? '#a78bfa' : '#2e2e50'}`, fontWeight: active ? 700 : 400 }}>{v.name}{v.room ? ` · ${v.room}` : ''}</button>; })}</div>}
                {fieldLabel('Venue name *')}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input value={form.venue} onChange={e => handleVenueChange(e.target.value)} onBlur={() => setTimeout(() => setVenueSuggestions([]), 150)} placeholder="Venue name" style={errors.venue ? errStyle : inputStyle} />
                  {venueSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{venueSuggestions.map(v => <button key={v} onMouseDown={() => selectVenue(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}<span style={{ color: '#6b6a8f', fontSize: 11 }}>{venueBook[v]?.city ? ` · ${venueBook[v].city}` : ''}</span></button>)}</div>}
                </div>
                <input value={form.room} onChange={e => update('room', e.target.value)} placeholder="Room / stage (optional)" style={{ ...inputStyle, marginBottom: 8 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ position: 'relative' }}>{fieldLabel('City *')}<input value={form.city} onChange={e => handleCityChange(e.target.value)} onBlur={() => setTimeout(() => setCitySuggestions([]), 150)} placeholder="City" style={errors.city ? errStyle : inputStyle} />{citySuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{citySuggestions.map(v => <button key={v} onMouseDown={() => selectCity(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}<span style={{ color: '#6b6a8f', fontSize: 11 }}>{cityBook[v] ? ` · ${cityBook[v]}` : ''}</span></button>)}</div>}</div>
                  <div style={{ position: 'relative' }}>{fieldLabel('Country *')}<input value={form.country} onChange={e => handleCountryChange(e.target.value)} onBlur={() => setTimeout(() => setCountrySuggestions([]), 150)} placeholder="Country" style={errors.country ? errStyle : inputStyle} />{countrySuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{countrySuggestions.map(v => <button key={v} onMouseDown={() => selectCountry(v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{v}</button>)}</div>}</div>
                </div>
                {fieldLabel('Venue size')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>{(settings.venueSizes||[]).map(vs => <button key={vs} onClick={() => update('venueSize', form.venueSize===vs ? null : vs)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: form.venueSize===vs ? '#a78bfa' : '#0c0c14', color: form.venueSize===vs ? '#0c0c14' : '#6b6a8f', border: `1px solid ${form.venueSize===vs ? '#a78bfa' : '#2e2e50'}`, fontWeight: form.venueSize===vs ? 700 : 400 }}>{vs}</button>)}<AddNewTagPill onAdd={v => { update('venueSize', v); setPendingTag({ value: v, settingsKey: 'venueSizes', label: 'venue sizes' }); }} /></div>
              </>)}
              {foldCard('Lineup & genre', <>
                {fieldLabel('Seen as')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 14 }}>{['Headliner','Support','Guest','Festival'].map(opt => <button key={opt} onClick={() => update('seenAs', form.seenAs===opt ? null : opt)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: form.seenAs===opt ? '#a78bfa' : '#0c0c14', color: form.seenAs===opt ? '#0c0c14' : '#6b6a8f', border: `1px solid ${form.seenAs===opt ? '#a78bfa' : '#2e2e50'}`, fontWeight: form.seenAs===opt ? 700 : 400 }}>{opt}</button>)}</div>
                {fieldLabel('Support acts')}
                {form.support.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>{form.support.map(s => { const name = getSupportName(s); const role = getSupportRole(s); const toggleRole = () => setForm(f => ({ ...f, support: f.support.map(x => getSupportName(x)===name ? { name, role: getSupportRole(x)==='guest' ? 'support' : 'guest' } : x) })); return <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 99, padding: '3px 10px', fontSize: 12, color: '#a78bfa' }}>{name}<button onClick={toggleRole} style={{ fontSize: 9, color: role==='guest' ? '#f472b6' : '#4a4870', fontFamily: "'DM Mono',monospace", padding: '1px 4px', background: role==='guest' ? '#1a1030' : 'none', borderRadius: 99, border: `1px solid ${role==='guest' ? '#f472b6' : '#2e2e50'}`, cursor: 'pointer', lineHeight: 1.4 }}>{role}</button><button onClick={() => setForm(f => ({ ...f, support: f.support.filter(x => getSupportName(x)!==name) }))} style={{ background: 'none', border: 'none', color: '#6b6a8f', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button></span>; })}</div>}
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>{['support','guest'].map(r => <button key={r} onClick={() => setSupportRole(r)} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: supportRole===r ? '#a78bfa' : '#0c0c14', color: supportRole===r ? '#0c0c14' : '#6b6a8f', border: `1px solid ${supportRole===r ? '#a78bfa' : '#2e2e50'}`, fontWeight: supportRole===r ? 700 : 400, fontFamily: "'DM Mono',monospace" }}>{r}</button>)}</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><input value={supportInput} onChange={e => setSupportInput(e.target.value)} onKeyDown={e => e.key==='Enter' && addSupport()} placeholder="Add support act..." style={{ ...inputStyle, flex: 1 }} /><button onClick={addSupport} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '0 12px', cursor: 'pointer' }}>+</button></div>
                {fieldLabel('Genre')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>{(settings.genres||[]).map(g => <button key={g} onClick={()=>{ const cur=getGenres(form); const next=cur.includes(g)?cur.filter(x=>x!==g):[...cur,g]; update('genre', next.length===0?null:next.length===1?next[0]:next); }} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: getGenres(form).includes(g) ? '#a78bfa' : '#0c0c14', color: getGenres(form).includes(g) ? '#0c0c14' : '#6b6a8f', border: `1px solid ${getGenres(form).includes(g) ? '#a78bfa' : '#2e2e50'}`, fontWeight: getGenres(form).includes(g) ? 700 : 400 }}>{g}</button>)}<AddNewTagPill onAdd={v => { const cur=getGenres(form); update('genre', [...cur, v]); setPendingTag({ value: v, settingsKey: 'genres', label: 'genres' }); }} /></div>
                {fieldLabel('Subgenre')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>{(settings.subgenres||[]).map(g => <button key={g} onClick={()=>update('subgenre', form.subgenre===g ? null : g)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: form.subgenre===g ? '#38bdf8' : '#0c0c14', color: form.subgenre===g ? '#0c0c14' : '#6b6a8f', border: `1px solid ${form.subgenre===g ? '#38bdf8' : '#2e2e50'}`, fontWeight: form.subgenre===g ? 700 : 400 }}>{g}</button>)}<AddNewTagPill accentColor="#38bdf8" onAdd={v => { update('subgenre', v); setPendingTag({ value: v, settingsKey: 'subgenres', label: 'subgenres' }); }} /></div>
                {fieldLabel('Language')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>{(() => { const langs = Array.isArray(form.language) ? form.language : form.language ? [form.language] : []; return (settings.languages||[]).map(l => { const on = langs.includes(l); return <button key={l} onClick={()=>update('language', on ? langs.filter(x=>x!==l) : [...langs, l])} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: on ? '#a78bfa' : '#0c0c14', color: on ? '#0c0c14' : '#6b6a8f', border: `1px solid ${on ? '#a78bfa' : '#2e2e50'}`, fontWeight: on ? 700 : 400 }}>{l}</button>; }); })()}<AddNewTagPill onAdd={v => { const langs = Array.isArray(form.language) ? form.language : form.language ? [form.language] : []; update('language', [...langs, v]); setPendingTag({ value: v, settingsKey: 'languages', label: 'languages' }); }} /></div>
              </>)}
              {foldCard('Your experience', experienceContent, !!(form.rating || form.seenAs !== 'Headliner'))}
              {foldCard('Financial', financialContent, !!(form.ticketPrice || form.otherCost || extraCostTotal(form) || (form.merch || []).length))}
              {foldCard('Notes', <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Any notes..." />, !!form.notes)}
            </>
          );
        })()}
      </div>
      {pendingTag && (
        <SaveTagPrompt
          value={pendingTag.value}
          label={pendingTag.label}
          onDismiss={() => setPendingTag(null)}
          onConfirm={() => {
            if (onUpdateSetting) onUpdateSetting(pendingTag.settingsKey, [...(settings[pendingTag.settingsKey] || []), pendingTag.value.trim()]);
            setPendingTag(null);
          }}
        />
      )}
    </div>
  )
}

function SettingsRow({ label, sub, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 2px", borderBottom: "1px solid #1a1a24", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "#e2e0ff", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function SettingsStepper({ value, onChange, min = 3, max = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#19182a", border: "1px solid #343052", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={{ background: "none", border: "none", color: "#6b6a8f", fontSize: 16, cursor: "pointer", padding: "6px 12px", lineHeight: 1 }}>−</button>
      <span style={{ fontSize: 13, color: "#e2e0ff", fontFamily: "'DM Mono', monospace", minWidth: 24, textAlign: "center" }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} style={{ background: "none", border: "none", color: "#6b6a8f", fontSize: 16, cursor: "pointer", padding: "6px 12px", lineHeight: 1 }}>+</button>
    </div>
  );
}

function SettingsOptionPills({ value, options, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "flex-end" }}>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          padding: "5px 11px", borderRadius: 99, fontSize: 11, cursor: "pointer",
          background: value === o.id ? "#a78bfa" : "#13131f",
          color: value === o.id ? "#0c0c14" : "#6b6a8f",
          border: `1px solid ${value === o.id ? "#a78bfa" : "#1f1f35"}`,
          fontWeight: value === o.id ? 700 : 400, fontFamily: "'DM Mono', monospace"
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.10em", margin: "0 0 8px 4px" }}>{title}</div>
      <div style={{ background: "#111119", borderRadius: 14, padding: "2px 12px", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function SettingsToggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 26, borderRadius: 99, border: "none",
        background: checked ? "#a78bfa" : "#2a2940", padding: 2, cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: checked ? "flex-end" : "flex-start",
        transition: "background 0.15s",
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: 99, background: "#fff", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
    </button>
  );
}

function SettingsActionRow({ icon, title, sub, tone = "accent", children }) {
  const palette = tone === "danger"
    ? { color: "#fb7185", bg: "rgba(251,113,133,0.1)", border: "rgba(251,113,133,0.32)" }
    : tone === "success"
      ? { color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.32)" }
      : { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.32)" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #232239" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: tone === "danger" ? "#fb7185" : "#e2e0ff", fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "#7d7aa5", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

const tagStyle = { display: "flex", alignItems: "center", gap: 4, background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 99, padding: "4px 10px", fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif" };
const tagInput = { flex: 1, background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 8, color: "#c4c2f0", padding: "8px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13 };
const addBtn = { background: "#1a1a30", border: "1px solid #a78bfa", borderRadius: 8, color: "#a78bfa", padding: "8px 14px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600 };

const TagManager = ({ items, onRemove, input, onInput, onAdd, placeholder }) => (
    <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: items.length ? 10 : 0 }}>
        {items.map(item => (
          <div key={item} style={tagStyle}>{item}
            <button onClick={() => onRemove(item)} style={{ background: "none", border: "none", color: "#4a4870", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2 }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={e => onInput(e.target.value)} onKeyDown={e => e.key === "Enter" && onAdd()} placeholder={placeholder} style={tagInput} />
        <button onClick={onAdd} style={addBtn}>Add</button>
      </div>
    </div>
  );


function SettingsView({ settings, onUpdate, onUpdateAll, concerts = [], onSaveConcert, onSignOut, userEmail, onNotify = () => {} }) {
  const [exportData, setExportData] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [importReport, setImportReport] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [newGenre, setNewGenre] = useState("");
  const [newSubgenre, setNewSubgenre] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newVenueSize, setNewVenueSize] = useState("");
  const [newTicketType, setNewTicketType] = useState("");
  const [newTicketAddon, setNewTicketAddon] = useState("");
  const [newVenue, setNewVenue] = useState({ name: '', city: '', country: '', room: '' });
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupFriends, setNewGroupFriends] = useState([]);
  const [importQueue, setImportQueue] = useState(null); // [{friends, suggested},...] | null
  const [importNameInput, setImportNameInput] = useState('');
  const [notifyPermState, setNotifyPermState] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));
  const [ntfyTestStatus, setNtfyTestStatus] = useState(null); // null | 'sending' | 'sent' | 'error'
  const handleEnableBrowserNotifications = async () => {
    const result = await requestNotifyPermission();
    setNotifyPermState(result);
  };
  const handleSetupNtfyTopic = () => {
    const topic = `settracker-${crypto.randomUUID().slice(0, 8)}`;
    onUpdate('ntfyTopic', topic);
  };
  const handleSendNtfyTest = async () => {
    if (!settings.ntfyTopic) return;
    setNtfyTestStatus('sending');
    try {
      const r = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: settings.ntfyTopic, title: '🔔 Test notification', body: 'If you see this, background notifications are working!', tags: ['bell'] }),
      });
      setNtfyTestStatus(r.ok ? 'sent' : 'error');
    } catch {
      setNtfyTestStatus('error');
    }
  };
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState(null);
  const sec = id => ({ open: openSection === id, onToggle: () => setOpenSection(s => s === id ? null : id) });
  const [showSavedVenues, setShowSavedVenues] = useState(false);
  const [showFriendGroups, setShowFriendGroups] = useState(false);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);
  const [editingInitials, setEditingInitials] = useState(false);
  const [initialsInput, setInitialsInput] = useState('');

  useEffect(() => { if (!touched) setLocal({ ...settings }); }, [settings]);

  // * Picks up the Spotify Client ID written by the setup wizard (setup.html).
  // * The wizard stores it in localStorage as 'pending_spotify_client_id' so it
  // * survives the redirect back to the app, then this effect consumes it once.
  useEffect(() => {
    const pending = localStorage.getItem('pending_spotify_client_id');
    if (pending) {
      localStorage.removeItem('pending_spotify_client_id');
      if (!settings.spotifyClientId) lUpdate('spotifyClientId', pending);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasChanges = JSON.stringify(local) !== JSON.stringify(settings);
  const lUpdate = (key, value) => { setTouched(true); setLocal(prev => ({ ...prev, [key]: value })); setSaved(false); };
  const defaultViewOptions = [{ id: "stats", label: "Stats" }, { id: "home", label: "Shows" }, { id: "artists", label: "Artists" }, { id: "songs", label: "Songs" }, { id: "venues", label: "Venues" }];
  const defaultSortOptions = [{ id: "newest", label: "Date" }, { id: "oldest", label: "Oldest" }, { id: "alpha", label: "A-Z" }, { id: "price", label: "Price" }, { id: "rating", label: "Rating" }];
  // Monochrome icons in the app's accent color, so they hue-shift automatically
  // with the color theme (unlike <img> favicons, which are colour-compensated
  // to render true-to-life and so ignore theme changes).
  const socialLinks = [
    {
      href: "https://github.com/HoltropAF/concert_tracker",
      label: "GitHub",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#a78bfa"><path d="M12 2a10 10 0 0 0-3.162 19.49c.5.092.68-.216.68-.48 0-.236-.008-.86-.014-1.69-2.77.602-3.356-1.335-3.356-1.335-.454-1.154-1.108-1.462-1.108-1.462-.906-.62.068-.608.068-.608 1 .07 1.526 1.027 1.526 1.027.89 1.526 2.336 1.085 2.904.83.09-.644.35-1.085.636-1.334-2.212-.252-4.54-1.106-4.54-4.924 0-1.088.39-1.978 1.028-2.675-.104-.252-.446-1.268.098-2.644 0 0 .838-.268 2.746 1.022A9.55 9.55 0 0 1 12 6.84c.85.004 1.706.114 2.504.336 1.906-1.29 2.742-1.022 2.742-1.022.546 1.376.204 2.392.1 2.644.64.697 1.026 1.587 1.026 2.675 0 3.828-2.332 4.668-4.552 4.916.358.308.678.916.678 1.846 0 1.334-.012 2.41-.012 2.738 0 .266.18.576.688.478A10 10 0 0 0 12 2Z"/></svg>
    },
    {
      href: "https://www.threads.com/@annuhfloor",
      label: "Threads",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#a78bfa"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.594 12c.022 3.086.713 5.496 2.051 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.689-2.044 1.616-1.707 1.594-3.957 1.332-5.005-.274-1.386-.995-2.367-2.181-2.973-.321 1.798-.908 3.192-1.763 4.134-.99 1.092-2.298 1.617-3.89 1.56-1.354-.046-2.553-.54-3.37-1.388-.95-.984-1.404-2.383-1.277-3.848.235-2.65 2.168-4.356 5.089-4.424.952-.022 1.929.099 2.898.361-.094-.499-.195-.967-.305-1.394-.348-1.358-.854-2.365-1.506-2.994-.705-.677-1.645-1.014-2.866-.997-1.53.024-2.717.533-3.529 1.512-.74.889-1.154 2.154-1.22 3.758l-2.1-.078c.083-2.076.614-3.757 1.58-4.997 1.14-1.44 2.817-2.185 4.982-2.216 1.79-.025 3.235.444 4.3 1.397.872.784 1.537 1.95 1.976 3.467.12.413.236.883.346 1.405a11.3 11.3 0 0 1 1.133.508c1.821.982 2.95 2.478 3.317 4.329.407 2.056.214 5.273-2.202 7.851C17.056 23.22 14.908 24 12.186 24z"/></svg>
    },
    {
      href: "https://www.tiktok.com/@annuhfloor98",
      label: "TikTok",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#a78bfa"><path d="M15.86 3c.2 1.695 1.154 3.466 3.14 4.434v2.305a8.11 8.11 0 0 1-3.14-.797v6.493A5.451 5.451 0 1 1 10.41 10c.234 0 .462.014.69.044v2.355a3.11 3.11 0 1 0 2.42 3.036V3h2.34Z"/></svg>
    },
    {
      href: "https://open.spotify.com/user/lxvqdy1rt317aiskee5fh6bpm",
      label: "Spotify",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#a78bfa"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 0 1-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 0 1 .207.857zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 0 1-.966-.519.781.781 0 0 1 .52-.966c3.632-1.102 8.147-.568 11.226 1.322a.78.78 0 0 1 .257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 1 1-.543-1.793c3.539-1.073 9.425-.866 13.146 1.385a.937.937 0 0 1-.986 1.565z"/></svg>
    },
    {
      href: "https://www.vinted.nl/member/50873825",
      label: "Vinted",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#a78bfa"><path d="M6.5 5.5h3.4v6.3c0 2.4.2 4.1.7 5 .5 1 1.3 1.5 2.4 1.5.8 0 1.6-.3 2.2-1 .6-.7 1.1-1.8 1.5-3.3l2.4-8.5c.1-.4.4-.7.8-.7h2.6l-3.2 11.4c-.7 2.4-1.7 4.2-2.9 5.4-1.2 1.2-2.7 1.8-4.4 1.8-2.1 0-3.8-.8-5-2.5-1.1-1.7-1.8-4.4-2-8.1L6.5 5.5Z"/></svg>
    },
  ];
  const cycleOption = (options, current) => {
    const idx = Math.max(0, options.findIndex(o => o.id === current));
    return options[(idx + 1) % options.length].id;
  };
  const optionLabel = (options, current) => options.find(o => o.id === current)?.label || options[0]?.label || "";
  const handleSettingsSave = async () => {
    const result = onUpdateAll
      ? await onUpdateAll(local)
      : await Object.entries(local).reduce(
          (chain, [k, v]) => chain.then(() => onUpdate(k, v)),
          Promise.resolve()
        );
    if (result?.error) {
      onNotify('Could not save settings', 'error');
      return;
    }
    setTouched(false);
    setSaved(true);
    onNotify('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  };

  const categories = local.merchCategories || [];
  const genres = local.genres || [];
  const subgenres = local.subgenres || [];
  const languages = local.languages || [];
  const venueSizes = local.venueSizes || [];

  const addCategory = () => {
    const t = newCategory.trim();
    if (!t || categories.map(c=>c.toLowerCase()).includes(t.toLowerCase())) return;
    lUpdate("merchCategories", [...categories, t]); setNewCategory("");
  };
  const removeCategory = (cat) => lUpdate("merchCategories", categories.filter(c => c !== cat));

  const addGenre = () => {
    const t = newGenre.trim();
    if (!t || genres.map(g=>g.toLowerCase()).includes(t.toLowerCase())) return;
    lUpdate("genres", [...genres, t]); setNewGenre("");
  };
  const removeGenre = (g) => lUpdate("genres", genres.filter(x => x !== g));

  const addSubgenre = () => {
    const t = newSubgenre.trim();
    if (!t || subgenres.map(g=>g.toLowerCase()).includes(t.toLowerCase())) return;
    lUpdate("subgenres", [...subgenres, t]); setNewSubgenre("");
  };
  const removeSubgenre = (g) => lUpdate("subgenres", subgenres.filter(x => x !== g));

  const addLanguage = () => {
    const t = newLanguage.trim();
    if (!t || languages.map(l=>l.toLowerCase()).includes(t.toLowerCase())) return;
    lUpdate("languages", [...languages, t]); setNewLanguage("");
  };
  const removeLanguage = (l) => lUpdate("languages", languages.filter(x => x !== l));

  const addVenueSize = () => {
    const t = newVenueSize.trim();
    if (!t || venueSizes.map(v=>v.toLowerCase()).includes(t.toLowerCase())) return;
    lUpdate("venueSizes", [...venueSizes, t]); setNewVenueSize("");
  };
  const removeVenueSize = (v) => lUpdate("venueSizes", venueSizes.filter(x => x !== v));
  const ticketTypes = local.ticketTypes || ['GA','GC','Seated'];
  const ticketAddons = local.ticketAddons || ['Barricade','VIP','Soundcheck','Hi-touch','Send-off','Early entry'];
  const addTicketType = () => { const t = newTicketType.trim(); if (!t || ticketTypes.includes(t)) return; lUpdate("ticketTypes", [...ticketTypes, t]); setNewTicketType(""); };
  const removeTicketType = (t) => lUpdate("ticketTypes", ticketTypes.filter(x => x !== t));
  const addTicketAddon = () => { const t = newTicketAddon.trim(); if (!t || ticketAddons.includes(t)) return; lUpdate("ticketAddons", [...ticketAddons, t]); setNewTicketAddon(""); };
  const removeTicketAddon = (t) => lUpdate("ticketAddons", ticketAddons.filter(x => x !== t));

  const savedVenues = local.savedVenues || [];
  const addSavedVenue = () => {
    const v = { name: newVenue.name.trim(), city: newVenue.city.trim(), country: newVenue.country.trim(), room: newVenue.room.trim() };
    if (!v.name || !v.city || !v.country) return;
    if (savedVenues.some(x => x.name.toLowerCase() === v.name.toLowerCase() && x.city.toLowerCase() === v.city.toLowerCase())) return;
    const nextV = [...savedVenues, v];
    lUpdate("savedVenues", nextV); onUpdate("savedVenues", nextV);
    setNewVenue({ name: '', city: '', country: '', room: '' });
  };
  const removeSavedVenue = (i) => { const nextV = savedVenues.filter((_, j) => j !== i); lUpdate("savedVenues", nextV); onUpdate("savedVenues", nextV); };
  const importVenuesFromHistory = () => {
    const known = new Set(savedVenues.map(v => v.name.toLowerCase()));
    const found = {};
    [...concerts].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(c => {
      if (c.venue && !known.has(c.venue.toLowerCase())) found[c.venue] = { name: c.venue, city: c.city || '', country: c.country || '', room: '' };
    });
    const adds = Object.values(found);
    if (adds.length === 0) { onNotify('All venues from your shows are already saved'); return; }
    const nextV = [...savedVenues, ...adds];
    lUpdate("savedVenues", nextV); onUpdate("savedVenues", nextV);
    onNotify(`Added ${adds.length} venue${adds.length === 1 ? '' : 's'} from your history`);
  };

  const friendGroups = local.friendGroups || [];
  const allFriendsFromConcerts = [...new Set(concerts.flatMap(c => getFriends(c)))].sort();
  const addFriendGroup = () => {
    const name = newGroupName.trim();
    if (!name || newGroupFriends.length === 0) return;
    if (friendGroups.some(g => g.name.toLowerCase() === name.toLowerCase())) return;
    const next = [...friendGroups, { name, friends: newGroupFriends }];
    lUpdate("friendGroups", next); onUpdate("friendGroups", next);
    setNewGroupName(''); setNewGroupFriends([]);
  };
  const removeFriendGroup = (i) => { const next = friendGroups.filter((_, j) => j !== i); lUpdate("friendGroups", next); onUpdate("friendGroups", next); };
  const importFriendGroupsFromHistory = () => {
    const existing = new Set(friendGroups.map(g => [...g.friends].sort().join('|')));
    const pairCount = {};
    concerts.forEach(c => {
      const fs = getFriends(c); if (fs.length < 2) return;
      const key = [...fs].sort().join('|');
      pairCount[key] = (pairCount[key] || 0) + 1;
    });
    const queue = Object.entries(pairCount)
      .filter(([key, count]) => count >= 3 && !existing.has(key))
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ friends: key.split('|'), count, suggested: key.split('|').join(' & ') }));
    if (queue.length === 0) { onNotify('No new groups found (need 3+ shows together)'); return; }
    setImportQueue(queue);
    setImportNameInput(queue[0].suggested);
  };
  const toggleGroupFriend = (f) => setNewGroupFriends(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handleCsvExport = () => {
    const headers = ['ID','Date','Artist','Venue','Room','City','Country','Type','Tour','Genre','SubGenre','Language','Rating','TicketPrice','Friends','Solo','VenueSize','Notes'];
    const rows = concerts.map(c => [
      c.id, c.date, c.artist, c.venue, c.room||'', c.city, c.country, c.type, c.tour||'',
      c.genre||'', c.subgenre||'', (Array.isArray(c.language) ? c.language.join('; ') : c.language||''), c.rating||'', c.ticketPrice||'',
      getFriends(c).join('; '), c.solo?'yes':'', c.venueSize||'', (c.notes||'').replace(/\n/g,' ')
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='settracker.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleXlsxExport = async () => {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();

    // Sheet 1: Shows
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(concerts.map(c => ({
      ID: c.id, Date: c.date, Artist: c.artist, Venue: c.venue, Room: c.room || '',
      City: c.city, Country: c.country, Type: c.type, Tour: c.tour || '',
      SeenAs: c.seenAs || '', Genre: c.genre || '', Subgenre: c.subgenre || '',
      Language: (Array.isArray(c.language) ? c.language : [c.language || '']).join('; '),
      Rating: c.rating || '', TicketPrice: c.ticketPrice || '',
      Friends: getFriends(c).join('; '), Solo: c.solo ? 'yes' : '',
      VenueSize: c.venueSize || '', Notes: (c.notes || '').replace(/\n/g, ' '),
    }))), 'Shows');

    // Sheet 2: Setlists (main artist + support acts, each song its own row)
    const setlistRows = [];
    concerts.forEach(c => {
      getSongList(c.setlist).forEach((s, i) => setlistRows.push({
        ConcertID: c.id, Date: c.date, MainArtist: c.artist,
        Performer: c.artist, IsSupport: 'no',
        Position: i + 1, Song: getSongName(s), Note: getSongInfo(s) || '',
      }));
      Object.entries(c.supportSetlists || {}).forEach(([artist, songs]) =>
        getSongList(songs).forEach((s, i) => setlistRows.push({
          ConcertID: c.id, Date: c.date, MainArtist: c.artist,
          Performer: artist, IsSupport: 'yes',
          Position: i + 1, Song: getSongName(s), Note: getSongInfo(s) || '',
        }))
      );
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setlistRows.length ? setlistRows : [{}]), 'Setlists');

    // Sheet 3: Support acts
    const supportRows = [];
    concerts.forEach(c => (c.support || []).forEach(s => supportRows.push({
      ConcertID: c.id, Date: c.date, MainArtist: c.artist,
      SupportAct: getSupportName(s), Role: getSupportRole(s),
    })));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supportRows.length ? supportRows : [{}]), 'Support acts');

    XLSX.writeFile(wb, 'settracker.xlsx');
  };

  const handleExport = async () => {
    try {
      // concerts prop passed from parent
      setExportData(JSON.stringify(concerts, null, 2));
    } catch (e) {
      setExportStatus("error");
    }
  };

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(exportData);
      setExportStatus("copied");
      onNotify('Backup copied');
      setTimeout(() => setExportStatus(null), 2000);
    } catch (e) {
      setExportStatus("error");
      onNotify('Could not copy backup', 'error');
    }
  };

  const asArray = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') return value.split(';').map(s => s.trim()).filter(Boolean);
    return [];
  };

  const asNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeDate = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const d = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : trimmed;
  };

  const excelDateToIso = (value, XLSX) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const d = XLSX.SSF.parse_date_code(value);
      if (!d) return null;
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    return normalizeDate(String(value || ''));
  };

  const normalizeConcertForImport = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const artist = typeof raw.artist === 'string' ? raw.artist.trim() : '';
    const date = normalizeDate(raw.date);
    if (!artist || !date) return null;

    const ratingMax = settings.ratingSystem || 5;
    const rating = asNumber(raw.rating);
    const safeRating = rating && rating >= 1 && rating <= ratingMax ? rating : null;
    const rawType = typeof raw.type === 'string' ? raw.type.toLowerCase() : raw.type;
    const type = rawType === 'festival' ? 'festival' : 'concert';
    const id = typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
      ...raw,
      id,
      artist,
      date,
      endDate: type === 'festival' ? normalizeDate(raw.endDate) || '' : raw.endDate || '',
      venue: typeof raw.venue === 'string' ? raw.venue : '',
      room: typeof raw.room === 'string' ? raw.room : '',
      city: typeof raw.city === 'string' ? raw.city : '',
      country: typeof raw.country === 'string' ? raw.country : '',
      type,
      tour: typeof raw.tour === 'string' ? raw.tour : '',
      support: Array.isArray(raw.support) ? raw.support : [],
      friends: asArray(raw.friends),
      solo: raw.solo === true || raw.solo === 'yes',
      rating: safeRating,
      ticketPrice: asNumber(raw.ticketPrice),
      otherCost: asNumber(raw.otherCost),
      costBreakdown: raw.costBreakdown && typeof raw.costBreakdown === 'object' ? {
        travel: asNumber(raw.costBreakdown.travel), stay: asNumber(raw.costBreakdown.stay),
        food: asNumber(raw.costBreakdown.food), other: asNumber(raw.costBreakdown.other),
      } : null,
      merch: Array.isArray(raw.merch) ? raw.merch : [],
      notes: typeof raw.notes === 'string' ? raw.notes : '',
      genre: raw.genre || null,
      subgenre: raw.subgenre || null,
      language: asArray(raw.language),
      venueSize: raw.venueSize || null,
      seenAs: raw.seenAs || (type === 'festival' ? 'Festival' : 'Headliner'),
      acts: Array.isArray(raw.acts) ? raw.acts : [],
      setlist: Array.isArray(raw.setlist) ? raw.setlist : [],
      supportSetlists: raw.supportSetlists && typeof raw.supportSetlists === 'object' ? raw.supportSetlists : {},
    };
  };

  const doImport = async (concerts) => {
    const valid = concerts.map(normalizeConcertForImport).filter(Boolean);
    const skipped = concerts.length - valid.length;
    if (valid.length === 0) { setImportStatus("error"); setImportMessage("No valid concerts found — each row needs at least an Artist and Date."); return; }
    let failed = 0;
    for (const c of valid) {
      const result = await onSaveConcert(c);
      if (result?.error) failed++;
    }
    const imported = valid.length - failed;
    setImportReport({ total: concerts.length, imported, skipped, failed });
    if (failed > 0) {
      setImportStatus("error");
      setImportMessage(`Imported ${imported}, skipped ${skipped}, failed ${failed}.`);
      onNotify('Import finished with errors', 'error');
      return;
    }
    setImportStatus("success");
    setImportMessage(`Imported ${imported} concert${imported !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`);
    onNotify('Import finished');
  };

  const handleImport = async () => {
    try {
      let parsed;
      try { parsed = JSON.parse(importText); } catch { setImportStatus("error"); setImportMessage("Couldn't read this as JSON — check for missing brackets or commas."); return; }
      if (!Array.isArray(parsed)) { setImportStatus("error"); setImportMessage("Expected a list of concerts (JSON array starting with [ ). Got a different format."); return; }
      if (parsed.length === 0) { setImportStatus("error"); setImportMessage("The JSON is empty — no concerts to import."); return; }
      setImportText("");
      await doImport(parsed);
    } catch { setImportStatus("error"); setImportMessage("Something went wrong during import. Try again."); }
  };

  const parseCSV = (text) => {
    const parseRow = (line) => {
      const fields = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (ch === ',' && !inQ) { fields.push(cur); cur = ''; }
        else cur += ch;
      }
      fields.push(cur); return fields;
    };
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { error: "The CSV file looks empty — it needs a header row and at least one concert row." };
    const headers = parseRow(lines[0]);
    if (!headers.includes('Artist') || !headers.includes('Date')) {
      return { error: `CSV is missing required columns. Found: ${headers.join(', ')}. Expected at least: Artist, Date.` };
    }
    return lines.slice(1).map(line => {
      const vals = parseRow(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return {
        id: obj.ID || `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: obj.Date || null, artist: obj.Artist || null, venue: obj.Venue || '', room: obj.Room || null,
        city: obj.City || '', country: obj.Country || '', type: obj.Type || 'concert',
        tour: obj.Tour || null, genre: obj.Genre || null, subgenre: obj.SubGenre || null,
        language: obj.Language ? obj.Language.split('; ').filter(Boolean) : [],
        rating: obj.Rating ? parseInt(obj.Rating) : null,
        ticketPrice: obj.TicketPrice ? parseFloat(obj.TicketPrice) : null,
        friends: obj.Friends ? obj.Friends.split('; ').filter(Boolean) : [],
        solo: obj.Solo === 'yes', venueSize: obj.VenueSize || null, notes: obj.Notes || null,
        seenAs: obj.SeenAs || null, merch: [], support: [],
      };
    });
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        if (file.name.endsWith('.csv')) {
          const result = parseCSV(ev.target.result);
          if (result?.error) { setImportStatus("error"); setImportMessage(result.error); return; }
          await doImport(result);
        } else {
          let parsed;
          try { parsed = JSON.parse(ev.target.result); } catch { setImportStatus("error"); setImportMessage("Couldn't read the file as JSON — it may be corrupted or the wrong format."); return; }
          if (!Array.isArray(parsed)) { setImportStatus("error"); setImportMessage("Expected a list of concerts (JSON array). Got a different format."); return; }
          await doImport(parsed);
        }
      } catch { setImportStatus("error"); setImportMessage("Something went wrong reading the file. Try again."); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleXlsxImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await loadXlsx();
        const wb = XLSX.read(ev.target.result, { type: 'array' });

        // Merge support acts from "Support acts" sheet into existing concerts
        const supportSheet = wb.Sheets['Support acts'];
        if (supportSheet) {
          const rows = XLSX.utils.sheet_to_json(supportSheet);
          const byId = {};
          rows.forEach(r => {
            const id = r.ConcertID;
            const name = r.SupportAct;
            const role = r.Role || 'support';
            if (!id || !name) return;
            if (!byId[id]) byId[id] = [];
            byId[id].push({ name, role });
          });
          let updated = 0;
          for (const concert of concerts) {
            const incoming = byId[concert.id];
            if (!incoming) continue;
            const existingNames = (concert.support || []).map(s => getSupportName(s).toLowerCase());
            const toAdd = incoming.filter(a => !existingNames.includes(a.name.toLowerCase()));
            if (toAdd.length === 0) continue;
            await onSaveConcert({ ...concert, support: [...(concert.support || []), ...toAdd] });
            updated++;
          }
          if (updated > 0) {
            setImportStatus("success");
            setImportMessage(`Updated support acts for ${updated} concert${updated !== 1 ? 's' : ''}.`);
          } else {
            setImportStatus("success");
            setImportMessage("All support acts were already up to date — nothing to add.");
          }
          return;
        }

        // Fallback: try reading Shows sheet as full concert import
        const showsSheet = wb.Sheets['Shows'];
        if (!showsSheet) { setImportStatus("error"); setImportMessage("No recognised sheet found. Expected 'Support acts' or 'Shows'."); return; }
        const rows = XLSX.utils.sheet_to_json(showsSheet);
        const parsed = rows.map(r => ({
          id: r.ID || `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: excelDateToIso(r.Date, XLSX), artist: r.Artist || null, venue: r.Venue || '', room: r.Room || null,
          city: r.City || '', country: r.Country || '', type: r.Type || 'concert',
          tour: r.Tour || null, genre: r.Genre || null, subgenre: r.Subgenre || null,
          language: r.Language ? r.Language.split('; ').filter(Boolean) : [],
          rating: r.Rating ? parseInt(r.Rating) : null,
          ticketPrice: r.TicketPrice ? parseFloat(r.TicketPrice) : null,
          friends: r.Friends ? r.Friends.split('; ').filter(Boolean) : [],
          solo: r.Solo === 'yes', venueSize: r.VenueSize || null, notes: r.Notes || null,
          seenAs: r.SeenAs || null, merch: [], support: [],
        }));
        await doImport(parsed);
      } catch (err) {
        setImportStatus("error");
        setImportMessage("Something went wrong reading the XLSX file. Try again.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div style={{ padding: "16px 10px 100px", width: "min(100%, 430px)", margin: "0 auto" }}>
      <div style={{ minHeight: 30, marginBottom: 14 }} />
      {(hasChanges || saved) && (
        <button onClick={handleSettingsSave} style={{
          position: "fixed", top: "calc(12px + env(safe-area-inset-top, 0px))", right: 14, zIndex: 300,
          background: saved ? "#a78bfa" : "#1a1a30",
          border: `1px solid ${saved ? "#a78bfa" : "#a78bfa"}`,
          color: saved ? "#0c0c14" : "#a78bfa",
          borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all 0.15s",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
        }}>{saved ? "Saved ✓" : "Save"}</button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0, marginBottom: 14, background: "#13131f", border: "1px solid #25243a", borderRadius: 10, padding: 3 }}>
        {[
          { id: null, label: 'General' },
          { id: 'preferences', label: 'Display' },
          { id: 'tags', label: 'Tags' },
          { id: 'account', label: 'Account' },
        ].map(tab => (
          <button key={String(tab.id)} onClick={() => { setActiveSettingsTab(tab.id); setOpenSection(null); }} style={{
            minHeight: 34, borderRadius: 7, cursor: "pointer", fontSize: 10,
            fontFamily: "'DM Mono', monospace", fontWeight: activeSettingsTab === tab.id ? 700 : 400,
            background: activeSettingsTab === tab.id ? "#30284d" : "transparent",
            border: `1px solid ${activeSettingsTab === tab.id ? "#5e4c8f" : "transparent"}`,
            color: activeSettingsTab === tab.id ? "#a78bfa" : "#6b6a8f",
            padding: "6px 4px", overflow: "hidden", textOverflow: "ellipsis",
          }}>{tab.label}</button>
        ))}
      </div>

      {activeSettingsTab === null && (() => {
        return (
          <div>
            {/* App identity */}
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 14, padding: "16px", marginBottom: 12, textAlign: "center" }}>
              <div style={{ color: "#e2e0ff", fontSize: 15, fontFamily: "'Syne', sans-serif", fontWeight: 800, letterSpacing: "0.04em", marginBottom: 3 }}>settracker</div>
              <div style={{ color: "#4a4870", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>your personal concert diary</div>
            </div>

            {/* Help links */}
            <SettingsSection title="Help">
              {[
                { svg: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>, label: "Report a bug or suggest a feature", url: "https://github.com/HoltropAF/concert_tracker/issues/new" },
                { svg: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, label: "Releases and changelog", url: "https://github.com/HoltropAF/concert_tracker/releases" },
                { svg: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, label: "Documentation", url: "https://github.com/HoltropAF/concert_tracker/wiki" },
              ].map(({ svg, label, url }, i, arr) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: "#b6b3d7", fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textDecoration: "none", padding: "11px 2px", borderBottom: i < arr.length - 1 ? "1px solid #1a1a24" : "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(167,139,250,0.1)", flexShrink: 0 }}>
                      <span style={{ width: 15, height: 15, display: "flex" }}>{svg}</span>
                    </span>
                    <span>{label}</span>
                  </span>
                  <span style={{ color: "#4a4870", fontSize: 13, flexShrink: 0 }}>↗</span>
                </a>
              ))}
            </SettingsSection>

            {/* Social links */}
            <SettingsSection title="Find me online">
              <div style={{ display: "flex", gap: 10, padding: "10px 2px", overflowX: "auto" }}>
                {socialLinks.map(({ href, label, icon }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" title={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none", flexShrink: 0 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {icon}
                    </span>
                    <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#4a4870", textAlign: "center", letterSpacing: "0.03em" }}>{label}</span>
                  </a>
                ))}
              </div>
            </SettingsSection>
          </div>
        );
      })()}

      {activeSettingsTab === 'preferences' && <>
        <SettingsSection title="Opening defaults">
          <SettingsRow label="Show past concerts" sub="On by default when opening app">
            <SettingsToggle checked={local.defaultShowPast === 'open'} onChange={checked => { const v = checked ? 'open' : 'closed'; lUpdate("defaultShowPast", v); onUpdate("defaultShowPast", v); }} />
          </SettingsRow>
          <SettingsRow label="Show wishlist" sub="Include want-to-go entries">
            <SettingsToggle checked={local.defaultShowWishlist === 'open'} onChange={checked => { const v = checked ? 'open' : 'closed'; lUpdate("defaultShowWishlist", v); onUpdate("defaultShowWishlist", v); }} />
          </SettingsRow>
          <SettingsRow label="Show upcoming" sub="On by default when opening app">
            <SettingsToggle checked={local.defaultShowUpcoming !== 'closed'} onChange={checked => { const v = checked ? 'open' : 'closed'; lUpdate("defaultShowUpcoming", v); onUpdate("defaultShowUpcoming", v); }} />
          </SettingsRow>
          <SettingsRow label="Default view" sub="What shows first on open">
            <SettingsOptionPills value={local.defaultTab} options={defaultViewOptions} onChange={v => { lUpdate("defaultTab", v); onUpdate("defaultTab", v); }} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Concert cards">
          <SettingsRow label="Show venue" sub="Display venue name on cards">
            <SettingsToggle checked={local.showVenueOnCards !== false} onChange={checked => { lUpdate("showVenueOnCards", checked); onUpdate("showVenueOnCards", checked); }} />
          </SettingsRow>
          <SettingsRow label="Show genre tags" sub="Tags visible on concert cards">
            <SettingsToggle checked={local.showGenreTagsOnCards !== false} onChange={checked => { lUpdate("showGenreTagsOnCards", checked); onUpdate("showGenreTagsOnCards", checked); }} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Concert list">
          <SettingsRow label="Group by month" sub="Month headers in concert list">
            <SettingsToggle checked={!!local.groupByMonth} onChange={checked => { lUpdate("groupByMonth", checked); onUpdate("groupByMonth", checked); }} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Summary & stats">
          <SettingsRow label="Stats tab" sub="Which stats view opens first">
            <SettingsOptionPills value={local.defaultStatsTab} options={[{id:"summary",label:"Summary"},{id:"charts",label:"Charts"}]} onChange={v => lUpdate("defaultStatsTab", v)} />
          </SettingsRow>
          <SettingsRow label="Summary scope" sub="Default time range on summary page">
            <SettingsOptionPills
              value={local.summaryYear || 'all'}
              options={[{ id: 'all', label: 'All time' }, { id: String(new Date().getFullYear()), label: String(new Date().getFullYear()) }]}
              onChange={v => { onUpdate('summaryYear', v); lUpdate('summaryYear', v); }}
            />
          </SettingsRow>
          <SettingsRow label="Top artists" sub="Rows shown in charts">
            <SettingsStepper value={local.topArtistsRows} onChange={v => { lUpdate("topArtistsRows", v); onUpdate("topArtistsRows", v); }} max={6} />
          </SettingsRow>
          <SettingsRow label="Top friends" sub="Rows shown in charts">
            <SettingsStepper value={local.topFriendsRows} onChange={v => lUpdate("topFriendsRows", v)} />
          </SettingsRow>
          <SettingsRow label="Top venues" sub="Rows shown in charts">
            <SettingsStepper value={local.topVenuesRows} onChange={v => lUpdate("topVenuesRows", v)} />
          </SettingsRow>
          <SettingsRow label="Most expensive" sub="Rows shown in list">
            <SettingsStepper value={local.topExpensiveRows} onChange={v => lUpdate("topExpensiveRows", v)} min={3} max={20} />
          </SettingsRow>
          <SettingsRow label="Songs shown" sub="Default rows in Songs tab">
            <SettingsStepper value={local.topSongsRows} onChange={v => lUpdate("topSongsRows", v)} min={3} max={50} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="App">
          <SettingsRow label="Color theme" sub="Changes instantly, no save needed">
            <SettingsOptionPills
              value={local.colorTheme || 'purple'}
              options={[{id:'purple',label:'Purple'},{id:'blue',label:'Blue'},{id:'green',label:'Green'},{id:'red',label:'Red'},{id:'orange',label:'Orange'},{id:'mono',label:'Mono'}]}
              onChange={v => { onUpdate('colorTheme', v); lUpdate('colorTheme', v); }}
            />
          </SettingsRow>
          <SettingsRow label="Rating system" sub="Stars used when rating shows">
            <SettingsOptionPills value={String(local.ratingSystem || 5)} options={[{id:"5",label:"5 stars"},{id:"10",label:"10 stars"}]} onChange={v => lUpdate("ratingSystem", Number(v))} />
          </SettingsRow>
          <SettingsRow label="Default country" sub="Pre-filled when adding a show">
            <input value={local.defaultCountry || ''} onChange={e => lUpdate('defaultCountry', e.target.value)} placeholder="e.g. Netherlands" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '6px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
          </SettingsRow>
        </SettingsSection>
      </>}

      {activeSettingsTab === 'tags' && <>
      {[
        { label: "Genres", id: "genres", items: genres, onRemove: removeGenre, input: newGenre, onInput: setNewGenre, onAdd: addGenre, placeholder: "Add genre..." },
        { label: "Subgenres", id: "subgenres", items: subgenres, onRemove: removeSubgenre, input: newSubgenre, onInput: setNewSubgenre, onAdd: addSubgenre, placeholder: "Add subgenre..." },
        { label: "Languages", id: "languages", items: languages, onRemove: removeLanguage, input: newLanguage, onInput: setNewLanguage, onAdd: addLanguage, placeholder: "Add language..." },
        { label: "Venue sizes", id: "venueSizes", items: venueSizes, onRemove: removeVenueSize, input: newVenueSize, onInput: setNewVenueSize, onAdd: addVenueSize, placeholder: "Add venue size..." },
        { label: "Merch items", id: "merch", items: categories, onRemove: removeCategory, input: newCategory, onInput: setNewCategory, onAdd: addCategory, placeholder: "Add category..." },
        { label: "Ticket types", id: "ticketTypes", items: ticketTypes, onRemove: removeTicketType, input: newTicketType, onInput: setNewTicketType, onAdd: addTicketType, placeholder: "Add ticket type..." },
        { label: "Ticket add-ons", id: "ticketAddons", items: ticketAddons, onRemove: removeTicketAddon, input: newTicketAddon, onInput: setNewTicketAddon, onAdd: addTicketAddon, placeholder: "Add add-on..." },
      ].map(({ label, id, items, ...props }) => (
        <Collapsible key={id} title={`${label} (${items.length})`} defaultOpen={false} {...sec(id)}>
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px 16px", marginBottom: 4 }}>
            <TagManager items={items} {...props} />
          </div>
        </Collapsible>
      ))}
      </>}

      {activeSettingsTab === 'tags' && <>
      <Collapsible title={`Saved venues (${savedVenues.length})`} {...sec("venues")}>
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px 16px", marginBottom: 4 }}>
          <button onClick={importVenuesFromHistory} style={{ width: '100%', background: 'none', border: '1px dashed #3d3564', borderRadius: 8, color: '#a78bfa', fontSize: 12, padding: '8px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>⤓ Import venues from my shows</button>
          {savedVenues.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => setShowSavedVenues(o => !o)} style={{ background: 'none', border: 'none', color: '#6b6a8f', cursor: 'pointer', fontSize: 11, fontFamily: "'DM Mono', monospace", padding: 0, marginBottom: showSavedVenues ? 10 : 0 }}>
                {showSavedVenues ? '▾' : '▸'} already added ({savedVenues.length})
              </button>
              {showSavedVenues && savedVenues.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #1a1a2e' }}>
                  <div>
                    <div style={{ color: '#c4c2f0', fontSize: 13, fontWeight: 600 }}>{v.name}{v.room ? ` · ${v.room}` : ''}</div>
                    <div style={{ color: '#6b6a8f', fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{v.city}</div>
                    <div style={{ color: '#4a4870', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{v.country}</div>
                  </div>
                  <button onClick={() => removeSavedVenue(i)} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, marginLeft: 8, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Add venue</div>
          {[
            { key: 'name', placeholder: 'Venue name *' },
            { key: 'room', placeholder: 'Room / stage (optional)' },
            { key: 'city', placeholder: 'City *' },
            { key: 'country', placeholder: 'Country *' },
          ].map(({ key, placeholder }) => (
            <input key={key} value={newVenue[key]} onChange={e => setNewVenue(v => ({ ...v, [key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addSavedVenue()}
              placeholder={placeholder}
              style={{ width: '100%', background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '7px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, boxSizing: 'border-box', marginBottom: 6 }} />
          ))}
          <button onClick={addSavedVenue} disabled={!newVenue.name.trim() || !newVenue.city.trim() || !newVenue.country.trim()} style={{
            background: 'none', border: '1px solid #2a4a3a', borderRadius: 8, color: '#a78bfa',
            fontSize: 12, padding: '6px 14px', cursor: 'pointer', fontFamily: "'DM Mono', monospace",
            opacity: !newVenue.name.trim() || !newVenue.city.trim() || !newVenue.country.trim() ? 0.4 : 1
          }}>Add venue</button>
        </div>
      </Collapsible>

      {false && <Collapsible title={`Friend groups (${friendGroups.length})`} {...sec("friendGroups")}>
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px 16px", marginBottom: 4 }}>
          {friendGroups.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => setShowFriendGroups(o => !o)} style={{ background: 'none', border: 'none', color: '#6b6a8f', cursor: 'pointer', fontSize: 11, fontFamily: "'DM Mono', monospace", padding: 0, marginBottom: showFriendGroups ? 10 : 0 }}>
                {showFriendGroups ? '▾' : '▸'} already added ({friendGroups.length})
              </button>
              {showFriendGroups && friendGroups.map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #1a1a2e' }}>
                  <div>
                    <div style={{ color: '#c4c2f0', fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                    <div style={{ color: '#6b6a8f', fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{g.friends.join(', ')}</div>
                  </div>
                  <button onClick={() => removeFriendGroup(i)} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, marginLeft: 8, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}
          {/* Import review flow */}
          {importQueue && importQueue.length > 0 ? (() => {
            const current = importQueue[0];
            const remaining = importQueue.length;
            const dismiss = () => {
              const next = importQueue.slice(1);
              setImportQueue(next.length > 0 ? next : null);
              setImportNameInput(next[0]?.suggested || '');
            };
            const save = () => {
              const name = importNameInput.trim() || current.suggested;
              const next2 = [...friendGroups, { name, friends: current.friends }];
              lUpdate('friendGroups', next2); onUpdate('friendGroups', next2);
              const q = importQueue.slice(1);
              setImportQueue(q.length > 0 ? q : null);
              setImportNameInput(q[0]?.suggested || '');
            };
            return (
              <div style={{ background: '#0c0c14', border: '1px solid #a78bfa55', borderRadius: 12, padding: '14px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Suggested group {importQueue.length > 1 ? `(${remaining} left)` : '(last one)'}
                </div>
                <div style={{ fontSize: 13, color: '#c4c2f0', marginBottom: 4 }}>{current.friends.join(', ')}</div>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{current.count} shows together</div>
                <input
                  value={importNameInput}
                  onChange={e => setImportNameInput(e.target.value)}
                  placeholder="Group name…"
                  style={{ width: '100%', background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '7px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, boxSizing: 'border-box', marginBottom: 10 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={save} style={{ flex: 1, background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 12, padding: '8px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>Save group</button>
                  <button onClick={dismiss} style={{ flex: 1, background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#6b6a8f', fontSize: 12, padding: '8px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Skip</button>
                </div>
              </div>
            );
          })() : (
            <button onClick={importFriendGroupsFromHistory} style={{ width: '100%', background: 'none', border: '1px dashed #3d3564', borderRadius: 8, color: '#a78bfa', fontSize: 12, padding: '8px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>⤓ Suggest groups from my shows (3+ together)</button>
          )}
          <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Add group</div>
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name (e.g. Festival crew)" style={{ width: '100%', background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '7px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, boxSizing: 'border-box', marginBottom: 8 }} />
          {allFriendsFromConcerts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {allFriendsFromConcerts.map(f => (
                <button key={f} onClick={() => toggleGroupFriend(f)} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: newGroupFriends.includes(f) ? '#a78bfa' : '#0c0c14', color: newGroupFriends.includes(f) ? '#0c0c14' : '#6b6a8f', border: `1px solid ${newGroupFriends.includes(f) ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{f}</button>
              ))}
            </div>
          )}
          <button onClick={addFriendGroup} disabled={!newGroupName.trim() || newGroupFriends.length === 0} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 8, color: '#a78bfa', fontSize: 12, padding: '6px 14px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", opacity: !newGroupName.trim() || newGroupFriends.length === 0 ? 0.4 : 1 }}>Add group</button>
        </div>
      </Collapsible>}

      </>}

      {false && activeSettingsTab === 'preferences' && (
        <SettingsSection title="Visible sections">
          <SettingsRow label="Summary scope" sub="Default time range on summary page">
            <SettingsOptionPills
              value={local.summaryYear || 'all'}
              options={[{ id: 'all', label: 'All time' }, { id: String(new Date().getFullYear()), label: String(new Date().getFullYear()) }]}
              onChange={v => { onUpdate('summaryYear', v); lUpdate('summaryYear', v); }}
            />
          </SettingsRow>
        {(() => {
          const hiddenBlocks = local.hiddenSummaryBlocks || [];
          const hiddenGroups = local.hiddenChartGroups || [];
          const hiddenChts = local.hiddenCharts || [];
          const toggleBlock = id => { const next = hiddenBlocks.includes(id) ? hiddenBlocks.filter(x => x !== id) : [...hiddenBlocks, id]; onUpdate('hiddenSummaryBlocks', next); lUpdate('hiddenSummaryBlocks', next); };
          const toggleGroup = id => { const next = hiddenGroups.includes(id) ? hiddenGroups.filter(x => x !== id) : [...hiddenGroups, id]; onUpdate('hiddenChartGroups', next); lUpdate('hiddenChartGroups', next); };
          const toggleChart = id => { const next = hiddenChts.includes(id) ? hiddenChts.filter(x => x !== id) : [...hiddenChts, id]; onUpdate('hiddenCharts', next); lUpdate('hiddenCharts', next); };
          const pill = (label, active, onClick, small = false) => (
            <button onClick={onClick} style={{
              padding: small ? '2px 8px' : '3px 10px', borderRadius: 99, fontSize: small ? 9 : 10, cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", border: `1px solid ${active ? '#a78bfa' : '#1f1f35'}`,
              background: active ? '#1a1a30' : 'none', color: active ? '#a78bfa' : '#4a4870',
            }}>{label}</button>
          );
          const BLOCKS = [{ id: 'stats1', label: 'Stats' }, { id: 'cumulative', label: 'Cumulative' }, { id: 'pies', label: 'Genres & Venues' }, { id: 'upnext', label: 'Up next' }];
          const ALL_CHART_GROUPS = [
            { id: 'activity', label: 'Activity', charts: [{ id: 'artists', label: 'Artist overview' }, { id: 'shows', label: 'Shows over time' }, { id: 'genres-pie', label: 'Genres & Ratings' }, { id: 'language', label: 'Language' }] },
            { id: 'friends', label: 'Friends', charts: [{ id: 'solo', label: 'Friends & group size' }] },
            { id: 'places', label: 'Places', charts: [{ id: 'venues', label: 'Top venues' }, { id: 'venue-loyalty', label: 'Venue loyalty' }] },
            { id: 'financial', label: 'Financial', charts: [{ id: 'year-spend', label: 'Spending per year' }, { id: 'averages', label: 'Averages' }, { id: 'expensive', label: 'Most expensive shows' }, { id: 'merch-overview', label: 'Merch' }] },
            { id: 'music', label: 'Music', charts: [{ id: 'songs', label: 'Top songs' }, { id: 'covers', label: 'Covers' }] },
          ];
          return (
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 9, color: '#4a4870', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Summary blocks</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                {BLOCKS.map(b => pill(b.label, !hiddenBlocks.includes(b.id), () => toggleBlock(b.id)))}
              </div>
              <div style={{ fontSize: 9, color: '#4a4870', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Charts</div>
              {ALL_CHART_GROUPS.map(g => (
                <div key={g.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {pill(g.label, !hiddenGroups.includes(g.id), () => toggleGroup(g.id))}
                  </div>
                  {!hiddenGroups.includes(g.id) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 10, borderLeft: '2px solid #1f1f35' }}>
                      {g.charts.map(c => pill(c.label, !hiddenChts.includes(c.id), () => toggleChart(c.id), true))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
        </SettingsSection>
      )}

      {activeSettingsTab === 'account' && <>
        {/* Profile */}
        <SettingsSection title="Profile">
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 99, background: "#201a34", border: "1px solid #3d2f6b", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>
                  {local.userInitials || (userEmail === 'guest' ? '?' : (userEmail || "ST").slice(0, 2).toUpperCase())}
                </div>
                <button onClick={() => { setInitialsInput(local.userInitials || (userEmail === 'guest' ? '' : (userEmail || "ST").slice(0, 2).toUpperCase())); setEditingInitials(true); }} style={{ position: "absolute", bottom: -4, right: -4, width: 16, height: 16, borderRadius: 99, background: "#30284d", border: "1px solid #5e4c8f", color: "#a78bfa", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>✎</button>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {local.userName
                  ? <div style={{ color: "#c4c2f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{local.userName}</div>
                  : <button onClick={() => { setInitialsInput(local.userInitials || (userEmail === 'guest' ? '' : (userEmail || "ST").slice(0, 2).toUpperCase())); setEditingInitials(true); }} style={{ background: "none", border: "none", color: "#4a4870", fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: "pointer", padding: 0, textAlign: "left" }}>+ add name</button>
                }
                <div style={{ color: "#4a4870", fontSize: 11, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: local.userName ? 2 : 0 }}>
                  {userEmail === 'guest' ? 'guest mode · data stored locally' : userEmail}
                </div>
              </div>
              <button onClick={onSignOut} style={{ background: "none", border: "none", color: "#4a4870", fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: "pointer", padding: "4px 0", flexShrink: 0 }}>
                {userEmail === 'guest' ? 'exit' : 'sign out'}
              </button>
            </div>
          </div>
        </SettingsSection>

        {/* Profile edit bottom sheet */}
        {editingInitials && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000000cc", display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", background: "#13131f", borderRadius: "16px 16px 0 0", padding: "20px 20px 40px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#e2e0ff" }}>Edit profile</div>
                <button onClick={() => setEditingInitials(false)} style={{ background: "none", border: "none", color: "#6b6a8f", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: 99, background: "#201a34", border: "1px solid #3d2f6b", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 16, letterSpacing: "0.05em", flexShrink: 0 }}>
                  {initialsInput.slice(0, 3) || "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Initials</div>
                  <input
                    value={initialsInput}
                    onChange={e => setInitialsInput(e.target.value.toUpperCase().slice(0, 3))}
                    placeholder="e.g. AF"
                    maxLength={3}
                    autoFocus
                    style={{ width: "100%", boxSizing: "border-box", background: "#0c0c14", border: "1px solid #2e2e50", borderRadius: 8, color: "#c4c2f0", padding: "9px 12px", fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Name</div>
                <input
                  value={local.userName || ""}
                  onChange={e => lUpdate("userName", e.target.value)}
                  placeholder="e.g. Annuh Floor"
                  style={{ width: "100%", boxSizing: "border-box", background: "#0c0c14", border: "1px solid #2e2e50", borderRadius: 8, color: "#c4c2f0", padding: "9px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
                />
              </div>
              <button onClick={() => {
                const val = initialsInput.trim().slice(0, 3);
                lUpdate("userInitials", val);
                onUpdate("userInitials", val);
                onUpdate("userName", local.userName || "");
                setEditingInitials(false);
              }} style={{ width: "100%", background: "#a78bfa", border: "none", borderRadius: 10, color: "#0c0c14", fontSize: 14, fontWeight: 700, padding: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Save</button>
            </div>
          </div>
        )}

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#9d9bc0', marginBottom: 12, lineHeight: 1.5 }}>
              Ticket sale reminders (30 min before + when sales open) come in two layers: instant alerts while the app is open, and a daily background check for when it's closed.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1a2e' }}>
              <div>
                <div style={{ fontSize: 13, color: '#e2e0ff', fontWeight: 600 }}>While the app is open</div>
                <div style={{ fontSize: 11, color: '#6b6a8f', marginTop: 2 }}>
                  {notifyPermState === 'granted' ? 'Enabled ✓' : notifyPermState === 'denied' ? 'Blocked — allow notifications for this site in your browser settings' : notifyPermState === 'unsupported' ? 'Not supported in this browser' : 'Not enabled yet'}
                </div>
              </div>
              {notifyPermState !== 'granted' && notifyPermState !== 'unsupported' && (
                <button onClick={handleEnableBrowserNotifications} style={{ background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 12, fontWeight: 700, padding: '7px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>Enable</button>
              )}
            </div>

            <div style={{ padding: '12px 0 4px' }}>
              <div style={{ fontSize: 13, color: '#e2e0ff', fontWeight: 600, marginBottom: 4 }}>While the app is closed</div>
              <div style={{ fontSize: 11, color: '#6b6a8f', marginBottom: 10, lineHeight: 1.5 }}>
                Uses <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>ntfy.sh</a> — a free push service. Runs once a day, so this is a "sale's coming up soon" heads-up rather than a precise 30-minute warning.
              </div>
              {!settings.ntfyTopic ? (
                <button onClick={handleSetupNtfyTopic} style={{ background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 12, fontWeight: 700, padding: '9px 14px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Set up background notifications</button>
              ) : (
                <div style={{ background: '#0c0c14', border: '1px solid #1f1f35', borderRadius: 10, padding: '12px' }}>
                  <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Your topic</div>
                  <div style={{ fontSize: 13, color: '#a78bfa', fontFamily: "'DM Mono', monospace", fontWeight: 700, marginBottom: 10, wordBreak: 'break-all' }}>{settings.ntfyTopic}</div>
                  <ol style={{ fontSize: 11, color: '#9d9bc0', lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                    <li>Install the <b>ntfy</b> app (iOS / Android), or just keep <a href={`https://ntfy.sh/${settings.ntfyTopic}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>this page</a> bookmarked</li>
                    <li>Subscribe to topic <b>{settings.ntfyTopic}</b></li>
                  </ol>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={handleSendNtfyTest} disabled={ntfyTestStatus === 'sending'} style={{ background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', fontSize: 11, padding: '7px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                      {ntfyTestStatus === 'sending' ? 'Sending…' : 'Send test'}
                    </button>
                    <button onClick={handleSetupNtfyTopic} style={{ background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#6b6a8f', fontSize: 11, padding: '7px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>New topic</button>
                  </div>
                  {ntfyTestStatus === 'sent' && <div style={{ fontSize: 10, color: '#34d399', marginTop: 8 }}>Sent — check your device</div>}
                  {ntfyTestStatus === 'error' && <div style={{ fontSize: 10, color: '#f87171', marginTop: 8 }}>Couldn't send — is the topic subscribed?</div>}
                </div>
              )}
            </div>
          </div>
        </SettingsSection>

        {/* Integrations */}
        <SettingsSection title="Integrations">
          <div style={{ padding: "14px 16px" }}>
            {(() => {
              const spotifyConnected = Boolean(settings.spotifyAccessToken)
              const dotColor = spotifyConnected ? "#4ade80" : local.spotifyClientId ? "#fbbf24" : "#2e2e4a"
              const statusColor = spotifyConnected ? "#4ade80" : local.spotifyClientId ? "#fbbf24" : "#4a4870"
              const statusLabel = spotifyConnected ? "connected" : local.spotifyClientId ? "client ID set — not connected" : "not configured"
              return (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: local.spotifyClientId ? 0 : 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#0d2b12", border: "1px solid #1a4d22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 0 1-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 0 1 .207.857zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 0 1-.966-.519.781.781 0 0 1 .52-.966c3.632-1.102 8.147-.568 11.226 1.322a.78.78 0 0 1 .257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 1 1-.543-1.793c3.539-1.073 9.425-.866 13.146 1.385a.937.937 0 0 1-.986 1.565z"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e0ff", fontFamily: "'DM Sans', sans-serif" }}>Spotify</div>
                <div style={{ fontSize: 11, color: statusColor, fontFamily: "'DM Mono', monospace" }}>{statusLabel}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: dotColor, flexShrink: 0 }} />
            </div>
              )
            })()}

            {!local.spotifyClientId && (
              <button onClick={() => setOpenSection(s => s === 'spotify-guide' ? null : 'spotify-guide')} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: "#a78bfa", fontFamily: "'DM Mono', monospace", textDecoration: "underline", textUnderlineOffset: 2 }}>
                {openSection === 'spotify-guide' ? 'hide setup guide ▲' : 'set up Spotify ▾'}
              </button>
            )}

            {(openSection === 'spotify-guide' || local.spotifyClientId) && (
              <div style={{ marginTop: 14 }}>
                {!local.spotifyClientId && (
                  <ol style={{ paddingLeft: 16, margin: "0 0 12px", color: "#9d9bc0", fontSize: 12, fontFamily: "'DM Mono', monospace", lineHeight: 2 }}>
                    <li>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa" }}>developer.spotify.com ↗</a> and create a free app</li>
                    <li>In the app settings, add <code style={{ background: "#0c0c14", padding: "1px 5px", borderRadius: 4 }}>{window.location.origin}</code> as a <strong>Redirect URI</strong></li>
                    <li>Copy the <strong>Client ID</strong> and paste it below</li>
                  </ol>
                )}
                <input
                  value={local.spotifyClientId || ''}
                  onChange={e => lUpdate('spotifyClientId', e.target.value.trim())}
                  placeholder="Paste Client ID here"
                  style={{ width: "100%", boxSizing: "border-box", background: "#0c0c14", border: "1px solid #2e2e50", borderRadius: 8, color: "#c4c2f0", padding: "9px 12px", fontFamily: "'DM Mono', monospace", fontSize: 12 }}
                />
                {local.spotifyClientId && !settings.spotifyAccessToken && (
                  <button onClick={() => lUpdate('spotifyClientId', '')} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: 8, fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace", textDecoration: "underline", textUnderlineOffset: 2 }}>
                    remove
                  </button>
                )}
                {/* Connect / disconnect */}
                {local.spotifyClientId && !settings.spotifyAccessToken && (
                  <button
                    onClick={() => startSpotifyAuth(local.spotifyClientId)}
                    style={{ display: "block", marginTop: 14, width: "100%", padding: "11px", borderRadius: 9, background: "#1DB954", border: "none", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.01em" }}
                  >
                    Connect Spotify →
                  </button>
                )}
                {settings.spotifyAccessToken && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "'DM Mono', monospace" }}>✓ connected</span>
                    <button
                      onClick={() => {
                        const next = { ...local, spotifyAccessToken: '', spotifyRefreshToken: '', spotifyTokenExpiry: null }
                        setLocal(next)
                        setSaved(false)
                        if (onUpdateAll) onUpdateAll(next)
                      }}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace", textDecoration: "underline", textUnderlineOffset: 2 }}
                    >
                      disconnect
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </SettingsSection>

        {/* Your data */}
        <SettingsSection title="Your data">
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, overflow: "hidden" }}>

            {/* Export */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #1f1f35" }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>Export</div>
                <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Download a copy of your concerts</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleXlsxExport} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "#1a1a30", border: "1px solid #a78bfa", color: "#a78bfa", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>↓ XLSX</button>
                {!exportData
                  ? <button onClick={handleExport} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #2e2e50", color: "#c4c2f0", fontFamily: "'DM Mono', monospace" }}>↓ JSON</button>
                  : <button onClick={() => setExportData(null)} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #1f1f35", color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>Close</button>
                }
              </div>
              {exportData && (
                <div style={{ marginTop: 10 }}>
                  <textarea readOnly value={exportData} rows={3} style={{ width: "100%", background: "rgba(167,139,250,0.05)", border: "1px solid #1f1f35", borderRadius: 8, color: "#6b6a8f", padding: "10px", fontSize: 10, fontFamily: "'DM Mono', monospace", resize: "none", boxSizing: "border-box", marginBottom: 8 }} />
                  <button onClick={handleCopy} style={{ width: "100%", padding: "9px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: exportStatus === "copied" ? "#a78bfa" : "#1a1a30", border: `1px solid ${exportStatus === "copied" ? "#a78bfa" : "#2e2e50"}`, color: exportStatus === "copied" ? "#0c0c14" : "#a78bfa", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{exportStatus === "copied" ? "Copied ✓" : "Copy to clipboard"}</button>
                </div>
              )}
            </div>

            {/* Import */}
            <div style={{ padding: "14px 16px" }}>
              <input type="file" accept=".json" id="import-json" onChange={handleFileImport} style={{ display: "none" }} />
              <input type="file" accept=".csv" id="import-csv" onChange={handleFileImport} style={{ display: "none" }} />
              <input type="file" accept=".xlsx" id="import-xlsx" onChange={handleXlsxImport} style={{ display: "none" }} />
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>Import</div>
                <div style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Load concerts from a file</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => document.getElementById('import-xlsx').click()} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "#1a1a30", border: "1px solid #a78bfa", color: "#a78bfa", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>↑ XLSX</button>
                <button onClick={() => document.getElementById('import-json').click()} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #2e2e50", color: "#c4c2f0", fontFamily: "'DM Mono', monospace" }}>↑ JSON</button>
                <button onClick={() => document.getElementById('import-csv').click()} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #2e2e50", color: "#c4c2f0", fontFamily: "'DM Mono', monospace" }}>↑ CSV</button>
              </div>
              <button onClick={() => setShowAdvancedImport(v => !v)} style={{ background: "none", border: "none", color: "#4a4870", fontSize: 10, fontFamily: "'DM Mono', monospace", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 9 }}>{showAdvancedImport ? "▾" : "▸"}</span> advanced options
              </button>
            </div>

            {/* Advanced: paste JSON + templates */}
            {showAdvancedImport && (
              <div style={{ padding: "14px 16px", borderTop: "1px solid #1f1f35" }}>
                <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>Paste JSON directly</div>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste JSON here..." rows={2} style={{ width: "100%", background: "rgba(167,139,250,0.05)", border: `1px solid ${importStatus === "error" ? "#f472b6" : "#1f1f35"}`, borderRadius: 8, color: "#c4c2f0", padding: "10px", fontSize: 10, fontFamily: "'DM Mono', monospace", resize: "none", boxSizing: "border-box", marginBottom: 8 }} />
                <button onClick={handleImport} disabled={!importText.trim()} style={{ width: "100%", padding: "9px", borderRadius: 8, fontSize: 12, cursor: importText.trim() ? "pointer" : "not-allowed", background: "none", border: "1px solid #1f1f35", color: importText.trim() ? "#c4c2f0" : "#2e2e4a", fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>Restore from paste</button>
                <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>Download blank templates</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { label: "CSV template", fn: () => {
                      const headers = ['ID','Date','Artist','Venue','Room','City','Country','Type','Tour','Genre','SubGenre','Language','Rating','TicketPrice','Friends','Solo','VenueSize','SeenAs','Notes'];
                      const example = ['c-example','2024-01-15','Artist Name','Venue Name','','City','Country','concert','Tour Name','Pop','','English','5','50','Friend One; Friend Two','','Large','Headliner','Great show'];
                      const csv = [headers.join(','), example.map(v => `"${v}"`).join(',')].join('\n');
                      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'settracker-template.csv'; a.click();
                    }},
                    { label: "JSON template", fn: () => {
                      const template = JSON.stringify([{ id: "c-example", date: "2024-01-15", artist: "Artist Name", venue: "Venue Name", room: "", city: "City", country: "Country", type: "concert", tour: "Tour Name", genre: "Pop", subgenre: "", language: ["English"], rating: 5, ticketPrice: 50, friends: ["Friend One"], solo: false, venueSize: "Large", seenAs: "Headliner", notes: "Great show", merch: [], support: [] }], null, 2);
                      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([template], { type: 'application/json' })); a.download = 'settracker-template.json'; a.click();
                    }},
                  ].map(({ label, fn }) => (
                    <button key={label} onClick={fn} style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 11, cursor: "pointer", background: "none", border: "1px solid #1f1f35", color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>↓ {label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Import result */}
            {(importStatus || importReport) && (
              <div style={{ padding: "0 16px 14px" }}>
                {importStatus === "success" && <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 8 }}>{importMessage}</div>}
                {importStatus === "error" && <div style={{ fontSize: 11, color: "#f472b6", marginBottom: 8, lineHeight: 1.5 }}>{importMessage}</div>}
                {importReport && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {[["Rows", importReport.total], ["Added", importReport.imported], ["Skipped", importReport.skipped], ["Failed", importReport.failed]].map(([label, value]) => (
                      <div key={label} style={{ background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 8, padding: "7px 4px", textAlign: "center" }}>
                        <div style={{ color: label === "Failed" && value > 0 ? "#f472b6" : "#a78bfa", fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{value}</div>
                        <div style={{ color: "#4a4870", fontFamily: "'DM Mono', monospace", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </SettingsSection>
      </>}

    </div>
  );
}

// ============================================================
// MAIN APP
// * Top-level shell: nav bar, view routing, add-concert sheet,
// * search/filter state, toast host, and back-button wiring.
// ============================================================

function FilterGroup({ id, label, activeLabel, openId, onToggle, children }) {
  const open = openId === id;
  return (
    <div style={{ marginBottom: 8, borderBottom: '1px solid #1f1f35', paddingBottom: open ? 10 : 8 }}>
      <button onClick={() => onToggle(open ? null : id)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: activeLabel ? '#a78bfa' : '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: activeLabel ? 700 : 400 }}>{label}</span>
          {activeLabel && <span style={{ fontSize: 10, color: '#0c0c14', fontFamily: "'DM Mono', monospace", background: '#a78bfa', borderRadius: 99, padding: '1px 7px' }}>{activeLabel}</span>}
        </div>
        <span style={{ fontSize: 11, color: '#4a4870', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {open && <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>}
    </div>
  );
}

export default function ConcertTracker({ concerts, settings, onSaveConcert, onDeleteConcert, onUpdateSetting, onUpdateSettings, onSignOut, userEmail }) {
  const today = new Date()
  const isPastDate = (dateStr) => new Date(dateStr + 'T00:00:00') <= today

  const showsGroup = ['home', 'artists', 'songs', 'venues']
  const [showStartupScreen, setShowStartupScreen] = useState(true)
  const [view, setView] = useState(settings.defaultTab || 'stats')
  const [showsTab, setShowsTab] = useState(showsGroup.includes(settings.defaultTab) ? settings.defaultTab : 'home')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(null) // null | 'concert' | 'festival'
  const [statsTab, setStatsTab] = useState(settings.defaultStatsTab || 'summary')
  const [chartGroup, setChartGroup] = useState('activity')
  const [search, setSearch] = useState('')
  const [filterYears, setFilterYears] = useState([])
  const [filterType, setFilterType] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [openFilterSection, setOpenFilterSection] = useState(null) // accordion: only one filter category open at a time
  const [filterFriend, setFilterFriend] = useState('all')
  const [filterVenue, setFilterVenue] = useState('all')
  const [filterRating, setFilterRating] = useState(0)
  const [filterSolo, setFilterSolo] = useState(false)
  const [filterGenre, setFilterGenre] = useState('all')
  const [filterSubgenre, setFilterSubgenre] = useState('all')
  const [filterCountry, setFilterCountry] = useState('all')
  const [filterHasPhoto, setFilterHasPhoto] = useState(false)
  const [sortOrder, setSortOrder] = useState(settings.defaultSort || 'newest')
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [showPast, setShowPast] = useState(settings.defaultShowPast === 'open')
  const [showWishlist, setShowWishlist] = useState(settings.defaultShowWishlist === 'open')
  const [showUpcoming, setShowUpcoming] = useState(settings.defaultShowUpcoming !== 'closed')
  const [compact, setCompact] = useState(!!settings.compactView)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; })
  const [selectedDate, setSelectedDate] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const [spotifyPrompt, setSpotifyPrompt] = useState(null) // concert awaiting Spotify link prompt
  const [spotifyMatcherConcert, setSpotifyMatcherConcert] = useState(null) // open SpotifyMatcher for this concert

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => { if (showsGroup.includes(view)) setShowsTab(view); }, [view])
  useEffect(() => { setSortOrder(settings.defaultSort || 'newest'); }, [settings.defaultSort])
  useEffect(() => { setCompact(!!settings.compactView); }, [settings.compactView])

  // Re-arm in-app ticket-sale alarms (30-min-before + at-sale-time) whenever the
  // concert list changes. These only fire while this tab is open — see the
  // Notifications section in Settings for the background/app-closed fallback.
  useEffect(() => { reScheduleAll(concerts) }, [concerts])

  const allFriends = [...new Set(concerts.flatMap(c => getFriends(c)))].sort()

  const savedScrollPos = useRef(0)
  const handleOpenConcert = (concert) => {
    savedScrollPos.current = document.getElementById('content-scroll')?.scrollTop || 0
    setSelected(concert)
  }
  useEffect(() => {
    if (!selected && savedScrollPos.current > 0) {
      requestAnimationFrame(() => {
        const el = document.getElementById('content-scroll')
        if (el) el.scrollTop = savedScrollPos.current
      })
    }
  }, [selected])

  const THEME_FILTER = { purple:'', blue:'hue-rotate(-50deg)', green:'hue-rotate(-145deg)', red:'hue-rotate(90deg)', orange:'hue-rotate(130deg)', mono:'grayscale(1)' };
  const themeFilter = THEME_FILTER[settings.colorTheme] ?? '';

  const handleSave = async (updated) => {
    const result = await onSaveConcert(updated)
    notify(result?.error ? 'Could not save show' : 'Show saved', result?.error ? 'error' : 'success')
    if (result?.error) return result
    setSelected(updated)
    return result
  }

  const handleLinkSongSpotify = async (songName, artistName, spotifyData) => {
    const matching = concerts.filter(concert => {
      const inMain = concert.artist === artistName && getSongList(concert.setlist).some(s => getSongName(s) === songName)
      const inSupport = Object.entries(concert.supportSetlists || {}).some(
        ([a, sl]) => a === artistName && getSongList(sl).some(s => getSongName(s) === songName)
      )
      return inMain || inSupport
    })
    const patch = (sl) => getSongList(sl).map(s =>
      getSongName(s) === songName ? { ...(typeof s === 'string' ? { name: s } : s), ...spotifyData } : s
    )
    for (const concert of matching) {
      const updated = {
        ...concert,
        ...(concert.artist === artistName ? { setlist: patch(concert.setlist) } : {}),
        supportSetlists: Object.fromEntries(
          Object.entries(concert.supportSetlists || {}).map(([a, sl]) => [a, a === artistName ? patch(sl) : sl])
        ),
      }
      await handleSave(updated)
    }
  }

  const updateSetting = (key, value) => {
    return onUpdateSetting(key, value)
  }

  const updateSettings = (next) => {
    return onUpdateSettings ? onUpdateSettings(next) : Promise.resolve()
  }

  const years = [...new Set(concerts.map(c => c.date.slice(0,4)))].sort().reverse()
  const allVenues = [...new Set(concerts.map(c => c.venue))].sort()
  const activeFriends = [...new Set(concerts.flatMap(c => getFriends(c)))].sort()
  const allCountries = [...new Set(concerts.map(c => (c.country || '').trim()).filter(Boolean))].sort()

  const activeFilterCount = [
    filterFriend !== 'all', filterVenue !== 'all',
    filterRating !== 0, filterSolo, filterGenre !== 'all', filterSubgenre !== 'all', filterCountry !== 'all', filterHasPhoto,
    filterType !== 'all'
  ].filter(Boolean).length
  const resetFilters = () => { setFilterFriend('all'); setFilterVenue('all'); setFilterRating(0); setFilterSolo(false); setFilterGenre('all'); setFilterSubgenre('all'); setFilterCountry('all'); setFilterType('all'); setFilterHasPhoto(false); }
  const resetSort = () => setSortOrder(settings.defaultSort || 'newest')

  // Shared with both the past/upcoming list and the wishlist, so picking "Online"
  // doesn't leave want-to-go entries visible just because they have no location set.
  const matchesType = c => {
    if (filterType === 'concerts' && c.type !== 'concert') return false
    if (filterType === 'festivals' && c.type !== 'festival') return false
    if (filterType === 'online' && !isOnline(c)) return false
    return true
  }
  const matchesYear = c => filterYears.length === 0 || filterYears.includes(c.date.slice(0,4))

  const filtered = concerts.filter(c => {
    if (isWish(c)) return false
    if (!matchesYear(c)) return false
    if (!matchesType(c)) return false
    if (filterFriend !== 'all' && !getFriends(c).includes(filterFriend)) return false
    if (filterVenue !== 'all' && c.venue !== filterVenue) return false
    if (filterRating !== 0 && (c.rating || 0) < filterRating) return false
    if (filterSolo && !(getFriends(c).length === 0 || c.solo)) return false
    if (filterGenre !== 'all' && !getGenres(c).includes(filterGenre)) return false
    if (filterHasPhoto && !c.photo) return false
    if (filterSubgenre !== 'all' && c.subgenre !== filterSubgenre) return false
    if (filterCountry !== 'all' && (c.country || '').trim() !== filterCountry) return false
    if (search) {
      const q = search.toLowerCase()
      return (c.artist || '').toLowerCase().includes(q) ||
        (c.venue || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.tour || '').toLowerCase().includes(q) ||
        getFriends(c).some(f => f.toLowerCase().includes(q)) ||
        (c.support || []).some(s => getSupportName(s).toLowerCase().includes(q)) ||
        (c.notes || '').toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => {
    if (sortOrder === 'oldest') return a.date.localeCompare(b.date)
    if (sortOrder === 'alpha') return (a.artist || '').localeCompare(b.artist || '')
    if (sortOrder === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (sortOrder === 'price') return (b.ticketPrice || 0) - (a.ticketPrice || 0)
    return b.date.localeCompare(a.date)
  })

  const wishlist = concerts.filter(c => isWish(c) && matchesType(c))
  const upcoming = filtered.filter(c => !isWish(c) && !isPastDate(c.date))
  const past = filtered.filter(c => !isWish(c) && isPastDate(c.date))
  const allPast = concerts.filter(c => !isWish(c) && isPastDate(c.date))
  const headerCounts = {
    concerts: allPast.filter(c => c.type !== 'festival').length,
    festivals: allPast.filter(c => c.type === 'festival').length,
    upcoming: concerts.filter(c => !isWish(c) && !isPastDate(c.date)).length,
  }
  const openSummaryFromStartup = () => {
    setView('stats')
    setStatsTab('summary')
    setShowStartupScreen(false)
  }
  const isSummaryHeader = view === 'stats' && statsTab === 'summary'
  const shellTitle = isSummaryHeader
    ? 'all the music'
    : view === 'home'
      ? 'Shows'
      : view === 'artists'
        ? 'Artists'
        : view === 'songs'
          ? 'Songs'
          : view === 'venues'
            ? 'Venues'
            : view === 'settings'
              ? 'Settings'
              : statsTab === 'friends'
                ? 'Friends'
                : 'Stats'
  const renderConcertList = (list, showPhoto) => {
    if (!settings.groupByMonth) {
      return list.map(c => (
        <ConcertCard
          key={c.id}
          concert={c}
          onOpen={handleOpenConcert}
          compact={compact}
          showPhoto={showPhoto}
          showVenue={settings.showVenueOnCards !== false}
          showGenreTags={settings.showGenreTagsOnCards !== false}
        />
      ))
    }
    const groups = []
    list.forEach(c => {
      const key = (c.date || '').slice(0, 7)
      const last = groups[groups.length - 1]
      if (!last || last.key !== key) {
        groups.push({
          key,
          label: c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Unknown',
          items: [c],
        })
      } else {
        last.items.push(c)
      }
    })
    return groups.map(group => (
      <div key={group.key}>
        <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 4px 8px' }}>{group.label}</div>
        {group.items.map(c => (
          <ConcertCard
            key={c.id}
            concert={c}
            onOpen={handleOpenConcert}
            compact={compact}
            showPhoto={showPhoto}
            showVenue={settings.showVenueOnCards !== false}
            showGenreTags={settings.showGenreTagsOnCards !== false}
          />
        ))}
      </div>
    ))
  }
  const defaultSortId = settings.defaultSort || 'newest'

  const TabBtn = ({ id, icon, label }) => (
    <button onClick={() => { if (id === 'stats' && view === 'stats' && statsTab === 'charts') { setStatsTab('summary'); } else { setView(id); } }} style={{
      flex: 1, background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '8px 0', color: view === id ? '#a78bfa' : '#5a5880',
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em', fontWeight: view === id ? 700 : 400 }}>{label}</span>
      {view === id && <div style={{ width: 16, height: 2, borderRadius: 1, background: '#a78bfa', marginTop: 1 }} />}
    </button>
  )

  const FilterPill = ({ active, onClick, children, activeColor = '#a78bfa' }) => (
    <button onClick={onClick} style={{
      padding: '5px 13px', borderRadius: 99, fontSize: 12, cursor: 'pointer', flexShrink: 0,
      background: active ? activeColor : '#13131f',
      color: active ? '#0c0c14' : '#6b6a8f',
      border: `1px solid ${active ? activeColor : '#1e3028'}`,
      fontWeight: active ? 700 : 400, fontFamily: "'DM Mono', monospace"
    }}>{children}</button>
  )

  const appShell = { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0c0c14', maxWidth: 480, margin: '0 auto', fontFamily: "'DM Sans', sans-serif", filter: themeFilter || undefined, overflow: 'hidden' }
  useEffect(() => {
    const id = 'theme-img-counter'
    let el = document.getElementById(id)
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el) }
    const inverse = {
      'hue-rotate(-50deg)': 'hue-rotate(50deg)',
      'hue-rotate(-145deg)': 'hue-rotate(145deg)',
      'hue-rotate(90deg)': 'hue-rotate(-90deg)',
      'hue-rotate(130deg)': 'hue-rotate(-130deg)',
      'grayscale(1)': 'grayscale(1) invert(1) grayscale(1) invert(1)',
    }
    const inv = inverse[themeFilter] || ''
    el.textContent = themeFilter && inv ? `[data-theme-shell] img { filter: ${inv} !important; }` : ''
    return () => { const e = document.getElementById(id); if (e) e.textContent = '' }
  }, [themeFilter])

  const visibleStatGroups = CHART_GROUP_IDS.filter(g => !(settings.hiddenChartGroups||[]).includes(g.id))

  const ChartGroupNav = () => view === 'stats' && statsTab === 'charts' ? (
    <div data-chart-group-nav="" style={{ flexShrink: 0, background: '#0c0c14', borderTop: '1px solid #1f1f35', display: 'flex', gap: 4, padding: '6px 12px' }}>
      {visibleStatGroups.map(g => (
        <button key={g.id} onClick={() => setChartGroup(g.id)} style={{
          flex: 1, background: chartGroup === g.id ? '#1a1a30' : 'none',
          border: `1px solid ${chartGroup === g.id ? '#a78bfa' : '#1f1f35'}`,
          borderRadius: 6, padding: '5px 2px', cursor: 'pointer',
          fontFamily: "'DM Mono', monospace", fontSize: 9,
          fontWeight: chartGroup === g.id ? 700 : 400,
          color: chartGroup === g.id ? '#a78bfa' : '#5a5880',
          textAlign: 'center', whiteSpace: 'nowrap'
        }}>{g.label}</button>
      ))}
    </div>
  ) : null

  const isShowsActive = showsGroup.includes(view)

  const ShowsSubNav = () => isShowsActive ? (
    <div style={{ flexShrink: 0, background: '#0c0c14', borderTop: '1px solid #1f1f35', display: 'flex', gap: 4, padding: '6px 12px' }}>
      {[{ id: 'home', label: 'Shows' }, { id: 'artists', label: 'Artists' }, { id: 'songs', label: 'Songs' }, { id: 'venues', label: 'Venues' }].map(t => (
        <button key={t.id} onClick={() => setView(t.id)} style={{
          flex: 1, background: view === t.id ? '#1a1a30' : 'none',
          border: `1px solid ${view === t.id ? '#a78bfa' : '#1f1f35'}`,
          borderRadius: 6, padding: '5px 2px', cursor: 'pointer',
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          fontWeight: view === t.id ? 700 : 400,
          color: view === t.id ? '#a78bfa' : '#5a5880',
          textAlign: 'center'
        }}>{t.label}</button>
      ))}
    </div>
  ) : null

  const navBtn = (id, icon, label, active, onClick) => (
    <button key={id} onClick={onClick} style={{
      flex: 1, background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '8px 0', color: active ? '#a78bfa' : '#5a5880',
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em', fontWeight: active ? 700 : 400 }}>{label}</span>
      {active && <div style={{ width: 16, height: 2, borderRadius: 1, background: '#a78bfa', marginTop: 1 }} />}
    </button>
  )

  const BottomNav = () => (
    <div data-bottom-nav="" style={{ flexShrink: 0, background: '#0c0c14', borderTop: '1px solid #0d1a14', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {navBtn('shows', '♪', 'Shows',   isShowsActive,                             () => setView(showsTab))}
      {navBtn('stats', '◎', 'Stats',    view === 'stats' && statsTab === 'charts', () => { setView('stats'); setStatsTab('charts'); })}
      {navBtn('summary', '▤', 'Summary', view === 'stats' && statsTab === 'summary', () => { setView('stats'); setStatsTab('summary'); })}
      {navBtn('friends', '♥', 'Friends', view === 'stats' && statsTab === 'friends', () => { setView('stats'); setStatsTab('friends'); })}
      {navBtn('settings', '⚙', 'Settings', view === 'settings',                    () => setView('settings'))}
    </div>
  )

  if (showAdd) return (
    <div data-theme-shell="" style={appShell}>
      <div id="content-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <AddConcertForm
          onSave={async c => {
            const result = await onSaveConcert(c);
            notify(result?.error ? 'Could not save show' : 'Show saved', result?.error ? 'error' : 'success');
            if (result?.error) return;
            setShowAdd(null); savedScrollPos.current = 0; setSelected(c);
            if (settings.spotifyAccessToken && getSongList(c.setlist).length > 0) {
              setSpotifyPrompt(c);
            }
          }}
          onClose={() => setShowAdd(null)}
          initialType={showAdd}
          settings={settings}
          onUpdateSetting={onUpdateSetting}
          friends={allFriends}
          concerts={concerts}
          allArtists={[...new Set([
            ...concerts.map(c => c.artist),
            ...concerts.flatMap(c => (c.support || []).map(s => getSupportName(s))),
            ...concerts.flatMap(c => (c.acts || []).map(a => a.name || '').filter(Boolean)),
          ])].filter(Boolean).sort()}
          recentFriends={[...new Set(
            [...concerts]
              .filter(c => isPastDate(c.date) && getFriends(c).length > 0)
              .sort((a, b) => b.date.localeCompare(a.date))
              .flatMap(c => getFriends(c))
          )].slice(0, 3)}
        />
      </div>
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
      <ChartGroupNav />
      <ShowsSubNav />
      <BottomNav />
    </div>
  )

  if (selected) return (
    <div data-theme-shell="" style={appShell}>
      <div id="content-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <ConcertDetail concert={selected} onClose={() => setSelected(null)} onSave={handleSave} settings={settings} onUpdateSetting={onUpdateSetting} onUpdateSettings={onUpdateSettings} friends={allFriends} onDelete={onDeleteConcert} onNotify={notify} photosEnabled={!!userEmail} onNavigate={({ view: v, artist: a }) => { setSelected(null); if (v === 'friends') { setView('stats'); setStatsTab('friends'); } else { setView(v); } }} allArtists={[...new Set([
          ...concerts.map(c => c.artist),
          ...concerts.flatMap(c => (c.support || []).map(s => getSupportName(s))),
          ...concerts.flatMap(c => (c.acts || []).map(a => a.name || '').filter(Boolean)),
        ])].filter(Boolean).sort()} />
      </div>
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
      <ChartGroupNav />
      <ShowsSubNav />
      <BottomNav />
    </div>
  )

  if (showStartupScreen) return (
    <div data-theme-shell="" style={appShell}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', maxWidth: 340, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 118, height: 118, borderRadius: 30, background: '#13131f', border: '1px solid #272544', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 24px 56px rgba(0,0,0,0.48), 0 0 48px rgba(167,139,250,0.2), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
            <img src="/icon-192.png" alt="" style={{ width: 92, height: 92, borderRadius: 23, display: 'block' }} />
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 29, fontWeight: 800, color: '#e2e0ff', lineHeight: 1, marginBottom: 8 }}>concert tracker</div>
          <div style={{ fontSize: 10, color: '#5a5880', fontFamily: "'DM Mono', monospace", marginBottom: 18 }}>
            {headerCounts.concerts} concerts · {headerCounts.festivals} festivals · {headerCounts.upcoming} upcoming
          </div>
          <button onClick={openSummaryFromStartup} style={{ minWidth: 172, minHeight: 44, borderRadius: 11, border: '1px solid #a78bfa', background: '#1a1a30', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '10px 18px', fontFamily: "'DM Mono', monospace", boxShadow: '0 12px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            Open summary
          </button>
        </div>
      </div>
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )

  return (
    <div data-theme-shell="" style={appShell}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '36px 16px 0', background: '#0c0c14', borderBottom: '1px solid #0d1a14' }}>
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: '#e2e0ff', lineHeight: 1 }}>{shellTitle}</div>
          {isSummaryHeader && (
            <div style={{ fontSize: 10, color: '#5a5880', fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
            {allPast.filter(c => c.type !== 'festival').length} concerts · {allPast.filter(c => c.type === 'festival').length} festivals · {concerts.filter(c => !isPastDate(c.date)).length} upcoming
            </div>
          )}
        </div>

        {view === 'home' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#4a4870', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Artist, venue, friend, tour..."
                style={{ width: '100%', background: '#13131f', border: `1px solid ${search ? '#a78bfa' : '#1f1f35'}`,
                  borderRadius: 10, color: '#c4c2f0', padding: '9px 36px 9px 32px',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
              )}
            </div>
            <button onClick={() => setShowAdd('concert')} style={{ minHeight: 38, background: '#1a1a30', border: '1px solid #a78bfa', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#a78bfa', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, flexShrink: 0 }}>+ Show</button>
            <button onClick={() => setShowAdd('festival')} style={{ minHeight: 38, background: '#1a1030', border: '1px solid #f472b6', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#f472b6', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, flexShrink: 0 }}>+ Fest</button>
            <button onClick={() => setShowCalendar(c => !c)} style={{ minHeight: 38, background: showCalendar ? '#1a1a30' : 'none', border: `1px solid ${showCalendar ? '#a78bfa' : '#1f1f35'}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: showCalendar ? '#a78bfa' : '#6b6a8f', fontSize: 14, flexShrink: 0, lineHeight: 1 }} title={showCalendar ? 'Switch to list view' : 'Switch to calendar view'}>
              📅
            </button>
          </div>
        )}

        {view === 'home' && !showCalendar && (
          <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center' }}>
            {/* Type dropdown */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => { setShowYearDropdown(false); document.getElementById('type-dd') && (document.getElementById('type-dd').style.display = document.getElementById('type-dd').style.display === 'block' ? 'none' : 'block') }} style={{ minHeight: 36, padding: '7px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: filterType !== 'all' ? '#a78bfa' : '#13131f', color: filterType !== 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterType !== 'all' ? '#a78bfa' : '#1f1f35'}`, fontWeight: filterType !== 'all' ? 700 : 400, fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
                {filterType === 'all' ? 'All' : filterType === 'concerts' ? 'Shows' : filterType === 'festivals' ? 'Festivals' : 'Online'}
                <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
              </button>
              <div id="type-dd" style={{ display: 'none', position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#13131f', border: '1px solid #2e2e50', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 110 }}>
                {[{id:'all',label:'All'},{id:'concerts',label:'Shows'},{id:'festivals',label:'Festivals'},{id:'online',label:'Online'}].map((t,i) => (
                  <button key={t.id} onClick={() => { setFilterType(t.id); document.getElementById('type-dd').style.display='none' }} style={{ width: '100%', background: filterType === t.id ? '#1a1a30' : 'none', border: 'none', borderBottom: i < 3 ? '1px solid #0c0c14' : 'none', padding: '9px 14px', cursor: 'pointer', textAlign: 'left', color: filterType === t.id ? '#a78bfa' : '#c4c2f0', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{t.label}</button>
                ))}
              </div>
            </div>
            {/* Year dropdown (multi-select) */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowYearDropdown(d => !d)} style={{ minHeight: 36, padding: '7px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: filterYears.length > 0 ? '#a78bfa' : '#13131f', color: filterYears.length > 0 ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterYears.length > 0 ? '#a78bfa' : '#1f1f35'}`, fontWeight: filterYears.length > 0 ? 700 : 400, fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
                {filterYears.length === 0 ? 'Year' : filterYears.length === 1 ? filterYears[0] : `${filterYears.length} years`}
                <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
              </button>
              {showYearDropdown && (() => {
                const _curYr = String(new Date().getFullYear());
                const _recentYrs = [_curYr, String(_curYr-1), String(_curYr-2)].filter(y => years.includes(y));
                const _olderYrs = years.filter(y => !_recentYrs.includes(y));
                const _opts = [..._recentYrs, ..._olderYrs];
                const toggleYear = y => setFilterYears(f => f.includes(y) ? f.filter(x => x !== y) : [...f, y]);
                return (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#13131f', border: '1px solid #2e2e50', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 110 }}>
                    <button onClick={() => { setFilterYears([]); setShowYearDropdown(false); }} style={{ width: '100%', background: filterYears.length===0?'#1a1a30':'none', border:'none', borderBottom: '1px solid #0c0c14', padding: '9px 14px', cursor:'pointer', textAlign:'left', color: filterYears.length===0?'#a78bfa':'#c4c2f0', fontFamily:"'DM Mono', monospace", fontSize:12 }}>
                      All years
                    </button>
                    {_opts.map((y, i) => (
                      <button key={y} onClick={() => toggleYear(y)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: filterYears.includes(y)?'#1a1a30':'none', border:'none', borderBottom: i < _opts.length-1 ? '1px solid #0c0c14' : 'none', padding: _olderYrs.includes(y)?'7px 14px':'9px 14px', paddingLeft: _olderYrs.includes(y)?'22px':'14px', cursor:'pointer', textAlign:'left', color: filterYears.includes(y)?'#a78bfa':_olderYrs.includes(y)?'#4a4870':'#c4c2f0', fontFamily:"'DM Mono', monospace", fontSize:12 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, border: `1px solid ${filterYears.includes(y) ? '#a78bfa' : '#3a3858'}`, background: filterYears.includes(y) ? '#a78bfa' : 'none', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#0c0c14' }}>{filterYears.includes(y) ? '✓' : ''}</span>
                        {y}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            {/* Sort button */}
            <button onClick={() => { setShowSort(s => !s); setShowFilters(false) }} style={{ minHeight: 36, background: showSort || sortOrder !== defaultSortId ? '#1a1a30' : 'none', border: `1px solid ${showSort || sortOrder !== defaultSortId ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '7px 12px', cursor: 'pointer', color: sortOrder !== defaultSortId ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: sortOrder !== defaultSortId ? 700 : 400, flexShrink: 0 }}>
              Sort{sortOrder !== defaultSortId ? ` ↕` : ''}
            </button>
            {/* Filters button */}
            <button onClick={() => { setShowFilters(f => !f); setShowSort(false) }} style={{ minHeight: 36, background: showFilters || activeFilterCount > 0 ? '#1a1a30' : 'none', border: `1px solid ${showFilters || activeFilterCount > 0 ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '7px 12px', cursor: 'pointer', color: activeFilterCount > 0 ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: activeFilterCount > 0 ? 700 : 400, flexShrink: 0 }}>
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            </button>
            {/* Compact / figures toggle */}
            <button onClick={() => setCompact(c => !c)} style={{ marginLeft: 'auto', background: compact ? '#1a1a30' : 'none', border: `1px solid ${compact ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 10px', cursor: 'pointer', color: compact ? '#a78bfa' : '#6b6a8f', fontSize: 13, flexShrink: 0, lineHeight: 1 }} title={compact ? 'Switch to expanded view' : 'Switch to compact view'}>
              {compact ? '▤' : '☰'}
            </button>
          </div>
        )}

        {view === 'home' && showSort && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            {sortOrder !== defaultSortId && <button onClick={resetSort} style={{ marginBottom: 10, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[{id:'newest',label:'Newest'},{id:'oldest',label:'Oldest'},{id:'alpha',label:'A→Z'},{id:'price',label:'Price ↓'},{id:'rating',label:'Rating ↓'}].map(s => (
                <button key={s.id} onClick={() => setSortOrder(s.id)} style={{ padding: '5px 11px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortOrder === s.id ? '#a78bfa' : '#0c0c14', color: sortOrder === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortOrder === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
              ))}
            </div>
          </div>
        )}

        {view === 'home' && showFilters && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10, maxHeight: '55vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            <button onClick={() => { resetFilters(); setOpenFilterSection(null); }} style={{ marginBottom: 10, background: 'none', border: 'none', color: activeFilterCount > 0 ? '#a78bfa' : '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>

            <FilterGroup id="type" label="Type" activeLabel={filterType !== 'all' ? {concerts:'Concerts',festivals:'Festivals',online:'Online'}[filterType] : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
              {[['all','All'],['concerts','Concerts'],['festivals','Festivals'],['online','Online']].map(([id, label]) => (
                <button key={id} onClick={() => setFilterType(id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterType === id ? '#a78bfa' : '#0c0c14', color: filterType === id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterType === id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{label}</button>
              ))}
            </FilterGroup>

            <FilterGroup id="friend" label="Friend" activeLabel={filterFriend !== 'all' ? filterFriend : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
              <button onClick={() => setFilterFriend('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterFriend === 'all' ? '#f472b6' : '#0c0c14', color: filterFriend === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterFriend === 'all' ? '#f472b6' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
              {activeFriends.map(f => (
                <button key={f} onClick={() => setFilterFriend(filterFriend === f ? 'all' : f)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterFriend === f ? '#f472b6' : '#0c0c14', color: filterFriend === f ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterFriend === f ? '#f472b6' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{f}</button>
              ))}
            </FilterGroup>

            <FilterGroup id="venue" label="Venue" activeLabel={filterVenue !== 'all' ? filterVenue : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
              <button onClick={() => setFilterVenue('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterVenue === 'all' ? '#38bdf8' : '#0c0c14', color: filterVenue === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterVenue === 'all' ? '#38bdf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
              {allVenues.map(v => (
                <button key={v} onClick={() => setFilterVenue(filterVenue === v ? 'all' : v)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterVenue === v ? '#38bdf8' : '#0c0c14', color: filterVenue === v ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterVenue === v ? '#38bdf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{v}</button>
              ))}
            </FilterGroup>

            <FilterGroup id="rating" label="Rating" activeLabel={filterRating !== 0 ? `${filterRating}★` : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
              <button onClick={() => setFilterRating(0)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterRating === 0 ? '#a78bfa' : '#0c0c14', color: filterRating === 0 ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterRating === 0 ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Any</button>
              {Array.from({ length: settings.ratingSystem || 5 }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setFilterRating(filterRating === n ? 0 : n)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterRating === n ? '#a78bfa' : '#0c0c14', color: filterRating === n ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterRating === n ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{n}★</button>
              ))}
            </FilterGroup>

            <FilterGroup id="photos" label="Photos" activeLabel={filterHasPhoto ? 'Only with photo' : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
              <button onClick={() => onUpdateSetting('showListPhotos', settings.showListPhotos === false)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: settings.showListPhotos !== false ? '#a78bfa' : '#0c0c14', color: settings.showListPhotos !== false ? '#0c0c14' : '#6b6a8f', border: `1px solid ${settings.showListPhotos !== false ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>📷 Show in list</button>
              <button onClick={() => setFilterHasPhoto(f => !f)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterHasPhoto ? '#a78bfa' : '#0c0c14', color: filterHasPhoto ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterHasPhoto ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Only with photo</button>
            </FilterGroup>

            <FilterGroup id="solo" label="Solo only" activeLabel={filterSolo ? 'Solo' : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
              <button onClick={() => setFilterSolo(s => !s)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterSolo ? '#a78bfa' : '#0c0c14', color: filterSolo ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterSolo ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Solo</button>
            </FilterGroup>

            {(settings.genres||[]).length > 0 && (
              <FilterGroup id="genre" label="Genre" activeLabel={filterGenre !== 'all' ? filterGenre : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
                {(() => {
                  const _g = settings.genres||[]; const _top = _g.slice(0,3); const _rest = _g.slice(3);
                  return (<>
                    <button onClick={() => setFilterGenre('all')} style={{ padding:'4px 10px', borderRadius:99, fontSize:11, cursor:'pointer', background:filterGenre==='all'?'#a78bfa':'#0c0c14', color:filterGenre==='all'?'#0c0c14':'#6b6a8f', border:`1px solid ${filterGenre==='all'?'#a78bfa':'#1f1f35'}`, fontFamily:"'DM Mono', monospace" }}>All</button>
                    {_top.map(g => <button key={g} onClick={() => setFilterGenre(filterGenre===g?'all':g)} style={{ padding:'4px 10px', borderRadius:99, fontSize:11, cursor:'pointer', background:filterGenre===g?'#a78bfa':'#0c0c14', color:filterGenre===g?'#0c0c14':'#6b6a8f', border:`1px solid ${filterGenre===g?'#a78bfa':'#1f1f35'}`, fontFamily:"'DM Mono', monospace" }}>{g}</button>)}
                    {_rest.length > 0 && <select value={_rest.includes(filterGenre)?filterGenre:''} onChange={e => e.target.value && setFilterGenre(e.target.value)} style={{ background:_rest.includes(filterGenre)?'#a78bfa':'#0c0c14', border:`1px solid ${_rest.includes(filterGenre)?'#a78bfa':'#1f1f35'}`, borderRadius:99, color:_rest.includes(filterGenre)?'#0c0c14':'#6b6a8f', fontFamily:"'DM Mono', monospace", fontSize:11, padding:'4px 8px', cursor:'pointer', WebkitAppearance:'none', appearance:'none' }}><option value=''>more ▾</option>{_rest.map(g => <option key={g} value={g}>{g}</option>)}</select>}
                  </>);
                })()}
              </FilterGroup>
            )}

            {(settings.subgenres||[]).length > 0 && (
              <FilterGroup id="subgenre" label="Subgenre" activeLabel={filterSubgenre !== 'all' ? filterSubgenre : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
                <button onClick={() => setFilterSubgenre('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterSubgenre === 'all' ? '#38bdf8' : '#0c0c14', color: filterSubgenre === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterSubgenre === 'all' ? '#38bdf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
                {(settings.subgenres||[]).map(g => (
                  <button key={g} onClick={() => setFilterSubgenre(filterSubgenre === g ? 'all' : g)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterSubgenre === g ? '#38bdf8' : '#0c0c14', color: filterSubgenre === g ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterSubgenre === g ? '#38bdf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{g}</button>
                ))}
              </FilterGroup>
            )}

            {allCountries.length > 1 && (
              <FilterGroup id="country" label="Country" activeLabel={filterCountry !== 'all' ? filterCountry : null} openId={openFilterSection} onToggle={setOpenFilterSection}>
                <button onClick={() => setFilterCountry('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterCountry === 'all' ? '#a78bfa' : '#0c0c14', color: filterCountry === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterCountry === 'all' ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
                {allCountries.map(c => (
                  <button key={c} onClick={() => setFilterCountry(filterCountry === c ? 'all' : c)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterCountry === c ? '#a78bfa' : '#0c0c14', color: filterCountry === c ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterCountry === c ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{c}</button>
                ))}
              </FilterGroup>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div id="content-scroll" style={{ flex: 1, overflowY: view === 'stats' && (statsTab === 'charts' || statsTab === 'summary') ? 'hidden' : 'auto', overflowX: 'hidden', padding: view === 'stats' && (statsTab === 'charts' || statsTab === 'summary') ? '0' : '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {view === 'home' && (
          <>
            {concerts.length === 0 && (
              <EmptyState title="No shows yet" detail="Start with a quick concert entry, then fill in setlists, merch, and notes when you feel like it." actionLabel="Add show" onAction={() => setShowAdd('concert')} />
            )}
            {concerts.length > 0 && showCalendar && (
              <CalendarMode
                concerts={concerts}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onOpen={handleOpenConcert}
              />
            )}
            {concerts.length > 0 && !showCalendar && filtered.length === 0 && (
              <EmptyState title="No matches" detail="Nothing fits the current search and filters." actionLabel="Clear filters" onAction={() => { setSearch(''); setFilterYears([]); setFilterType('all'); resetFilters(); resetSort(); }} />
            )}
            {!showCalendar && filtered.length > 0 && <>
            {wishlist.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setShowWishlist(w => !w)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: showWishlist ? '4px 4px 10px' : '4px 4px 6px', marginBottom: showWishlist ? 4 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#34d399', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Want to go</span>
                    <span style={{ fontSize: 10, color: '#2e4a3a', fontFamily: "'DM Mono', monospace", background: '#0a1a12', border: '1px solid #2a4a3a', borderRadius: 99, padding: '1px 7px' }}>{wishlist.length}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#34d399', transform: showWishlist ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                </button>
                {showWishlist && renderConcertList(wishlist, false)}
                <div style={{ height: 1, background: '#0e0e1a', margin: showWishlist ? '4px 0 16px' : '0 0 12px' }} />
              </div>
            )}
            {upcoming.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setShowUpcoming(u => !u)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: showUpcoming ? '4px 4px 10px' : '4px 4px 6px', marginBottom: showUpcoming ? 4 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#818cf8', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Upcoming</span>
                    <span style={{ fontSize: 10, color: '#4a4a8f', fontFamily: "'DM Mono', monospace", background: '#12122a', border: '1px solid #2e2e5a', borderRadius: 99, padding: '1px 7px' }}>{upcoming.length}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#818cf8', transform: showUpcoming ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                </button>
                {(showUpcoming || !!search) && renderConcertList(upcoming, settings.showListPhotos !== false)}
                <div style={{ height: 1, background: '#0e0e1a', margin: showUpcoming ? '12px 0 16px' : '0 0 12px' }} />
              </div>
            )}
            <div style={{ marginTop: upcoming.length > 0 ? 0 : 10 }}>
              <button onClick={() => setShowPast(p => !p)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: showPast ? '4px 4px 10px' : '4px 4px 6px', marginBottom: showPast ? 4 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: '#a78bfa', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Past</span>
                  <span style={{ fontSize: 10, color: '#4a3d70', fontFamily: "'DM Mono', monospace", background: '#181229', border: '1px solid #2e2350', borderRadius: 99, padding: '1px 7px' }}>{past.length}</span>
                </div>
                <span style={{ fontSize: 11, color: '#a78bfa', transform: showPast ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
              </button>
              {(showPast || !!search) && renderConcertList(past, settings.showListPhotos !== false)}
            </div>
            </>}
          </>
        )}
        {view === 'stats' && <StatsView concerts={concerts} settings={settings} onNavigate={({ view: v, filterType: ft }) => { setView(v); if (ft !== undefined) setFilterType(ft); }} onUpdateSetting={updateSetting} statsTab={statsTab} setStatsTab={setStatsTab} chartGroup={chartGroup} setChartGroup={setChartGroup} onOpen={handleOpenConcert} hideTabs fillHeight={statsTab === 'charts' || statsTab === 'summary'} />}
        {view === 'songs' && <SongsView concerts={concerts} onOpen={handleOpenConcert} settings={settings} saveSettings={onUpdateSettings} onLinkSong={handleLinkSongSpotify} />}
        {view === 'artists' && <ArtistsView concerts={concerts} onOpen={handleOpenConcert} onNavigate={({ view: v }) => { if (v === 'friends') { setView('stats'); setStatsTab('friends'); } else setView(v); }} />}
        {view === 'venues' && <VenuesView concerts={concerts} onOpen={handleOpenConcert} settings={settings} onUpdateSetting={updateSetting} onNavigate={({ view: v }) => { if (v === 'friends') { setView('stats'); setStatsTab('friends'); } else setView(v); }} />}
        {view === 'settings' && <SettingsView settings={settings} onUpdate={updateSetting} onUpdateAll={onUpdateSettings ? updateSettings : null} concerts={concerts} onSaveConcert={onSaveConcert} onSignOut={onSignOut} userEmail={userEmail} onNotify={notify} />}
      </div>

      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
      <ChartGroupNav />
      <ShowsSubNav />
      <BottomNav />

      {/* Spotify link prompt after adding a concert with songs */}
      {spotifyPrompt && !spotifyMatcherConcert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 900 }}>
          <div style={{ background: '#13131f', border: '1px solid #2a2850', borderRadius: '16px 16px 0 0', padding: '24px 18px 36px', width: '100%', maxWidth: 480 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#e2e0ff', marginBottom: 6 }}>
              Link songs to Spotify?
            </div>
            <div style={{ fontSize: 12, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginBottom: 22 }}>
              {spotifyPrompt.artist} · {getSongList(spotifyPrompt.setlist).length} song{getSongList(spotifyPrompt.setlist).length !== 1 ? 's' : ''} added. Want to link them to Spotify now?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSpotifyMatcherConcert(spotifyPrompt)}
                style={{ flex: 1, padding: 12, borderRadius: 9, background: '#1DB954', border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Link now
              </button>
              <button onClick={() => setSpotifyPrompt(null)}
                style={{ padding: '12px 18px', borderRadius: 9, background: 'none', border: '1px solid #2a2850', color: '#6b6a8f', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SpotifyMatcher opened from the add-concert prompt */}
      {spotifyMatcherConcert && (
        <SpotifyMatcher
          artist={spotifyMatcherConcert.artist}
          songs={getSongList(spotifyMatcherConcert.setlist)}
          settings={settings}
          saveSettings={onUpdateSettings || (() => {})}
          onSave={async updatedSongs => {
            const updated = { ...spotifyMatcherConcert, setlist: updatedSongs }
            await onSaveConcert(updated)
            setSelected(prev => prev?.id === updated.id ? updated : prev)
            setSpotifyMatcherConcert(null)
            setSpotifyPrompt(null)
          }}
          onClose={() => { setSpotifyMatcherConcert(null); setSpotifyPrompt(null) }}
        />
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { uploadConcertPhoto, deleteConcertPhoto, getPhotoUrl } from '../lib/photos'
import { startSpotifyAuth, getValidSpotifyToken } from '../lib/spotify'
import { requestPermission as requestNotifyPermission, canNotify, reScheduleAll } from '../lib/notifications'
import { geocodeVenue } from '../lib/geocode'
import SpotifyMatcher from './SpotifyMatcher'
import VenueMap from './VenueMap'

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
      <div style={{ fontSize: 9, color: '#4a4870', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Detail view</div>
      <div ref={boxRef}
        onTouchStart={e => { const t = e.touches[0]; start(t.clientX, t.clientY) }}
        onTouchMove={e => { const t = e.touches[0]; move(t.clientX, t.clientY) }}
        onTouchEnd={() => { drag.current = null }}
        onMouseDown={e => start(e.clientX, e.clientY)}
        onMouseMove={e => { if (e.buttons === 1) move(e.clientX, e.clientY) }}
        onMouseUp={() => { drag.current = null }}
        onMouseLeave={() => { drag.current = null }}
        style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', touchAction: 'none', cursor: 'grab', background: '#13131f', position: 'relative', border: '1px solid #2e2e50' }}>
        {url && <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${p.x ?? 50}% ${p.y ?? 50}%`, display: 'block', pointerEvents: 'none' }} />}
        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: '#e2e0ff', background: '#0c0c14aa', padding: '3px 8px', borderRadius: 99, fontFamily: "'DM Mono', monospace", pointerEvents: 'none' }}>↕↔ drag to reframe</div>
      </div>
      <button onClick={() => onChange({ x: 50, y: 50 })} style={{ marginTop: 6, background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#6b6a8f', fontSize: 11, padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>center</button>
      <div style={{ fontSize: 9, color: '#4a4870', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 6px' }}>How it looks in your shows list</div>
      <div style={{ width: '100%', aspectRatio: '5 / 2', borderRadius: 8, overflow: 'hidden', background: '#13131f', border: '1px solid #2e2e50' }}>
        {url && <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${p.x ?? 50}% ${p.y ?? 50}%`, display: 'block' }} />}
      </div>
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
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const isPast = (dateStr) => dateStr < todayStr;
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
// Deterministic colored-initials avatar for friends — same name always gets the same hue.
const FRIEND_HUES = [265, 210, 340, 25, 165, 45, 190, 300];
const friendColor = name => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FRIEND_HUES[hash % FRIEND_HUES.length];
};
const friendInitials = name => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
// Picks a transit emoji based on the words actually used, so "tram 5" and
// "Amsterdam Centraal" don't both get the same generic subway icon.
const transitEmoji = text => {
  const t = (text || '').toLowerCase();
  if (/\bbus\b/.test(t)) return '🚌';
  if (/\btram\b/.test(t)) return '🚊';
  if (/\b(metro|subway|underground)\b/.test(t)) return '🚇';
  if (/\b(train|station|centraal|central|gare|bahnhof|trein)\b/.test(t)) return '🚆';
  return '🚏';
};
// Detail-page header subtitle: each entry in `lines` is its own row; an entry
// that is itself an array gets its parts joined with " · " on that one row.
// Used on Venue/Artist/Song/Friend detail headers for consistency.
function DetailSubtitle({ lines }) {
  const shown = lines.map(l => Array.isArray(l) ? l.filter(Boolean) : (l ? [l] : [])).filter(l => l.length > 0);
  if (shown.length === 0) return null;
  return (
    <div style={{ marginTop: 3 }}>
      {shown.map((parts, i) => (
        <div key={i} style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", lineHeight: 1.5 }}>
          {parts.map((p, j) => <span key={j}>{j > 0 && ' · '}{p}</span>)}
        </div>
      ))}
    </div>
  );
}

function FriendAvatar({ name, size = 36 }) {
  const hue = friendColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue}, 55%, 22%)`, border: `1px solid hsl(${hue}, 55%, 40%)`,
      color: `hsl(${hue}, 70%, 78%)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: size * 0.36,
    }}>{friendInitials(name)}</div>
  );
}
// Extra costs beyond ticket price: travel, stay (accommodation), food, other misc.
// Falls back to the legacy single `otherCost` number for shows saved before this breakdown existed.
// Sum of a concert's ticket line-items (name + price each, so add-ons/fan-club
// fees/etc. can be itemized) — falls back to the legacy single ticketPrice
// number for older entries that predate this.
const ticketTotal = c => {
  if (c && Array.isArray(c.tickets) && c.tickets.length > 0) {
    return c.tickets.reduce((s, t) => s + (parseFloat(t.price) || 0), 0);
  }
  return (c && c.ticketPrice) || 0;
};
// Kept as a no-op so old call sites that still add `+ extraCostTotal(c)` don't
// break — the travel/stay/food/other cost breakdown itself has been removed.
const extraCostTotal = () => 0;

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

function Badge({ children, color = "#1a2e26", textColor = "#a78bfa" }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 99,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      background: color, color: textColor, border: "1px solid #2a3d35"
    }}>{children}</span>
  );
}

// Itemized tickets: each line has a name (e.g. "Ticket", "Fan club add-on",
// "Booking fee") and a price; the sum is the concert's ticket cost. Lets you
// split out add-ons while still counting as one total for stats/graphs.
function TicketsFields({ value, onChange, labelStyle, inputStyle }) {
  const tickets = value || [];
  const update = (i, key, v) => onChange(tickets.map((t, j) => j === i ? { ...t, [key]: v } : t));
  const remove = i => onChange(tickets.filter((_, j) => j !== i));
  const add = () => onChange([...tickets, { name: tickets.length === 0 ? 'Ticket' : '', price: '' }]);
  const subtotal = tickets.reduce((s, t) => s + (parseFloat(t.price) || 0), 0);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={labelStyle}>Tickets</div>
        <button onClick={add} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>+ Add item</button>
      </div>
      {tickets.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <input value={t.name || ''} placeholder="e.g. Ticket, Fee, Add-on" onChange={e => update(i, 'name', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <span style={{ color: '#6b6a8f' }}>€</span>
          <input type="number" value={t.price || ''} placeholder="0.00" onChange={e => update(i, 'price', e.target.value)} style={{ ...inputStyle, width: 80 }} />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#4a4870', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      ))}
      {subtotal > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
          <span>Ticket total</span>
          <span style={{ color: '#a78bfa' }}>€{subtotal.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// Small confirmation popup: "Add 'X' to your saved [tags]?" — used when someone types
// a brand-new custom value (merch category, genre, etc.) directly on a show, so they
// can optionally promote it to a permanent, reusable option without going to Settings.
function Donut({ segments, size = 120, label = "total", showLabels = false, labelTexts = null, centerText = undefined, labelPad = 0.18 }) {
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


function ChartToggle({ options, value, onChange, color = "#a78bfa" }) {
    return (
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
  }

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
  const [noteOpenFor, setNoteOpenFor] = useState(null);
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
              <div key={act.name} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                {!readOnly && (
                  <button onClick={() => setNoteOpenFor(noteOpenFor === act.name ? null : act.name)} title="Add a note" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: act.note ? '#a78bfa' : '#2e2e4a', padding: 0, lineHeight: 1 }}>📝</button>
                )}
                {!readOnly && <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>}
              </div>
              {!readOnly && noteOpenFor === act.name && (
                <textarea value={act.note || ''} onChange={e => update(i, { note: e.target.value })}
                  placeholder={`Note about ${act.name}…`} rows={2}
                  style={{ ...inputStyle, width: '100%', resize: 'vertical', marginTop: 4, boxSizing: 'border-box' }} />
              )}
              {readOnly && act.note && (
                <div style={{ fontSize: 11, color: '#8b89ab', fontStyle: 'italic', marginTop: 3, paddingLeft: 4, borderLeft: '2px solid #2e2e50' }}>{act.note}</div>
              )}
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
        width: "100%", textAlign: "left", background: past ? "#17172a" : concert.wishlist ? "#0d1f16" : "#0f1638",
        border: `1px solid ${past ? "#1f1f35" : concert.wishlist ? "#1e3a2a" : "#33397a"}`,
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
          <span style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            {(concert.tags || []).includes('Cried') && <span title="Cried here" style={{ fontSize: 10 }}>💧</span>}
            <span style={{ color: concert.favorite ? "#facc15" : "#a78bfa", fontSize: 11 }}>{"★".repeat(Math.min(concert.rating, 10))}</span>
          </span>
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
        width: "100%", textAlign: "left", background: past ? "#17172a" : concert.wishlist ? "#0d1f16" : "#0f1638",
        border: `1px solid ${past ? "#1f1f35" : concert.wishlist ? "#1e3a2a" : "#33397a"}`,
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
          <div style={{ display: showVenue ? "block" : "none", fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
            {online ? (
              <>
                <div>{formatDate(concert.date)}</div>
                <div>{formatOnlineLocation(concert)}</div>
              </>
            ) : (
              <>
                <div>{formatDate(concert.date)}{concert.endDate && concert.endDate !== concert.date ? ` – ${formatDate(concert.endDate)}` : ''}</div>
                <div>{concert.venue}{concert.room ? ` · ${concert.room}` : ""}</div>
                {concert.city && <div>{concert.city}</div>}
              </>
            )}
          </div>
          {!showVenue && (
            <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
              <div>{formatDate(concert.date)}</div>
              {concert.city && <div>{concert.city}</div>}
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
              {(concert.tags || []).includes('Cried') && <span title="Cried here" style={{ fontSize: 11 }}>💧</span>}
              <span style={{ color: concert.favorite ? "#facc15" : "#a78bfa", fontSize: 13 }}>
                {"★".repeat(Math.min(concert.rating, 10))}
              </span>
            </div>
          )}
          {!past && (
            <div style={{ fontSize: 10, color: "#818cf8", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
              upcoming
            </div>
          )}
          {(getSongList(concert.setlist).length > 0 || Object.values(concert.supportSetlists || {}).some(s => getSongList(s).length > 0)) && (
            <div style={{ fontSize: 17, color: "#6b6a8f", marginTop: 4 }}>♪</div>
          )}
        </div>
      </div>
      {showGenreTags && (concert.favorite || (concert.tags || []).length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {concert.favorite && <Badge color="#2a2410" textColor="#facc15">★ all-time fave</Badge>}
          {(concert.tags || []).map(t => <Badge key={t} color="#1a1030">{t}</Badge>)}
        </div>
      )}
      {showGenreTags && (getGenres(concert).length > 0 || concert.subgenre) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
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
                      {concert.criedSong === name && <span title="Cried during this song" style={{ fontSize: 11, lineHeight: 1 }}>💧</span>}
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

function ConcertDetail({ concert, concerts = [], onClose, onSave, settings = {}, onUpdateSetting = null, onUpdateSettings = null, friends = [], onDelete, onNotify = () => {}, allArtists = [], photosEnabled = false, onNavigate = () => {} }) {
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
    const songCount = getSongList(concert.setlist).length;
    const genres = getGenres(concert);
    const lines = [
      `🎤 ${concert.artist}${concert.tour ? ` — ${concert.tour}` : ''}`,
      concert.type === 'festival' ? '🎪 Festival' : null,
      `📅 ${formatDate(concert.date)}`,
      isOnline(concert)
        ? `💻 ${formatOnlineLocation(concert)}`
        : `📍 ${concert.venue}${concert.room ? ` · ${concert.room}` : ''}, ${concert.city}${concert.country ? `, ${concert.country}` : ''}`,
      genres.length > 0 ? `🎵 ${genres.join(', ')}` : null,
      getFriends(concert).length > 0 ? `👥 w. ${getFriends(concert).join(', ')}` : '👤 solo',
      concert.rating ? `${'★'.repeat(concert.rating)}${'☆'.repeat((settings.ratingSystem || 5) - concert.rating)}` : null,
      songCount > 0 ? `${songCount} song${songCount !== 1 ? 's' : ''} heard live` : null,
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
    const totalCost = ticketTotal(concert) + merchTotal;
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
      ticketTotal(concert) > 0 ? { label: concert.ticketType ? `Ticket · ${concert.ticketType}` : "Ticket", value: `€${ticketTotal(concert).toFixed(2)}`, nav: null } : null,
      past && companions.length > 0 && { label: "With", value: companions.length === 1 ? companions[0] : `${companions.length} friends`, nav: 'friends' },
      past && companions.length === 0 && { label: "With", value: "Solo", nav: null },
    ].filter(Boolean);
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0c0c14", overflowY: "auto", zIndex: 100 }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, background: "#0c0c14", borderBottom: "1px solid #1e3028", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, zIndex: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <button onClick={() => onNavigate({ view: 'artists', artist: concert.artist })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: "#e2e0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", maxWidth: "100%" }}>{concert.artist} ›</button>
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
                {concert.tour && <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, color: "#e2e0ff", fontWeight: 800 }}>{concert.tour}</div>}
                <div style={{ fontSize: concert.tour ? 14 : 16, color: "#c4c2f0", fontWeight: 600, marginTop: concert.tour ? 4 : 0 }}>{onlineTypeLabel(concert)}</div>
                {concert.platform && <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{concert.platform}</div>}
              </>
            ) : (
              <>
                {concert.tour && <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, color: "#e2e0ff", fontWeight: 800, marginBottom: 4 }}>{concert.tour}</div>}
                <button onClick={() => onNavigate({ view: 'venues', venue: concert.venue })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: concert.tour ? 14 : 16, color: "#c4c2f0", fontWeight: 600, textAlign: "left" }}>{concert.venue}{concert.room ? ` · ${concert.room}` : ""} ›</button>
                <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{concert.city}, {concert.country}</div>
              </>
            )}
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
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: label === "Rating" ? 13 : 15, fontWeight: 800, color: label === "Rating" && concert.favorite ? "#facc15" : "#a78bfa", lineHeight: 1 }}>{value}{nav ? <span style={{ fontSize: 10, color: "#6b6a8f", marginLeft: 2 }}>›</span> : null}</div>
                  <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
          {/* Tag pills — favorite & moments first, category tags below */}
          {(concert.favorite || (concert.tags || []).length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {concert.favorite && <Badge color="#2a2410" textColor="#facc15">★ all-time fave</Badge>}
              {(concert.tags || []).map(t => <Badge key={t} color="#1a1030">{t}</Badge>)}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {isFestival && <Badge color="#1a1030">🎪 Festival</Badge>}
            {concert.wishlist ? <Badge color="#0a1a12">want to go</Badge> : !past && <Badge color="#0d1a15">upcoming</Badge>}
            {concert.seenAs && <Badge color="#1a1a30">{concert.seenAs}</Badge>}
            {(concert.ticketAddons || []).map(a => <Badge key={a} color="#1a1030">{a}</Badge>)}
            {concert.venueSize && <Badge color="#13131f">{concert.venueSize}</Badge>}
            {getGenres(concert).map(g => <Badge key={g} color="#13131f">{g}</Badge>)}
            {concert.subgenre && <Badge color="#13131f">{concert.subgenre}</Badge>}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #1a1a2e" }} />

        <div style={{ padding: "16px 20px 100px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Costs */}
          {((concert.tickets || []).length > 0 || concert.ticketPrice || merchTotal > 0) && (
            <div style={detailCard}>
              {sec("Costs")}
              {(() => {
                const ticketItems = (concert.tickets && concert.tickets.length > 0)
                  ? concert.tickets.filter(t => t.price).map(t => [t.name || "Ticket", parseFloat(t.price) || 0])
                  : concert.ticketPrice ? [[concert.ticketType ? `Ticket (${concert.ticketType})` : "Ticket", concert.ticketPrice]] : [];
                const merchItems = (concert.merch || []).filter(m => m.price).map(m => [m.item || "Item", parseFloat(m.price) || 0]);
                const addons = concert.ticketAddons || [];
                const Group = (heading, items, bold = false, extras = []) => {
                  if (items.length === 0 && extras.length === 0) return null;
                  if (items.length <= 1 && extras.length === 0) return (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1a2e" }}>
                      <span style={{ color: bold ? "#c4c2f0" : "#6b6a8f", fontSize: 12, fontWeight: bold ? 700 : 400 }}>{items[0]?.[0] || heading}</span>
                      {items[0] && <span style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: bold ? 700 : 400 }}>€{items[0][1].toFixed(2)}</span>}
                    </div>
                  );
                  const subtotal = items.reduce((s, [, v]) => s + v, 0);
                  return (
                    <div style={{ padding: "5px 0", borderBottom: "1px solid #1a1a2e" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#c4c2f0", fontSize: 12, fontWeight: bold ? 700 : 600 }}>{heading}</span>
                        {items.length > 0 && <span style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: bold ? 700 : 400 }}>€{subtotal.toFixed(2)}</span>}
                      </div>
                      {items.map(([label, amount], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", paddingLeft: 14, marginTop: 4 }}>
                          <span style={{ color: "#6b6a8f", fontSize: 11 }}>· {label}</span>
                          <span style={{ color: "#8b89ab", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>€{amount.toFixed(2)}</span>
                        </div>
                      ))}
                      {extras.map((label, i) => (
                        <div key={`x${i}`} style={{ paddingLeft: 14, marginTop: 4 }}>
                          <span style={{ color: "#f472b6", fontSize: 11 }}>· includes {label}</span>
                        </div>
                      ))}
                    </div>
                  );
                };
                return (
                  <>
                    {Group("Tickets", ticketItems, true, addons)}
                    {Group("Merch", merchItems)}
                  </>
                );
              })()}
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

          {/* Acts — festivals */}
          {isFestival && (concert.acts || []).length > 0 && (
            <div style={detailCard}>
              {sec("Acts seen")}
              {(() => {
                const acts = concert.acts || [];
                const hearted = acts.filter(a => a.highlight).length;
                const ratedActs = acts.filter(a => a.rating);
                const avgActRating = ratedActs.length ? (ratedActs.reduce((s, a) => s + a.rating, 0) / ratedActs.length).toFixed(1) : null;
                const numDays = festivalDays(concert.date, concert.endDate);
                const dayRatings = numDays > 1 ? Array.from({ length: numDays }, (_, i) => {
                  const dayActs = acts.filter(a => a.day === i + 1 && a.rating);
                  return dayActs.length ? dayActs.reduce((s, a) => s + a.rating, 0) / dayActs.length : 0;
                }) : [];
                const maxDayRating = Math.max(...dayRatings, 1);
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${avgActRating ? 3 : 2}, 1fr)`, gap: 6, marginBottom: 14 }}>
                      <div style={{ background: "#0c0c14", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}><div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{acts.length}</div><div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>acts seen</div></div>
                      {hearted > 0 && <div style={{ background: "#0c0c14", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}><div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#f472b6" }}>{hearted}</div><div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>hearted</div></div>}
                      {avgActRating && <div style={{ background: "#0c0c14", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}><div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>★{avgActRating}</div><div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>avg rating</div></div>}
                    </div>
                    {numDays > 1 && dayRatings.some(r => r > 0) && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Rating by day</div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 44 }}>
                          {dayRatings.map((r, i) => (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <div style={{ width: "100%", maxWidth: 34, background: r > 0 ? "#a78bfa" : "#1f1f35", borderRadius: "4px 4px 0 0", height: `${Math.max(3, (r / maxDayRating) * 34)}px` }} />
                              <div style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>Day {i + 1}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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
                          <span onClick={e => { e.stopPropagation(); onNavigate({ view: 'artists', artist: name }); }} style={{ color: '#c4c2f0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{name}</span>
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
              const goingToBought = form.wishlist;
              update('wishlist', !form.wishlist);
              if (goingToBought && form.date === '9999-12-31') update('date', '');
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
            <div style={labelStyle}>Tags</div>
            <DropdownSelect
              options={settings.showTags || ['Cried']}
              selected={form.tags || []}
              onToggle={t => update("tags", (form.tags || []).includes(t) ? (form.tags || []).filter(x => x !== t) : [...(form.tags || []), t])}
              multi
              placeholder="Select tags..."
              accentColor="#f472b6"
              onAddNew={v => { update("tags", [...(form.tags || []), v]); setPendingTag({ value: v, settingsKey: 'showTags', label: 'tags' }); }}
            />
            {(form.tags || []).includes('Cried') && getSongList(form.setlist).length > 0 && (
              <div style={{ marginTop: 4, marginBottom: 4 }}>
                <div style={{ ...labelStyle, fontSize: 11, color: '#8b89cf' }}>💧 Which song?</div>
                <select value={form.criedSong || ''} onChange={e => update('criedSong', e.target.value || null)} style={{
                  width: '100%', background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8,
                  color: form.criedSong ? '#c4c2f0' : '#4a4870', fontSize: 13, padding: '8px 10px',
                  fontFamily: "'DM Sans', sans-serif", WebkitAppearance: 'none', appearance: 'none'
                }}>
                  <option value="">Not sure / whole show</option>
                  {getSongList(form.setlist).map((s, i) => <option key={i} value={getSongName(s)}>{getSongName(s)}</option>)}
                </select>
              </div>
            )}
            {(() => {
              const favoriteCount = concerts.filter(c => c.favorite && c.id !== concert.id).length;
              const atLimit = favoriteCount >= 5 && !form.favorite;
              return (
                <button onClick={() => !atLimit && update('favorite', !form.favorite)} disabled={atLimit} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: `1px solid ${form.favorite ? '#facc15' : '#2e2e50'}`, borderRadius: 8, padding: '8px 12px', cursor: atLimit ? 'default' : 'pointer', opacity: atLimit ? 0.5 : 1, marginTop: 4 }}>
                  <span style={{ fontSize: 14, color: form.favorite ? '#facc15' : '#6b6a8f' }}>★</span>
                  <span style={{ fontSize: 12, color: form.favorite ? '#facc15' : '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>
                    {form.favorite ? 'One of your all-time favorites' : atLimit ? "All-time faves are full (5/5) — remove one first" : 'Mark as an all-time favorite'}
                  </span>
                </button>
              );
            })()}
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
            <TicketsFields value={form.tickets} onChange={v => update('tickets', v)} labelStyle={labelStyle} inputStyle={inputStyle} />
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

function Collapsible({ title, icon, defaultOpen = true, children, open: controlledOpen, onToggle }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const toggle = onToggle || (() => setInternalOpen(o => !o));
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={toggle} style={{
        width: "100%", background: "#111119", border: "none", borderRadius: 12, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 12px",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon && <SettingsSectionIcon id={icon} />}
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: open ? "#e2e0ff" : "#c4c2f0" }}>{title}</span>
        </span>
        <span style={{ color: "#4a4870", fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
      </button>
      {open && <div style={{ paddingTop: 6 }}>{children}</div>}
    </div>
  );
}

function StatsView({ concerts, settings = {}, onNavigate = () => {}, onUpdateSetting = () => {}, onSaveConcert = () => {}, statsTab, setStatsTab, chartGroup, setChartGroup, onOpen = () => {}, hideTabs = false, fillHeight = false }) {
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

  // Financial and Year-in-pixels have been retired: Financial's most useful
  // piece (spending over time) is now an always-visible monthly chart embedded
  // directly on Summary, and Year in pixels didn't have a natural home elsewhere.
  const CHART_GROUPS = [];

  useBackButton(() => setStatsTab("summary"), statsTab === "charts");
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
  const [summaryFavOnly, setSummaryFavOnly] = useState(false);
  const [editingFaveOrder, setEditingFaveOrder] = useState(false);
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
  const summaryPast = pastAll.filter(c => (summaryYear === 'all' || c.date.slice(0,4) === summaryYear) && (!summaryFavOnly || c.favorite));

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

  // Chart-groups system (Financial/Year-in-pixels) was retired — see CHART_GROUPS above.

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
                {pills.map(({ id, label }) => {
                  const active = summaryYear === id && !summaryFavOnly;
                  return (
                    <button key={id} disabled={summaryFavOnly} onClick={() => onUpdateSetting('summaryYear', id)} style={{
                      background: active ? "#a78bfa" : "none",
                      border: `1px solid ${active ? "#a78bfa" : "#1f1f35"}`,
                      borderRadius: 99, cursor: summaryFavOnly ? "default" : "pointer", padding: "3px 10px", flexShrink: 0,
                      fontSize: 11, fontFamily: "'DM Mono', monospace",
                      color: active ? "#0c0c14" : "#4a4870",
                      fontWeight: active ? 700 : 400,
                      opacity: summaryFavOnly ? 0.4 : 1,
                    }}>{label}</button>
                  );
                })}
                {olderYears.length > 0 && (
                  <select
                    disabled={summaryFavOnly}
                    value={olderYears.includes(summaryYear) ? summaryYear : ''}
                    onChange={e => e.target.value && onUpdateSetting('summaryYear', e.target.value)}
                    style={{
                      background: olderYears.includes(summaryYear) && !summaryFavOnly ? "#a78bfa" : "#0c0c14",
                      border: `1px solid ${olderYears.includes(summaryYear) && !summaryFavOnly ? "#a78bfa" : "#1f1f35"}`,
                      borderRadius: 99, cursor: summaryFavOnly ? "default" : "pointer", padding: "3px 10px",
                      fontSize: 11, fontFamily: "'DM Mono', monospace",
                      color: olderYears.includes(summaryYear) && !summaryFavOnly ? "#0c0c14" : "#4a4870",
                      WebkitAppearance: "none", appearance: "none",
                      opacity: summaryFavOnly ? 0.4 : 1,
                    }}
                  >
                    <option value="">older ▾</option>
                    {olderYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
                <button onClick={() => { setSummaryFavOnly(f => { if (!f) onUpdateSetting('summaryYear', 'all'); return !f; }); }} style={{
                  background: summaryFavOnly ? "#facc15" : "none",
                  border: `1px solid ${summaryFavOnly ? "#facc15" : "#1f1f35"}`,
                  borderRadius: 99, cursor: "pointer", padding: "3px 10px", flexShrink: 0,
                  fontSize: 11, fontFamily: "'DM Mono', monospace",
                  color: summaryFavOnly ? "#0c0c14" : "#4a4870",
                  fontWeight: summaryFavOnly ? 700 : 400,
                }}>★ ATF</button>
              </div>
            );
          })()}

          {/* Row 1: shows / festivals / countries / avg per year */}
          {!(settings.hiddenSummaryBlocks||[]).includes("stats1") && !summaryFavOnly && (() => {
            const currentYearStr = String(new Date().getFullYear());
            const sp = summaryPast;
            const spShows = sp.filter(c => c.type === 'concert');
            const spFests = sp.filter(c => c.type === 'festival');
            const spCountries = {};
            sp.forEach(c => { const k = (c.country||'').trim(); if (k) spCountries[k] = (spCountries[k]||0)+1; });
            const spYears = [...new Set(sp.map(c => getYear(c.date)))];
            const spAvg = summaryYear === 'all' && spYears.length ? (sp.length / spYears.length).toFixed(1) : null;
            const upcomingAll = summaryFavOnly ? [] : summaryYear === 'all'
              ? concerts.filter(c => !isWish(c) && !isPast(c.date))
              : summaryYear === currentYearStr
              ? concerts.filter(c => !isWish(c) && !isPast(c.date) && c.date.slice(0,4) === currentYearStr)
              : [];
            const upShows = upcomingAll.filter(c => c.type === 'concert').length;
            const upFests = upcomingAll.filter(c => c.type === 'festival').length;
            const upNewCountries = [...new Set(upcomingAll.map(c => (c.country||'').trim()).filter(k => k && !spCountries[k]))].length;
            return (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${spAvg !== null ? 4 : 3}, 1fr)`, gap: 6, marginBottom: 8 }}>
                {[
                  { label: "shows", value: spShows.length, upcoming: upShows, nav: { view: 'home', filterType: 'concerts' } },
                  { label: "festivals", value: spFests.length, upcoming: upFests, nav: { view: 'home', filterType: 'festivals' } },
                  { label: "countries", value: Object.keys(spCountries).length, upcoming: upNewCountries, nav: { view: 'venues' } },
                  ...(spAvg !== null ? [{ label: "avg / year", value: spAvg, upcoming: 0, nav: null }] : []),
                ].map(b => (
                  <div key={b.label} onClick={b.nav ? () => onNavigate(b.nav) : undefined} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 8, padding: "6px 4px", textAlign: "center", cursor: b.nav ? "pointer" : "default", position: "relative" }}>
                    {b.upcoming > 0 && <div style={{ position: "absolute", top: 3, right: 4, fontSize: 8, color: "#34d399", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>+{b.upcoming}</div>}
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "#a78bfa", lineHeight: 1 }}>{b.value}</div>
                    <div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}


          {!summaryFavOnly && (
            <>
          {/* Cumulative line chart — only shown for "all years"; the month-by-month view is merged into Spending below */}
          {!(settings.hiddenSummaryBlocks||[]).includes("cumulative") && summaryYear === 'all' && <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>cumulative shows</div>
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
              const allSorted = [...concerts].filter(c => !isWish(c) && c.date && c.date.length === 10 && c.date !== '9999-12-31' && (!summaryFavOnly || c.favorite)).sort((a,b) => a.date.localeCompare(b.date));
              if (allSorted.length < 2) return null;
              const n = allSorted.length;
              const W = 300, H = 53;
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

          {/* Spending per year (or per month within the selected year) — stacked by type, past vs upcoming */}
          {(() => {
            const costOf = c => ticketTotal(c) + (c.merch || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
            const relevant = concerts.filter(c => !isWish(c) && c.date && c.date !== '9999-12-31' && (!summaryFavOnly || c.favorite));
            if (relevant.length === 0) return null;
            const empty = () => ({ concertPast: 0, concertUp: 0, festPast: 0, festUp: 0 });
            const add = (bucket, c) => {
              const key = (c.type === 'festival' ? 'fest' : 'concert') + (isPast(c.date) ? 'Past' : 'Up');
              bucket[key] += costOf(c);
            };
            let buckets, labels, showCounts = null;
            if (summaryYear === 'all') {
              const spend = {};
              relevant.forEach(c => { const y = c.date.slice(0, 4); if (!spend[y]) spend[y] = empty(); add(spend[y], c); });
              labels = Object.keys(spend).sort();
              buckets = labels.map(y => spend[y]);
            } else {
              const monthNames = ["J","F","M","A","M","J","J","A","S","O","N","D"];
              const spend = Array.from({ length: 12 }, empty);
              const counts = Array(12).fill(0);
              relevant.filter(c => c.date.slice(0, 4) === summaryYear).forEach(c => { const m = parseInt(c.date.slice(5,7), 10) - 1; add(spend[m], c); counts[m] += 1; });
              labels = monthNames;
              buckets = spend;
              showCounts = counts;
            }
            const totals = buckets.map(b => b.concertPast + b.concertUp + b.festPast + b.festUp);
            const maxSpend = Math.max(...totals, 1);
            const total = totals.reduce((a, b) => a + b, 0);
            if (total === 0) return null;
            const hasFest = buckets.some(b => b.festPast + b.festUp > 0);
            const hasUpcoming = buckets.some(b => b.concertUp + b.festUp > 0);
            return (
              <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{summaryYear === 'all' ? 'Spending per year' : `Spending & shows per month · ${summaryYear}`}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {showCounts && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "#38bdf8" }} /><span style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Shows count</span></div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "#a78bfa" }} /><span style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Spending</span></div>
                    {hasFest && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "#f472b6" }} /><span style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Festivals</span></div>}
                    {hasUpcoming && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "#a78bfa", opacity: 0.35 }} /><span style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Upcoming</span></div>}
                  </div>
                </div>
                {showCounts ? (() => {
                  const maxCount = Math.max(...showCounts, 1);
                  const H = 45;
                  return (
                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "stretch", gap: 2 }}>
                        {labels.map((label, i) => {
                          const b = buckets[i]; const t = totals[i]; const cnt = showCounts[i];
                          const segs = [
                            ['concertPast', b.concertPast, "#a78bfa", 1], ['festPast', b.festPast, "#f472b6", 1],
                            ['concertUp', b.concertUp, "#a78bfa", 0.35], ['festUp', b.festUp, "#f472b6", 0.35],
                          ];
                          return (
                            <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <div style={{ fontSize: 8, color: cnt > 0 ? "#6b6a8f" : "transparent", fontFamily: "'DM Mono', monospace", marginBottom: 2, lineHeight: 1, whiteSpace: "nowrap" }}>{cnt || ''}</div>
                              <div style={{ width: "100%", height: H, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                                <div style={{ width: "100%", maxWidth: 34, margin: "0 auto", borderRadius: "4px 4px 0 0", background: cnt > 0 ? "#38bdf8" : "#1f1f35", height: `${Math.max(2, (cnt / maxCount) * H)}px` }} />
                              </div>
                              <div style={{ width: "100%", height: 2, background: "#3a3858", zIndex: 1 }} />
                              <div style={{ width: "100%", height: H }}>
                                <div style={{ width: "100%", maxWidth: 34, margin: "0 auto", borderRadius: "0 0 4px 4px", overflow: "hidden", display: "flex", flexDirection: "column", height: `${Math.max(2, (t / maxSpend) * H)}px`, background: t > 0 ? undefined : "#1f1f35" }}>
                                  {segs.map(([key, v, color, op]) => v > 0 && <div key={key} style={{ width: "100%", background: color, opacity: op, height: `${(v / t) * 100}%` }} />)}
                                </div>
                              </div>
                              <div style={{ fontSize: 7, color: t > 0 ? "#6b6a8f" : "transparent", fontFamily: "'DM Mono', monospace", marginTop: 2, lineHeight: 1, whiteSpace: "nowrap" }}>{t > 0 ? `€${t.toFixed(0)}` : ''}</div>
                              <div style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 4, whiteSpace: "nowrap" }}>{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
                    {labels.map((label, i) => {
                      const b = buckets[i];
                      const t = totals[i];
                      const segs = [
                        ['concertPast', b.concertPast, "#a78bfa", 1],
                        ['festPast', b.festPast, "#f472b6", 1],
                        ['concertUp', b.concertUp, "#a78bfa", 0.35],
                        ['festUp', b.festUp, "#f472b6", 0.35],
                      ];
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                          <div style={{ fontSize: 8, color: t > 0 ? "#6b6a8f" : "transparent", fontFamily: "'DM Mono', monospace", marginBottom: 3, lineHeight: 1 }}>{t > 0 ? `€${t.toFixed(0)}` : '0'}</div>
                          <div style={{ width: "100%", maxWidth: 34, borderRadius: "4px 4px 0 0", overflow: "hidden", display: "flex", flexDirection: "column-reverse", height: `${Math.max(3, (t / maxSpend) * 60)}px`, background: t > 0 ? undefined : "#1f1f35" }}>
                            {segs.map(([key, v, color, op]) => v > 0 && (
                              <div key={key} style={{ width: "100%", background: color, opacity: op, height: `${(v / t) * 100}%` }} />
                            ))}
                          </div>
                          <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

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
                <div style={{ flex: 1, padding: "12px", borderRight: "1px solid #1f1f35" }}>
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
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: 8, rowGap: 3, marginTop: 8 }}>
                        {[...topGenres.slice(0,3), ...(topGenres.length > 3 ? [["Others"]] : [])].map(([name], i) => (
                          <div key={name} style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                            <div style={{ width: 5, height: 5, borderRadius: 1, background: i < 3 ? GENRE_COLORS[i] : "#4a4870", flexShrink: 0 }} />
                            <span style={{ fontSize: 8, color: name === "Others" ? "#4a4870" : "#c4c2f0", whiteSpace: "nowrap" }}>{name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Venue size */}
                <div style={{ flex: 1, padding: "12px" }}>
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
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: 8, rowGap: 3, marginTop: 8 }}>
                        {[...venueEntries.slice(0,3), ...(venueEntries.length > 3 ? [["Others"]] : [])].map(([name], i) => (
                          <div key={name} style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                            <div style={{ width: 5, height: 5, borderRadius: 1, background: i < 3 ? VENUE_COLORS[i] : "#4a4870", flexShrink: 0 }} />
                            <span style={{ fontSize: 8, color: name === "Others" ? "#4a4870" : "#c4c2f0", whiteSpace: "nowrap" }}>{name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

            </>
          )}

          {/* All-time faves view — replaces the charts above when ATF is on */}
          {summaryFavOnly && (() => {
            const order = settings.favoriteOrder || [];
            const rawFaves = concerts.filter(c => c.favorite && !isWish(c));
            const faves = [...rawFaves].sort((a, b) => {
              const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
              if (ia === -1 && ib === -1) return a.date.localeCompare(b.date);
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            });
            if (faves.length === 0) return (
              <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "24px 14px", marginBottom: 12, textAlign: "center" }}>
                <div style={{ color: "#4a4870", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>No all-time faves marked yet — star up to 5 shows from their Edit page</div>
              </div>
            );
            const moveFave = (idx, dir) => {
              const newFaves = [...faves];
              const swapIdx = idx + dir;
              if (swapIdx < 0 || swapIdx >= newFaves.length) return;
              [newFaves[idx], newFaves[swapIdx]] = [newFaves[swapIdx], newFaves[idx]];
              onUpdateSetting('favoriteOrder', newFaves.map(c => c.id));
            };
            const gCount = {};
            faves.forEach(c => getGenres(c).forEach(g => { gCount[g] = (gCount[g] || 0) + 1; }));
            const topGenre = Object.entries(gCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
            const criedCount = faves.filter(c => (c.tags || []).includes('Cried')).length;
            return (
              <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#facc15", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>★ Your all-time faves</div>
                  <button onClick={() => setEditingFaveOrder(v => !v)} title="Reorder" style={{ background: "none", border: "none", color: editingFaveOrder ? "#facc15" : "#4a4870", cursor: "pointer", fontSize: 13, padding: 0 }}>✎</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${criedCount > 0 ? 3 : 2}, 1fr)`, gap: 6, marginBottom: 12 }}>
                  <div style={{ background: "#0c0c14", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}><div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#facc15" }}>{faves.length}</div><div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>shows</div></div>
                  <div style={{ background: "#0c0c14", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}><div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#facc15" }}>{topGenre}</div><div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>top genre</div></div>
                  {criedCount > 0 && <div style={{ background: "#0c0c14", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}><div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#facc15" }}>💧{criedCount}</div><div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>cried</div></div>}
                </div>
                {faves.length > 1 && (() => {
                  const times = faves.map(c => new Date(c.date + 'T00:00:00').getTime());
                  const minT = Math.min(...times), maxT = Math.max(...times);
                  const span = maxT - minT || 1;
                  const W = 300;
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <svg width="100%" height="38" viewBox={`0 0 ${W} 38`}>
                        <line x1="10" y1="18" x2={W - 10} y2="18" stroke="#2e2e50" strokeWidth="2" />
                        {faves.map((c, i) => {
                          const t = new Date(c.date + 'T00:00:00').getTime();
                          const x = 10 + ((t - minT) / span) * (W - 20);
                          return <circle key={c.id} cx={x} cy={18} r="5" fill="#facc15" />;
                        })}
                        <text x="10" y="34" fontSize="8" fill="#4a4870" fontFamily="DM Mono, monospace">{faves[0].date.slice(0,4)}</text>
                        <text x={W - 10} y="34" fontSize="8" fill="#4a4870" fontFamily="DM Mono, monospace" textAnchor="end">{faves[faves.length - 1].date.slice(0,4)}</text>
                      </svg>
                    </div>
                  );
                })()}
                {faves.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: i > 0 ? "1px solid #1a1a2e" : "none", padding: "8px 0" }}>
                    <button onClick={() => !editingFaveOrder && onOpen(c)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: editingFaveOrder ? "default" : "pointer", textAlign: "left" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#2a2410", color: "#facc15", fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                      {c.photo && <PhotoImg path={c.photo} pos={c.photoPos} style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                          <span style={{ color: "#e2e0ff", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.artist}</span>
                          {(settings.ultGroups || []).includes(c.artist) && <span title="Ult group" style={{ color: "#3a6ea5", fontSize: 11, flexShrink: 0 }}>◆</span>}
                        </div>
                        <div style={{ color: "#6b6a8f", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{formatDate(c.date)}{c.rating ? ` · ${"★".repeat(c.rating)}` : ""}</div>
                      </div>
                    </button>
                    {editingFaveOrder && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                        <button onClick={() => moveFave(i, -1)} disabled={i === 0} style={{ background: "none", border: "1px solid #2e2e50", borderRadius: 6, color: i === 0 ? "#2e2e4a" : "#facc15", fontSize: 10, padding: "2px 8px", cursor: i === 0 ? "default" : "pointer", lineHeight: 1.4 }}>▲</button>
                        <button onClick={() => moveFave(i, 1)} disabled={i === faves.length - 1} style={{ background: "none", border: "1px solid #2e2e50", borderRadius: 6, color: i === faves.length - 1 ? "#2e2e4a" : "#facc15", fontSize: 10, padding: "2px 8px", cursor: i === faves.length - 1 ? "default" : "pointer", lineHeight: 1.4 }}>▼</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}


          {/* Countdown — next 3 upcoming shows */}
          {!(settings.hiddenSummaryBlocks||[]).includes("upnext") && !summaryFavOnly && (() => {
            const upcoming = concerts
              .filter(c => !isWish(c) && !isPast(c.date) && c.date && c.date !== '9999-12-31')
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
      {statsTab === "friends" && <FriendsView concerts={concerts} onOpen={onOpen} settings={settings} onUpdateSetting={onUpdateSetting} onBackToSummary={() => setStatsTab("summary")} />}
      </>}
    </div>
  );
}

function FriendsView({ concerts, onOpen, settings = {}, onUpdateSetting, onBackToSummary = () => {} }) {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('most-shows');
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showFriendFilters, setShowFriendFilters] = useState(false);
  const [filterMinTogether, setFilterMinTogether] = useState(0);
  const [filterHasUpcoming, setFilterHasUpcoming] = useState(false);
  const [showAddFriendForm, setShowAddFriendForm] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [editingProfile, setEditingProfile] = useState(null); // { name, nickname, contact, note }
  const [filterType, setFilterType] = useState('all');
  const [showAllTogether, setShowAllTogether] = useState(false);
  useEffect(() => { setShowAllTogether(false); }, [selectedFriend]);

  const friendProfiles = settings.friendProfiles || {};
  const getProfile = name => friendProfiles[name] || {};
  const saveProfile = (name, profile) => {
    const updated = { ...friendProfiles, [name]: { ...getProfile(name), ...profile } };
    onUpdateSetting?.('friendProfiles', updated);
  };
  const displayName = name => getProfile(name).nickname || name;

  const past = concerts.filter(c => isPast(c.date));
  const knownFriends = (settings.knownFriends || []).filter(n => n && n.trim());
  const allFriends = [...new Set([...past.flatMap(c => getFriends(c)), ...knownFriends])].sort();

  const solo = past.filter(c => getFriends(c).length === 0);
  const withFriends = past.filter(c => getFriends(c).length > 0);
  const groupSizeDist = {};
  past.forEach(c => {
    const n = getFriends(c).length;
    const key = n >= 6 ? '6+' : String(n);
    groupSizeDist[key] = (groupSizeDist[key] || 0) + 1;
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

  const activeFriendFilterCount = [filterMinTogether > 0, filterHasUpcoming].filter(Boolean).length;
  const filtered = friendEntries
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))
    .filter(f => filterType === 'all' || (filterType === 'concerts' ? f.concertCount > 0 : f.festivalCount > 0))
    .filter(f => filterMinTogether === 0 || f.shows.length >= filterMinTogether)
    .filter(f => !filterHasUpcoming || f.upcoming.length > 0)
    .sort((a, b) => {
      if (sortBy === 'most-shows') return b.shows.length - a.shows.length;
      if (sortBy === 'alpha') return a.name.localeCompare(b.name);
      if (sortBy === 'recent') return (b.lastShow?.date || '').localeCompare(a.lastShow?.date || '');
      return 0;
    });

  useBackButton(() => { if (selectedFriend) setSelectedFriend(null); else onBackToSummary(); }, true);

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

        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button onClick={() => setSelectedFriend(null)} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: "18px" }}>←</button>
          <FriendAvatar name={displayName(f.name)} size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>
              {displayName(f.name)}
              {profile.nickname && <span style={{ fontSize: 12, color: "#4a4870", fontFamily: "'DM Mono', monospace", fontWeight: 400, marginLeft: 8 }}>{f.name}</span>}
            </div>
            <DetailSubtitle lines={[
              `${f.shows.length} show${f.shows.length !== 1 ? 's' : ''} together`,
              yearSpan,
              profile.contact,
              profile.note,
            ]} />
          </div>
          <button onClick={() => setEditingProfile({ nickname: profile.nickname || "", contact: profile.contact || "", note: profile.note || "" })} style={{ background: "none", border: "1px solid #2e2e50", borderRadius: 8, color: "#6b6a8f", fontSize: 11, padding: "5px 10px", cursor: "pointer", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>Edit</button>
        </div>

        {/* Stat tiles */}
        {(() => {
          const rated = f.shows.filter(c => c.rating);
          const avgR = rated.length ? (rated.reduce((a, c) => a + c.rating, 0) / rated.length).toFixed(1) : null;
          const vCount = {}; f.shows.forEach(c => { if (c.venue) vCount[c.venue] = (vCount[c.venue] || 0) + 1; });
          const distinctVenues = Object.keys(vCount).length;
          const distinctCountries = new Set(f.shows.map(c => c.country).filter(Boolean)).size;
          const tiles = [
            { value: `${f.shows.length}×`, label: "together" },
            avgR && { value: `★ ${avgR}`, label: "avg rating" },
            distinctVenues > 0 && { value: distinctVenues, label: "venues" },
            distinctCountries > 1 && { value: distinctCountries, label: "countries" },
          ].filter(Boolean);
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "14px 16px 0" }}>
              {tiles.map(({ value, label }) => (
                <div key={label} style={{ background: "#13131f", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 7.5, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          );
        })()}

        <div style={{ padding: "16px 16px" }}>
          {/* Details */}
          {(() => {
            const aCount = {}; f.shows.forEach(c => { if (c.type !== 'festival') aCount[c.artist] = (aCount[c.artist] || 0) + 1; });
            const topA = Object.entries(aCount).sort((a, b) => b[1] - a[1])[0];
            const vCount = {}; f.shows.forEach(c => { if (c.venue) vCount[c.venue] = (vCount[c.venue] || 0) + 1; });
            const topV = Object.entries(vCount).sort((a, b) => b[1] - a[1])[0];
            const rows = [
              f.firstShow && ["first together", `${formatDate(f.firstShow.date)} · ${f.firstShow.artist}`],
              f.lastShow && f.firstShow && f.lastShow.id !== f.firstShow.id && ["most recent", `${formatDate(f.lastShow.date)} · ${f.lastShow.artist}`],
              topA && topA[1] > 1 && ["most seen artist", `${topA[0]} (${topA[1]}×)`],
              topV && topV[1] > 1 && ["usual spot", `${topV[0]} (${topV[1]}×)`],
            ].filter(Boolean);
            if (rows.length === 0) return null;
            return (
              <div style={card}>
                <div style={sectionLabel}>Details</div>
                {rows.map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: "1px solid #1a1a2e" }}>
                    <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{l}</span>
                    <span style={{ color: "#c4c2f0", fontSize: 12, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })()}

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
                      <PhotoImg path={c.photo} pos={c.photoPos} style={{ width: 128, aspectRatio: "16 / 10", borderRadius: 10 }} />
                      <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3, textAlign: "left" }}>{c.artist} · {c.date.slice(0, 4)}</div>
                    </button>
                  ))}
                </div>
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

          {/* Upcoming together */}
          {f.upcoming.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...sectionLabel, marginBottom: 8 }}>Upcoming together</div>
              {[...f.upcoming].sort((a,b) => a.date.localeCompare(b.date)).map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
            </div>
          )}

          {/* All shows */}
          <div>
            <button onClick={() => setShowAllTogether(s => !s)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={sectionLabel.marginBottom !== undefined ? { ...sectionLabel, marginBottom: 0 } : sectionLabel}>All shows together</span>
                <span style={{ fontSize: 10, color: '#2e2e50', fontFamily: "'DM Mono', monospace", background: '#13131f', border: '1px solid #1f1f35', borderRadius: 99, padding: '1px 7px' }}>{f.sortedShows.length}</span>
              </div>
              <span style={{ fontSize: 11, color: '#4a4870', transform: showAllTogether ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
            </button>
            {showAllTogether && [...f.sortedShows].reverse().map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 100px" }}>
      {/* Overview */}
      {!search && (
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{allFriends.length}</span>
            <span style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>friends</span>
          </div>
          <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
            {friendEntries.filter(f => f.shows.length > 1).length} regular{friendEntries.filter(f => f.shows.length > 1).length !== 1 ? 's' : ''}, {past.filter(c => getFriends(c).length === 0).length} solo show{past.filter(c => getFriends(c).length === 0).length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
      {/* Search + sort + filters + add */}
      <div style={{ padding: "12px 16px 0", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search friend..."
            style={{ flex: 1, minWidth: 0, background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 8, color: "#c4c2f0", padding: "7px 11px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }}
          />
          <button onClick={() => { setShowSortPanel(p => !p); setShowFriendFilters(false); }} style={{ background: showSortPanel || sortBy !== 'most-shows' ? '#1a1a30' : 'none', border: `1px solid ${showSortPanel || sortBy !== 'most-shows' ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: sortBy !== 'most-shows' ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: sortBy !== 'most-shows' ? 700 : 400, flexShrink: 0 }}>
            Sort{sortBy !== 'most-shows' ? ' ↕' : ''}
          </button>
          <button onClick={() => { setShowFriendFilters(f => !f); setShowSortPanel(false); }} style={{ background: showFriendFilters || activeFriendFilterCount > 0 ? '#1a1a30' : 'none', border: `1px solid ${showFriendFilters || activeFriendFilterCount > 0 ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: activeFriendFilterCount > 0 ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: activeFriendFilterCount > 0 ? 700 : 400, flexShrink: 0 }}>
            {activeFriendFilterCount > 0 ? `Filters (${activeFriendFilterCount})` : 'Filters'}
          </button>
          <button onClick={() => { setAddFriendInput(''); setShowAddFriendForm(true); }} aria-label="Add a friend" style={{ background: 'none', border: '1px solid #1f1f35', borderRadius: 99, width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a78bfa', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>+</button>
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
        {showFriendFilters && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            {activeFriendFilterCount > 0 && <button onClick={() => { setFilterMinTogether(0); setFilterHasUpcoming(false); }} style={{ marginBottom: 10, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Min. shows together</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[0, 2, 3, 5].map(n => (
                  <button key={n} onClick={() => setFilterMinTogether(n)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterMinTogether === n ? '#a78bfa' : '#0c0c14', color: filterMinTogether === n ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterMinTogether === n ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{n === 0 ? 'Any' : `${n}+`}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Upcoming</div>
              <button onClick={() => setFilterHasUpcoming(u => !u)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterHasUpcoming ? '#a78bfa' : '#0c0c14', color: filterHasUpcoming ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterHasUpcoming ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Has upcoming show together</button>
            </div>
          </div>
        )}
        {showAddFriendForm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: '#000000cc', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowAddFriendForm(false)}>
            <div style={{ width: '100%', background: '#13131f', borderRadius: '16px 16px 0 0', padding: '20px 20px 40px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#e2e0ff' }}>Add a friend</div>
                <button onClick={() => setShowAddFriendForm(false)} style={{ background: 'none', border: 'none', color: '#6b6a8f', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Name</div>
                <input
                  value={addFriendInput}
                  onChange={e => setAddFriendInput(e.target.value)}
                  placeholder="e.g. Sophie"
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
                />
              </div>
              <button disabled={!addFriendInput.trim()} onClick={() => {
                const name = addFriendInput.trim();
                if (!name) return;
                const next = [...(settings.knownFriends || []), name];
                onUpdateSetting('knownFriends', next);
                setShowAddFriendForm(false);
                setSelectedFriend(name);
              }} style={{ width: '100%', background: '#a78bfa', border: 'none', borderRadius: 10, color: '#0c0c14', fontSize: 14, fontWeight: 700, padding: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: !addFriendInput.trim() ? 0.5 : 1 }}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Friend list */}
      <div style={{ padding: "0 16px" }}>
        {filtered.map(({ name, shows, lastShow, topGenres, upcoming }) => (
          <button key={name} onClick={() => setSelectedFriend(name)} style={{
            width: "100%", textAlign: "left", background: "#13131f",
            border: "1px solid #1f1f35", borderLeft: "3px solid #2e2e4a",
            borderRadius: 10, padding: "12px 14px", cursor: "pointer", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 12
          }}>
            <FriendAvatar name={displayName(name)} />
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

function ArtistsView({ concerts, onOpen, onNavigate = () => {}, settings = {}, onUpdateSetting = () => {}, onDetailChange = () => {}, initialSelectedArtist = null, onInitialArtistConsumed = () => {}, onBackToOrigin = null }) {
  const [selectedArtist, setSelectedArtist] = useState(initialSelectedArtist);
  const [enteredViaArtist] = useState(initialSelectedArtist);
  useEffect(() => { if (initialSelectedArtist) { setSelectedArtist(initialSelectedArtist); onInitialArtistConsumed(); } }, [initialSelectedArtist]);
  const goBackFromArtist = () => {
    if (selectedArtist && selectedArtist === enteredViaArtist && onBackToOrigin) onBackToOrigin();
    else setSelectedArtist(null);
  };
  const [showArtistUpcoming, setShowArtistUpcoming] = useState(false);
  const [showArtistHeadliner, setShowArtistHeadliner] = useState(false);
  const [showArtistSupport, setShowArtistSupport] = useState(false);
  const [showArtistSongs, setShowArtistSongs] = useState(false);
  const [showArtistCovers, setShowArtistCovers] = useState(false);
  useEffect(() => { onDetailChange(selectedArtist !== null); return () => onDetailChange(false); }, [selectedArtist]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("most-seen");
  const [sortDir, setSortDir] = useState('desc');
  const [filterGenre, setFilterGenre] = useState("all");
  const [filterMinSeen, setFilterMinSeen] = useState(0);
  const [filterUpcoming, setFilterUpcoming] = useState(false);
  const [filterUltGroup, setFilterUltGroup] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [showAddArtistForm, setShowAddArtistForm] = useState(false);
  const [addArtistInput, setAddArtistInput] = useState('');

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
      supportAppearancesMap[name].push({ concert: c, role: 'festival', act });
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
    const festivalActRatings = supportApps.filter(a => a.role === 'festival' && a.act?.rating);
    const festivalAvgRating = festivalActRatings.length ? festivalActRatings.reduce((s, a) => s + a.act.rating, 0) / festivalActRatings.length : null;
    const festivalNotes = supportApps.filter(a => a.role === 'festival' && a.act?.note).map(a => ({ date: a.concert.date, festival: a.concert.artist, note: a.act.note, concert: a.concert }));
    return { name, shows, pastShows, upcomingShows, upcomingSupportApps, pastCount: pastShows.length, avgRating, festivalAvgRating, festivalNotes, firstShow, lastShow, topGenre, supportApps, supportCount, guestCount, festivalCount };
  });

  // Artists you haven't seen yet, but want to — kept separate so they never
  // count toward "seen" stats.
  const existingArtistNames = new Set(artistEntries.map(a => a.name.toLowerCase()));
  const wantToSeeArtists = (settings.wantToSeeArtists || []).filter(w => !existingArtistNames.has(w.toLowerCase()));
  wantToSeeArtists.forEach(name => {
    artistEntries.push({
      name, shows: [], pastShows: [], upcomingShows: [], upcomingSupportApps: [], pastCount: 0, avgRating: null,
      firstShow: null, lastShow: null, topGenre: null, supportApps: [], supportCount: 0, guestCount: 0, festivalCount: 0,
      wantToSee: true,
    });
  });

  const activeFilterCount = [filterGenre !== 'all', filterMinSeen > 0, filterUpcoming, filterUltGroup].filter(Boolean).length;

  const sorted = artistEntries
    .filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGenre !== 'all' && a.topGenre !== filterGenre) return false;
      if (filterMinSeen > 0 && (a.pastCount + a.supportCount + a.guestCount + a.festivalCount) < filterMinSeen) return false;
      if (filterUpcoming && a.upcomingShows.length === 0 && a.upcomingSupportApps.length === 0) return false;
      if (filterType === 'concerts' && a.pastCount === 0) return false;
      if (filterType === 'festivals' && a.festivalCount === 0 && a.upcomingSupportApps.filter(u => u.role === 'festival').length === 0) return false;
      if (filterUltGroup && !(settings.ultGroups || []).includes(a.name)) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? -1 : 1;
      if (sortBy === 'most-seen') {
        const totA = a.pastCount + a.supportCount + a.guestCount + a.festivalCount;
        const totB = b.pastCount + b.supportCount + b.guestCount + b.festivalCount;
        return dir * (totB - totA) || a.name.localeCompare(b.name);
      }
      if (sortBy === 'alpha') return -dir * a.name.localeCompare(b.name);
      if (sortBy === 'recently-seen') return dir * (b.lastShow?.date || '').localeCompare(a.lastShow?.date || '');
      if (sortBy === 'rating') return dir * ((b.avgRating || 0) - (a.avgRating || 0)) || b.pastCount - a.pastCount;
      if (sortBy === 'cost-per-song') {
        const costOf = e => {
          const nonFest = e.pastShows.filter(c => c.type !== 'festival');
          const songs = nonFest.reduce((s, c) => s + getSongList(c.setlist).length, 0);
          const spend = nonFest.reduce((s, c) => s + ticketTotal(c) + (c.merch || []).reduce((m, x) => m + (parseFloat(x.price) || 0), 0), 0);
          return songs > 0 ? spend / songs : null;
        };
        const ca = costOf(a), cb = costOf(b);
        if (ca === null && cb === null) return a.name.localeCompare(b.name);
        if (ca === null) return 1;
        if (cb === null) return -1;
        return dir * (cb - ca);
      }
      return 0;
    });

  const getBorderColor = (count) => {
    if (count >= 5) return '#a78bfa';
    if (count >= 3) return '#6d5fa8';
    if (count >= 2) return '#3d3564';
    return '#2e2e4a';
  };

  useBackButton(goBackFromArtist, selectedArtist !== null);

  if (selectedArtist) {
    const shows = (artistMap[selectedArtist] || []).sort((a,b) => b.date.localeCompare(a.date));
    const pastShows = shows.filter(c => isPast(c.date));
    const upcomingShows = shows.filter(c => !isPast(c.date));
    const rated = pastShows.filter(c => c.rating);
    const avgRating = rated.length ? (rated.reduce((s,c) => s + c.rating, 0) / rated.length).toFixed(1) : null;
    const criedCount = pastShows.filter(c => (c.tags || []).includes('Cried')).length;
    const supportApps = (supportAppearancesMap[selectedArtist] || []).filter(a => isPast(a.concert.date)).sort((a,b) => b.concert.date.localeCompare(a.concert.date));
    const festivalActRatings = supportApps.filter(a => a.role === 'festival' && a.act?.rating);
    const festivalAvgRating = festivalActRatings.length ? (festivalActRatings.reduce((s, a) => s + a.act.rating, 0) / festivalActRatings.length).toFixed(1) : null;
    const festivalNotes = supportApps.filter(a => a.role === 'festival' && a.act?.note).sort((a,b) => b.concert.date.localeCompare(a.concert.date));
    const friendCount = {};
    pastShows.forEach(c => getFriends(c).forEach(f => { friendCount[f] = (friendCount[f] || 0) + 1; }));
    const topFriend = Object.entries(friendCount).sort((a,b) => b[1]-a[1])[0] || null;
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
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button onClick={goBackFromArtist} style={{
            background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: "18px"
          }}>←</button>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>{selectedArtist}</div>
            <DetailSubtitle lines={[
              [`${totalAppearances} appearance${totalAppearances !== 1 ? "s" : ""}`, ...(roleParts.length > 0 && pastShows.length !== totalAppearances ? roleParts : [])],
              allUpcoming.length > 0 ? `${allUpcoming.length} upcoming` : null,
            ]} />
          </div>
        </div>
        {/* Hero count + money stats */}
        {totalAppearances === 0 ? (
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{ fontSize: 13, color: "#6b6a8f", marginBottom: 10 }}>Haven't seen them live yet.</div>
            <button onClick={() => {
              const next = (settings.wantToSeeArtists || []).filter(w => w.toLowerCase() !== selectedArtist.toLowerCase());
              onUpdateSetting('wantToSeeArtists', next);
              setSelectedArtist(null);
            }} style={{ background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#6b6a8f', fontSize: 11, padding: '7px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
              Remove from want-to-see list
            </button>
          </div>
        ) : (() => {
          const priced = pastShows.filter(c => ticketTotal(c) > 0);
          const avgTicket = priced.length ? priced.reduce((a, c) => a + ticketTotal(c), 0) / priced.length : null;
          const totalSpentOnArtist = pastShows.reduce((s, c) => s + ticketTotal(c) + (c.merch || []).reduce((m, x) => m + (parseFloat(x.price) || 0), 0), 0);
          // Per-song figures only make sense for concerts (a festival's cost/setlist isn't
          // this artist's alone) — festivals are excluded here, not just under-counted.
          const nonFestShows = pastShows.filter(c => c.type !== 'festival');
          const totalSongsHeard = nonFestShows.reduce((s, c) => s + getSongList(c.setlist).length, 0);
          const nonFestSpend = nonFestShows.reduce((s, c) => s + ticketTotal(c) + (c.merch || []).reduce((m, x) => m + (parseFloat(x.price) || 0), 0), 0);
          const costPerSong = totalSongsHeard > 0 && nonFestSpend > 0 ? nonFestSpend / totalSongsHeard : null;
          const merchItems = pastShows.flatMap(c => c.merch || []);
          const merchSpend = merchItems.reduce((a, m) => a + (parseFloat(m.price) || 0), 0);
          const photos = pastShows.filter(c => c.photo);
          const isUltGroup = (settings.ultGroups || []).includes(selectedArtist);
          return (
            <>
              <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{totalAppearances}×</span>
                <span style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>seen live</span>
                <button onClick={() => { const list = settings.ultGroups || []; onUpdateSetting('ultGroups', isUltGroup ? list.filter(n => n !== selectedArtist) : [...list, selectedArtist]); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: isUltGroup ? "#3a6ea5" : "#3a3858", fontFamily: "'DM Mono', monospace" }}>
                  {isUltGroup ? '◆ your ult group' : '◇ mark as ult group'}
                </button>
              </div>
              {pastShows.length > 0 && festivalOnlyCount > 0 && (
                <div style={{ display: "flex", gap: 16, padding: "6px 16px 0" }}>
                  <div><span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{pastShows.length}×</span> <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>concerts</span></div>
                  <div><span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#f472b6" }}>{festivalOnlyCount}×</span> <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>festivals</span></div>
                </div>
              )}
              <div style={{ padding: "6px 16px 0" }}>
                <DetailSubtitle lines={[
                  avgTicket !== null ? <>avg ticket <span style={{ color: "#c4c2f0" }}>€{avgTicket.toFixed(0)}</span></> : null,
                  merchItems.length > 0 ? `${merchItems.length} merch item${merchItems.length !== 1 ? 's' : ''} bought · €${merchSpend.toFixed(0)}` : null,
                  costPerSong ? <>€{costPerSong.toFixed(2)} / song</> : null,
                ]} />
              </div>
              {photos.length > 0 && (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 16px 0", WebkitOverflowScrolling: "touch" }}>
                  {photos.map(c => (
                    <button key={c.id} onClick={() => onOpen(c)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                      <PhotoImg path={c.photo} pos={c.photoPos} style={{ width: 128, aspectRatio: "16 / 10", borderRadius: 10 }} />
                      <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3, textAlign: "left" }}>{c.date.slice(0, 4)} · {isOnline(c) ? formatOnlineLocation(c) : c.venue}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}
        {/* Quick stats row */}
        {(avgRating || festivalAvgRating || criedCount > 0 || topFriend) && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${[avgRating, festivalAvgRating, criedCount > 0, topFriend].filter(Boolean).length}, 1fr)`, gap: 6, padding: "12px 16px", borderBottom: "1px solid #1f1f35" }}>
            {avgRating && (
              <div style={{ background: "#13131f", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>★{avgRating}</div>
                <div style={{ fontSize: 7.5, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4 }}>{festivalAvgRating ? "concert rating" : "avg rating"}</div>
              </div>
            )}
            {festivalAvgRating && (
              <div style={{ background: "#13131f", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: "#f472b6", lineHeight: 1 }}>★{festivalAvgRating}</div>
                <div style={{ fontSize: 7.5, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4 }}>festival rating</div>
              </div>
            )}
            {criedCount > 0 && (
              <div style={{ background: "#13131f", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: "#3a6ea5", lineHeight: 1 }}>💧{criedCount}</div>
                <div style={{ fontSize: 7.5, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4 }}>cried</div>
              </div>
            )}
            {topFriend && (
              <div onClick={() => onNavigate({ view: 'friends' })} style={{ background: "#13131f", borderRadius: 10, padding: "8px 4px", textAlign: "center", cursor: "pointer" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: "#a78bfa", lineHeight: 1.15, whiteSpace: "normal", wordBreak: "break-word" }}>{topFriend[0]}</div>
                <div style={{ fontSize: 7.5, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4 }}>top friend · {topFriend[1]}×</div>
              </div>
            )}
          </div>
        )}
        {festivalNotes.length > 0 && (
          <div style={{ padding: "10px 16px 0" }}>
            <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Festival notes</div>
            {festivalNotes.map((a, i) => (
              <button key={i} onClick={() => onOpen(a.concert)} style={{ display: "block", width: "100%", textAlign: "left", background: "#13131f", border: "none", borderRadius: 8, padding: "8px 10px", marginBottom: 6, cursor: "pointer" }}>
                <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginBottom: 3 }}>{a.festival} · {formatDate(a.date)}</div>
                <div style={{ fontSize: 12, color: "#c4c2f0" }}>{a.note}</div>
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: "14px 16px" }}>
          {allUpcoming.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <button onClick={() => setShowArtistUpcoming(s => !s)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#818cf8", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Upcoming</span>
                  <span style={{ fontSize: 10, color: "#4a4a8f", fontFamily: "'DM Mono', monospace", background: "#12122a", border: "1px solid #2e2e5a", borderRadius: 99, padding: "1px 7px" }}>{allUpcoming.length}</span>
                </div>
                <span style={{ fontSize: 11, color: "#818cf8", transform: showArtistUpcoming ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▾</span>
              </button>
              {showArtistUpcoming && allUpcoming.map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} showArtist={false} />)}
            </div>
          )}
          {pastShows.length > 0 && (
            <div style={{ marginBottom: supportApps.length > 0 ? 10 : 0 }}>
              <button onClick={() => setShowArtistHeadliner(s => !s)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Headliner</span>
                  <span style={{ fontSize: 10, color: "#4a3d70", fontFamily: "'DM Mono', monospace", background: "#181229", border: "1px solid #2e2350", borderRadius: 99, padding: "1px 7px" }}>{pastShows.length}</span>
                </div>
                <span style={{ fontSize: 11, color: "#a78bfa", transform: showArtistHeadliner ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▾</span>
              </button>
              {showArtistHeadliner && pastShows.map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} showArtist={false} />)}
            </div>
          )}
          {artistSongs.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <button onClick={() => setShowArtistSongs(s => !s)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Songs heard live</span>
                  <span style={{ fontSize: 10, color: "#4a3d70", fontFamily: "'DM Mono', monospace", background: "#181229", border: "1px solid #2e2350", borderRadius: 99, padding: "1px 7px" }}>{artistSongs.length}</span>
                </div>
                <span style={{ fontSize: 11, color: "#a78bfa", transform: showArtistSongs ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▾</span>
              </button>
              {showArtistSongs && (
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
              )}
            </div>
          )}
          {coversByOthers.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <button onClick={() => setShowArtistCovers(s => !s)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Covered by others</span>
                  <span style={{ fontSize: 10, color: "#4a3d70", fontFamily: "'DM Mono', monospace", background: "#181229", border: "1px solid #2e2350", borderRadius: 99, padding: "1px 7px" }}>{coversByOthers.length}</span>
                </div>
                <span style={{ fontSize: 11, color: "#a78bfa", transform: showArtistCovers ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▾</span>
              </button>
              {showArtistCovers && (
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
              )}
            </div>
          )}
          {supportApps.length > 0 && (
            <div>
              <button onClick={() => setShowArtistSupport(s => !s)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Support, guest & festival</span>
                  <span style={{ fontSize: 10, color: "#4a3d70", fontFamily: "'DM Mono', monospace", background: "#181229", border: "1px solid #2e2350", borderRadius: 99, padding: "1px 7px" }}>{supportApps.length}</span>
                </div>
                <span style={{ fontSize: 11, color: "#a78bfa", transform: showArtistSupport ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▾</span>
              </button>
              {showArtistSupport && supportApps.map(({ concert: c, role }) => {
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
  const totalArtists = artistEntries.filter(a => !a.wantToSee).length;
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
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{totalArtists}</span>
            <span style={{ fontSize: 12, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>artists seen</span>
          </div>
          {(uniqueGenres > 0 || avgShowsPerArtist) && (
            <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
              {uniqueGenres} genre{uniqueGenres !== 1 ? 's' : ''}{avgShowsPerArtist ? `, ${avgShowsPerArtist} avg shows` : ''}
            </div>
          )}
        </div>
      )}

      {/* Type pills */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
        {[['all','All'],['concerts','Shows'],['festivals','Fest']].map(([id,label]) => (
          <button key={id} onClick={() => setFilterType(id)} style={{ background:filterType===id?'#a78bfa':'none', border:`1px solid ${filterType===id?'#a78bfa':'#1f1f35'}`, borderRadius:99, padding:'5px 11px', cursor:'pointer', color:filterType===id?'#0c0c14':'#6b6a8f', fontSize:12, fontFamily:"'DM Mono', monospace", fontWeight:filterType===id?700:400, flexShrink:0 }}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => { setAddArtistInput(''); setShowAddArtistForm(true); }} aria-label="Add an artist you want to see" style={{ background: 'none', border: '1px solid #1f1f35', borderRadius: 99, width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a78bfa', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>+</button>
      </div>

      {/* Add an artist you want to see */}
      {showAddArtistForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: '#000000cc', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowAddArtistForm(false)}>
          <div style={{ width: '100%', background: '#13131f', borderRadius: '16px 16px 0 0', padding: '20px 20px 40px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#e2e0ff' }}>Artist you want to see</div>
              <button onClick={() => setShowAddArtistForm(false)} style={{ background: 'none', border: 'none', color: '#6b6a8f', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Artist name</div>
              <input
                value={addArtistInput}
                onChange={e => setAddArtistInput(e.target.value)}
                placeholder="e.g. Fontaines D.C."
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
              />
            </div>
            <button disabled={!addArtistInput.trim()} onClick={() => {
              const name = addArtistInput.trim();
              if (!name) return;
              const next = [...(settings.wantToSeeArtists || []), name];
              onUpdateSetting('wantToSeeArtists', next);
              setShowAddArtistForm(false);
              setSelectedArtist(name);
            }} style={{ width: '100%', background: '#a78bfa', border: 'none', borderRadius: 10, color: '#0c0c14', fontSize: 14, fontWeight: 700, padding: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: !addArtistInput.trim() ? 0.5 : 1 }}>
              Add
            </button>
          </div>
        </div>
      )}

      {/* Search + sort + filters */}
      <div style={{ padding: "8px 16px 0", position: "relative", zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search artist..."
            style={{ flex: 1, minWidth: 0, background: '#0c0c14', border: '1px solid #1f1f35', borderRadius: 8, color: '#c4c2f0', padding: '7px 11px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' }}
          />
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {[{id:'most-seen',label:'Most seen'},{id:'alpha',label:'A–Z'},{id:'recently-seen',label:'Recently seen'},{id:'rating',label:'Avg rating'},{id:'cost-per-song',label:'€ / song'}].map(s => (
                <button key={s.id} onClick={() => setSortBy(s.id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortBy === s.id ? '#a78bfa' : '#0c0c14', color: sortBy === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortBy === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
              ))}
              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} title="Flip direction" style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: '#0c0c14', color: '#a78bfa', border: '1px solid #2e2e50', fontFamily: "'DM Mono', monospace" }}>
                {sortDir === 'asc' ? '↑ asc' : '↓ desc'}
              </button>
            </div>
          </div>
        )}

        {showFilters && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            {activeFilterCount > 0 && <button onClick={() => { setFilterGenre('all'); setFilterMinSeen(0); setFilterUpcoming(false); setFilterUltGroup(false); }} style={{ marginBottom: 10, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
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
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Upcoming only</div>
              <button onClick={() => setFilterUpcoming(f => !f)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterUpcoming ? '#818cf8' : '#0c0c14', color: filterUpcoming ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterUpcoming ? '#818cf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Has upcoming</button>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Moments</div>
              <button onClick={() => setFilterUltGroup(f => !f)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterUltGroup ? '#3a6ea5' : '#0c0c14', color: filterUltGroup ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterUltGroup ? '#3a6ea5' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Ult group</button>
            </div>
          </div>
        )}
      </div>

      {/* Artist list */}
      <div style={{ padding: "0 16px" }}>
        {sorted.map(({ name, pastCount, pastShows, upcomingShows, upcomingSupportApps, firstShow, lastShow, avgRating, topGenre, supportCount, guestCount, festivalCount, supportApps, wantToSee }) => {
          const total = pastCount + supportCount + guestCount + festivalCount;
          const latestSupportDate = supportApps.length > 0 ? supportApps.slice().sort((a,b) => b.concert.date.localeCompare(a.concert.date))[0].concert.date : null;
          const displayDate = lastShow ? lastShow.date : latestSupportDate;
          const soonCount = upcomingShows.length + upcomingSupportApps.length;
          let costPerSongDisplay = null;
          if (sortBy === 'cost-per-song' && pastShows) {
            const nonFest = pastShows.filter(c => c.type !== 'festival');
            const songs = nonFest.reduce((s, c) => s + getSongList(c.setlist).length, 0);
            const spend = nonFest.reduce((s, c) => s + ticketTotal(c) + (c.merch || []).reduce((m, x) => m + (parseFloat(x.price) || 0), 0), 0);
            costPerSongDisplay = songs > 0 ? spend / songs : null;
          }
          return (
          <button key={name} onClick={() => setSelectedArtist(name)} style={{
            width: "100%", textAlign: "left", background: "#13131f",
            border: "1px solid #1f1f35", borderLeft: `3px solid ${wantToSee ? '#34d399' : getBorderColor(total)}`,
            borderRadius: 10, padding: "12px 14px", cursor: "pointer", marginBottom: 8,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#e2e0ff" }}>{name}</span>
                {wantToSee && <span style={{ fontSize: 9, color: '#34d399', fontFamily: "'DM Mono', monospace", border: '1px solid #1e3a2e', borderRadius: 99, padding: '1px 6px', flexShrink: 0 }}>want to see</span>}
                {topGenre && (
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 99, background: '#1a1a30', color: '#6b6a8f', flexShrink: 0 }}>{topGenre}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
                {wantToSee ? 'not seen yet' : firstShow && lastShow && firstShow.date !== lastShow.date
                  ? `${firstShow.date.slice(0,4)} – ${lastShow.date.slice(0,4)} · last ${formatDate(lastShow.date)}`
                  : displayDate ? formatDate(displayDate) : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
              {!wantToSee && (
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#6b6a8f', lineHeight: 1 }}>{total}</span>
                <span style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginLeft: 3 }}>time{total !== 1 ? 's' : ''}</span>
              </div>
              )}
              {(supportCount > 0 || guestCount > 0 || festivalCount > 0) && (
                <div style={{ fontSize: 9, color: '#4a4870', fontFamily: "'DM Mono', monospace", textAlign: 'right' }}>
                  {[pastCount > 0 && `${pastCount}h`, supportCount > 0 && `${supportCount}s`, guestCount > 0 && `${guestCount}g`, festivalCount > 0 && `${festivalCount}f`].filter(Boolean).join('·')}
                </div>
              )}
              {soonCount > 0 && (
                <div style={{ fontSize: 9, color: '#818cf8', fontFamily: "'DM Mono', monospace" }}>+{soonCount} soon</div>
              )}
              {costPerSongDisplay !== null && (
                <div style={{ fontSize: 10, color: '#a78bfa', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>€{costPerSongDisplay.toFixed(2)}/song</div>
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

function SongsView({ concerts, onOpen, settings, saveSettings, onLinkSong, onDetailChange = () => {}, initialSearch = null, onInitialSearchConsumed = () => {} }) {
  const past = concerts.filter(c => isPast(c.date));
  const [search, setSearch] = useState(initialSearch || '');
  useEffect(() => { if (initialSearch) { setSearch(initialSearch); onInitialSearchConsumed(); } }, [initialSearch]);
  const [sortBy, setSortBy] = useState('count');
  const [topN, setTopN] = useState(settings?.topSongsRows || 5);
  const [selectedSong, setSelectedSong] = useState(null);
  useEffect(() => { onDetailChange(selectedSong !== null); return () => onDetailChange(false); }, [selectedSong]);
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
          albumArt: t.album?.images?.[0]?.url || selectedSong.albumArt,
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
  const maxRating = settings.ratingSystem || 5;
  past.filter(c => filterType === 'all' || (filterType === 'concerts' ? c.type !== 'festival' : c.type === 'festival')).forEach(c => {
    const tally = (s, performer) => {
      const n = getSongName(s); if (!n) return;
      const cov = getSongCover(s);
      const a = (typeof cov === 'string' && cov) || performer || '';
      const k = n + '\n' + a;
      const sp = (s && typeof s === 'object') ? s : null;
      if (!songCount[k]) songCount[k] = { name: n, artist: a, count: 0, spotifyId: null, spotifyName: null, albumName: null, albumId: null, albumArt: null, durationMs: null, popularity: null, trackNumber: null, criedFor: false, topRated: false };
      songCount[k].count += 1;
      if (c.criedSong === n) songCount[k].criedFor = true;
      if (c.rating === maxRating) songCount[k].topRated = true;
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

  const rank = e => (e.criedFor ? 2 : 0) + (e.topRated ? 1 : 0);
  const byCount = [...songEntries].sort((a, b) => (rank(b) - rank(a)) || (b.count - a.count));
  const topSet = topN ? new Set(byCount.slice(0, topN)) : null;
  const filtered = songEntries
    .filter(e => (!search && topSet ? topSet.has(e) : true)
      && (!search || e.name.toLowerCase().includes(search.toLowerCase()) || e.artist.toLowerCase().includes(search.toLowerCase()))
      && (filterSpotify === 'all' || (filterSpotify === 'linked' ? e.spotifyId : !e.spotifyId)))
    .sort((a, b) => sortBy === 'count' ? ((rank(b) - rank(a)) || (b.count - a.count)) : (a.name.localeCompare(b.name) || a.artist.localeCompare(b.artist)));

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
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid #1f1f35', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <button onClick={() => setSelectedSong(null)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: '18px' }}>←</button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: '#e2e0ff', lineHeight: 1 }}>{selectedSong.name}</div>
            <DetailSubtitle lines={[[selectedSong.artist, duration]]} />
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
            <img src={selectedSong.albumArt} alt="" style={{ width: 130, height: 130, borderRadius: 10, flexShrink: 0, objectFit: 'cover' }} />
          )}
          </div>
        </div>
        {/* Stat tiles: times live, cried, popularity */}
        {(() => {
          const criedCount = appearances.filter(a => a.concert.criedSong === selectedSong.name).length;
          const tileCount = 1 + (criedCount > 0 ? 1 : 0) + (typeof selectedSong.popularity === 'number' ? 1 : 0);
          return (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tileCount}, 1fr)`, gap: 6, padding: '12px 16px 0' }}>
              <div style={{ background: '#13131f', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{appearances.length}×</div>
                <div style={{ fontSize: 7.5, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>live</div>
              </div>
              {criedCount > 0 && (
                <div style={{ background: '#13131f', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: '#3a6ea5', lineHeight: 1 }}>💧{criedCount}×</div>
                  <div style={{ fontSize: 7.5, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>cried</div>
                </div>
              )}
              {typeof selectedSong.popularity === 'number' && (
                <div style={{ background: '#13131f', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: '#1DB954', lineHeight: 1 }}>{selectedSong.popularity}</div>
                  <div style={{ fontSize: 7.5, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>popularity</div>
                </div>
              )}
            </div>
          );
        })()}
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
      {/* Overview: headline stat + subtitle, matching Venues */}
      {!search && totalUnique > 0 && (() => {
        const totalArtists = [...new Set(songEntries.map(e => e.artist).filter(Boolean))].length;
        return (
          <div style={{ padding: '14px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{totalUnique}</span>
              <span style={{ fontSize: 12, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>songs heard</span>
            </div>
            {(past.length > 0 || totalArtists > 0) && (
              <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
                across {past.length} show{past.length !== 1 ? 's' : ''}{totalArtists > 0 ? `, ${totalArtists} artist${totalArtists !== 1 ? 's' : ''}` : ''}
              </div>
            )}
          </div>
        );
      })()}
      {/* Type pills */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 6 }}>
        {[['all','All'],['concerts','Shows'],['festivals','Fest']].map(([id,label]) => (
          <button key={id} onClick={() => setFilterType(id)} style={{ background:filterType===id?'#a78bfa':'none', border:`1px solid ${filterType===id?'#a78bfa':'#1f1f35'}`, borderRadius:99, padding:'5px 11px', cursor:'pointer', color:filterType===id?'#0c0c14':'#6b6a8f', fontSize:12, fontFamily:"'DM Mono', monospace", fontWeight:filterType===id?700:400, flexShrink:0 }}>{label}</button>
        ))}
      </div>
      {/* Search + sort + filters */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search songs..."
          style={{ flex: 1, minWidth: 0, background: '#0c0c14', border: '1px solid #1f1f35', borderRadius: 8, color: '#c4c2f0', padding: '7px 11px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' }}
        />
        <button onClick={() => { setShowSongSort(s => !s); setShowSongFilters(false); }} style={{ background: showSongSort || sortBy !== 'count' || topN !== null ? '#1a1a30' : 'none', border: `1px solid ${showSongSort || sortBy !== 'count' || topN !== null ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: sortBy !== 'count' || topN !== null ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: sortBy !== 'count' || topN !== null ? 700 : 400, flexShrink: 0 }}>
          Sort{sortBy !== 'count' || topN !== null ? ' ↕' : ''}
        </button>
        <button onClick={() => { setShowSongFilters(f => !f); setShowSongSort(false); }} style={{ background: showSongFilters || filterSpotify !== 'all' ? '#1a1a30' : 'none', border: `1px solid ${showSongFilters || filterSpotify !== 'all' ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: filterSpotify !== 'all' ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: filterSpotify !== 'all' ? 700 : 400, flexShrink: 0 }}>
          {filterSpotify === 'all' ? 'Filters' : filterSpotify === 'linked' ? 'Linked' : 'Unlinked'}
        </button>
      </div>
      {showSongSort && (
        <div style={{ margin: '0 16px 8px', background: '#13131f', border: '1px solid #1f1f35', borderRadius: 10, padding: '10px 12px' }}>
          {(sortBy !== 'count' || topN !== null) && <button onClick={() => { setSortBy('count'); setTopN(null); }} style={{ marginBottom: 8, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
          <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Sort by</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
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
      {showSongFilters && (
        <div style={{ margin: '0 16px 8px', background: '#13131f', border: '1px solid #1f1f35', borderRadius: 10, padding: '10px 12px' }}>
          {filterSpotify !== 'all' && <button onClick={() => setFilterSpotify('all')} style={{ marginBottom: 8, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[['all','All'],['linked','Linked'],['unlinked','Unlinked']].map(([id, label]) => (
              <button key={id} onClick={() => setFilterSpotify(id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterSpotify===id ? '#a78bfa' : '#0c0c14', color: filterSpotify===id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterSpotify===id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace", fontWeight: filterSpotify===id ? 700 : 400 }}>{label}</button>
            ))}
          </div>
        </div>
      )}
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
              {sortBy === 'count' && i < 3 ? (
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: ['#facc15', '#cbd5e1', '#d97706'][i], color: '#0c0c14', fontSize: 10, fontWeight: 800, fontFamily: "'DM Mono', monospace",
                }}>{i + 1}</span>
              ) : (
                <span style={{ color: '#4a4870', fontSize: 10, fontFamily: "'DM Mono', monospace", width: 20, textAlign: 'right', flexShrink: 0 }}>
                  {sortBy === 'count' ? `#${i+1}` : null}
                </span>
              )}
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

function ArtistShowRow({ concert, onOpen, showArtist = true }) {
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
          {showArtist && <span style={{ fontSize: 13, color: "#e2e0ff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{concert.artist}</span>}
          <span style={{ fontSize: 13, color: showArtist ? "#6b6a8f" : "#e2e0ff", fontWeight: showArtist ? 500 : 500, flexShrink: 0 }}>{showArtist ? `· ${formatDate(concert.date)}` : formatDate(concert.date)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
          {online ? formatOnlineLocation(concert) : <>{concert.venue}{concert.room ? ` · ${concert.room}` : ""} · {concert.city}</>}
        </div>
        {concert.tour && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2 }}>{concert.tour}</div>}
        {getFriends(concert).length > 0 && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2 }}>w. {getFriends(concert).join(", ")}</div>}
        {concert.rating && <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 3 }}>{"★".repeat(Math.min(concert.rating, 10))}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {ticketTotal(concert) > 0 && <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>€{ticketTotal(concert).toFixed(2)}</div>}
        {!past && <div style={{ fontSize: 9, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>upcoming</div>}
      </div>
    </button>
  );
}

function VenuesView({ concerts, onOpen, settings, onUpdateSetting = () => {}, onNavigate = () => {}, onDetailChange = () => {}, initialSelectedVenue = null, onInitialVenueConsumed = () => {}, onBackToOrigin = null }) {
  const [selectedVenue, setSelectedVenue] = useState(initialSelectedVenue);
  const [enteredViaVenue] = useState(initialSelectedVenue);
  useEffect(() => { if (initialSelectedVenue) { setSelectedVenue(initialSelectedVenue); onInitialVenueConsumed(); } }, [initialSelectedVenue]);
  const goBackFromVenue = () => {
    if (selectedVenue && selectedVenue === enteredViaVenue && onBackToOrigin) onBackToOrigin();
    else setSelectedVenue(null);
  };
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('most-visited');
  const [showSort, setShowSort] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterWantToGo, setFilterWantToGo] = useState(false);
  const [filterMinVisited, setFilterMinVisited] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [showVenuePast, setShowVenuePast] = useState(false);
  const [showVenueUpcoming, setShowVenueUpcoming] = useState(false);
  const [editingVenueInfo, setEditingVenueInfo] = useState(false);
  const [venueEditInput, setVenueEditInput] = useState({ url: '', parking: '', transit: '', rooms: [], tags: [] });
  const [newRoomInput, setNewRoomInput] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [showVenuesMap, setShowVenuesMap] = useState(false);
  const [openVenueInfoPopup, setOpenVenueInfoPopup] = useState(null);
  const [showAddVenueForm, setShowAddVenueForm] = useState(false);
  const [addVenueInput, setAddVenueInput] = useState({ name: '', city: '', country: '' });
  const [addVenueSaving, setAddVenueSaving] = useState(false);
  const [addVenueError, setAddVenueError] = useState(null);
  useEffect(() => { setShowVenuePast(false); setShowVenueUpcoming(false); setEditingVenueInfo(false); setOpenVenueInfoPopup(null); }, [selectedVenue]);
  useEffect(() => { onDetailChange(selectedVenue !== null); return () => onDetailChange(false); }, [selectedVenue]);

  useBackButton(goBackFromVenue, selectedVenue !== null);

  // Build venue map — online/streamed shows are excluded: the "venue" field on
  // those just describes where the artist performed from, not anywhere you
  // actually went, so they shouldn't count as a visited (or upcoming) place.
  const venueMap = {};
  concerts.filter(c => !isWish(c) && c.venue && !isOnline(c)).forEach(c => {
    const key = c.venue.trim();
    if (!venueMap[key]) venueMap[key] = [];
    venueMap[key].push(c);
  });

  const venueEntries = Object.entries(venueMap).map(([name, shows]) => {
    const past = shows.filter(c => isPast(c.date));
    const upcoming = shows.filter(c => !isPast(c.date));
    const rated = past.filter(c => c.rating);
    const avgRating = rated.length ? rated.reduce((s, c) => s + c.rating, 0) / rated.length : null;
    const priced = past.filter(c => ticketTotal(c) > 0);
    const avgTicket = priced.length ? priced.reduce((s, c) => s + ticketTotal(c), 0) / priced.length : null;
    const city = shows[0]?.city || null;
    const country = shows[0]?.country || null;
    const lastVisit = past.sort((a,b) => b.date.localeCompare(a.date))[0] || null;
    const photos = past.filter(c => c.photo);
    const mapShape = shows.length > 0 && shows.every(c => c.type === 'festival') ? 'diamond' : 'pin';
    return { name, shows, past, upcoming, pastCount: past.length, avgRating, avgTicket, city, country, lastVisit, photos, mapShape };
  });

  // Venues you haven't logged a show at yet, but want to — kept separate from
  // real (attended) venues so they never get counted in stats/spend.
  const existingNames = new Set(venueEntries.map(v => v.name.toLowerCase()));
  const wantToVisitVenues = (settings.wantToVisitVenues || []).filter(w => !existingNames.has(w.name.toLowerCase()));
  wantToVisitVenues.forEach(w => {
    venueEntries.push({
      name: w.name, shows: [], past: [], upcoming: [], pastCount: 0, avgRating: null, avgTicket: null,
      city: w.city || null, country: w.country || null, lastVisit: null, photos: [], mapShape: 'pin', wantToVisit: true,
    });
  });

  const allVenueCountries = [...new Set(venueEntries.map(v => v.country).filter(Boolean))].sort();
  const activeFilterCount = [filterCountry !== 'all', filterWantToGo, filterMinVisited > 0].filter(Boolean).length;
  const sorted = venueEntries
    .filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()))
    .filter(v => filterType === 'all' || (filterType === 'concerts' ? v.past.some(c => c.type !== 'festival') : v.past.some(c => c.type === 'festival')))
    .filter(v => filterCountry === 'all' || v.country === filterCountry)
    .filter(v => !filterWantToGo || v.wantToVisit)
    .filter(v => filterMinVisited === 0 || v.pastCount >= filterMinVisited)
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
    const totalSpent = v.past.reduce((s, c) => s + ticketTotal(c) + (c.merch || []).reduce((m, x) => m + (parseFloat(x.price) || 0), 0), 0);
    const artists = [...new Set(v.past.map(c => c.artist))];
    const friendCount = {};
    v.past.forEach(c => getFriends(c).forEach(f => { friendCount[f] = (friendCount[f] || 0) + 1; }));
    const topFriend = Object.entries(friendCount).sort((a,b) => b[1]-a[1])[0] || null;
    const rooms = [...new Set(v.past.filter(c => c.room).map(c => c.room))];
    return (
      <div style={{ padding: '0 0 100px' }}>
        {/* Sticky header, matching the show detail page */}
        <div style={{ position: 'sticky', top: 0, background: '#0c0c14', borderBottom: '1px solid #1e3028', padding: '16px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
          <button onClick={goBackFromVenue} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: '#e2e0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedVenue}</div>
            <DetailSubtitle lines={[
              [v.city, v.country],
              [`${v.pastCount}× visited`, v.upcoming.length > 0 ? `${v.upcoming.length} upcoming` : null],
            ]} />
          </div>
        </div>

        {/* Hero: maps / website / parking / transit / edit */}
        <div style={{ padding: '14px 16px 0' }}>
          {(() => {
            const vInfo = (settings.venueInfo || {})[selectedVenue] || {};
            const websiteUrl = vInfo.url || (settings.venueUrls || {})[selectedVenue] || '';
            const mapsQuery = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([selectedVenue, q, v.city, v.country].filter(Boolean).join(' '))}`;
            const iconStroke = { stroke: '#9d9bc0', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
            const ICONS = {
              pin: <svg width="12" height="12" viewBox="0 0 24 24" {...iconStroke}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>,
              link: <svg width="12" height="12" viewBox="0 0 24 24" {...iconStroke}><path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>,
              car: <svg width="12" height="12" viewBox="0 0 24 24" {...iconStroke}><path d="M5 17h14M5 17a1.5 1.5 0 0 1-1.5-1.5V13l1.7-4.5A2 2 0 0 1 7.1 7h9.8a2 2 0 0 1 1.9 1.5L20.5 13v2.5A1.5 1.5 0 0 1 19 17"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>,
              transit: <svg width="12" height="12" viewBox="0 0 24 24" {...iconStroke}><rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 12h16M8 17v2M16 17v2"/><circle cx="8" cy="8.5" r="0.5"/><circle cx="16" cy="8.5" r="0.5"/></svg>,
              info: <svg width="11" height="11" viewBox="0 0 24 24" {...iconStroke}><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 8v.01"/></svg>,
              edit: <svg width="12" height="12" viewBox="0 0 24 24" {...iconStroke}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>,
            };
            const chipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#13131f', border: '1px solid #1f1f35', borderRadius: 99, padding: '5px 10px', color: '#9d9bc0', fontSize: 10, fontFamily: "'DM Mono', monospace", textDecoration: 'none', cursor: 'pointer' };
            // A chip for an optional field: icon + label, an (i) that reveals the raw
            // text you typed, and a separate pin that opens Maps for that spot.
            const InfoChip = ({ id, icon, label, text }) => (
              <button onClick={() => setOpenVenueInfoPopup(p => p === id ? null : id)} style={{ ...chipStyle, flexShrink: 0 }} aria-label={`${label} info`}>
                {icon} {label}
              </button>
            );
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
                  <a href={mapsQuery()} target="_blank" rel="noopener noreferrer" style={{ ...chipStyle, flexShrink: 0 }}>{ICONS.pin} Maps</a>
                  {websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={{ ...chipStyle, flexShrink: 0 }}>{ICONS.link} Website</a>}
                  {vInfo.parking && settings.showVenueParking !== false && <InfoChip id="parking" icon={ICONS.car} label="Parking" text={vInfo.parking} />}
                  {vInfo.transit && settings.showVenueTransit !== false && <InfoChip id="transit" icon={ICONS.transit} label="Transit" text={vInfo.transit} />}
                  <button onClick={() => {
                    setVenueEditInput({ url: websiteUrl, parking: vInfo.parking || '', transit: vInfo.transit || '', rooms: vInfo.rooms && vInfo.rooms.length > 0 ? vInfo.rooms : rooms, tags: vInfo.tags || [] });
                    setEditingVenueInfo(true);
                  }} aria-label="Edit venue" style={{ ...chipStyle, flexShrink: 0, width: 26, height: 26, padding: 0, justifyContent: 'center' }}>{ICONS.edit}</button>
                </div>
                {openVenueInfoPopup === 'parking' && vInfo.parking && (
                  <div style={{ marginTop: 6, background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#c4c2f0', maxWidth: 280 }}>{vInfo.parking}</div>
                )}
                {openVenueInfoPopup === 'transit' && vInfo.transit && (
                  <div style={{ marginTop: 6, background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#c4c2f0', maxWidth: 280 }}>{vInfo.transit}</div>
                )}
              </>
            );
          })()}
        </div>

        {/* Edit venue modal */}
        {editingVenueInfo && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: '#000000cc', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', maxHeight: '85vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: '#13131f', borderRadius: '16px 16px 0 0', padding: '20px 20px 40px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#e2e0ff' }}>Edit venue</div>
                <button onClick={() => setEditingVenueInfo(false)} style={{ background: 'none', border: 'none', color: '#6b6a8f', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
              </div>
              {[
                { key: 'url', label: 'Website', placeholder: 'https://venue-website.com' },
                { key: 'parking', label: 'Parking', placeholder: 'e.g. P+R De Uithof, or a street name' },
                { key: 'transit', label: 'Public transport', placeholder: 'e.g. Amsterdam Centraal, tram 5' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
                  <input
                    value={venueEditInput[key] || ''}
                    onChange={e => setVenueEditInput(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Rooms / stages</div>
                <TagManager
                  items={venueEditInput.rooms || []}
                  onRemove={room => setVenueEditInput(p => ({ ...p, rooms: p.rooms.filter(r => r !== room) }))}
                  input={newRoomInput}
                  onInput={setNewRoomInput}
                  onAdd={() => { const v2 = newRoomInput.trim(); if (!v2) return; setVenueEditInput(p => ({ ...p, rooms: [...new Set([...(p.rooms || []), v2])] })); setNewRoomInput(''); }}
                  placeholder="Add room / stage..."
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Tags</div>
                <TagManager
                  items={venueEditInput.tags || []}
                  onRemove={tag => setVenueEditInput(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }))}
                  input={newTagInput}
                  onInput={setNewTagInput}
                  onAdd={() => { const v2 = newTagInput.trim(); if (!v2) return; setVenueEditInput(p => ({ ...p, tags: [...new Set([...(p.tags || []), v2])] })); setNewTagInput(''); }}
                  placeholder="e.g. big venue, great sound..."
                />
              </div>
              <button onClick={() => {
                const next = { ...(settings.venueInfo || {}) };
                const { url, parking, transit, rooms: editedRooms, tags: editedTags } = venueEditInput;
                const cleaned = { url: url.trim(), parking: parking.trim(), transit: transit.trim(), rooms: editedRooms || [], tags: editedTags || [] };
                if (cleaned.url || cleaned.parking || cleaned.transit || cleaned.rooms.length || cleaned.tags.length) next[selectedVenue] = cleaned;
                else delete next[selectedVenue];
                onUpdateSetting('venueInfo', next);
                setEditingVenueInfo(false);
              }} style={{ width: '100%', background: '#a78bfa', border: 'none', borderRadius: 10, color: '#0c0c14', fontSize: 14, fontWeight: 700, padding: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Save</button>
            </div>
          </div>
        )}
        {!v.wantToVisit && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '14px 16px 0' }}>
          <div style={{ background: '#13131f', borderRadius: 10, padding: '9px 4px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{v.pastCount}×</div>
            <div style={{ fontSize: 8, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>visited</div>
          </div>
          {totalSpent > 0 && (
            <div style={{ background: '#13131f', borderRadius: 10, padding: '9px 4px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>€{totalSpent.toFixed(0)}</div>
              <div style={{ fontSize: 8, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>total spent</div>
            </div>
          )}
          {v.avgRating && (
            <div style={{ background: '#13131f', borderRadius: 10, padding: '9px 4px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>★{v.avgRating.toFixed(1)}</div>
              <div style={{ fontSize: 8, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>avg rating</div>
            </div>
          )}
          {artists.length > 0 && (
            <div style={{ background: '#13131f', borderRadius: 10, padding: '9px 4px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{artists.length}</div>
              <div style={{ fontSize: 8, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>artists</div>
            </div>
          )}
        </div>
        )}
        {v.wantToVisit && (
          <div style={{ padding: '14px 16px 0' }}>
            <button onClick={() => {
              const next = (settings.wantToVisitVenues || []).filter(w => w.name.toLowerCase() !== selectedVenue.toLowerCase());
              onUpdateSetting('wantToVisitVenues', next);
              setSelectedVenue(null);
            }} style={{ background: 'none', border: '1px solid #2e2e50', borderRadius: 8, color: '#6b6a8f', fontSize: 11, padding: '7px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
              Remove from want-to-go list
            </button>
          </div>
        )}
        {(() => {
          const vInfo = (settings.venueInfo || {})[selectedVenue] || {};
          const showRooms = settings.showVenueRooms !== false;
          const showTags = settings.showVenueTags !== false;
          const displayRooms = showRooms ? (vInfo.rooms && vInfo.rooms.length > 0 ? vInfo.rooms : rooms) : [];
          const displayTags = showTags ? (vInfo.tags || []) : [];
          if (displayRooms.length === 0 && displayTags.length === 0) return null;
          return (
            <div style={{ padding: '10px 16px 0' }}>
              {displayRooms.length > 0 && <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginBottom: displayTags.length > 0 ? 6 : 0 }}>Rooms/stages: {displayRooms.join(', ')}</div>}
              {displayTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {displayTags.map(t => (
                    <span key={t} style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", padding: '3px 8px', borderRadius: 99, background: '#1a1a30', color: '#9d9bc0' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Mini map */}
        {(() => {
          const vInfo = (settings.venueInfo || {})[selectedVenue] || {};
          if (typeof vInfo.lat !== 'number') return null;
          const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([selectedVenue, v.city, v.country].filter(Boolean).join(' '))}`;
          return (
            <div style={{ padding: '12px 16px 0', position: 'relative' }}>
              <VenueMap points={[{ name: selectedVenue, lat: vInfo.lat, lng: vInfo.lng, pastCount: v.pastCount, upcomingCount: v.upcoming.length, shape: v.mapShape, wantToVisit: v.wantToVisit }]} focus={{ lat: vInfo.lat, lng: vInfo.lng, zoom: 14 }} interactive={false} showZoomControl clickOpensMaps height={130} />
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', top: 20, right: 24, background: '#0c0c14dd', border: '1px solid #2e2e50', borderRadius: 8, padding: '4px 8px', fontSize: 10, color: '#c4c2f0', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                Open in Maps ↗
              </a>
            </div>
          );
        })()}

        {/* Photos */}
        {v.photos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }}>
            {v.photos.map(c => (
              <button key={c.id} onClick={() => onOpen(c)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                <PhotoImg path={c.photo} pos={c.photoPos} style={{ width: 128, aspectRatio: '16 / 10', borderRadius: 10 }} />
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
                  {ticketTotal(c) > 0 && <div style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace" }}>€{ticketTotal(c).toFixed(2)}</div>}
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
  return (
    <div style={{ padding: '0 0 100px' }}>
      {/* Overview: one headline stat, location breakdown, top 3 */}
      {!search && totalVenues > 0 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{totalVenues}</span>
            <span style={{ fontSize: 12, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>venues visited</span>
          </div>
          {(uniqueCities > 0 || uniqueCountries > 0) && (
            <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
              across {uniqueCities} cit{uniqueCities !== 1 ? 'ies' : 'y'}{uniqueCountries > 0 ? `, ${uniqueCountries} countr${uniqueCountries !== 1 ? 'ies' : 'y'}` : ''}
            </div>
          )}
        </div>
      )}
      {/* Type pills + map toggle */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
        {[['all','All'],['concerts','Shows'],['festivals','Fest']].map(([id,label]) => (
          <button key={id} onClick={() => setFilterType(id)} style={{ background:filterType===id?'#a78bfa':'none', border:`1px solid ${filterType===id?'#a78bfa':'#1f1f35'}`, borderRadius:99, padding:'5px 11px', cursor:'pointer', color:filterType===id?'#0c0c14':'#6b6a8f', fontSize:12, fontFamily:"'DM Mono', monospace", fontWeight:filterType===id?700:400, flexShrink:0 }}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowVenuesMap(m => !m)} style={{ background: showVenuesMap ? '#a78bfa' : 'none', border: `1px solid ${showVenuesMap ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: showVenuesMap ? '#0c0c14' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: showVenuesMap ? 700 : 400, flexShrink: 0 }}>
          Map
        </button>
        <button onClick={() => { setAddVenueInput({ name: '', city: '', country: '' }); setAddVenueError(null); setShowAddVenueForm(true); }} aria-label="Add a venue you want to visit" style={{ background: 'none', border: '1px solid #1f1f35', borderRadius: 99, width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a78bfa', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>+</button>
      </div>

      {/* Add a "want to visit" venue */}
      {showAddVenueForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: '#000000cc', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowAddVenueForm(false)}>
          <div style={{ width: '100%', background: '#13131f', borderRadius: '16px 16px 0 0', padding: '20px 20px 40px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#e2e0ff' }}>Venue you want to visit</div>
              <button onClick={() => setShowAddVenueForm(false)} style={{ background: 'none', border: 'none', color: '#6b6a8f', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 11, color: '#6b6a8f', marginBottom: 16, lineHeight: 1.5 }}>
              Name and city are needed to place it correctly on the map — a venue name alone is often ambiguous. Everything else (website, parking, transit, tags) can be added later from its own page.
            </div>
            {[
              { key: 'name', label: 'Venue name', placeholder: 'e.g. Wembley Arena', required: true },
              { key: 'city', label: 'City', placeholder: 'e.g. London', required: true },
              { key: 'country', label: 'Country (optional)', placeholder: 'e.g. United Kingdom', required: false },
            ].map(({ key, label, placeholder, required }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}{required && <span style={{ color: '#a78bfa' }}> *</span>}</div>
                <input
                  value={addVenueInput[key]}
                  onChange={e => { setAddVenueInput(p => ({ ...p, [key]: e.target.value })); setAddVenueError(null); }}
                  placeholder={placeholder}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
                />
              </div>
            ))}
            {addVenueError && (
              <div style={{ fontSize: 11, color: '#f87171', marginBottom: 12, lineHeight: 1.5 }}>{addVenueError}</div>
            )}
            <button disabled={!addVenueInput.name.trim() || !addVenueInput.city.trim() || addVenueSaving} onClick={async () => {
              const entry = { name: addVenueInput.name.trim(), city: addVenueInput.city.trim(), country: addVenueInput.country.trim() };
              if (!entry.name || !entry.city) return;
              setAddVenueSaving(true);
              setAddVenueError(null);
              const coords = await geocodeVenue(entry.name, entry.city, entry.country);
              setAddVenueSaving(false);
              if (!coords) {
                setAddVenueError("Couldn't find that on the map — check the spelling, or save it anyway without a map pin.");
                return;
              }
              const next = [...(settings.wantToVisitVenues || []), entry];
              onUpdateSetting('wantToVisitVenues', next);
              const info = { ...(settings.venueInfo || {}) };
              info[entry.name] = { ...(info[entry.name] || {}), ...coords };
              onUpdateSetting('venueInfo', info);
              setShowAddVenueForm(false);
              setSelectedVenue(entry.name);
            }} style={{ width: '100%', background: '#a78bfa', border: 'none', borderRadius: 10, color: '#0c0c14', fontSize: 14, fontWeight: 700, padding: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: !addVenueInput.name.trim() || !addVenueInput.city.trim() || addVenueSaving ? 0.5 : 1 }}>
              {addVenueSaving ? 'Finding it on the map…' : 'Add'}
            </button>
            {addVenueError && (
              <button onClick={() => {
                const entry = { name: addVenueInput.name.trim(), city: addVenueInput.city.trim(), country: addVenueInput.country.trim() };
                const next = [...(settings.wantToVisitVenues || []), entry];
                onUpdateSetting('wantToVisitVenues', next);
                setShowAddVenueForm(false);
                setSelectedVenue(entry.name);
              }} style={{ width: '100%', background: 'none', border: '1px solid #2e2e50', borderRadius: 10, color: '#6b6a8f', fontSize: 12, padding: '10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", marginTop: 8 }}>
                Save without a map pin
              </button>
            )}
          </div>
        </div>
      )}
      {/* Search + sort */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search venues..."
          style={{ flex: 1, minWidth: 0, background: '#0c0c14', border: '1px solid #1f1f35', borderRadius: 8, color: '#c4c2f0', padding: '7px 11px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' }}
        />
        <button onClick={() => setShowSort(s => !s)} style={{ background: showSort || sortBy !== 'most-visited' ? '#1a1a30' : 'none', border: `1px solid ${showSort || sortBy !== 'most-visited' ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: sortBy !== 'most-visited' ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: sortBy !== 'most-visited' ? 700 : 400, flexShrink: 0 }}>
          Sort{sortBy !== 'most-visited' ? ' ↕' : ''}
        </button>
        <button onClick={() => { setShowFilters(f => !f); setShowSort(false); }} style={{ background: showFilters || activeFilterCount > 0 ? '#1a1a30' : 'none', border: `1px solid ${showFilters || activeFilterCount > 0 ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: activeFilterCount > 0 ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: activeFilterCount > 0 ? 700 : 400, flexShrink: 0 }}>
          {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
        </button>
      </div>
      {showSort && (
        <div style={{ margin: '0 16px 8px', background: '#13131f', border: '1px solid #1f1f35', borderRadius: 10, padding: '10px 12px' }}>
          {sortBy !== 'most-visited' && <button onClick={() => setSortBy('most-visited')} style={{ marginBottom: 8, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[{id:'most-visited',label:'Most visited'},{id:'alpha',label:'A–Z'},{id:'recent',label:'Recently visited'},{id:'rating',label:'Best rated'}].map(s => (
              <button key={s.id} onClick={() => setSortBy(s.id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortBy === s.id ? '#a78bfa' : '#0c0c14', color: sortBy === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortBy === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
            ))}
          </div>
        </div>
      )}
      {showFilters && (
        <div style={{ margin: '0 16px 8px', background: '#13131f', border: '1px solid #1f1f35', borderRadius: 10, padding: '10px 12px' }}>
          {activeFilterCount > 0 && <button onClick={() => { setFilterCountry('all'); setFilterWantToGo(false); setFilterMinVisited(0); }} style={{ marginBottom: 8, background: 'none', border: 'none', color: '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>}
          {allVenueCountries.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Country</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button onClick={() => setFilterCountry('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterCountry === 'all' ? '#a78bfa' : '#0c0c14', color: filterCountry === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterCountry === 'all' ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
                {allVenueCountries.map(c => (
                  <button key={c} onClick={() => setFilterCountry(filterCountry === c ? 'all' : c)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterCountry === c ? '#a78bfa' : '#0c0c14', color: filterCountry === c ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterCountry === c ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{c}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Min. times visited</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[0, 2, 3, 5].map(n => (
                <button key={n} onClick={() => setFilterMinVisited(n)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterMinVisited === n ? '#a78bfa' : '#0c0c14', color: filterMinVisited === n ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterMinVisited === n ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{n === 0 ? 'Any' : `${n}+`}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Want to go</div>
            <button onClick={() => setFilterWantToGo(w => !w)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterWantToGo ? '#34d399' : '#0c0c14', color: filterWantToGo ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterWantToGo ? '#34d399' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Only want-to-go</button>
          </div>
        </div>
      )}

      {showVenuesMap && (() => {
        const mapPoints = sorted.map(v => {
          const info = (settings.venueInfo || {})[v.name] || {};
          return { name: v.name, lat: info.lat, lng: info.lng, pastCount: v.pastCount, upcomingCount: v.upcoming.length, shape: v.mapShape, country: v.country, wantToVisit: v.wantToVisit };
        }).filter(p => typeof p.lat === 'number');
        const useCountryDefault = settings.mapDefaultRegion === 'country' && settings.defaultCountry;
        const fitPoints = useCountryDefault ? mapPoints.filter(p => p.country === settings.defaultCountry) : null;
        return (
          <div style={{ padding: '0 16px' }}>
            <VenueMap points={mapPoints} fitPoints={fitPoints && fitPoints.length > 0 ? fitPoints : null} onSelect={name => setSelectedVenue(name)} />
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', overflowX: 'auto' }}>
              <span style={{ flexShrink: 0 }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', marginRight: 3 }} />visited</span>
              <span style={{ flexShrink: 0 }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#34d399', marginRight: 3 }} />upcoming</span>
              <span style={{ flexShrink: 0 }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#fbbf24', marginRight: 3 }} />want to go</span>
              <span style={{ flexShrink: 0 }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#6b6a8f', marginRight: 3 }} />concert</span>
              <span style={{ flexShrink: 0 }}><span style={{ display: 'inline-block', width: 7, height: 7, background: '#6b6a8f', marginRight: 3, transform: 'rotate(45deg)' }} />festival</span>
            </div>
          </div>
        );
      })()}

      {/* Venue list */}
      {!showVenuesMap && (
      <div style={{ padding: '0 16px' }}>
        {sorted.map(v => (
          <button key={v.name} onClick={() => setSelectedVenue(v.name)} style={{ width: '100%', textAlign: 'left', background: '#0e0e1a', border: '1px solid #1f1f35', borderLeft: `3px solid ${v.wantToVisit ? '#34d399' : v.pastCount >= 5 ? '#a78bfa' : v.pastCount >= 3 ? '#6d5fa8' : v.pastCount >= 2 ? '#3d3564' : '#2e2e4a'}`, borderRadius: 10, padding: '11px 14px', cursor: 'pointer', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 14, color: '#e2e0ff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                {v.wantToVisit && <span style={{ fontSize: 9, color: '#34d399', fontFamily: "'DM Mono', monospace", border: '1px solid #1e3a2e', borderRadius: 99, padding: '1px 6px', flexShrink: 0 }}>want to go</span>}
              </div>
              <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                {v.wantToVisit ? (v.city || v.country || 'no shows logged yet') : `${v.city ? `${v.city} · ` : ''}${v.pastCount}× past${v.upcoming.length > 0 ? ` · ${v.upcoming.length} upcoming` : ''}`}
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
      )}
    </div>
  );
}

function AddConcertForm({ onSave, onClose, settings = {}, onUpdateSetting = null, friends = [], allArtists = [], recentFriends = [], initialType = 'concert', initialAttendanceMode = 'in_person', initialWishlist = false, concerts = [] }) {
  useBackButton(onClose);
  const [pendingTag, setPendingTag] = useState(null);
  const [form, setForm] = useState({
    artist: '', date: '', endDate: '', venue: '', room: '', city: '', country: settings.defaultCountry || [...concerts].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.country || '',
    type: initialType === 'wish' ? 'concert' : initialType, wishlist: initialType === 'wish' || initialWishlist, tour: '', support: [], friends: [], solo: false,
    rating: null, tickets: [], merch: [], notes: '',
    ticketType: null, ticketAddons: [],
    genre: null, subgenre: null, language: [], venueSize: null, seenAs: 'Headliner',
    acts: [], attendanceMode: initialAttendanceMode, onlineType: 'concert', platform: '',
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', maxHeight: '94vh', background: '#0c0c14', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2e2e50' }} />
        </div>
        <div style={{ padding: '12px 20px 14px', borderBottom: '1px solid #1e3028', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: form.type === 'festival' ? '#f472b6' : '#e2e0ff' }}>{form.type === 'festival' ? 'Add festival' : 'Add concert'}</div>
            <button onClick={() => { update('type', form.type === 'festival' ? 'concert' : 'festival'); if (form.type !== 'festival') setShowDetails(true); }} style={{ background: 'none', border: 'none', padding: 0, marginTop: 1, cursor: 'pointer', fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", textDecoration: 'underline', textUnderlineOffset: 2 }}>
              switch to {form.type === 'festival' ? 'concert' : 'festival'}
            </button>
          </div>
          <button onClick={handleSave} style={{ background: '#a78bfa', border: '1px solid #a78bfa', color: '#0c0c14', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Save</button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
        {(() => {
          const isFest = form.type === 'festival';
          const sectionIcon = (svg, color) => (
            <div style={{ width: 26, height: 26, borderRadius: 8, background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{svg}</div>
          );
          const ICONS = {
            details: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>,
            acts: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
            experience: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17.3 6.2 21l1.6-6.6L2.5 10l6.7-.6L12 3.3l2.8 6.1 6.7.6-5.3 4.4 1.6 6.6z"/></svg>,
            financial: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 15.5c.5.8 1.4 1.3 2.5 1.3 1.5 0 2.5-.8 2.5-2s-1-1.7-2.5-2-2.5-.8-2.5-2 1-2 2.5-2c1.1 0 2 .5 2.5 1.3M12 6.5v11"/></svg>,
            notes: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>,
          };
          const card = (title, content) => (
            <div key={title} style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 14, padding: '16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1a1a2e' }}>
                {sectionIcon(ICONS.details, isFest ? '#f472b6' : '#a78bfa')}
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: '#e2e0ff' }}>{title}</div>
              </div>
              {content}
            </div>
          );
          const foldCard = (title, content, hasData = false) => {
            const open = openCards.includes(title);
            const iconMap = { 'Acts seen': ['acts', '#818cf8'], 'Your experience': ['experience', '#a78bfa'], 'Financial': ['financial', '#34d399'], 'Notes': ['notes', '#6b6a8f'] };
            const [iconKey, iconColor] = iconMap[title] || [null, '#a78bfa'];
            return (
              <div key={title} style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
                <button onClick={() => setOpenCards(o => open ? o.filter(t => t !== title) : [...o, title])} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {iconKey && sectionIcon(ICONS[iconKey], iconColor)}
                    <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: open ? '#e2e0ff' : '#9b97d4' }}>{title}{!open && hasData && <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 6 }}>●</span>}</span>
                  </span>
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
              <TicketsFields value={form.tickets} onChange={v => update('tickets', v)} labelStyle={{ fontSize: 11, color: '#6b6a8f', marginBottom: 6, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }} inputStyle={inputStyle} />
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
              {card(form.wishlist ? 'Want to go' : quickUpcoming ? 'Upcoming show' : 'Show details', <>
                <button onClick={() => update('wishlist', !form.wishlist)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: `1px solid ${form.wishlist ? '#34d399' : '#1f1f35'}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', marginBottom: 12, textAlign: 'left' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${form.wishlist ? '#34d399' : '#3d3564'}`, background: form.wishlist ? '#34d399' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#0c0c14', lineHeight: 1 }}>{form.wishlist ? '✓' : ''}</span>
                  <span style={{ fontSize: 12, color: form.wishlist ? '#34d399' : '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>No tickets yet — save as "want to go"</span>
                </button>
                <div style={{ marginBottom: 10, position: 'relative' }}>
                  {fieldLabel('Artist *')}
                  <input value={form.artist} onChange={e => handleArtistChange(e.target.value)} onBlur={() => setTimeout(() => setArtistSuggestions([]), 150)} placeholder="Artist name" style={errors.artist ? errStyle : inputStyle} />
                  {artistSuggestions.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 8, zIndex: 200, overflow: 'hidden', marginTop: 2 }}>{artistSuggestions.map(a => <button key={a} onMouseDown={() => selectArtist(a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #2e2e50', color: '#c4c2f0', cursor: 'pointer', fontSize: 13 }}>{a}</button>)}</div>}
                </div>
                {(form.wishlist || quickUpcoming) ? (
                  <div style={{ marginBottom: 10 }}>{fieldLabel(form.wishlist ? 'Date (if known)' : 'Date *')}<input type="date" value={form.date} onChange={e => update('date', e.target.value)} style={errors.date ? errStyle : inputStyle} /></div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>{fieldLabel('Date *')}<input type="date" value={form.date} onChange={e => update('date', e.target.value)} style={errors.date ? errStyle : inputStyle} /></div>
                    <div>{fieldLabel('Rating')}<div style={{ minHeight: 36, display: 'flex', alignItems: 'center' }}><StarRating value={form.rating} onChange={v => update('rating', v)} max={settings.ratingSystem || 5} /></div></div>
                  </div>
                )}
                {!form.wishlist && !quickUpcoming && <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <input value={sfUrl} onChange={e => setSfUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && fillFromSetlistUrl()} placeholder="✨ Paste setlist.fm link to auto-fill…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={fillFromSetlistUrl} disabled={!sfUrl.trim() || sfStatus === 'loading'} style={{ background: 'none', border: '1px solid #3d3564', borderRadius: 8, color: sfUrl.trim() ? '#a78bfa' : '#2e2e4a', fontSize: 12, padding: '0 14px', cursor: sfUrl.trim() ? 'pointer' : 'default', fontFamily: "'DM Mono', monospace" }}>{sfStatus === 'loading' ? '…' : 'Fill'}</button>
                </div>
                {sfMsg && <div style={{ fontSize: 10, color: sfStatus === 'error' ? '#f87171' : '#4ade80', fontFamily: "'DM Mono', monospace", marginBottom: 8, textAlign: 'center' }}>{sfMsg}</div>}
                <div style={{ height: 8 }} />
                {form.artist && form.date && (
                  <a href={`https://www.setlist.fm/search?query=${encodeURIComponent(form.artist)}+${form.date.slice(0,4)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginBottom: 10, background: 'none', border: '1px solid #3d3564', borderRadius: 8, color: '#a78bfa', fontSize: 12, padding: '8px', textDecoration: 'none', fontFamily: "'DM Mono', monospace", boxSizing: 'border-box' }}>
                    Find on setlist.fm ↗
                  </a>
                )}
                <button disabled={!form.artist || !form.date || sfStatus === 'loading'} onClick={autoFillFromSearch} style={{ width: '100%', marginBottom: 12, background: 'none', border: '1px dashed #3d3564', borderRadius: 8, color: (!form.artist || !form.date) ? '#2e2e4a' : '#a78bfa', fontSize: 12, padding: '8px', cursor: (!form.artist || !form.date) ? 'default' : 'pointer', fontFamily: "'DM Mono', monospace" }}>{sfStatus === 'loading' ? 'Searching setlist.fm…' : '✨ Auto-fill from setlist.fm (artist + date)'}</button>
                </>}
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
                {form.wishlist ? null : quickUpcoming
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
              {card(form.wishlist ? 'Want to go' : quickUpcoming ? 'Upcoming festival' : 'Festival details', <>
                <button onClick={() => update('wishlist', !form.wishlist)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: `1px solid ${form.wishlist ? '#34d399' : '#1f1f35'}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', marginBottom: 12, textAlign: 'left' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${form.wishlist ? '#34d399' : '#3d3564'}`, background: form.wishlist ? '#34d399' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#0c0c14', lineHeight: 1 }}>{form.wishlist ? '✓' : ''}</span>
                  <span style={{ fontSize: 12, color: form.wishlist ? '#34d399' : '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>No tickets yet — save as "want to go"</span>
                </button>
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
                {form.wishlist ? null : quickUpcoming
                  ? <div style={{ fontSize: 11, color: '#38bdf8', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: '8px 0' }}>📅 upcoming festival — acts & extras unlock after the date</div>
                  : <>
                    {fieldLabel('Went with')}
                    {experienceContent}
                  </>}
                <button onClick={() => setShowDetails(true)} style={{ width: '100%', marginTop: 14, minHeight: 40, borderRadius: 8, border: '1px solid #2e2e50', background: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{form.wishlist ? 'Add lineup (optional)' : 'More details (acts, money, notes…)'}</button>
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
              {!form.wishlist && !quickUpcoming && foldCard('Your experience', experienceContent, !!(form.rating || form.seenAs !== 'Headliner'))}
              {!form.wishlist && !quickUpcoming && foldCard('Financial', financialContent, !!((form.tickets || []).length || (form.merch || []).length))}
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>{(() => { const langs = Array.isArray(form.language) ? form.language : form.language ? [form.language] : []; return (settings.languages||[]).map(l => { const on = langs.includes(l); return <button key={l} onClick={()=>update('language', on ? langs.filter(x=>x!==l) : [...langs, l])} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: on ? '#a78bfa' : '#0c0c14', color: on ? '#0c0c14' : '#6b6a8f', border: `1px solid ${on ? '#a78bfa' : '#2e2e50'}`, fontWeight: on ? 700 : 400 }}>{l}</button>; }); })()}<AddNewTagPill onAdd={v => { const langs = Array.isArray(form.language) ? form.language : form.language ? [form.language] : []; update('language', [...langs, v]); setPendingTag({ value: v, settingsKey: 'languages', label: 'languages' }); }} /></div>
                {fieldLabel('Tags')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>{(settings.showTags || ['Cried']).map(t => { const on = (form.tags || []).includes(t); return <button key={t} onClick={() => update('tags', on ? (form.tags || []).filter(x => x !== t) : [...(form.tags || []), t])} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: on ? '#f472b6' : '#0c0c14', color: on ? '#0c0c14' : '#6b6a8f', border: `1px solid ${on ? '#f472b6' : '#2e2e50'}`, fontWeight: on ? 700 : 400 }}>{t}</button>; })}<AddNewTagPill accentColor="#f472b6" onAdd={v => { update('tags', [...(form.tags || []), v]); setPendingTag({ value: v, settingsKey: 'showTags', label: 'tags' }); }} /></div>
                {(() => {
                  const favoriteCount = concerts.filter(c => c.favorite && c.id !== concert.id).length;
                  const atLimit = favoriteCount >= 5 && !form.favorite;
                  return (
                    <button onClick={() => !atLimit && update('favorite', !form.favorite)} disabled={atLimit} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: `1px solid ${form.favorite ? '#facc15' : '#2e2e50'}`, borderRadius: 8, padding: '8px 12px', cursor: atLimit ? 'default' : 'pointer', opacity: atLimit ? 0.5 : 1 }}>
                      <span style={{ fontSize: 14, color: form.favorite ? '#facc15' : '#6b6a8f' }}>★</span>
                      <span style={{ fontSize: 12, color: form.favorite ? '#facc15' : '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>
                        {form.favorite ? 'One of your all-time favorites' : atLimit ? "All-time faves are full (5/5) — remove one first" : 'Mark as an all-time favorite'}
                      </span>
                    </button>
                  );
                })()}
              </>)}
              {!form.wishlist && !quickUpcoming && foldCard('Your experience', experienceContent, !!(form.rating || form.seenAs !== 'Headliner'))}
              {!form.wishlist && !quickUpcoming && foldCard('Financial', financialContent, !!((form.tickets || []).length || (form.merch || []).length))}
              {foldCard('Notes', <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Any notes..." />, !!form.notes)}
            </>
          );
        })()}
        </div>
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

// Full-width choice block: bold label + sub caption, then pills that fill the
// row and wrap — matches the "Property Type" pattern from the reference
// (as opposed to SettingsRow+SettingsOptionPills, which crams small pills
// right-aligned next to a label — fine for a quick binary choice, wrong for
// a primary preference with several options).
function PreferenceBlock({ label, sub, value, options, onChange, isLast = false, compact = false }) {
  return (
    <div style={{ padding: "14px 2px", borderBottom: isLast ? "none" : "1px solid #1a1a24" }}>
      <div style={{ fontSize: 14, color: "#e2e0ff", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, marginBottom: sub ? 2 : 10 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>{sub}</div>}
      <div style={{ display: "flex", flexWrap: compact ? "nowrap" : "wrap", gap: compact ? 4 : 8 }}>
        {options.map(o => (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            padding: compact ? "6px 4px" : "9px 16px", borderRadius: compact ? 8 : 99, fontSize: compact ? 11 : 13, cursor: "pointer",
            background: value === o.id ? "#a78bfa" : "transparent",
            color: value === o.id ? "#0c0c14" : "#c4c2f0",
            border: `1.5px solid ${value === o.id ? "#a78bfa" : "#2e2e48"}`,
            fontWeight: value === o.id ? 700 : 500, fontFamily: "'DM Sans', sans-serif",
            flex: compact ? "1 1 0" : "0 0 auto", minWidth: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

// Real slider for wide-range numeric settings (native <input type=range> —
// cheap, accessible, accent-color themes it automatically). Reserved for
// ranges wide enough that a stepper would mean many taps; narrow ranges
// (e.g. 3–6) stay as SettingsStepper, where a slider would be fiddly.
function SettingsSliderRow({ label, sub, value, min, max, onChange, isLast = false }) {
  return (
    <div style={{ padding: "14px 2px", borderBottom: isLast ? "none" : "1px solid #1a1a24" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 14, color: "#e2e0ff", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{value}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{sub}</div>}
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#a78bfa", marginTop: 10, height: 4 }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{min}</span>
        <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{max}</span>
      </div>
    </div>
  );
}

// Minimal monoline section icons — same stroke language already used in the
// Help section (stroke="#a78bfa" strokeWidth=1.8, no fill). One per section
// header rather than one per row: a full per-row icon set (~25 distinct,
// recognizable glyphs) isn't realistic to hand-draw well without an icon
// library, and mediocre icons read worse than none. Section-level anchoring
// gets most of the visual benefit from the reference for a fraction of the cost.
const SETTINGS_ICONS = {
  help: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
  online: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  card: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>,
  sliders: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 12h6"/></svg>,
  layout: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  person: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  plug: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v6M15 2v6M6 8h12l-1 6a5 5 0 0 1-5 4 5 5 0 0 1-5-4L6 8z"/><path d="M12 18v4"/></svg>,
  data: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 12.6 12 21.2 2.8 12 2.8 2.8 12 2.8l8.6 8.6a2 2 0 0 1 0 2.9z"/><circle cx="7.3" cy="7.3" r="1"/></svg>,
};

function SettingsSectionIcon({ id }) {
  const svg = SETTINGS_ICONS[id];
  if (!svg) return null;
  return <span style={{ width: 14, height: 14, display: "inline-flex", flexShrink: 0 }}>{svg}</span>;
}

function SettingsSection({ title, icon, children, collapsible = false, defaultOpen = true, subtitle = null }) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = !collapsible || open;
  return (
    <div style={{ marginBottom: 22 }}>
      {collapsible ? (
        <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 8px 4px' }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.10em" }}>
            {icon && <SettingsSectionIcon id={icon} />}
            {title}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isOpen && subtitle && <span style={{ fontSize: 10, color: subtitle.color || '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>{subtitle.label}</span>}
            <span style={{ fontSize: 10, color: '#4a4870', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
          </span>
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.10em", margin: "0 0 8px 4px" }}>
          {icon && <SettingsSectionIcon id={icon} />}
          {title}
        </div>
      )}
      {isOpen && <div style={{ background: "#111119", borderRadius: 14, padding: "2px 12px", overflow: "hidden" }}>{children}</div>}
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
  const handleRatingSystemChange = async (newScaleStr) => {
    const newScale = Number(newScaleStr);
    const oldScale = Number(local.ratingSystem || 5);
    if (newScale === oldScale) return;

    // Remember exactly what ratings looked like on the scale we're leaving,
    // so switching back later restores the originals instead of re-deriving
    // them (which would compound rounding loss on a 10→5→10 round trip).
    const snapshots = { ...(settings.ratingSnapshots || {}) };
    const leavingSnapshot = {};
    concerts.forEach(c => { if (c.rating) leavingSnapshot[c.id] = c.rating; });
    snapshots[String(oldScale)] = leavingSnapshot;

    const arrivingSnapshot = snapshots[String(newScale)] || {};
    const ratio = newScale / oldScale;
    const updates = [];
    concerts.forEach(c => {
      if (!c.rating) return;
      const remembered = arrivingSnapshot[c.id];
      const converted = remembered != null ? remembered : (ratio > 1 ? Math.round(c.rating * ratio) : Math.floor(c.rating * ratio));
      if (converted !== c.rating) updates.push({ ...c, rating: converted });
    });

    lUpdate("ratingSystem", newScale);
    onUpdate("ratingSystem", newScale);
    lUpdate("ratingSnapshots", snapshots);
    onUpdate("ratingSnapshots", snapshots);
    if (onSaveConcert) await Promise.all(updates.map(c => onSaveConcert(c)));
  };

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
      icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="#a78bfa"><path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161"/></svg>
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
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5" fill="#a78bfa" stroke="none"/></svg>
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
    const headers = ['ID','Date','Artist','Venue','Room','City','Country','Type','Tour','Genre','SubGenre','Language','Rating','TicketPrice','TicketItems','Merch','Favorite','Tags','CriedSong','Friends','Solo','VenueSize','Notes'];
    const rows = concerts.map(c => [
      c.id, c.date, c.artist, c.venue, c.room||'', c.city, c.country, c.type, c.tour||'',
      c.genre||'', c.subgenre||'', (Array.isArray(c.language) ? c.language.join('; ') : c.language||''), c.rating||'', ticketTotal(c)||'',
      (c.tickets||[]).map(t => `${t.name||'Ticket'}:${t.price||0}`).join('; '),
      (c.merch||[]).map(m => `${m.item||'Item'}:${m.price||0}`).join('; '),
      c.favorite ? 'yes' : '', (c.tags||[]).join('; '), c.criedSong || '',
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
      Rating: c.rating || '', TicketPrice: ticketTotal(c) || '',
      TicketItems: (c.tickets||[]).map(t => `${t.name||'Ticket'}:${t.price||0}`).join('; '),
      Merch: (c.merch||[]).map(m => `${m.item||'Item'}:${m.price||0}`).join('; '),
      Favorite: c.favorite ? 'yes' : '', Tags: (c.tags||[]).join('; '), CriedSong: c.criedSong || '',
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
        tickets: obj.TicketItems ? obj.TicketItems.split('; ').filter(Boolean).map(s => { const idx = s.lastIndexOf(':'); return { name: idx > -1 ? s.slice(0, idx) : s, price: idx > -1 ? parseFloat(s.slice(idx + 1)) || 0 : 0 }; }) : [],
        merch: obj.Merch ? obj.Merch.split('; ').filter(Boolean).map(s => { const idx = s.lastIndexOf(':'); return { item: idx > -1 ? s.slice(0, idx) : s, price: idx > -1 ? parseFloat(s.slice(idx + 1)) || 0 : 0 }; }) : [],
        favorite: obj.Favorite === 'yes', tags: obj.Tags ? obj.Tags.split('; ').filter(Boolean) : [], criedSong: obj.CriedSong || null,
        friends: obj.Friends ? obj.Friends.split('; ').filter(Boolean) : [],
        solo: obj.Solo === 'yes', venueSize: obj.VenueSize || null, notes: obj.Notes || null,
        seenAs: obj.SeenAs || null, support: [],
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
          tickets: r.TicketItems ? String(r.TicketItems).split('; ').filter(Boolean).map(s => { const idx = s.lastIndexOf(':'); return { name: idx > -1 ? s.slice(0, idx) : s, price: idx > -1 ? parseFloat(s.slice(idx + 1)) || 0 : 0 }; }) : [],
          merch: r.Merch ? String(r.Merch).split('; ').filter(Boolean).map(s => { const idx = s.lastIndexOf(':'); return { item: idx > -1 ? s.slice(0, idx) : s, price: idx > -1 ? parseFloat(s.slice(idx + 1)) || 0 : 0 }; }) : [],
          favorite: r.Favorite === 'yes', tags: r.Tags ? String(r.Tags).split('; ').filter(Boolean) : [], criedSong: r.CriedSong || null,
          friends: r.Friends ? r.Friends.split('; ').filter(Boolean) : [],
          solo: r.Solo === 'yes', venueSize: r.VenueSize || null, notes: r.Notes || null,
          seenAs: r.SeenAs || null, support: [],
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
            {/* Help links */}
            <SettingsSection title="Help" icon="help">
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

            {/* Social links — quiet footer credit instead of its own card */}
            <div style={{ textAlign: "center", padding: "18px 10px 4px", fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1.8 }}>
              <div>Built by <span style={{ color: "#6b6a8f" }}>@annuhfloor</span></div>
              <div>
                {socialLinks.map(({ href, label }, i) => (
                  <span key={label}>
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa", textDecoration: "none" }}>{label}</a>
                    {i < socialLinks.length - 1 && <span style={{ color: "#3a3858" }}> &nbsp;/&nbsp; </span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {activeSettingsTab === 'preferences' && <>
        <SettingsSection title="Opening defaults" icon="eye">
          <SettingsRow label="Show past concerts" sub="On by default when opening app">
            <SettingsToggle checked={local.defaultShowPast === 'open'} onChange={checked => { const v = checked ? 'open' : 'closed'; lUpdate("defaultShowPast", v); onUpdate("defaultShowPast", v); }} />
          </SettingsRow>
          <SettingsRow label="Show wishlist" sub="Include want-to-go entries">
            <SettingsToggle checked={local.defaultShowWishlist === 'open'} onChange={checked => { const v = checked ? 'open' : 'closed'; lUpdate("defaultShowWishlist", v); onUpdate("defaultShowWishlist", v); }} />
          </SettingsRow>
          <SettingsRow label="Show upcoming" sub="On by default when opening app">
            <SettingsToggle checked={local.defaultShowUpcoming !== 'closed'} onChange={checked => { const v = checked ? 'open' : 'closed'; lUpdate("defaultShowUpcoming", v); onUpdate("defaultShowUpcoming", v); }} />
          </SettingsRow>
          <PreferenceBlock label="Default view" sub="What shows first on open" value={local.defaultTab} options={defaultViewOptions} onChange={v => { lUpdate("defaultTab", v); onUpdate("defaultTab", v); }} isLast compact />
        </SettingsSection>

        <SettingsSection title="Concert cards" icon="card">
          <SettingsRow label="Show venue" sub="Display venue name on cards">
            <SettingsToggle checked={local.showVenueOnCards !== false} onChange={checked => { lUpdate("showVenueOnCards", checked); onUpdate("showVenueOnCards", checked); }} />
          </SettingsRow>
          <SettingsRow label="Show genre tags" sub="Tags visible on concert cards">
            <SettingsToggle checked={local.showGenreTagsOnCards !== false} onChange={checked => { lUpdate("showGenreTagsOnCards", checked); onUpdate("showGenreTagsOnCards", checked); }} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Concert list" icon="list">
          <SettingsRow label="Group by year" sub="Year headers in concert list">
            <SettingsToggle checked={!!local.groupByYear} onChange={checked => { lUpdate("groupByYear", checked); onUpdate("groupByYear", checked); }} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Venue details" icon="layout">
          <SettingsRow label="Parking" sub="Show the parking link on venue pages">
            <SettingsToggle checked={local.showVenueParking !== false} onChange={checked => { lUpdate("showVenueParking", checked); onUpdate("showVenueParking", checked); }} />
          </SettingsRow>
          <SettingsRow label="Public transport" sub="Show the transit link on venue pages">
            <SettingsToggle checked={local.showVenueTransit !== false} onChange={checked => { lUpdate("showVenueTransit", checked); onUpdate("showVenueTransit", checked); }} />
          </SettingsRow>
          <SettingsRow label="Rooms / stages" sub="Show saved rooms on venue pages">
            <SettingsToggle checked={local.showVenueRooms !== false} onChange={checked => { lUpdate("showVenueRooms", checked); onUpdate("showVenueRooms", checked); }} />
          </SettingsRow>
          <SettingsRow label="Tags" sub='Show venue tags (e.g. "big venue")'>
            <SettingsToggle checked={local.showVenueTags !== false} onChange={checked => { lUpdate("showVenueTags", checked); onUpdate("showVenueTags", checked); }} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Summary & stats" icon="chart">
          <PreferenceBlock
            label="Summary scope" sub="Default time range on summary page"
            value={local.summaryYear || 'all'}
            options={[{ id: 'all', label: 'All time' }, { id: String(new Date().getFullYear()), label: String(new Date().getFullYear()) }]}
            onChange={v => { onUpdate('summaryYear', v); lUpdate('summaryYear', v); }}
          />
          <SettingsRow label="Top artists" sub="Rows shown in charts">
            <SettingsStepper value={local.topArtistsRows} onChange={v => { lUpdate("topArtistsRows", v); onUpdate("topArtistsRows", v); }} max={6} />
          </SettingsRow>
          <SettingsSliderRow label="Top friends" sub="Rows shown in charts" value={local.topFriendsRows} min={3} max={20} onChange={v => { lUpdate("topFriendsRows", v); onUpdate("topFriendsRows", v); }} />
          <SettingsSliderRow label="Top venues" sub="Rows shown in charts" value={local.topVenuesRows} min={3} max={20} onChange={v => { lUpdate("topVenuesRows", v); onUpdate("topVenuesRows", v); }} />
          <SettingsSliderRow label="Most expensive" sub="Rows shown in list" value={local.topExpensiveRows} min={3} max={20} onChange={v => { lUpdate("topExpensiveRows", v); onUpdate("topExpensiveRows", v); }} />
          <SettingsSliderRow label="Songs shown" sub="Default rows in Songs tab" value={local.topSongsRows} min={3} max={50} onChange={v => { lUpdate("topSongsRows", v); onUpdate("topSongsRows", v); }} isLast />
        </SettingsSection>

        <SettingsSection title="App" icon="sliders">
          <PreferenceBlock
            label="Appearance" sub="Same color theme, flipped background/text"
            value={local.lightMode ? 'light' : 'dark'}
            options={[{id:'dark',label:'Dark'},{id:'light',label:'Light'}]}
            onChange={v => { const val = v === 'light'; onUpdate('lightMode', val); lUpdate('lightMode', val); }}
          />
          <PreferenceBlock
            label="Color theme" sub="Changes instantly, no save needed"
            value={local.colorTheme || 'purple'}
            options={[{id:'purple',label:'Purple'},{id:'blue',label:'Blue'},{id:'green',label:'Green'},{id:'red',label:'Red'},{id:'orange',label:'Orange'},{id:'mono',label:'Mono'}]}
            onChange={v => { onUpdate('colorTheme', v); lUpdate('colorTheme', v); }}
          />
          <PreferenceBlock label="Rating system" sub="Existing ratings are converted automatically" value={String(local.ratingSystem || 5)} options={[{id:"5",label:"5 stars"},{id:"10",label:"10 stars"}]} onChange={handleRatingSystemChange} />
          <SettingsRow label="Default country" sub="Pre-filled when adding a show">
            <input value={local.defaultCountry || ''} onChange={e => lUpdate('defaultCountry', e.target.value)} placeholder="e.g. Netherlands" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid #2e2e50', borderRadius: 8, color: '#c4c2f0', padding: '6px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
          </SettingsRow>
          <PreferenceBlock
            label="Default map view" sub={local.defaultCountry ? `Where the venues map opens` : 'Set a default country above to enable'}
            value={local.mapDefaultRegion === 'country' && local.defaultCountry ? 'country' : 'all'}
            options={[{ id: 'all', label: 'All venues' }, { id: 'country', label: local.defaultCountry || 'My country' }]}
            onChange={v => { if (v === 'country' && !local.defaultCountry) return; lUpdate('mapDefaultRegion', v); onUpdate('mapDefaultRegion', v); }}
            isLast
          />
        </SettingsSection>
      </>}

      {activeSettingsTab === 'tags' && <>
      {[
        { label: "Genres", id: "genres", icon: "tag", items: genres, onRemove: removeGenre, input: newGenre, onInput: setNewGenre, onAdd: addGenre, placeholder: "Add genre..." },
        { label: "Subgenres", id: "subgenres", icon: "tag", items: subgenres, onRemove: removeSubgenre, input: newSubgenre, onInput: setNewSubgenre, onAdd: addSubgenre, placeholder: "Add subgenre..." },
        { label: "Languages", id: "languages", icon: "online", items: languages, onRemove: removeLanguage, input: newLanguage, onInput: setNewLanguage, onAdd: addLanguage, placeholder: "Add language..." },
        { label: "Venue sizes", id: "venueSizes", icon: "layout", items: venueSizes, onRemove: removeVenueSize, input: newVenueSize, onInput: setNewVenueSize, onAdd: addVenueSize, placeholder: "Add venue size..." },
        { label: "Merch items", id: "merch", icon: "card", items: categories, onRemove: removeCategory, input: newCategory, onInput: setNewCategory, onAdd: addCategory, placeholder: "Add category..." },
        { label: "Ticket types", id: "ticketTypes", icon: "list", items: ticketTypes, onRemove: removeTicketType, input: newTicketType, onInput: setNewTicketType, onAdd: addTicketType, placeholder: "Add ticket type..." },
        { label: "Ticket add-ons", id: "ticketAddons", icon: "list", items: ticketAddons, onRemove: removeTicketAddon, input: newTicketAddon, onInput: setNewTicketAddon, onAdd: addTicketAddon, placeholder: "Add add-on..." },
      ].map(({ label, id, icon, items, ...props }) => (
        <Collapsible key={id} title={`${label} (${items.length})`} icon={icon} defaultOpen={false} {...sec(id)}>
          <div style={{ background: "#0c0c14", borderRadius: 10, padding: "12px" }}>
            <TagManager items={items} {...props} />
          </div>
        </Collapsible>
      ))}
      </>}

      {false && activeSettingsTab === 'preferences' && (
        <SettingsSection title="Visible sections" icon="layout">
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
        <SettingsSection title="Profile" icon="person">
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
        <SettingsSection title="Notifications" icon="bell" collapsible defaultOpen={false} subtitle={(notifyPermState === 'granted' || settings.ntfyTopic) ? { label: 'Enabled', color: '#4ade80' } : { label: 'Not enabled', color: '#4a4870' }}>
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
                <div style={{ background: '#0c0c14', border: '1px solid #1f1f35', borderRadius: 10, padding: '12px' }}>
                  <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>How it works</div>
                  <ol style={{ fontSize: 11, color: '#9d9bc0', lineHeight: 1.7, margin: 0, paddingLeft: 18, marginBottom: 12 }}>
                    <li>Tap "Set up" below — you'll get a private, random topic name (like a channel just for you)</li>
                    <li>Install the free <b>ntfy</b> app: <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>iOS</a> / <a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>Android</a></li>
                    <li>In the app, subscribe to your topic — that's it, no account or login needed</li>
                  </ol>
                  <button onClick={handleSetupNtfyTopic} style={{ background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 12, fontWeight: 700, padding: '9px 14px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", width: '100%' }}>Set up background notifications</button>
                </div>
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
        <SettingsSection title="Integrations" icon="plug" collapsible defaultOpen={false} subtitle={settings.spotifyAccessToken ? { label: 'Spotify connected', color: '#4ade80' } : { label: 'Not connected', color: '#4a4870' }}>
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
        <SettingsSection title="Your data" icon="data" collapsible defaultOpen={false}>
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
  const isPastDate = (dateStr) => dateStr < todayStr

  const showsGroup = ['home', 'artists', 'songs', 'venues']
  const [showStartupScreen, setShowStartupScreen] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowStartupScreen(false), 2000)
    return () => clearTimeout(t)
  }, [])
  const [view, setView] = useState(settings.defaultTab || 'stats')
  const [showsTab, setShowsTab] = useState(showsGroup.includes(settings.defaultTab) ? settings.defaultTab : 'home')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(null) // null | 'concert' | 'festival'
  const [showAddAttendance, setShowAddAttendance] = useState('in_person')
  const [showAddWishlist, setShowAddWishlist] = useState(false)
  const [statsTab, setStatsTab] = useState(settings.defaultStatsTab || 'summary')
  const [chartGroup, setChartGroup] = useState('activity')
  const [search, setSearch] = useState('')
  const [filterYears, setFilterYears] = useState([])
  const [filterType, setFilterType] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [openFilterSection, setOpenFilterSection] = useState(null) // accordion: only one filter category open at a time
  const [filterFriend, setFilterFriend] = useState('all')
  const [filterStatus, setFilterStatus] = useState([]) // subset of 'want' | 'upcoming' | 'past'
  const [filterVenue, setFilterVenue] = useState('all')
  const [filterRating, setFilterRating] = useState(0)
  const [filterSolo, setFilterSolo] = useState(false)
  const [filterFavorite, setFilterFavorite] = useState(false)
  const [filterTags, setFilterTags] = useState([])
  const [filterGenre, setFilterGenre] = useState('all')
  const [filterSubgenre, setFilterSubgenre] = useState('all')
  const [filterCountry, setFilterCountry] = useState('all')
  const [filterHasPhoto, setFilterHasPhoto] = useState(false)
  const [sortOrder, setSortOrder] = useState(settings.defaultSort || 'newest')
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [showPast, setShowPast] = useState(settings.defaultShowPast === 'open')
  const [showWishlist, setShowWishlist] = useState(settings.defaultShowWishlist === 'open')
  const [showUpcoming, setShowUpcoming] = useState(settings.defaultShowUpcoming !== 'closed')
  const [showActivity, setShowActivity] = useState(false)
  const [activityChartMode, setActivityChartMode] = useState('bar')
  const [addFlowStep, setAddFlowStep] = useState(null) // null | 'type' | 'timing' | 'ticket'
  const [addFlowType, setAddFlowType] = useState(null) // 'concert' | 'festival'
  const [addFlowAttendance, setAddFlowAttendance] = useState(null) // 'in_person' | 'online'
  const [venueDetailOpen, setVenueDetailOpen] = useState(false)
  const [pendingVenueSelect, setPendingVenueSelect] = useState(null)
  const [venueReturnConcert, setVenueReturnConcert] = useState(null)
  const [pendingArtistSelect, setPendingArtistSelect] = useState(null)
  const [artistReturnConcert, setArtistReturnConcert] = useState(null)
  const [pendingSongsSearch, setPendingSongsSearch] = useState(null)
  const [artistDetailOpen, setArtistDetailOpen] = useState(false)
  const [songDetailOpen, setSongDetailOpen] = useState(false)
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
  // Light mode reuses the same filter trick as color themes, rather than a
  // ground-up light palette: invert(1) + hue-rotate(180deg) flips dark<->light
  // while roughly preserving hue (the same technique "force dark mode" browser
  // extensions use in reverse). It's self-inverse, so combining it with a
  // color theme is just a matter of chaining the two filters.
  const LIGHT_FILTER = 'invert(1) hue-rotate(180deg)';
  const lightMode = !!settings.lightMode;
  const combinedFilter = [lightMode ? LIGHT_FILTER : '', themeFilter].filter(Boolean).join(' ');

  // Best-effort: if this concert's venue doesn't have map coordinates yet,
  // fetch them in the background (Nominatim, free, no key) and save. Never
  // blocks or fails the actual concert save.
  const maybeGeocodeVenue = (concert) => {
    if (!concert?.venue) return
    const venueInfo = settings.venueInfo || {}
    if (venueInfo[concert.venue]?.lat != null) return
    geocodeVenue(concert.venue, concert.city, concert.country).then(coords => {
      if (!coords) return
      const next = { ...(settings.venueInfo || {}) }
      next[concert.venue] = { ...(next[concert.venue] || {}), ...coords }
      onUpdateSetting('venueInfo', next)
    })
  }

  const handleSave = async (updated) => {
    const result = await onSaveConcert(updated)
    notify(result?.error ? 'Could not save show' : 'Show saved', result?.error ? 'error' : 'success')
    if (result?.error) return result
    setSelected(updated)
    maybeGeocodeVenue(updated)
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
      // Save directly — not via handleSave, which navigates to the concert and
      // shows a toast. That's right for the edit form, wrong here: this runs
      // from the Songs page and should leave the user exactly where they were.
      await onSaveConcert(updated)
    }
  }

  const updateSetting = (key, value) => {
    return onUpdateSetting(key, value)
  }

  const updateSettings = (next) => {
    return onUpdateSettings ? onUpdateSettings(next) : Promise.resolve()
  }

  const years = [...new Set(concerts.filter(c => c.date !== '9999-12-31').map(c => c.date.slice(0,4)))].sort().reverse()
  const allVenues = [...new Set(concerts.map(c => c.venue))].sort()
  const activeFriends = [...new Set(concerts.flatMap(c => getFriends(c)))].sort()
  const allCountries = [...new Set(concerts.map(c => (c.country || '').trim()).filter(Boolean))].sort()

  const activeFilterCount = [
    filterFriend !== 'all', filterVenue !== 'all',
    filterRating !== 0, filterSolo, filterGenre !== 'all', filterSubgenre !== 'all', filterCountry !== 'all', filterHasPhoto,
    filterType !== 'all', filterStatus.length > 0, filterFavorite, filterTags.length > 0
  ].filter(Boolean).length
  const resetFilters = () => { setFilterFriend('all'); setFilterVenue('all'); setFilterRating(0); setFilterSolo(false); setFilterGenre('all'); setFilterSubgenre('all'); setFilterCountry('all'); setFilterType('all'); setFilterHasPhoto(false); setFilterStatus([]); setFilterFavorite(false); setFilterTags([]); }
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
    if (filterFavorite && !c.favorite) return false
    if (filterTags.length > 0 && !filterTags.every(t => (c.tags || []).includes(t))) return false
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
    if (sortOrder === 'price') return ticketTotal(b) - ticketTotal(a)
    return b.date.localeCompare(a.date)
  })

  const wishlist = concerts.filter(c => isWish(c) && matchesType(c))
  const upcoming = filtered.filter(c => !isWish(c) && !isPastDate(c.date))
  const past = filtered.filter(c => !isWish(c) && isPastDate(c.date))
  const combinedShows = filterStatus.length === 0
    ? [...wishlist, ...upcoming, ...past]
    : [
        ...(filterStatus.includes('want') ? wishlist : []),
        ...(filterStatus.includes('upcoming') ? upcoming : []),
        ...(filterStatus.includes('past') ? past : []),
      ]
  const allPast = concerts.filter(c => !isWish(c) && isPastDate(c.date))
  const headerCounts = {
    concerts: allPast.filter(c => c.type !== 'festival').length,
    festivals: allPast.filter(c => c.type === 'festival').length,
    upcoming: concerts.filter(c => !isWish(c) && !isPastDate(c.date)).length,
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
    if (!settings.groupByYear) {
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
      const key = (isWish(c) || !isPastDate(c.date)) ? '__upcoming__' : (c.date || '').slice(0, 4)
      const last = groups[groups.length - 1]
      if (!last || last.key !== key) {
        groups.push({
          key,
          label: key === '__upcoming__' ? 'Want to go & upcoming' : (key || 'Unknown'),
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

  const appShell = { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0c0c14', maxWidth: 480, margin: '0 auto', fontFamily: "'DM Sans', sans-serif", filter: combinedFilter || undefined, overflow: 'hidden' }
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
    // Cancel the parent filter chain for images/map-tiles: reverse order,
    // each step inverted. LIGHT_FILTER is self-inverse so it's the same token.
    const themeInv = inverse[themeFilter] || ''
    const imgFilter = [themeInv, lightMode ? LIGHT_FILTER : ''].filter(Boolean).join(' ')
    const rules = []
    if (imgFilter) {
      rules.push(`[data-theme-shell] img { filter: ${imgFilter} !important; }`)
      // Leaflet's own UI chrome (attribution strip, zoom buttons) isn't an
      // <img>, but reads just as wrong once the whole page is hue-rotated —
      // exclude it from the theme filter too so it stays legible.
      rules.push(`[data-theme-shell] .leaflet-control-attribution, [data-theme-shell] .leaflet-control-zoom { filter: ${imgFilter} !important; }`)
    }
    // The default Leaflet attribution bar is a small dark strip that clashes
    // with the light basemap — restyle it to sit quietly in the corner.
    rules.push(`.leaflet-control-attribution { background: rgba(255,255,255,0.75) !important; color: #555 !important; font-size: 9px !important; padding: 1px 4px !important; }`)
    rules.push(`.leaflet-control-attribution a { color: #555 !important; }`)
    el.textContent = rules.join('\n')
    return () => { const e = document.getElementById(id); if (e) e.textContent = '' }
  }, [themeFilter, lightMode])

  const visibleStatGroups = CHART_GROUP_IDS.filter(g => !(settings.hiddenChartGroups||[]).includes(g.id))

  const isShowsActive = showsGroup.includes(view)

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

  const ICON_ARTISTS = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>
  const ICON_SONGS = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  const ICON_VENUES = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>

  const BottomNav = () => (
    <div data-bottom-nav="" style={{ flexShrink: 0, background: '#0c0c14', borderTop: '1px solid #0d1a14', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {navBtn('shows', '♪', 'Shows', view === 'home', () => setView('home'))}
      {navBtn('artists', ICON_ARTISTS, 'Artists', view === 'artists', () => setView('artists'))}
      {navBtn('songs', ICON_SONGS, 'Songs', view === 'songs', () => setView('songs'))}
      {navBtn('venues', ICON_VENUES, 'Venues', view === 'venues', () => setView('venues'))}
      {navBtn('friends', '♥', 'Friends', view === 'stats' && statsTab === 'friends', () => { setView('stats'); setStatsTab('friends'); })}
    </div>
  )

  if (addFlowStep) {
    const stepNum = { type: 1, timing: 2, ticket: 3 }[addFlowStep]
    const stepTotal = addFlowStep === 'ticket' || (addFlowStep === 'timing') ? 3 : 3
    const OptionCard = ({ color, icon, title, sub, onClick }) => (
      <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', width: '100%',
        background: '#13131f', border: '1px solid #1f1f35', borderLeft: `3px solid ${color}`,
        borderRadius: 14, padding: '16px 16px 16px 15px', cursor: 'pointer',
      }}>
        {icon && (
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: '#e2e0ff' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#6b6a8f', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
        </div>
        <span style={{ color: '#3a3858', fontSize: 18, flexShrink: 0 }}>›</span>
      </button>
    )
    return (
    <div data-theme-shell="" style={appShell}>
      <div id="content-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <button onClick={() => { if (addFlowStep === 'type') setAddFlowStep(null); else if (addFlowStep === 'timing') setAddFlowStep('type'); else setAddFlowStep('timing'); }} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{ width: n === stepNum ? 18 : 6, height: 6, borderRadius: 3, background: n <= stepNum ? '#a78bfa' : '#1f1f35', transition: 'width 0.2s' }} />
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 27, fontWeight: 800, color: '#e2e0ff', lineHeight: 1.15, margin: '14px 0 4px' }}>
          {addFlowStep === 'type' ? 'What are you logging?' : addFlowStep === 'timing' ? 'When is it?' : 'Got a ticket?'}
        </div>
        <div style={{ fontSize: 13, color: '#6b6a8f', marginBottom: 26 }}>
          {addFlowStep === 'type' ? 'Pick the kind of show first.' : addFlowStep === 'timing' ? 'Past shows and upcoming plans both get logged, just a little differently.' : "We'll keep it lighter if you're still deciding."}
        </div>

        {addFlowStep === 'type' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <OptionCard color="#a78bfa" title="Offline show" sub="A concert you go to in person"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>}
              onClick={() => { setAddFlowType('concert'); setAddFlowAttendance('in_person'); setAddFlowStep('timing'); }} />
            <OptionCard color={ONLINE_COLOR} title="Online show" sub="A livestream or online performance"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>}
              onClick={() => { setAddFlowType('concert'); setAddFlowAttendance('online'); setAddFlowStep('timing'); }} />
            <OptionCard color="#f472b6" title="Festival" sub="Multiple acts, one event"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 18H5L12 3z"/><path d="M9 14h6"/></svg>}
              onClick={() => { setAddFlowType('festival'); setAddFlowAttendance('in_person'); setAddFlowStep('timing'); }} />
          </div>
        )}

        {addFlowStep === 'timing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <OptionCard color="#a78bfa" title="Already happened" sub="Log a show from the past"
              onClick={() => { setShowAdd(addFlowType); setShowAddAttendance(addFlowAttendance); setShowAddWishlist(false); setAddFlowStep(null); }} />
            <OptionCard color="#818cf8" title="Coming up" sub="Something upcoming, or on your radar"
              onClick={() => setAddFlowStep('ticket')} />
          </div>
        )}

        {addFlowStep === 'ticket' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <OptionCard color="#818cf8" title="Yes" sub="It's booked — log the full details"
              onClick={() => { setShowAdd(addFlowType); setShowAddAttendance(addFlowAttendance); setShowAddWishlist(false); setAddFlowStep(null); }} />
            <OptionCard color="#34d399" title="Not yet" sub="Add it to your want-to-go list instead"
              onClick={() => { setShowAdd(addFlowType); setShowAddAttendance(addFlowAttendance); setShowAddWishlist(true); setAddFlowStep(null); }} />
          </div>
        )}
      </div>
    </div>
  )
  }

  if (showAdd) return (
    <div data-theme-shell="" style={appShell}>
      <div id="content-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <AddConcertForm
          onSave={async c => {
            const result = await onSaveConcert(c);
            notify(result?.error ? 'Could not save show' : 'Show saved', result?.error ? 'error' : 'success');
            if (result?.error) return;
            setShowAdd(null); savedScrollPos.current = 0; setSelected(c);
            maybeGeocodeVenue(c);
            if (settings.spotifyAccessToken && getSongList(c.setlist).length > 0) {
              setSpotifyPrompt(c);
            }
          }}
          onClose={() => setShowAdd(null)}
          initialType={showAdd}
          initialAttendanceMode={showAddAttendance}
          initialWishlist={showAddWishlist}
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
      <BottomNav />
    </div>
  )

  if (selected) return (
    <div data-theme-shell="" style={appShell}>
      <div id="content-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <ConcertDetail concert={selected} concerts={concerts} onClose={() => setSelected(null)} onSave={handleSave} settings={settings} onUpdateSetting={onUpdateSetting} onUpdateSettings={onUpdateSettings} friends={allFriends} onDelete={onDeleteConcert} onNotify={notify} photosEnabled={!!userEmail} onNavigate={({ view: v, artist: a, venue: ve }) => { if (v === 'venues' && ve) setVenueReturnConcert(selected); if (v === 'artists' && a) setArtistReturnConcert(selected); setSelected(null); if (v === 'friends') { setView('stats'); setStatsTab('friends'); } else { setView(v); if (v === 'venues' && ve) setPendingVenueSelect(ve); if (v === 'artists' && a) setPendingArtistSelect(a); } }} allArtists={[...new Set([
          ...concerts.map(c => c.artist),
          ...concerts.flatMap(c => (c.support || []).map(s => getSupportName(s))),
          ...concerts.flatMap(c => (c.acts || []).map(a => a.name || '').filter(Boolean)),
        ])].filter(Boolean).sort()} />
      </div>
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
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
          <div style={{ fontSize: 10, color: '#5a5880', fontFamily: "'DM Mono', monospace" }}>
            {headerCounts.concerts} concerts · {headerCounts.festivals} festivals · {headerCounts.upcoming} upcoming
          </div>
        </div>
      </div>
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )

  return (
    <div data-theme-shell="" style={appShell}>

      {/* Header */}
      {!((view === 'venues' && venueDetailOpen) || (view === 'artists' && artistDetailOpen) || (view === 'songs' && songDetailOpen)) && (
      <div style={{ flexShrink: 0, padding: '36px 16px 0', background: '#0c0c14', borderBottom: '1px solid #0d1a14' }}>
        <div style={{ marginBottom: 20, textAlign: 'center', position: 'relative' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: '#e2e0ff', lineHeight: 1 }}>{shellTitle}</div>
          <button onClick={() => { setView('stats'); setStatsTab('summary'); }} aria-label="Stats" style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: view === 'stats' && statsTab === 'summary' ? '#a78bfa' : '#6b6a8f', cursor: 'pointer', padding: '6px 4px', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="15" width="3.5" height="6" rx="1" fill="currentColor"/><rect x="8" y="9" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="14" y="12" width="3.5" height="9" rx="1" fill="currentColor"/><rect x="20" y="5" width="3.5" height="16" rx="1" fill="currentColor"/><path d="M3.75 11L9.75 6L15.75 9.5L21.75 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="3.75" cy="11" r="2" fill="currentColor"/><circle cx="9.75" cy="6" r="2" fill="currentColor"/><circle cx="15.75" cy="9.5" r="2" fill="currentColor"/><circle cx="21.75" cy="2.5" r="2" fill="currentColor"/></svg>
          </button>
          <button onClick={() => setView('settings')} aria-label="Settings" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: view === 'settings' ? '#a78bfa' : '#6b6a8f', fontSize: 20, cursor: 'pointer', padding: '6px 4px', lineHeight: 1, letterSpacing: '1px' }}>⋯</button>
          {isSummaryHeader && (
            <div style={{ fontSize: 10, color: '#5a5880', fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
            {allPast.filter(c => c.type !== 'festival').length} concerts · {allPast.filter(c => c.type === 'festival').length} festivals · {concerts.filter(c => !isPastDate(c.date)).length} upcoming
            </div>
          )}
        </div>

      </div>
      )}

      {/* Content */}
      <div id="content-scroll" style={{ flex: 1, overflowY: view === 'stats' && (statsTab === 'charts' || statsTab === 'summary') ? 'hidden' : 'auto', overflowX: 'hidden', padding: view === 'stats' && (statsTab === 'charts' || statsTab === 'summary') ? '0' : '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {view === 'home' && (
          <>
            {concerts.length === 0 && (
              <EmptyState title="No shows yet" detail="Start with a quick concert entry, then fill in setlists, merch, and notes when you feel like it." actionLabel="Add show" onAction={() => setAddFlowStep('type')} />
            )}
        {view === 'home' && concerts.length > 0 && (() => {
          const pastAll = concerts.filter(c => !isWish(c) && isPast(c.date));
          const distinctArtists = new Set(pastAll.map(c => c.artist).filter(Boolean)).size;
          const distinctVenues = new Set(pastAll.map(c => c.venue).filter(Boolean)).size;
          const distinctCountries = new Set(pastAll.map(c => c.country).filter(Boolean)).size;
          return (
            <div style={{ padding: '14px 16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{pastAll.length}</span>
                <span style={{ fontSize: 12, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>shows attended</span>
              </div>
              {(distinctArtists > 0 || distinctVenues > 0 || distinctCountries > 0) && (
                <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
                  across {distinctArtists} artist{distinctArtists !== 1 ? 's' : ''}, {distinctVenues} venue{distinctVenues !== 1 ? 's' : ''}{distinctCountries > 0 ? `, ${distinctCountries} countr${distinctCountries !== 1 ? 'ies' : 'y'}` : ''}
                </div>
              )}
            </div>
          );
        })()}

        {/* Type pills + compact/calendar/add */}
        {view === 'home' && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0', alignItems: 'center' }}>
            {[['all','All'],['concerts','Shows'],['festivals','Fest']].map(([id,label]) => (
              <button key={id} onClick={() => setFilterType(id)} style={{ background:filterType===id?'#a78bfa':'none', border:`1px solid ${filterType===id?'#a78bfa':'#1f1f35'}`, borderRadius:99, padding:'5px 11px', cursor:'pointer', color:filterType===id?'#0c0c14':'#6b6a8f', fontSize:12, fontFamily:"'DM Mono', monospace", fontWeight:filterType===id?700:400, flexShrink:0 }}>{label}</button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => setCompact(c => !c)} style={{ background: compact ? '#1a1a30' : 'none', border: `1px solid ${compact ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: compact ? '#a78bfa' : '#6b6a8f', fontSize: 13, flexShrink: 0, lineHeight: 1 }} title={compact ? 'Switch to expanded view' : 'Switch to compact view'}>
              {compact ? '▤' : '☰'}
            </button>
            <button onClick={() => setShowCalendar(c => !c)} style={{ background: showCalendar ? '#1a1a30' : 'none', border: `1px solid ${showCalendar ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: showCalendar ? '#a78bfa' : '#6b6a8f', display: 'inline-flex', alignItems: 'center', flexShrink: 0, lineHeight: 1 }} title={showCalendar ? 'Switch to list view' : 'Switch to calendar view'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
            </button>
            <button onClick={() => { setAddFlowStep('type'); setAddFlowType(null); setAddFlowAttendance(null); }} aria-label="Add a show" style={{ background: 'none', border: '1px solid #1f1f35', borderRadius: 99, width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a78bfa', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>+</button>
          </div>
        )}

        {/* Search + sort + filters */}
        {view === 'home' && (
          <div style={{ padding: '8px 16px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search shows..."
              style={{ flex: 1, minWidth: 0, background: '#0c0c14', border: '1px solid #1f1f35', borderRadius: 8, color: '#c4c2f0', padding: '7px 11px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' }}
            />
            <button onClick={() => { setShowSort(s => !s); setShowFilters(false) }} style={{ background: showSort || sortOrder !== defaultSortId ? '#1a1a30' : 'none', border: `1px solid ${showSort || sortOrder !== defaultSortId ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: sortOrder !== defaultSortId ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: sortOrder !== defaultSortId ? 700 : 400, flexShrink: 0 }}>
              Sort{sortOrder !== defaultSortId ? ` ↕` : ''}
            </button>
            <button onClick={() => { setShowFilters(f => !f); setShowSort(false) }} style={{ background: showFilters || activeFilterCount > 0 ? '#1a1a30' : 'none', border: `1px solid ${showFilters || activeFilterCount > 0 ? '#a78bfa' : '#1f1f35'}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', color: activeFilterCount > 0 ? '#a78bfa' : '#6b6a8f', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: activeFilterCount > 0 ? 700 : 400, flexShrink: 0 }}>
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
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
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            <button onClick={() => { resetFilters(); setOpenFilterSection(null); }} style={{ marginBottom: 10, background: 'none', border: 'none', color: activeFilterCount > 0 ? '#a78bfa' : '#4a4870', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>↩ back to default</button>
            {(() => {
              const Row = (label, children) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
                </div>
              );
              const pill = (active, label, onClick, color = '#a78bfa') => (
                <button key={label} onClick={onClick} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: active ? color : '#0c0c14', color: active ? '#0c0c14' : '#6b6a8f', border: `1px solid ${active ? color : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{label}</button>
              );
              return (
                <>
                  {Row('Type', [['all','All'],['concerts','Concerts'],['festivals','Festivals'],['online','Online']].map(([id, label]) => pill(filterType === id, label, () => setFilterType(id))))}

                  {Row('Year', [pill(filterYears.length === 0, 'All years', () => setFilterYears([])), ...years.map(y => pill(filterYears.includes(y), y, () => setFilterYears(f => f.includes(y) ? f.filter(x => x !== y) : [...f, y])))])}

                  {Row('Rating', [pill(filterRating === 0, 'Any', () => setFilterRating(0)), ...Array.from({ length: settings.ratingSystem || 5 }, (_, i) => i + 1).map(n => pill(filterRating === n, `${n}★`, () => setFilterRating(filterRating === n ? 0 : n)))])}

                  {Row('Photos', [
                    pill(settings.showListPhotos !== false, 'Show in list', () => onUpdateSetting('showListPhotos', settings.showListPhotos === false)),
                    pill(filterHasPhoto, 'Only with photo', () => setFilterHasPhoto(f => !f)),
                  ])}

                  {Row('Solo', [pill(filterSolo, 'Solo only', () => setFilterSolo(s => !s))])}

                  {Row('Moments', [
                    pill(filterFavorite, '★ All-time fave', () => setFilterFavorite(f => !f)),
                    ...(settings.showTags || ['Cried']).map(t => pill(filterTags.includes(t), t, () => setFilterTags(f => f.includes(t) ? f.filter(x => x !== t) : [...f, t]), '#f472b6')),
                  ])}

                  {(settings.genres||[]).length > 0 && (() => {
                    const _g = settings.genres||[]; const _top = _g.slice(0,3); const _rest = _g.slice(3);
                    return Row('Genre', [
                      pill(filterGenre === 'all', 'All', () => setFilterGenre('all')),
                      ..._top.map(g => pill(filterGenre === g, g, () => setFilterGenre(filterGenre===g?'all':g))),
                      _rest.length > 0 && (
                        <select key="more" value={_rest.includes(filterGenre)?filterGenre:''} onChange={e => e.target.value && setFilterGenre(e.target.value)} style={{ background:_rest.includes(filterGenre)?'#a78bfa':'#0c0c14', border:`1px solid ${_rest.includes(filterGenre)?'#a78bfa':'#1f1f35'}`, borderRadius:99, color:_rest.includes(filterGenre)?'#0c0c14':'#6b6a8f', fontFamily:"'DM Mono', monospace", fontSize:11, padding:'4px 8px', cursor:'pointer', WebkitAppearance:'none', appearance:'none' }}><option value=''>more ▾</option>{_rest.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      ),
                    ]);
                  })()}

                  {(settings.subgenres||[]).length > 0 && Row('Subgenre', [pill(filterSubgenre === 'all', 'All', () => setFilterSubgenre('all'), '#38bdf8'), ...(settings.subgenres||[]).map(g => pill(filterSubgenre === g, g, () => setFilterSubgenre(filterSubgenre === g ? 'all' : g), '#38bdf8'))])}

                  {allCountries.length > 1 && Row('Country', [pill(filterCountry === 'all', 'All', () => setFilterCountry('all')), ...allCountries.map(c => pill(filterCountry === c, c, () => setFilterCountry(filterCountry === c ? 'all' : c)))])}
                </>
              );
            })()}
          </div>
        )}

            {concerts.length > 0 && !showCalendar && (() => {
              const pastAll = concerts.filter(c => !isWish(c) && isPast(c.date));
              const yearCounts = {};
              pastAll.forEach(c => { const y = c.date.slice(0, 4); yearCounts[y] = (yearCounts[y] || 0) + 1; });
              const years = Object.keys(yearCounts).sort();
              const maxYearCount = Math.max(...Object.values(yearCounts), 1);
              const midYearCount = Math.round(maxYearCount / 2);
              const ratingScale = settings.ratingSystem || 5;
              const ratingCounts = {}; pastAll.forEach(c => { if (c.rating) ratingCounts[c.rating] = (ratingCounts[c.rating] || 0) + 1; });
              if (years.length === 0) return null;
              const BAR_H = 90;
              const Y_PAD = 24;
              return (
                <div style={{ marginBottom: showActivity ? 10 : 2 }}>
                  <button onClick={() => setShowActivity(s => !s)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: showActivity ? '0 4px 10px' : '0 4px 2px' }}>
                    <span style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Activity</span>
                    <span style={{ fontSize: 11, color: '#4a4870', transform: showActivity ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                  </button>
                  {showActivity && (
                    <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px' }}>
                      {years.length > 1 && (
                        <ChartToggle options={[{ id: 'bar', label: 'Bar' }, { id: 'line', label: 'Line' }]} value={activityChartMode} onChange={setActivityChartMode} />
                      )}
                      {/* Shows per year */}
                      {activityChartMode === 'bar' ? (
                        <div style={{ display: 'flex', marginBottom: 14 }}>
                          <div style={{ width: Y_PAD, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: BAR_H, paddingBottom: 18, flexShrink: 0 }}>
                            <span style={{ fontSize: 8, color: '#4a4870', fontFamily: "'DM Mono', monospace", textAlign: 'right', lineHeight: 1 }}>{maxYearCount}</span>
                            <span style={{ fontSize: 8, color: '#4a4870', fontFamily: "'DM Mono', monospace", textAlign: 'right', lineHeight: 1 }}>{midYearCount}</span>
                            <span style={{ fontSize: 8, color: '#4a4870', fontFamily: "'DM Mono', monospace", textAlign: 'right', lineHeight: 1 }}>0</span>
                          </div>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BAR_H, pointerEvents: 'none' }}>
                              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px solid #1f1f35' }} />
                              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #1a1a2e' }} />
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid #1f1f35' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: BAR_H, paddingBottom: 1 }}>
                              {years.map(y => (
                                <button key={y} onClick={() => setFilterYears(f => f.includes(y) ? f.filter(x => x !== y) : [...f, y])} title={`${y}: ${yearCounts[y]} shows`}
                                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                  <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: filterYears.includes(y) ? '#a78bfa' : '#3d3564', height: `${Math.max(2, (yearCounts[y] / maxYearCount) * (BAR_H - 2))}px` }} />
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 3, borderTop: '1px solid #1f1f35', paddingTop: 3 }}>
                              {years.map(y => (
                                <div key={y} style={{ flex: 1, textAlign: 'center' }}>
                                  <span style={{ fontSize: 8, color: '#4a4870', fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{y.slice(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : years.length < 2 ? (
                        <div style={{ color: '#2e2e4a', fontSize: 11, fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>Need at least 2 years of data</div>
                      ) : (() => {
                        const W = 260, H = BAR_H;
                        const n = years.length;
                        const xOf = i => (i / (n - 1)) * (W - 6) + 3;
                        const yOf = v => H - 4 - (v / maxYearCount) * (H - 14);
                        const path = "M " + years.map((y, i) => `${xOf(i)},${yOf(yearCounts[y])}`).join(" L ");
                        return (
                          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div style={{ width: Y_PAD, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: H + 14, paddingBottom: 14, flexShrink: 0 }}>
                              <span style={{ fontSize: 8, color: '#4a4870', fontFamily: "'DM Mono', monospace", textAlign: 'right', lineHeight: 1 }}>{maxYearCount}</span>
                              <span style={{ fontSize: 8, color: '#4a4870', fontFamily: "'DM Mono', monospace", textAlign: 'right', lineHeight: 1 }}>{midYearCount}</span>
                              <span style={{ fontSize: 8, color: '#4a4870', fontFamily: "'DM Mono', monospace", textAlign: 'right', lineHeight: 1 }}>0</span>
                            </div>
                            <svg style={{ flex: 1 }} height={H + 14} viewBox={`0 0 ${W} ${H + 14}`} preserveAspectRatio="none">
                              <defs><linearGradient id="showsYearGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2"/><stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/></linearGradient></defs>
                              <line x1={0} y1={yOf(maxYearCount)} x2={W} y2={yOf(maxYearCount)} stroke="#1f1f35" strokeWidth="1" />
                              <line x1={0} y1={yOf(midYearCount)} x2={W} y2={yOf(midYearCount)} stroke="#1a1a2e" strokeWidth="1" strokeDasharray="3,3" />
                              <line x1={0} y1={yOf(0)} x2={W} y2={yOf(0)} stroke="#1f1f35" strokeWidth="1" />
                              {years.map((y, i) => (
                                <text key={y} x={xOf(i)} y={H + 11} textAnchor="middle" fill="#4a4870" fontSize="8" fontFamily="DM Mono,monospace">{y.slice(2)}</text>
                              ))}
                              <path d={path + ` L ${xOf(n - 1)},${yOf(0)} L ${xOf(0)},${yOf(0)} Z`} fill="url(#showsYearGrad)" />
                              <path d={path} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              {years.map((y, i) => <circle key={y} cx={xOf(i)} cy={yOf(yearCounts[y])} r="3" fill={filterYears.includes(y) ? '#34d399' : '#a78bfa'} />)}
                            </svg>
                          </div>
                        );
                      })()}
                      {Object.keys(ratingCounts).length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, color: '#4a4870', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', marginBottom: 6 }}>Ratings</div>
                          {Array.from({ length: ratingScale }, (_, i) => ratingScale - i).map(n => (ratingCounts[n] || 0) > 0 && (
                            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", width: 24 }}>★{n}</span>
                              <div style={{ flex: 1, height: 5, background: '#0c0c14', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 3, background: '#a78bfa', width: `${(ratingCounts[n] / Math.max(...Object.values(ratingCounts))) * 100}%` }} />
                              </div>
                              <span style={{ fontSize: 9, color: '#4a4870', fontFamily: "'DM Mono', monospace", width: 14, textAlign: 'right' }}>{ratingCounts[n]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
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
            {!showCalendar && filtered.length > 0 && (
              <div style={{ marginTop: showActivity ? 10 : 2 }}>
                {(filterStatus.length === 0 || filterStatus.includes('want')) && wishlist.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <button onClick={() => setShowWishlist(w => !w)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: showWishlist ? '4px 4px 10px' : '4px 4px 2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#34d399', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Want to go</span>
                        <span style={{ fontSize: 10, color: '#2e4a3a', fontFamily: "'DM Mono', monospace", background: '#0a1a12', border: '1px solid #2a4a3a', borderRadius: 99, padding: '1px 7px' }}>{wishlist.length}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#34d399', transform: showWishlist ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                    </button>
                    {showWishlist && renderConcertList(wishlist, false)}
                  </div>
                )}
                {(filterStatus.length === 0 || filterStatus.includes('upcoming')) && upcoming.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <button onClick={() => setShowUpcoming(u => !u)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: showUpcoming ? '4px 4px 10px' : '4px 4px 2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#818cf8', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Upcoming</span>
                        <span style={{ fontSize: 10, color: '#4a4a8f', fontFamily: "'DM Mono', monospace", background: '#12122a', border: '1px solid #2e2e5a', borderRadius: 99, padding: '1px 7px' }}>{upcoming.length}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#818cf8', transform: showUpcoming ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                    </button>
                    {showUpcoming && renderConcertList(upcoming, settings.showListPhotos !== false)}
                  </div>
                )}
                {(filterStatus.length === 0 || filterStatus.includes('past')) && past.length > 0 && renderConcertList(past, settings.showListPhotos !== false)}
              </div>
            )}
          </>
        )}
        {view === 'stats' && <StatsView concerts={concerts} settings={settings} onNavigate={({ view: v, filterType: ft }) => { setView(v); if (ft !== undefined) setFilterType(ft); }} onUpdateSetting={updateSetting} onSaveConcert={handleSave} statsTab={statsTab} setStatsTab={setStatsTab} chartGroup={chartGroup} setChartGroup={setChartGroup} onOpen={handleOpenConcert} hideTabs fillHeight={statsTab === 'charts' || statsTab === 'summary'} />}
        {view === 'songs' && <SongsView concerts={concerts} onOpen={handleOpenConcert} settings={settings} saveSettings={onUpdateSettings} onLinkSong={handleLinkSongSpotify} onDetailChange={setSongDetailOpen} initialSearch={pendingSongsSearch} onInitialSearchConsumed={() => setPendingSongsSearch(null)} />}
        {view === 'artists' && <ArtistsView concerts={concerts} onOpen={handleOpenConcert} settings={settings} onUpdateSetting={updateSetting} onDetailChange={setArtistDetailOpen} initialSelectedArtist={pendingArtistSelect} onInitialArtistConsumed={() => setPendingArtistSelect(null)} onBackToOrigin={artistReturnConcert ? () => { setSelected(artistReturnConcert); setArtistReturnConcert(null); } : null} onNavigate={({ view: v, search: s }) => { if (v === 'friends') { setView('stats'); setStatsTab('friends'); } else { setView(v); if (v === 'songs' && s) setPendingSongsSearch(s); } }} />}
        {view === 'venues' && <VenuesView concerts={concerts} onOpen={handleOpenConcert} settings={settings} onUpdateSetting={updateSetting} onDetailChange={setVenueDetailOpen} initialSelectedVenue={pendingVenueSelect} onInitialVenueConsumed={() => setPendingVenueSelect(null)} onBackToOrigin={venueReturnConcert ? () => { setSelected(venueReturnConcert); setVenueReturnConcert(null); } : null} onNavigate={({ view: v }) => { if (v === 'friends') { setView('stats'); setStatsTab('friends'); } else setView(v); }} />}
        {view === 'settings' && <SettingsView settings={settings} onUpdate={updateSetting} onUpdateAll={onUpdateSettings ? updateSettings : null} concerts={concerts} onSaveConcert={onSaveConcert} onSignOut={onSignOut} userEmail={userEmail} onNotify={notify} />}
      </div>

      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
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

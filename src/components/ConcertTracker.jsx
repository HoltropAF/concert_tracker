import { useState, useEffect, useCallback } from 'react'

// ============================================================
// HELPERS
// ============================================================

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const getYear = (dateStr) => dateStr.slice(0, 4);

const today = new Date();
const isPast = (dateStr) => new Date(dateStr + "T00:00:00") <= today;

// ============================================================
// COMPONENTS
// ============================================================

function StarRating({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 22, color: n <= (value || 0) ? "#a78bfa" : "#2e2e4a",
            padding: 0, lineHeight: 1
          }}
        >★</button>
      ))}
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

function ConcertCard({ concert, onOpen }) {
  const past = isPast(concert.date);
  const isFestival = concert.type === "festival";

  return (
    <button
      onClick={() => onOpen(concert)}
      style={{
        width: "100%", textAlign: "left", background: past ? "#17172a" : "#0d1a15",
        border: `1px solid ${past ? "#1f1f35" : "#2e2e50"}`,
        borderLeft: `3px solid ${isFestival ? "#f472b6" : past ? "#a78bfa" : "#818cf8"}`,
        borderRadius: 12, padding: "14px 16px", cursor: "pointer",
        transition: "all 0.15s ease", marginBottom: 8
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {isFestival && <Badge color="#1a1a30">FEST</Badge>}
            <span style={{
              fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
              color: "#e2e0ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
            }}>{concert.artist}</span>
          </div>
          <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
            {formatDate(concert.date)} · {concert.venue}{concert.room ? ` · ${concert.room}` : ""} · {concert.city}
          </div>
          {concert.friends.length > 0 && (
            <div style={{ fontSize: 11, color: "#5a5880", marginTop: 4 }}>
              w. {concert.friends.join(", ")}
            </div>
          )}
          {concert.solo && concert.friends.length === 0 && (
            <div style={{ fontSize: 11, color: "#5a5880", marginTop: 4, fontStyle: "italic" }}>solo</div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {concert.rating && (
            <div style={{ color: "#a78bfa", fontSize: 13 }}>
              {"★".repeat(concert.rating)}
            </div>
          )}
          {!past && (
            <div style={{ fontSize: 10, color: "#818cf8", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
              upcoming
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function SetlistSection({ concert }) {
  const searchUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(concert.artist)}+${concert.date.split("-")[0]}`;
  const isSpotify = concert.setlistUrl?.includes("spotify");
  const linkStyle = (primary) => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 14px", borderRadius: 8, fontSize: 12,
    background: "#13131f", border: `1px solid ${primary ? "#2a4a3a" : "#1f1f35"}`,
    color: primary ? "#a78bfa" : "#4a4870", textDecoration: "none",
    fontFamily: "'DM Mono', monospace"
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {concert.setlistUrl && (
        <a href={concert.setlistUrl} target="_blank" rel="noopener noreferrer" style={linkStyle(true)}>
          {isSpotify ? "🎧 Spotify playlist ↗" : "🎵 Setlist ↗"}
        </a>
      )}
      <a href={searchUrl} target="_blank" rel="noopener noreferrer" style={linkStyle(!concert.setlistUrl)}>
        🔍 Search on setlist.fm ↗
      </a>
    </div>
  );
}

function ConcertDetail({ concert, onClose, onSave, settings = {}, friends = [], onDelete }) {
  const merchCategories = settings.merchCategories || ["T-shirt","Hoodie","Crewneck","Tote bag","Poster","Hat / Cap","Other"];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...concert });
  const [friendInput, setFriendInput] = useState('');
  const [supportInput, setSupportInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
    if (!t || (form.support || []).includes(t)) return;
    setForm(f => ({ ...f, support: [...(f.support || []), t] }));
    setSupportInput('');
  };
  const removeSupport = (s) => setForm(f => ({ ...f, support: (f.support || []).filter(x => x !== s) }));

  const handleShare = () => {
    const lines = [
      `🎤 ${concert.artist}${concert.tour ? ` — ${concert.tour}` : ''}`,
      `📅 ${formatDate(concert.date)} · ${concert.venue}${concert.room ? ` · ${concert.room}` : ''} · ${concert.city}`,
      concert.friends.length > 0 ? `👥 w. ${concert.friends.join(', ')}` : '👤 solo',
      concert.rating ? `⭐ ${'★'.repeat(concert.rating)}` : null,
      concert.notes ? `📝 ${concert.notes}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(lines);
  };

  const allFriendChoices = [...new Set([...friends, ...form.friends])].sort();
  const isFestival = concert.type === "festival";
  const past = isPast(concert.date);

  const labelStyle = { fontSize: 11, color: "#6b6a8f", marginBottom: 4, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.08em" };

  const inputStyle = {
    width: "100%", background: "#13131f", border: "1px solid #2a4a3a",
    borderRadius: 8, color: "#c4c2f0", padding: "8px 12px",
    fontFamily: "'DM Mono', monospace", fontSize: 13, boxSizing: "border-box"
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0c0c14",
      overflowY: "auto", zIndex: 100
    }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, background: "#0c0c14",
        borderBottom: "1px solid #1e3028", padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 12, zIndex: 10
      }}>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "#a78bfa",
          fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800,
            color: "#e2e0ff"
          }}>{concert.artist}</div>
          <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
            {formatDate(concert.date)} · {concert.city}
          </div>
        </div>
        {!editing && (
          <button onClick={handleShare} style={{
            background: "none", border: "1px solid #1f1f35", color: "#6b6a8f",
            borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer",
            fontFamily: "'DM Mono', monospace"
          }}>Share</button>
        )}
        <button
          onClick={() => {
            if (editing) { onSave(form); setEditing(false); }
            else setEditing(true);
          }}
          style={{
            background: editing ? "#a78bfa" : "#1a1a30", border: `1px solid ${editing ? "#a78bfa" : "#2e2e50"}`,
            color: editing ? "#0c0c14" : "#a78bfa", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Mono', monospace"
          }}
        >{editing ? "Save" : "Edit"}</button>
      </div>

      <div style={{ padding: "20px" }}>
        {/* Type badge / toggle */}
        {editing ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[{id:"concert",label:"🎤 Concert"},{id:"festival",label:"🎪 Festival"}].map(t => (
              <button key={t.id} onClick={() => update("type", t.id)} style={{
                flex:1, padding:"8px", borderRadius:8, fontSize:13, cursor:"pointer",
                background: form.type===t.id ? "#1a1a30" : "#13131f",
                border: `1px solid ${form.type===t.id ? "#a78bfa" : "#2e2e50"}`,
                color: form.type===t.id ? "#a78bfa" : "#6b6a8f",
                fontWeight: form.type===t.id ? 700 : 400, fontFamily:"'DM Sans',sans-serif"
              }}>{t.label}</button>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <Badge color={isFestival ? "#1a1a30" : "#13131f"}>{isFestival ? "🎪 Festival" : "🎤 Concert"}</Badge>
            {!past && <Badge color="#1a1a30">📅 Upcoming</Badge>}
            {concert.notes?.includes("first concert") && <Badge color="#1a1a30">⭐ First ever</Badge>}
            {concert.notes?.includes("first festival") && <Badge color="#1a1a30">⭐ First festival</Badge>}
          </div>
        )}

        {/* Artist + Date — editable only in edit mode */}
        {editing && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Artist</div>
              <input value={form.artist} onChange={e=>update("artist",e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Date</div>
              <input type="date" value={form.date} onChange={e=>update("date",e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        {/* Tour */}
        {(editing || concert.tour) && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Tour</div>
            {editing
              ? <input value={form.tour || ""} onChange={e=>update("tour",e.target.value)} placeholder="Tour name (optional)" style={inputStyle} />
              : <div style={{ color: "#c4c2f0", fontSize: 14 }}>{concert.tour}</div>
            }
          </div>
        )}

        {/* Venue */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Venue</div>
          {editing ? (
            <>
              <input value={form.venue} onChange={e=>update("venue",e.target.value)} placeholder="Venue name" style={{ ...inputStyle, marginBottom: 8 }} />
              <input value={form.room||""} onChange={e=>update("room",e.target.value)} placeholder="Room / stage (optional)" style={{ ...inputStyle, marginBottom: 8 }} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <input value={form.city} onChange={e=>update("city",e.target.value)} placeholder="City" style={inputStyle} />
                <input value={form.country} onChange={e=>update("country",e.target.value)} placeholder="Country" style={inputStyle} />
              </div>
            </>
          ) : (
            <>
              <div style={{ color: "#c4c2f0", fontSize: 14 }}>
                {concert.venue}{concert.room ? ` · ${concert.room}` : ""}
              </div>
              <div style={{ color: "#6b6a8f", fontSize: 12 }}>{concert.city}, {concert.country}</div>
            </>
          )}
        </div>

        {/* Support acts */}
        {(editing || concert.support?.length > 0) && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Support Acts</div>
            {editing ? (
              <>
                {(form.support || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {(form.support || []).map(s => (
                      <span key={s} style={{ display:"flex", alignItems:"center", gap:4, background:"#1a1a30", border:"1px solid #2e2e50", borderRadius:99, padding:"3px 10px", fontSize:12, color:"#a78bfa" }}>
                        {s}
                        <button onClick={() => removeSupport(s)} style={{ background:"none", border:"none", color:"#6b6a8f", cursor:"pointer", fontSize:13, padding:0, lineHeight:1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex", gap:8 }}>
                  <input value={supportInput} onChange={e=>setSupportInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSupport()} placeholder="Add support act..." style={{ ...inputStyle, flex:1 }} />
                  <button onClick={addSupport} style={{ background:"none", border:"1px solid #2a4a3a", borderRadius:6, color:"#a78bfa", fontSize:11, padding:"0 12px", cursor:"pointer" }}>+</button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {concert.support.map(s => <Badge key={s}>{s}</Badge>)}
              </div>
            )}
          </div>
        )}

        {/* Venue Size */}
        {(editing || concert.venueSize) && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Venue size</div>
            {editing ? (
              <div style={{ display:"flex", gap:6 }}>
                {[{id:"small",label:"Club"},{id:"mid",label:"Mid-size"},{id:"arena",label:"Arena"}].map(vs => (
                  <button key={vs.id} onClick={()=>update("venueSize",form.venueSize===vs.id?null:vs.id)} style={{
                    flex:1, padding:"6px 8px", borderRadius:99, fontSize:12, cursor:"pointer",
                    background: form.venueSize===vs.id ? "#a78bfa" : "#13131f",
                    color: form.venueSize===vs.id ? "#0c0c14" : "#6b6a8f",
                    border: `1px solid ${form.venueSize===vs.id ? "#a78bfa" : "#2e2e50"}`,
                    fontWeight: form.venueSize===vs.id ? 700 : 400
                  }}>{vs.label}</button>
                ))}
              </div>
            ) : (
              <div style={{ color:"#c4c2f0", fontSize:14 }}>
                {concert.venueSize === "small" ? "Club" : concert.venueSize === "mid" ? "Mid-size" : concert.venueSize === "arena" ? "Arena" : concert.venueSize}
              </div>
            )}
          </div>
        )}

        {/* Genre */}
        {(editing || concert.genre) && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Genre</div>
            {editing ? (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(settings.genres||[]).map(g => (
                  <button key={g} onClick={()=>update("genre",form.genre===g?null:g)} style={{
                    padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer",
                    background: form.genre===g ? "#a78bfa" : "#13131f",
                    color: form.genre===g ? "#0c0c14" : "#6b6a8f",
                    border: `1px solid ${form.genre===g ? "#a78bfa" : "#2e2e50"}`,
                    fontWeight: form.genre===g ? 700 : 400
                  }}>{g}</button>
                ))}
              </div>
            ) : <div style={{ color:"#c4c2f0", fontSize:14 }}>{concert.genre}</div>}
          </div>
        )}

        {/* Language */}
        {(editing || concert.language) && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Language</div>
            {editing ? (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(settings.languages||[]).map(l => (
                  <button key={l} onClick={()=>update("language",form.language===l?null:l)} style={{
                    padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer",
                    background: form.language===l ? "#a78bfa" : "#13131f",
                    color: form.language===l ? "#0c0c14" : "#6b6a8f",
                    border: `1px solid ${form.language===l ? "#a78bfa" : "#2e2e50"}`,
                    fontWeight: form.language===l ? 700 : 400
                  }}>{l}</button>
                ))}
              </div>
            ) : <div style={{ color:"#c4c2f0", fontSize:14 }}>{concert.language}</div>}
          </div>
        )}

        {/* Friends */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#6b6a8f", marginBottom: 8, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Went with
          </div>
          {editing ? (
            <div>
              {allFriendChoices.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {allFriendChoices.map(name => (
                    <button key={name} onClick={() => toggleFriend(name)} style={{
                      padding: "4px 10px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                      background: form.friends.includes(name) ? "#a78bfa" : "#13131f",
                      color: form.friends.includes(name) ? "#0c0c14" : "#6b6a8f",
                      border: `1px solid ${form.friends.includes(name) ? "#a78bfa" : "#2e2e50"}`,
                      fontWeight: form.friends.includes(name) ? 700 : 400
                    }}>{name}</button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={friendInput} onChange={e=>setFriendInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomFriend()} placeholder="Add friend..." style={{ flex:1, background:"#13131f", border:"1px solid #2a4a3a", borderRadius:8, color:"#c4c2f0", padding:"6px 10px", fontFamily:"'DM Mono',monospace", fontSize:12 }} />
                <button onClick={addCustomFriend} style={{ background:"none", border:"1px solid #2a4a3a", borderRadius:6, color:"#a78bfa", fontSize:11, padding:"0 12px", cursor:"pointer" }}>+</button>
              </div>
              <button onClick={()=>setForm(f=>({...f,solo:!f.solo,friends:[]}))} style={{
                marginTop:8, padding:"5px 12px", borderRadius:99, fontSize:12, cursor:"pointer",
                background: form.solo ? "#a78bfa" : "#13131f",
                color: form.solo ? "#0c0c14" : "#6b6a8f",
                border: `1px solid ${form.solo ? "#a78bfa" : "#2e2e50"}`,
                fontWeight: form.solo ? 700 : 400
              }}>solo</button>
            </div>
          ) : (
            <div style={{ color: "#c4c2f0", fontSize: 14 }}>
              {concert.friends.length > 0 ? concert.friends.join(", ") : "solo"}
            </div>
          )}
        </div>

        {/* Rating */}
        {past && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#6b6a8f", marginBottom: 8, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rating</div>
            {editing ? (
              <StarRating value={form.rating} onChange={v => update("rating", v)} />
            ) : (
              <div style={{ color: "#a78bfa", fontSize: 18 }}>
                {concert.rating ? "★".repeat(concert.rating) + "☆".repeat(5 - concert.rating) : <span style={{ color: "#2e2e4a" }}>Not rated yet</span>}
              </div>
            )}
          </div>
        )}

        {/* Ticket price */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#6b6a8f", marginBottom: 8, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ticket Price</div>
          {editing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#6b6a8f" }}>€</span>
              <input
                type="number" value={form.ticketPrice || ""} placeholder="0.00"
                onChange={e => update("ticketPrice", e.target.value ? parseFloat(e.target.value) : null)}
                style={{ ...inputStyle, width: 100 }}
              />
            </div>
          ) : (
            <div style={{ color: "#c4c2f0", fontSize: 14 }}>
              {concert.ticketPrice ? `€${concert.ticketPrice.toFixed(2)}` : <span style={{ color: "#2e2e4a" }}>—</span>}
            </div>
          )}
        </div>

        {/* Merch */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Merch</div>
            {editing && (
              <button onClick={addMerchItem} style={{
                background: "none", border: "1px solid #2a4a3a", borderRadius: 6,
                color: "#a78bfa", fontSize: 11, padding: "3px 8px", cursor: "pointer"
              }}>+ Add</button>
            )}
          </div>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(form.merch || []).map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <select
                      value={merchCategories.includes(m.item) ? m.item : "__custom__"}
                      onChange={e => {
                        if (e.target.value !== "__custom__") updateMerch(i, "item", e.target.value);
                      }}
                      style={{ ...inputStyle, flex: 1, width: "100%", appearance: "none", paddingRight: 24 }}
                    >
                      {merchCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__custom__">Custom...</option>
                    </select>
                    <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#6b6a8f", fontSize: 10, pointerEvents: "none" }}>▾</span>
                  </div>
                  {(!merchCategories.includes(m.item) || m.item === "") && (
                    <input
                      value={m.item === "__custom__" ? "" : m.item}
                      placeholder="Custom item..."
                      onChange={e => updateMerch(i, "item", e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      autoFocus
                    />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#6b6a8f", fontSize: 12 }}>€</span>
                    <input
                      type="number" value={m.price} placeholder="0"
                      onChange={e => updateMerch(i, "price", e.target.value)}
                      style={{ ...inputStyle, width: 70 }}
                    />
                  </div>
                  <button onClick={() => removeMerch(i)} style={{
                    background: "none", border: "none", color: "#4a6a5a",
                    fontSize: 16, cursor: "pointer", padding: 0
                  }}>×</button>
                </div>
              ))}
            </div>
          ) : (
            (concert.merch || []).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {concert.merch.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#c4c2f0", fontSize: 13 }}>
                    <span>{m.item}</span>
                    {m.price && <span style={{ color: "#a78bfa" }}>€{parseFloat(m.price).toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            ) : <span style={{ color: "#2e2e4a", fontSize: 13 }}>—</span>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#6b6a8f", marginBottom: 8, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes</div>
          {editing ? (
            <textarea
              value={form.notes || ""}
              onChange={e => update("notes", e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Any notes..."
            />
          ) : (
            <div style={{ color: "#c4c2f0", fontSize: 13, lineHeight: 1.5 }}>
              {concert.notes || <span style={{ color: "#2e2e4a" }}>—</span>}
            </div>
          )}
        </div>

        {/* Setlist */}
        {past && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#6b6a8f", marginBottom: 8, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Setlist</div>
            {editing ? (
              <input
                value={form.setlistUrl || ""}
                onChange={e => update("setlistUrl", e.target.value)}
                placeholder="Paste Spotify or setlist.fm URL..."
                style={inputStyle}
              />
            ) : (
              <SetlistSection concert={concert} />
            )}
          </div>
        )}

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
                  <button onClick={()=>{ onDelete(concert.id); onClose(); }} style={{ flex:1, padding:"8px", borderRadius:8, fontSize:12, cursor:"pointer", background:"#f472b6", border:"none", color:"#0c0c14", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Collapsible({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{
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

function StatsView({ concerts, settings = {} }) {
  const {
    topArtistsRows = 5, topFriendsRows = 8,
    topVenuesRows = 5, topExpensiveRows = 10,
    defaultStatsTab = "summary"
  } = settings;
  const past = concerts.filter(c => isPast(c.date));
  const shows = past.filter(c => c.type === "concert");
  const festivals = past.filter(c => c.type === "festival");
  const solo = past.filter(c => c.friends.length === 0);
  const withFriends = past.filter(c => c.friends.length > 0);

  const totalSpent = past.reduce((sum, c) => {
    const ticket = c.ticketPrice || 0;
    const merch = (c.merch || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
    return sum + ticket + merch;
  }, 0);

  // Artists frequency
  const artistCount = {};
  past.forEach(c => { artistCount[c.artist] = (artistCount[c.artist] || 0) + 1; });
  const topArtists = Object.entries(artistCount).sort((a,b) => b[1]-a[1]).slice(0, topArtistsRows);

  // Friends frequency
  const friendCount = {};
  past.forEach(c => c.friends.forEach(f => { friendCount[f] = (friendCount[f] || 0) + 1; }));
  const topFriends = Object.entries(friendCount).sort((a,b) => b[1]-a[1]).slice(0, topFriendsRows);

  // Venues
  const venueCount = {};
  past.forEach(c => { venueCount[c.venue] = (venueCount[c.venue] || 0) + 1; });
  const topVenues = Object.entries(venueCount).sort((a,b) => b[1]-a[1]).slice(0, topVenuesRows);

  // Countries
  const countryCount = {};
  past.forEach(c => { countryCount[c.country] = (countryCount[c.country] || 0) + 1; });

  // Years
  const yearCount = {};
  const yearSpend = {};
  past.forEach(c => {
    const y = getYear(c.date);
    yearCount[y] = (yearCount[y] || 0) + 1;
    const spent = (c.ticketPrice || 0) + (c.merch || []).reduce((s,m) => s + (parseFloat(m.price)||0), 0);
    yearSpend[y] = (yearSpend[y] || 0) + spent;
  });
  const years = Object.keys(yearCount).sort();

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
  const totalMerch = past.reduce((sum, c) => {
    const m = (c.merch || []).reduce((s,x) => s + (parseFloat(x.price)||0), 0);
    const y = getYear(c.date);
    yearMerchSpend[y] = (yearMerchSpend[y] || 0) + m;
    return sum + m;
  }, 0);
  const totalTickets = past.reduce((sum,c) => sum + (c.ticketPrice||0), 0);


  const monthCount = {};
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  past.forEach(c => {
    const m = parseInt(c.date.split("-")[1]) - 1;
    monthCount[m] = (monthCount[m] || 0) + 1;
  });

  // Top 10 most expensive
  const topExpensive = [...past]
    .filter(c => c.ticketPrice)
    .sort((a,b) => b.ticketPrice - a.ticketPrice)
    .slice(0, topExpensiveRows);

  // Cumulative shows over time
  const sortedPast = [...past].sort((a,b) => a.date.localeCompare(b.date));
  const cumulative = sortedPast.map((c, i) => ({ date: c.date.slice(0,7), count: i+1, artist: c.artist }));

  // Venue size buckets (field-based)
  const venueSizes = { "Club / Small": 0, "Mid-size": 0, "Arena": 0, "Festival": 0 };
  past.forEach(c => {
    if (c.type === "festival") venueSizes["Festival"]++;
    else if (c.venueSize === "arena") venueSizes["Arena"]++;
    else if (c.venueSize === "mid") venueSizes["Mid-size"]++;
    else venueSizes["Club / Small"]++;
  });

  // Avg shows per year
  const avgPerYear = years.length ? (past.length / years.length).toFixed(1) : null;

  // Genre breakdown
  const genreCount = {};
  past.forEach(c => { if (c.genre) genreCount[c.genre] = (genreCount[c.genre] || 0) + 1; });
  const topGenres = Object.entries(genreCount).sort((a,b) => b[1]-a[1]);

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
  const Donut = ({ segments, size = 120 }) => {
    const total = segments.reduce((s, x) => s + x.value, 0);
    if (total === 0) return null;
    const cx = size/2, cy = size/2, r = size*0.38, stroke = size*0.14;
    let angle = -90;
    const arcs = segments.map(seg => {
      const pct = seg.value / total;
      const start = angle;
      angle += pct * 360;
      const startRad = (start * Math.PI) / 180;
      const endRad = ((angle-0.5) * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad),   y2 = cy + r * Math.sin(endRad);
      const large = pct > 0.5 ? 1 : 0;
      return { ...seg, d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, pct };
    });
    return (
      <svg width={size} height={size}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="butt" />
        ))}
        <text x={cx} y={cy+2} textAnchor="middle" dominantBaseline="middle" fill="#e2e0ff" fontSize={size*0.13} fontFamily="'Syne',sans-serif" fontWeight="800">{total}</text>
        <text x={cx} y={cy+size*0.14} textAnchor="middle" dominantBaseline="middle" fill="#6b6a8f" fontSize={size*0.09} fontFamily="'DM Mono',monospace">total</text>
      </svg>
    );
  };

  const CHART_GROUPS = [
    {
      id: "artists", label: "Artists",
      charts: [
        { id: "artists",    label: "🎤 Top artists" },
        { id: "year-count", label: "📅 Shows per year" },
        { id: "months",     label: "📆 Busiest months" },
        ...(rated.length > 0 ? [{ id: "ratings", label: "⭐ Ratings" }] : []),
        ...(topGenres.length > 0 ? [{ id: "genres", label: "🎸 Genres" }] : []),
      ]
    },
    {
      id: "friends", label: "Friends",
      charts: [
        { id: "friends-chart", label: "👥 Most shows with" },
        { id: "solo",          label: "👯 Solo vs with friends" },
      ]
    },
    {
      id: "venues", label: "Venues",
      charts: [
        { id: "venues",      label: "📍 Favourite venues" },
        { id: "venue-size",  label: "🏟️ Venue size" },
        { id: "countries",   label: "🌍 Countries" },
      ]
    },
    {
      id: "financial", label: "Financial",
      charts: [
        { id: "year-spend", label: "💸 Spending & avg ticket per year" },
        { id: "expensive",  label: "💰 Most expensive shows" },
      ]
    },
    {
      id: "merch", label: "Merch",
      charts: [
        { id: "merch-overview", label: "🛍️ Merch overview" },
        { id: "merch-types",    label: "👕 What I buy most" },
        { id: "merch-artists",  label: "🎤 By artist" },
      ]
    },
  ];

  const [statsTab, setStatsTab] = useState(defaultStatsTab);
  const [chartGroup, setChartGroup] = useState("artists");
  const [selectedChart, setSelectedChart] = useState("artists");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeGroup = CHART_GROUPS.find(g => g.id === chartGroup);
  const activeChart = activeGroup?.charts.find(c => c.id === selectedChart) || activeGroup?.charts[0];

  const renderChart = (id) => {
    switch(id) {
      case "year-count": return (
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
          {years.map(([y, count], i) => null) && null}
          {Object.entries(yearCount).sort((a,b) => b[0].localeCompare(a[0])).map(([y, count], i, arr) => (
            <div key={y} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: "#c4c2f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", width: 36, flexShrink: 0 }}>{y}</span>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <div style={{ height: 4, borderRadius: 2, background: "#a78bfa", width: Math.max(16, (count / Math.max(...Object.values(yearCount))) * 80) }} />
                <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 28, textAlign: "right" }}>{count}</span>
              </div>
            </div>
          ))}
        </div>
      );
      case "year-spend": return (
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#f472b6" }} />
              <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Total spend</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#38bdf8" }} />
              <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Avg ticket</span>
            </div>
          </div>
          {/* Grouped bars */}
          {(() => {
            const activeYears = years.filter(y => yearSpend[y] > 0);
            const maxSpend = Math.max(...activeYears.map(y => yearSpend[y]), 1);
            const maxAvg = Math.max(...activeYears.filter(y => yearTicketCount[y]).map(y => yearTicketSum[y] / yearTicketCount[y]), 1);
            // normalise both to same scale — use maxSpend as reference
            return activeYears.map(y => {
              const spend = yearSpend[y] || 0;
              const avg = yearTicketCount[y] ? yearTicketSum[y] / yearTicketCount[y] : null;
              const spendW = Math.max(4, (spend / maxSpend) * 100);
              const avgW = avg ? Math.max(4, (avg / maxSpend) * 100) : 0;
              return (
                <div key={y} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ color: "#c4c2f0", fontSize: 12, fontFamily: "'DM Sans', sans-serif", width: 36, flexShrink: 0 }}>{y}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                    {/* Spend bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ height: 7, borderRadius: 3, background: "#f472b6", width: `${spendW}%`, transition: "width 0.5s ease" }} />
                      <span style={{ fontSize: 10, color: "#f472b6", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>€{Math.round(spend)}</span>
                    </div>
                    {/* Avg bar */}
                    {avg && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ height: 7, borderRadius: 3, background: "#38bdf8", width: `${avgW}%`, opacity: 0.8, transition: "width 0.5s ease" }} />
                        <span style={{ fontSize: 10, color: "#38bdf8", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>€{avg.toFixed(0)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
          <div style={{ borderTop: "1px solid #1f1f35", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>total</span>
            <span style={{ color: "#f472b6", fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>€{Math.round(totalSpent)}</span>
          </div>
        </div>
      );
      case "avg-ticket": return null;
      case "expensive": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          {topExpensive.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#c4c2f0", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.artist}</div>
                <div style={{ color: "#4a4870", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{c.date.slice(0,4)} · {c.venue}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ height: 4, borderRadius: 2, background: "#a78bfa", width: Math.max(12, (c.ticketPrice / topExpensive[0].ticketPrice) * 50) }} />
                <span style={{ color: "#a78bfa", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 44, textAlign: "right" }}>€{c.ticketPrice}</span>
              </div>
            </div>
          ))}
        </div>
      );
      case "over-time": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          <svg width="100%" height={120} viewBox="0 0 300 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {(() => {
              if (cumulative.length < 2) return null;
              const n = cumulative.length;
              const maxC = cumulative[n-1].count;
              const pts = cumulative.map((d, i) => `${(i/(n-1))*294+3},${96-(d.count/maxC)*88}`);
              const linePath = "M " + pts.join(" L ");
              const areaPath = linePath + ` L 297,96 L 3,96 Z`;
              return (<>
                <path d={areaPath} fill="url(#lineGrad)" />
                <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={3} cy={96-(cumulative[0].count/maxC)*88} r="3" fill="#a78bfa" />
                <circle cx={297} cy={96-(cumulative[cumulative.length-1].count/maxC)*88} r="3" fill="#a78bfa" />
              </>);
            })()}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{sortedPast[0]?.date.slice(0,7)}</span>
            <span style={{ fontSize: 10, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>{past.length} total</span>
            <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{sortedPast[sortedPast.length-1]?.date.slice(0,7)}</span>
          </div>
        </div>
      );
      case "months": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginBottom: 6 }}>
            {monthNames.map((name, i) => {
              const count = monthCount[i] || 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 9, color: count > 0 ? "#a78bfa" : "transparent", fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>{count || ""}</div>
                  <div style={{ width: "100%", background: count > 0 ? "#a78bfa" : "#0e0e1a", borderRadius: "2px 2px 0 0", height: `${Math.max(3, (count/Math.max(maxMonth,1))*60)}px` }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {monthNames.map((name, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{name[0]}</div>
            ))}
          </div>
        </div>
      );
      case "solo": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px", display: "flex", alignItems: "center", gap: 20 }}>
          <Donut segments={[{ value: withFriends.length, color: "#a78bfa" }, { value: solo.length, color: "#1f1f35" }]} size={110} />
          <div style={{ flex: 1 }}>
            {[{ label: "With friends", value: withFriends.length, color: "#a78bfa" }, { label: "Solo", value: solo.length, color: "#6b6a8f" }].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ color: "#c4c2f0", fontSize: 13, flex: 1 }}>{s.label}</span>
                <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{s.value} ({Math.round(s.value/Math.max(past.length,1)*100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      );
      case "venue-size": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px", display: "flex", alignItems: "center", gap: 20 }}>
          <Donut segments={[
            { value: venueSizes["Arena"], color: "#a78bfa" },
            { value: venueSizes["Mid-size"], color: "#f472b6" },
            { value: venueSizes["Club / Small"], color: "#7c3aed" },
            { value: venueSizes["Festival"], color: "#4f46e5" },
          ].filter(s=>s.value>0)} size={110} />
          <div style={{ flex: 1 }}>
            {[{ label: "Arena", color: "#a78bfa" }, { label: "Mid-size", color: "#f472b6" }, { label: "Club / Small", color: "#7c3aed" }, { label: "Festival", color: "#4f46e5" }]
              .filter(s => venueSizes[s.label] > 0).map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ color: "#c4c2f0", fontSize: 13, flex: 1 }}>{s.label}</span>
                <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{venueSizes[s.label]}</span>
              </div>
            ))}
          </div>
        </div>
      );
      case "countries": return (
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
          {Object.entries(countryCount).sort((a,b)=>b[1]-a[1]).map(([country, count]) => (
            <div key={country} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: "#c4c2f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", flex: 1 }}>{country}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div style={{ height: 4, borderRadius: 2, background: "#38bdf8", width: Math.max(16, (count / Math.max(...Object.values(countryCount))) * 80) }} />
                <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 20, textAlign: "right" }}>{count}</span>
              </div>
            </div>
          ))}
        </div>
      );
      case "ratings": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          {[5,4,3,2,1].map(n => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ color: "#a78bfa", fontSize: 12, width: 36, flexShrink: 0 }}>{"★".repeat(n)}</span>
              <div style={{ flex: 1, height: 7, background: "#0e0e1a", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: "#a78bfa", width: `${(ratingDist[n]/Math.max(...Object.values(ratingDist),1))*100}%` }} />
              </div>
              <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 16, textAlign: "right" }}>{ratingDist[n]}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #1e3028", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>average</span>
            <span style={{ color: "#a78bfa", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{avgRating} ★</span>
          </div>
        </div>
      );
      case "artists": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          <ListStat title="" items={topArtists} suffix="x" />
        </div>
      );
      case "friends-chart": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          <ListStat title="" items={topFriends} suffix=" shows" />
        </div>
      );
      case "venues": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          <ListStat title="" items={topVenues} suffix="x" />
        </div>
      );
      case "merch-overview": return (
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
          {/* Summary row */}
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
          {/* Top 3 most expensive items */}
          {topMerchItems.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Top 3 most expensive</div>
              {topMerchItems.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#e2e0ff" }}>{m.item}</div>
                    <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{m.artist}</div>
                  </div>
                  <span style={{ color: "#f472b6", fontSize: 13, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>€{parseFloat(m.price).toFixed(2)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      );
      case "merch-types": return (
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
          {topMerchTypes.length === 0
            ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>No merch data yet</div>
            : topMerchTypes.map(([type, count], i) => (
              <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18 }}>#{i+1}</span>
                  <span style={{ color: "#c4c2f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>{type}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ height: 4, borderRadius: 2, background: "#a78bfa", width: Math.max(16, (count / topMerchTypes[0][1]) * 80) }} />
                  <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 20, textAlign: "right" }}>{count}x</span>
                </div>
              </div>
            ))
          }
        </div>
      );
      case "merch-artists": return (
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
          {topArtistMerch.length === 0
            ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>No merch data yet</div>
            : topArtistMerch.map(([artist, spend], i) => (
              <div key={artist} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18 }}>#{i+1}</span>
                  <span style={{ color: "#c4c2f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{artist}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ height: 4, borderRadius: 2, background: "#f472b6", width: Math.max(16, (spend / topArtistMerch[0][1]) * 80) }} />
                  <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 40, textAlign: "right" }}>€{spend.toFixed(0)}</span>
                </div>
              </div>
            ))
          }
        </div>
      );
      case "genres": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          {topGenres.length === 0
            ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>No genre data yet</div>
            : <ListStat title="" items={topGenres} suffix="x" />
          }
        </div>
      );
      default: return null;
    }
  };

  return (
    <div style={{ padding: "0 0 100px" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid #0d1a14", marginBottom: 0 }}>
        {[{ id: "summary", label: "Summary" }, { id: "charts", label: "Charts" }].map(t => (
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
        <div style={{ padding: "16px 16px 0" }}>

          {/* Row 1: shows / festivals / countries / avg per year */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
            {[
              { label: "shows", value: shows.length },
              { label: "festivals", value: festivals.length },
              { label: "countries", value: Object.keys(countryCount).length },
              { label: "avg / year", value: avgPerYear ?? "—" },
            ].map(b => (
              <div key={b.label} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 8, padding: "10px 4px", textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#a78bfa", lineHeight: 1 }}>{b.value}</div>
                <div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>{b.label}</div>
              </div>
            ))}
          </div>

          {/* Row 2: total spend / avg ticket all time / avg ticket this year */}
          {(() => {
            const thisYear = String(new Date().getFullYear());
            const allTickets = concerts.filter(c => c.ticketPrice);
            const thisYearTickets = allTickets.filter(c => getYear(c.date) === thisYear);
            const avgAll = allTickets.length ? allTickets.reduce((s,c) => s + c.ticketPrice, 0) / allTickets.length : null;
            const avgThisYear = thisYearTickets.length ? thisYearTickets.reduce((s,c) => s + c.ticketPrice, 0) / thisYearTickets.length : null;
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
                {[
                  { label: "total spent", value: totalSpent > 0 ? `€${Math.round(totalSpent)}` : "—", color: "#f472b6" },
                  { label: "avg ticket", value: avgAll ? `€${avgAll.toFixed(0)}` : "—", color: "#f472b6" },
                  { label: `avg ${thisYear}`, value: avgThisYear ? `€${avgThisYear.toFixed(0)}` : "—", color: "#38bdf8" },
                ].map(b => (
                  <div key={b.label} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: b.color, lineHeight: 1 }}>{b.value}</div>
                    <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Cumulative line chart */}
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 12 }}>
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
              const allSorted = [...concerts].sort((a,b) => a.date.localeCompare(b.date));
              if (allSorted.length < 2) return null;
              const n = allSorted.length;
              const W = 300, H = 80;
              const firstMs = new Date(allSorted[0].date).getTime();
              // extend x-axis to last upcoming show
              const lastMs = new Date(allSorted[n-1].date).getTime();
              const rangeMs = lastMs - firstMs || 1;
              const todayMs = new Date().getTime();
              const todayX = Math.min(W - 3, ((todayMs - firstMs) / rangeMs) * (W - 6) + 3);

              const coords = allSorted.map((c, i) => ({
                x: ((new Date(c.date).getTime() - firstMs) / rangeMs) * (W - 6) + 3,
                y: H - 6 - ((i + 1) / n) * (H - 14),
                isPast: isPast(c.date),
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
                <svg width="100%" viewBox={`0 0 ${W} ${H+14}`} style={{ overflow: "visible" }}>
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
                  {/* Today line */}
                  <line x1={todayX} y1={0} x2={todayX} y2={H-4} stroke="#2e2e50" strokeWidth="1" />
                  {/* Past area fill */}
                  {areaPath && <path d={areaPath} fill="url(#cumGrad)" />}
                  {/* Past line — purple */}
                  {pastPath && <path d={pastPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {/* Upcoming line — light blue dashed */}
                  {upcomingPath && <path d={upcomingPath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" opacity="0.8" />}
                  {/* Dots */}
                  {pastCoords.length > 0 && <circle cx={pastCoords[0].x} cy={pastCoords[0].y} r="3" fill="#a78bfa" />}
                  {pastCoords.length > 0 && <circle cx={todayX} cy={todayY} r="3" fill="#a78bfa" />}
                  {upcomingCoords.length > 0 && <circle cx={upcomingCoords[upcomingCoords.length-1].x} cy={upcomingCoords[upcomingCoords.length-1].y} r="3" fill="#38bdf8" opacity="0.8" />}
                </svg>
              );
            })()}
          </div>

          {/* Two donuts side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {/* Solo vs friends */}
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Solo vs friends</div>
              <Donut segments={[
                { value: withFriends.length, color: "#a78bfa" },
                { value: solo.length, color: "#2e2e4a" },
              ]} size={90} />
              <div style={{ marginTop: 10, width: "100%" }}>
                {[{ label: "w. friends", value: withFriends.length, color: "#a78bfa" }, { label: "solo", value: solo.length, color: "#4a4870" }].map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "#c4c2f0", flex: 1, fontFamily: "'DM Sans', sans-serif" }}>{s.label}</span>
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Venue size */}
            <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Venue size</div>
              <Donut segments={[
                { value: venueSizes["Arena"], color: "#a78bfa" },
                { value: venueSizes["Mid-size"], color: "#f472b6" },
                { value: venueSizes["Club / Small"], color: "#38bdf8" },
                { value: venueSizes["Festival"], color: "#2e2e4a" },
              ].filter(s => s.value > 0)} size={90} />
              <div style={{ marginTop: 10, width: "100%" }}>
                {[
                  { label: "arena", color: "#a78bfa", key: "Arena" },
                  { label: "mid-size", color: "#f472b6", key: "Mid-size" },
                  { label: "club", color: "#38bdf8", key: "Club / Small" },
                  { label: "festival", color: "#4a4870", key: "Festival" },
                ].filter(s => venueSizes[s.key] > 0).map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "#c4c2f0", flex: 1, fontFamily: "'DM Sans', sans-serif" }}>{s.label}</span>
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>{venueSizes[s.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Countdown — next 3 upcoming shows */}
          {(() => {
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
                    <div key={c.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
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
                        <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>{c.venue} · {c.city}</div>
                      </div>
                      <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                        {new Date(c.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        </div>
      )}
      {statsTab === "charts" && (
        <div style={{ padding: "0" }}>
          {/* Category grid — 1 row, no scrolling */}
          <div style={{ display: "flex", gap: 5, padding: "10px 16px", borderBottom: "1px solid #0d1a14" }}>
            {CHART_GROUPS.map(g => (
              <button key={g.id} onClick={() => setChartGroup(g.id)} style={{
                flex: 1, background: chartGroup === g.id ? "#1a1a30" : "none",
                border: `1px solid ${chartGroup === g.id ? "#a78bfa" : "#1f1f35"}`,
                borderRadius: 6, padding: "5px 2px", cursor: "pointer",
                fontFamily: "'DM Mono', monospace", fontSize: 9,
                fontWeight: chartGroup === g.id ? 700 : 400,
                color: chartGroup === g.id ? "#a78bfa" : "#5a5880",
                textAlign: "center", whiteSpace: "nowrap"
              }}>{g.label}</button>
            ))}
          </div>
          {/* All charts in group stacked */}
          <div style={{ padding: "14px 16px 0" }}>
            {activeGroup?.charts.map((c, i) => (
              <div key={c.id} style={{ marginBottom: i < activeGroup.charts.length - 1 ? 16 : 0 }}>
                <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{c.label}</div>
                {renderChart(c.id)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FriendsView({ concerts }) {
  const past = concerts.filter(c => isPast(c.date));

  const allFriends = [...new Set(past.flatMap(c => c.friends))].sort();
  const friendStats = {};
  allFriends.forEach(f => {
    friendStats[f] = past.filter(c => c.friends.includes(f));
  });

  const sorted = Object.entries(friendStats).sort((a,b) => b[1].length - a[1].length);

  return (
    <div style={{ padding: "0 20px 100px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#e2e0ff", marginBottom: 20, paddingTop: 8 }}>
        Friends
      </div>
      {sorted.map(([name, shows]) => (
        <div key={name} style={{
          background: "#13131f", border: "1px solid #1e3028", borderRadius: 12,
          padding: "14px 16px", marginBottom: 10
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "#e2e0ff" }}>{name}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#a78bfa" }}>{shows.length} show{shows.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {shows.slice(0,6).map(c => (
              <span key={c.id} style={{
                fontSize: 11, padding: "2px 7px", borderRadius: 99,
                background: "#17172a", color: "#6b6a8f", border: "1px solid #1e3028"
              }}>{c.artist}</span>
            ))}
            {shows.length > 6 && (
              <span style={{ fontSize: 11, color: "#4a4870" }}>+{shows.length - 6} more</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtistsView({ concerts, onOpen }) {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [search, setSearch] = useState("");

  const past = concerts.filter(c => isPast(c.date));

  // Group all concerts (past + upcoming) by artist
  const artistMap = {};
  concerts.forEach(c => {
    if (!artistMap[c.artist]) artistMap[c.artist] = [];
    artistMap[c.artist].push(c);
  });

  const artists = Object.entries(artistMap)
    .sort((a, b) => b[1].filter(c => isPast(c.date)).length - a[1].filter(c => isPast(c.date)).length || a[0].localeCompare(b[0]))
    .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()));

  if (selectedArtist) {
    const shows = artistMap[selectedArtist].sort((a,b) => b.date.localeCompare(a.date));
    const pastShows = shows.filter(c => isPast(c.date));
    const upcomingShows = shows.filter(c => !isPast(c.date));
    return (
      <div style={{ padding: "0 0 100px" }}>
        {/* Artist header */}
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSelectedArtist(null)} style={{
            background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1
          }}>←</button>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>{selectedArtist}</div>
            <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
              {pastShows.length} show{pastShows.length !== 1 ? "s" : ""}{upcomingShows.length > 0 ? ` · ${upcomingShows.length} upcoming` : ""}
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 16px" }}>
          {upcomingShows.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Upcoming</div>
              {upcomingShows.map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
            </div>
          )}
          {pastShows.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Past</div>
              {pastShows.map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 100px" }}>
      {/* Search */}
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ position: "relative" }}>
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
      </div>

      {/* Artist list */}
      <div style={{ padding: "4px 16px" }}>
        {artists.map(([name, shows]) => {
          const pastCount = shows.filter(c => isPast(c.date)).length;
          const upcomingCount = shows.filter(c => !isPast(c.date)).length;
          const lastShow = shows.filter(c => isPast(c.date)).sort((a,b) => b.date.localeCompare(a.date))[0];
          const tours = [...new Set(shows.map(c => c.tour).filter(Boolean))];
          return (
            <button key={name} onClick={() => setSelectedArtist(name)} style={{
              width: "100%", textAlign: "left", background: "#13131f",
              border: "1px solid #1f1f35", borderLeft: `3px solid ${upcomingCount > 0 ? "#a78bfa" : "#2e2e4a"}`,
              borderRadius: 10, padding: "12px 14px", cursor: "pointer", marginBottom: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#e2e0ff", marginBottom: 3 }}>{name}</div>
                <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
                  {lastShow ? `last: ${formatDate(lastShow.date)}` : upcomingCount > 0 ? `upcoming: ${formatDate(shows[0].date)}` : ""}
                </div>
                {tours.length > 0 && (
                  <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tours.join(" · ")}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{pastCount}</div>
                <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>show{pastCount !== 1 ? "s" : ""}</div>
                {upcomingCount > 0 && <div style={{ fontSize: 9, color: "#a78bfa", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>+{upcomingCount} soon</div>}
              </div>
            </button>
          );
        })}
        {artists.length === 0 && (
          <div style={{ textAlign: "center", color: "#2e2e4a", padding: "40px 0", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>no artists found</div>
        )}
      </div>
    </div>
  );
}

function ArtistShowRow({ concert, onOpen }) {
  const past = isPast(concert.date);
  return (
    <button onClick={() => onOpen(concert)} style={{
      width: "100%", textAlign: "left", background: past ? "#0e0e1a" : "#13131f",
      border: "1px solid #1f1f35", borderRadius: 10, padding: "11px 14px",
      cursor: "pointer", marginBottom: 6, display: "flex", alignItems: "center", gap: 12
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#e2e0ff", fontWeight: 500, marginBottom: 2 }}>
          {formatDate(concert.date)}
        </div>
        <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
          {concert.venue}{concert.room ? ` · ${concert.room}` : ""} · {concert.city}
        </div>
        {concert.tour && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2 }}>{concert.tour}</div>}
        {concert.friends.length > 0 && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2 }}>w. {concert.friends.join(", ")}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {concert.rating && <div style={{ color: "#a78bfa", fontSize: 12 }}>{"★".repeat(concert.rating)}</div>}
        {concert.ticketPrice && <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>€{concert.ticketPrice}</div>}
        {!past && <div style={{ fontSize: 9, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>upcoming</div>}
      </div>
    </button>
  );
}

function AddConcertForm({ onSave, onClose, settings = {}, friends = [] }) {
  const [form, setForm] = useState({
    artist: '', date: '', venue: '', room: '', city: '', country: '',
    type: 'concert', tour: '', support: [], friends: [], solo: false,
    rating: null, ticketPrice: null, merch: [], notes: '',
    genre: null, language: null, venueSize: null
  })
  const [supportInput, setSupportInput] = useState('')
  const [friendInput, setFriendInput] = useState('')
  const [errors, setErrors] = useState({})

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))

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
    if (!t || form.support.includes(t)) return
    setForm(f => ({ ...f, support: [...f.support, t] }))
    setSupportInput('')
  }

  const validate = () => {
    const e = {}
    if (!form.artist.trim()) e.artist = true
    if (!form.date) e.date = true
    if (!form.venue.trim()) e.venue = true
    if (!form.city.trim()) e.city = true
    if (!form.country.trim()) e.country = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    onSave({ ...form, id })
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
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: '#e2e0ff', flex: 1 }}>Add concert</div>
        <button onClick={handleSave} style={{ background: '#a78bfa', border: '1px solid #a78bfa', color: '#0c0c14', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Save</button>
      </div>
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Type')}
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ id: 'concert', label: '🎤 Concert' }, { id: 'festival', label: '🎪 Festival' }].map(t => (
              <button key={t.id} onClick={() => update('type', t.id)} style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                background: form.type === t.id ? '#1a1a30' : '#13131f',
                border: `1px solid ${form.type === t.id ? '#a78bfa' : '#2e2e50'}`,
                color: form.type === t.id ? '#a78bfa' : '#6b6a8f',
                fontWeight: form.type === t.id ? 700 : 400, fontFamily: "'DM Sans', sans-serif"
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Artist *')}
          <input value={form.artist} onChange={e => update('artist', e.target.value)} placeholder="Artist name" style={errors.artist ? errStyle : inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Date *')}
          <input type="date" value={form.date} onChange={e => update('date', e.target.value)} style={errors.date ? errStyle : inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Venue *')}
          <input value={form.venue} onChange={e => update('venue', e.target.value)} placeholder="Venue name" style={{ ...(errors.venue ? errStyle : inputStyle), marginBottom: 8 }} />
          <input value={form.room} onChange={e => update('room', e.target.value)} placeholder="Room / stage (optional)" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            {fieldLabel('City *')}
            <input value={form.city} onChange={e => update('city', e.target.value)} placeholder="City" style={errors.city ? errStyle : inputStyle} />
          </div>
          <div>
            {fieldLabel('Country *')}
            <input value={form.country} onChange={e => update('country', e.target.value)} placeholder="Country" style={errors.country ? errStyle : inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Tour')}
          <input value={form.tour} onChange={e => update('tour', e.target.value)} placeholder="Tour name (optional)" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Venue size')}
          <div style={{ display: 'flex', gap: 6 }}>
            {[{id:'small',label:'Club'},{id:'mid',label:'Mid-size'},{id:'arena',label:'Arena'}].map(vs => (
              <button key={vs.id} onClick={() => update('venueSize', form.venueSize===vs.id ? null : vs.id)} style={{
                flex: 1, padding: '6px 8px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                background: form.venueSize===vs.id ? '#a78bfa' : '#13131f',
                color: form.venueSize===vs.id ? '#0c0c14' : '#6b6a8f',
                border: `1px solid ${form.venueSize===vs.id ? '#a78bfa' : '#2e2e50'}`,
                fontWeight: form.venueSize===vs.id ? 700 : 400
              }}>{vs.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Support acts')}
          {form.support.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {form.support.map(s => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1a1a30', border: '1px solid #2e2e50', borderRadius: 99, padding: '3px 10px', fontSize: 12, color: '#a78bfa' }}>
                  {s}
                  <button onClick={() => setForm(f => ({ ...f, support: f.support.filter(x => x !== s) }))} style={{ background: 'none', border: 'none', color: '#6b6a8f', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={supportInput} onChange={e => setSupportInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSupport()} placeholder="Add support act..." style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addSupport} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '0 12px', cursor: 'pointer' }}>+</button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Went with')}
          {allFriendChoices.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {allFriendChoices.map(name => (
                <button key={name} onClick={() => toggleFriend(name)} style={{
                  padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                  background: form.friends.includes(name) ? '#a78bfa' : '#13131f',
                  color: form.friends.includes(name) ? '#0c0c14' : '#6b6a8f',
                  border: `1px solid ${form.friends.includes(name) ? '#a78bfa' : '#2e2e50'}`,
                  fontWeight: form.friends.includes(name) ? 700 : 400
                }}>{name}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={friendInput} onChange={e => setFriendInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomFriend()} placeholder="Add friend..." style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addCustomFriend} style={{ background: 'none', border: '1px solid #2a4a3a', borderRadius: 6, color: '#a78bfa', fontSize: 11, padding: '0 12px', cursor: 'pointer' }}>+</button>
          </div>
          <button onClick={() => setForm(f => ({ ...f, solo: !f.solo, friends: [] }))} style={{
            marginTop: 8, padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
            background: form.solo ? '#a78bfa' : '#13131f',
            color: form.solo ? '#0c0c14' : '#6b6a8f',
            border: `1px solid ${form.solo ? '#a78bfa' : '#2e2e50'}`,
            fontWeight: form.solo ? 700 : 400
          }}>solo</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Genre')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(settings.genres||[]).map(g => (
              <button key={g} onClick={() => update('genre', form.genre===g ? null : g)} style={{
                padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                background: form.genre===g ? '#a78bfa' : '#13131f',
                color: form.genre===g ? '#0c0c14' : '#6b6a8f',
                border: `1px solid ${form.genre===g ? '#a78bfa' : '#2e2e50'}`,
                fontWeight: form.genre===g ? 700 : 400
              }}>{g}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Language')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(settings.languages||[]).map(l => (
              <button key={l} onClick={() => update('language', form.language===l ? null : l)} style={{
                padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                background: form.language===l ? '#a78bfa' : '#13131f',
                color: form.language===l ? '#0c0c14' : '#6b6a8f',
                border: `1px solid ${form.language===l ? '#a78bfa' : '#2e2e50'}`,
                fontWeight: form.language===l ? 700 : 400
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Ticket price')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#6b6a8f' }}>€</span>
            <input type="number" value={form.ticketPrice || ''} placeholder="0.00" onChange={e => update('ticketPrice', e.target.value ? parseFloat(e.target.value) : null)} style={{ ...inputStyle, width: 100 }} />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          {fieldLabel('Notes')}
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Any notes..." />
        </div>
      </div>
    </div>
  )
}

function SettingsView({ settings, onUpdate, concerts = [], onSaveConcert, onSignOut, userEmail }) {
  const [exportData, setExportData] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [newGenre, setNewGenre] = useState("");
  const [newLanguage, setNewLanguage] = useState("");

  const categories = settings.merchCategories || [];
  const genres = settings.genres || [];
  const languages = settings.languages || [];

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.map(c=>c.toLowerCase()).includes(trimmed.toLowerCase())) return;
    onUpdate("merchCategories", [...categories, trimmed]);
    setNewCategory("");
  };

  const removeCategory = (cat) => {
    onUpdate("merchCategories", categories.filter(c => c !== cat));
  };

  const addGenre = () => {
    const trimmed = newGenre.trim();
    if (!trimmed || genres.map(g=>g.toLowerCase()).includes(trimmed.toLowerCase())) return;
    onUpdate("genres", [...genres, trimmed]);
    setNewGenre("");
  };

  const removeGenre = (g) => onUpdate("genres", genres.filter(x => x !== g));

  const addLanguage = () => {
    const trimmed = newLanguage.trim();
    if (!trimmed || languages.map(l=>l.toLowerCase()).includes(trimmed.toLowerCase())) return;
    onUpdate("languages", [...languages, trimmed]);
    setNewLanguage("");
  };

  const removeLanguage = (l) => onUpdate("languages", languages.filter(x => x !== l));

  const handleCsvExport = () => {
    const headers = ['Date','Artist','Venue','Room','City','Country','Type','Tour','Genre','Language','Rating','TicketPrice','Friends','Solo','Notes'];
    const rows = concerts.map(c => [
      c.date, c.artist, c.venue, c.room||'', c.city, c.country, c.type, c.tour||'',
      c.genre||'', c.language||'', c.rating||'', c.ticketPrice||'',
      (c.friends||[]).join('; '), c.solo?'yes':'', (c.notes||'').replace(/\n/g,' ')
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='settracker.csv'; a.click();
    URL.revokeObjectURL(url);
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
      setTimeout(() => setExportStatus(null), 2000);
    } catch (e) {
      setExportStatus("error");
    }
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error("not array");
      // Save each concert via onSaveConcert
      for (const concert of parsed) {
        await onSaveConcert(concert);
      }
      setImportStatus("success");
      setImportText("");
      setTimeout(() => { setImportStatus(null); window.location.reload(); }, 1500);
    } catch (e) {
      setImportStatus("error");
    }
  };

  const Row = ({ label, sub, children }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid #1a1a2e" }}>
      <div>
        <div style={{ fontSize: 13, color: "#e2e0ff", fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );

  const Stepper = ({ value, onChange, min = 3, max = 20 }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#13131f", border: "1px solid #1f1f35", borderRadius: 8, overflow: "hidden" }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={{
        background: "none", border: "none", color: "#6b6a8f", fontSize: 16, cursor: "pointer",
        padding: "6px 12px", lineHeight: 1
      }}>−</button>
      <span style={{ fontSize: 13, color: "#e2e0ff", fontFamily: "'DM Mono', monospace", minWidth: 24, textAlign: "center" }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} style={{
        background: "none", border: "none", color: "#6b6a8f", fontSize: 16, cursor: "pointer",
        padding: "6px 12px", lineHeight: 1
      }}>+</button>
    </div>
  );

  const OptionPills = ({ value, options, onChange }) => (
    <div style={{ display: "flex", gap: 5 }}>
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

  return (
    <div style={{ padding: "16px 20px 100px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#e2e0ff", marginBottom: 20 }}>Settings</div>

      <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Charts</div>
      <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "0 16px", marginBottom: 20 }}>
        <Row label="Top artists rows" sub="How many artists to show in charts">
          <Stepper value={settings.topArtistsRows} onChange={v => onUpdate("topArtistsRows", v)} />
        </Row>
        <Row label="Top friends rows" sub="How many friends to show in charts">
          <Stepper value={settings.topFriendsRows} onChange={v => onUpdate("topFriendsRows", v)} />
        </Row>
        <Row label="Top venues rows" sub="How many venues to show in charts">
          <Stepper value={settings.topVenuesRows} onChange={v => onUpdate("topVenuesRows", v)} />
        </Row>
        <Row label="Most expensive rows" sub="How many shows in expensive list">
          <Stepper value={settings.topExpensiveRows} onChange={v => onUpdate("topExpensiveRows", v)} min={3} max={20} />
        </Row>
      </div>

      <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Defaults</div>
      <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "0 16px", marginBottom: 20 }}>
        <Row label="Opening tab" sub="Which tab opens on launch">
          <OptionPills value={settings.defaultTab} options={[{id:"stats",label:"Stats"},{id:"home",label:"Shows"},{id:"artists",label:"Artists"}]} onChange={v => onUpdate("defaultTab", v)} />
        </Row>
        <Row label="Past shows" sub="Show past concerts by default">
          <OptionPills value={settings.defaultShowPast} options={[{id:"open",label:"Open"},{id:"closed",label:"Closed"}]} onChange={v => onUpdate("defaultShowPast", v)} />
        </Row>
        <Row label="Stats tab" sub="Which stats view opens first">
          <OptionPills value={settings.defaultStatsTab} options={[{id:"summary",label:"Summary"},{id:"charts",label:"Charts"}]} onChange={v => onUpdate("defaultStatsTab", v)} />
        </Row>
      </div>

      {/* Merch categories */}
      <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Merch categories</div>
      <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
          These appear in the dropdown when adding merch to a show.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {categories.map(cat => (
            <div key={cat} style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 99,
              padding: "4px 10px", fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif"
            }}>
              {cat}
              <button onClick={() => removeCategory(cat)} style={{
                background: "none", border: "none", color: "#4a4870", cursor: "pointer",
                fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2
              }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCategory()}
            placeholder="Add category..."
            style={{
              flex: 1, background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 8,
              color: "#c4c2f0", padding: "8px 12px", fontFamily: "'DM Sans', sans-serif",
              fontSize: 13
            }}
          />
          <button onClick={addCategory} style={{
            background: "#1a1a30", border: "1px solid #a78bfa", borderRadius: 8,
            color: "#a78bfa", padding: "8px 14px", cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600
          }}>Add</button>
        </div>
      </div>

      {/* Genres */}
      <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Genres</div>
      <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {genres.map(g => (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 4, background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 99, padding: "4px 10px", fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif" }}>
              {g}
              <button onClick={() => removeGenre(g)} style={{ background: "none", border: "none", color: "#4a4870", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newGenre} onChange={e => setNewGenre(e.target.value)} onKeyDown={e => e.key === "Enter" && addGenre()} placeholder="Add genre..." style={{ flex: 1, background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 8, color: "#c4c2f0", padding: "8px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }} />
          <button onClick={addGenre} style={{ background: "#1a1a30", border: "1px solid #a78bfa", borderRadius: 8, color: "#a78bfa", padding: "8px 14px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600 }}>Add</button>
        </div>
      </div>

      {/* Languages */}
      <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Languages</div>
      <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {languages.map(l => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 99, padding: "4px 10px", fontSize: 12, color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif" }}>
              {l}
              <button onClick={() => removeLanguage(l)} style={{ background: "none", border: "none", color: "#4a4870", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newLanguage} onChange={e => setNewLanguage(e.target.value)} onKeyDown={e => e.key === "Enter" && addLanguage()} placeholder="Add language..." style={{ flex: 1, background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 8, color: "#c4c2f0", padding: "8px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }} />
          <button onClick={addLanguage} style={{ background: "#1a1a30", border: "1px solid #a78bfa", borderRadius: 8, color: "#a78bfa", padding: "8px 14px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600 }}>Add</button>
        </div>
      </div>

      {/* Data backup */}
      <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Data backup</div>
      <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "16px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginBottom: 12, lineHeight: 1.5 }}>
          Export your full concert database including ratings, merch, and notes. Save this JSON somewhere safe — you can use it to restore your data later.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={handleCsvExport} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            background: "none", border: "1px solid #2e2e50", color: "#c4c2f0",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600
          }}>Export CSV</button>
        </div>

        {!exportData ? (
          <button onClick={handleExport} style={{
            width: "100%", padding: "10px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            background: "#1a1a30", border: "1px solid #a78bfa", color: "#a78bfa",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600
          }}>Export data</button>
        ) : (
          <div>
            <textarea
              readOnly
              value={exportData}
              rows={5}
              style={{
                width: "100%", background: "#0c0c14", border: "1px solid #1f1f35",
                borderRadius: 8, color: "#6b6a8f", padding: "10px", fontSize: 10,
                fontFamily: "'DM Mono', monospace", resize: "none", boxSizing: "border-box",
                marginBottom: 8
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCopy} style={{
                flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                background: exportStatus === "copied" ? "#a78bfa" : "#1a1a30",
                border: `1px solid ${exportStatus === "copied" ? "#a78bfa" : "#2e2e50"}`,
                color: exportStatus === "copied" ? "#0c0c14" : "#a78bfa",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 600
              }}>{exportStatus === "copied" ? "✓ Copied!" : "Copy to clipboard"}</button>
              <button onClick={() => setExportData(null)} style={{
                padding: "9px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                background: "none", border: "1px solid #1f1f35", color: "#6b6a8f",
                fontFamily: "'DM Sans', sans-serif"
              }}>×</button>
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid #1a1a2e", marginTop: 16, paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Restore from backup</div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste JSON backup here..."
            rows={4}
            style={{
              width: "100%", background: "#0c0c14", border: `1px solid ${importStatus === "error" ? "#f472b6" : "#1f1f35"}`,
              borderRadius: 8, color: "#c4c2f0", padding: "10px", fontSize: 10,
              fontFamily: "'DM Mono', monospace", resize: "none", boxSizing: "border-box", marginBottom: 8
            }}
          />
          {importStatus === "error" && <div style={{ fontSize: 11, color: "#f472b6", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Invalid JSON — check your backup and try again</div>}
          {importStatus === "success" && <div style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>✓ Restored! Reloading...</div>}
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            style={{
              width: "100%", padding: "9px", borderRadius: 8, fontSize: 12, cursor: importText.trim() ? "pointer" : "not-allowed",
              background: "none", border: "1px solid #1f1f35",
              color: importText.trim() ? "#c4c2f0" : "#2e2e4a",
              fontFamily: "'DM Sans', sans-serif"
            }}
          >Restore data</button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#2e2e4a", fontFamily: "'DM Mono', monospace", textAlign: "center", marginBottom: 20 }}>
        settings saved automatically
      </div>

      {/* Account */}
      <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Account</div>
      <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
          Signed in as <span style={{ color: "#a78bfa" }}>{userEmail}</span>
        </div>
        <button onClick={onSignOut} style={{
          width: "100%", padding: "10px", borderRadius: 8, fontSize: 13, cursor: "pointer",
          background: "none", border: "1px solid #2e2e50", color: "#6b6a8f",
          fontFamily: "'DM Sans', sans-serif"
        }}>Sign out</button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function ConcertTracker({ concerts, settings, onSaveConcert, onDeleteConcert, onUpdateSetting, onSignOut, userEmail }) {
  const today = new Date()
  const isPastDate = (dateStr) => new Date(dateStr + 'T00:00:00') <= today

  const [view, setView] = useState(settings.defaultTab || 'stats')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [filterFriend, setFilterFriend] = useState('all')
  const [filterVenue, setFilterVenue] = useState('all')
  const [filterRating, setFilterRating] = useState(0)
  const [filterSolo, setFilterSolo] = useState(false)
  const [filterGenre, setFilterGenre] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [showPast, setShowPast] = useState(settings.defaultShowPast === 'open')

  const allFriends = [...new Set(concerts.flatMap(c => c.friends))].sort()

  const handleSave = (updated) => {
    onSaveConcert(updated)
    setSelected(updated)
  }

  const updateSetting = (key, value) => {
    onUpdateSetting(key, value)
  }

  const years = [...new Set(concerts.map(c => c.date.slice(0,4)))].sort().reverse()
  const allVenues = [...new Set(concerts.map(c => c.venue))].sort()
  const activeFriends = [...new Set(concerts.flatMap(c => c.friends))].sort()

  const activeFilterCount = [
    filterYear !== 'all', filterType !== 'all',
    filterFriend !== 'all', filterVenue !== 'all', sortOrder !== 'newest',
    filterRating !== 0, filterSolo, filterGenre !== 'all'
  ].filter(Boolean).length

  const filtered = concerts.filter(c => {
    if (filterYear !== 'all' && c.date.slice(0,4) !== filterYear) return false
    if (filterType === 'concerts' && c.type !== 'concert') return false
    if (filterType === 'festivals' && c.type !== 'festival') return false
    if (filterFriend !== 'all' && !c.friends.includes(filterFriend)) return false
    if (filterVenue !== 'all' && c.venue !== filterVenue) return false
    if (filterRating !== 0 && (c.rating || 0) < filterRating) return false
    if (filterSolo && !(c.friends.length === 0 || c.solo)) return false
    if (filterGenre !== 'all' && c.genre !== filterGenre) return false
    if (search) {
      const q = search.toLowerCase()
      return c.artist.toLowerCase().includes(q) ||
        c.venue.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (c.tour || '').toLowerCase().includes(q) ||
        c.friends.some(f => f.toLowerCase().includes(q)) ||
        (c.support || []).some(s => s.toLowerCase().includes(q)) ||
        (c.notes || '').toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => {
    if (sortOrder === 'oldest') return a.date.localeCompare(b.date)
    if (sortOrder === 'alpha') return a.artist.localeCompare(b.artist)
    if (sortOrder === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (sortOrder === 'price') return (b.ticketPrice || 0) - (a.ticketPrice || 0)
    return b.date.localeCompare(a.date)
  })

  const upcoming = filtered.filter(c => !isPastDate(c.date))
  const past = filtered.filter(c => isPastDate(c.date))
  const allPast = concerts.filter(c => isPastDate(c.date))

  const TabBtn = ({ id, icon, label }) => (
    <button onClick={() => setView(id)} style={{
      flex: 1, background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '8px 0', color: view === id ? '#a78bfa' : '#2e2e50',
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

  if (showAdd) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <AddConcertForm
        onSave={c => { onSaveConcert(c); setShowAdd(false); setSelected(c) }}
        onClose={() => setShowAdd(false)}
        settings={settings}
        friends={allFriends}
      />
    </div>
  )

  if (selected) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <ConcertDetail concert={selected} onClose={() => setSelected(null)} onSave={handleSave} settings={settings} friends={allFriends} onDelete={onDeleteConcert} />
    </div>
  )

  return (
    <div style={{ background: '#0c0c14', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', position: 'sticky', top: 0, background: '#0c0c14', zIndex: 50, borderBottom: '1px solid #0d1a14' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#e2e0ff', lineHeight: 1 }}>settracker</div>
            <div style={{ fontSize: 10, color: '#5a5880', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
              {allPast.length} shows · {concerts.filter(c => !isPastDate(c.date)).length} upcoming
            </div>
          </div>
          {view === 'home' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAdd(true)} style={{
                background: '#1a1a30', border: '1px solid #a78bfa',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                color: '#a78bfa', fontSize: 18, lineHeight: 1, fontWeight: 300
              }}>+</button>
              <button onClick={() => setShowFilters(f => !f)} style={{
                position: 'relative', background: showFilters || activeFilterCount > 0 ? '#1a1a30' : 'none',
                border: `1px solid ${showFilters || activeFilterCount > 0 ? '#a78bfa' : '#1f1f35'}`,
                borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                color: activeFilterCount > 0 ? '#a78bfa' : '#6b6a8f', fontSize: 13
              }}>
                ⚙
                {activeFilterCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4, background: '#a78bfa',
                    color: '#0c0c14', borderRadius: 99, fontSize: 9, fontWeight: 800,
                    width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{activeFilterCount}</span>
                )}
              </button>
            </div>
          )}
        </div>

        {view === 'home' && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
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
        )}

        {view === 'home' && (
          <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center' }}>
            {/* Type dropdown */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => { setShowYearDropdown(false); document.getElementById('type-dd') && (document.getElementById('type-dd').style.display = document.getElementById('type-dd').style.display === 'block' ? 'none' : 'block') }} style={{
                padding: '5px 11px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                background: filterType !== 'all' ? '#a78bfa' : '#13131f',
                color: filterType !== 'all' ? '#0c0c14' : '#6b6a8f',
                border: `1px solid ${filterType !== 'all' ? '#a78bfa' : '#1f1f35'}`,
                fontWeight: filterType !== 'all' ? 700 : 400, fontFamily: "'DM Mono', monospace",
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                {filterType === 'all' ? 'All' : filterType === 'concerts' ? 'Shows' : 'Festivals'}
                <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
              </button>
              <div id="type-dd" style={{ display: 'none', position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#13131f', border: '1px solid #2e2e50', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 110 }}>
                {[{id:'all',label:'All'},{id:'concerts',label:'Shows'},{id:'festivals',label:'Festivals'}].map((t,i) => (
                  <button key={t.id} onClick={() => { setFilterType(t.id); document.getElementById('type-dd').style.display='none' }} style={{ width: '100%', background: filterType === t.id ? '#1a1a30' : 'none', border: 'none', borderBottom: i < 2 ? '1px solid #0c0c14' : 'none', padding: '9px 14px', cursor: 'pointer', textAlign: 'left', color: filterType === t.id ? '#a78bfa' : '#c4c2f0', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{t.label}</button>
                ))}
              </div>
            </div>
            {/* Year dropdown */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowYearDropdown(d => !d)} style={{ padding: '5px 11px', borderRadius: 99, fontSize: 12, cursor: 'pointer', background: filterYear !== 'all' ? '#a78bfa' : '#13131f', color: filterYear !== 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterYear !== 'all' ? '#a78bfa' : '#1f1f35'}`, fontWeight: filterYear !== 'all' ? 700 : 400, fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
                {filterYear === 'all' ? 'Year' : filterYear}
                <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
              </button>
              {showYearDropdown && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#13131f', border: '1px solid #2e2e50', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 90 }}>
                  {['all', ...years].map((y, i) => (
                    <button key={y} onClick={() => { setFilterYear(y); setShowYearDropdown(false) }} style={{ width: '100%', background: filterYear === y ? '#1a1a30' : 'none', border: 'none', borderBottom: i < years.length ? '1px solid #0c0c14' : 'none', padding: '9px 14px', cursor: 'pointer', textAlign: 'left', color: filterYear === y ? '#a78bfa' : '#c4c2f0', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{y === 'all' ? 'All years' : y}</button>
                  ))}
                </div>
              )}
            </div>
            {filterFriend !== 'all' && <button onClick={() => setFilterFriend('all')} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#f472b6', border: '1px solid #f472b6', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>{filterFriend} ×</button>}
            {filterVenue !== 'all' && <button onClick={() => setFilterVenue('all')} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#38bdf8', border: '1px solid #38bdf8', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>{filterVenue} ×</button>}
            {filterRating !== 0 && <button onClick={() => setFilterRating(0)} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#a78bfa', border: '1px solid #a78bfa', fontFamily: "'DM Mono', monospace" }}>{'★'.repeat(filterRating)}+ ×</button>}
            {filterSolo && <button onClick={() => setFilterSolo(false)} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#a78bfa', border: '1px solid #a78bfa', fontFamily: "'DM Mono', monospace" }}>solo ×</button>}
            {filterGenre !== 'all' && <button onClick={() => setFilterGenre('all')} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#a78bfa', border: '1px solid #a78bfa', fontFamily: "'DM Mono', monospace" }}>{filterGenre} ×</button>}
            {sortOrder !== 'newest' && <button onClick={() => setSortOrder('newest')} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#a78bfa', border: '1px solid #a78bfa', fontFamily: "'DM Mono', monospace" }}>↕ {sortOrder} ×</button>}
          </div>
        )}

        {view === 'home' && showFilters && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Sort</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[{id:'newest',label:'Newest'},{id:'oldest',label:'Oldest'},{id:'alpha',label:'A→Z'},{id:'price',label:'Price ↓'},{id:'rating',label:'Rating ↓'}].map(s => (
                  <button key={s.id} onClick={() => setSortOrder(s.id)} style={{ padding: '5px 11px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortOrder === s.id ? '#a78bfa' : '#0c0c14', color: sortOrder === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortOrder === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Friend</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button onClick={() => setFilterFriend('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterFriend === 'all' ? '#f472b6' : '#0c0c14', color: filterFriend === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterFriend === 'all' ? '#f472b6' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
                {activeFriends.map(f => (
                  <button key={f} onClick={() => setFilterFriend(filterFriend === f ? 'all' : f)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterFriend === f ? '#f472b6' : '#0c0c14', color: filterFriend === f ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterFriend === f ? '#f472b6' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Venue</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button onClick={() => setFilterVenue('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterVenue === 'all' ? '#38bdf8' : '#0c0c14', color: filterVenue === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterVenue === 'all' ? '#38bdf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
                {allVenues.map(v => (
                  <button key={v} onClick={() => setFilterVenue(filterVenue === v ? 'all' : v)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterVenue === v ? '#38bdf8' : '#0c0c14', color: filterVenue === v ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterVenue === v ? '#38bdf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Rating</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button onClick={() => setFilterRating(0)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterRating === 0 ? '#a78bfa' : '#0c0c14', color: filterRating === 0 ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterRating === 0 ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Any</button>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setFilterRating(filterRating === n ? 0 : n)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterRating === n ? '#a78bfa' : '#0c0c14', color: filterRating === n ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterRating === n ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{'★'.repeat(n)}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Solo only</div>
              <button onClick={() => setFilterSolo(s => !s)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterSolo ? '#a78bfa' : '#0c0c14', color: filterSolo ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterSolo ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>Solo</button>
            </div>
            {(settings.genres||[]).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Genre</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  <button onClick={() => setFilterGenre('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterGenre === 'all' ? '#a78bfa' : '#0c0c14', color: filterGenre === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterGenre === 'all' ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
                  {(settings.genres||[]).map(g => (
                    <button key={g} onClick={() => setFilterGenre(filterGenre === g ? 'all' : g)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterGenre === g ? '#a78bfa' : '#0c0c14', color: filterGenre === g ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterGenre === g ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{g}</button>
                  ))}
                </div>
              </div>
            )}
            {activeFilterCount > 0 && (
              <button onClick={() => { setFilterYear('all'); setFilterType('all'); setFilterFriend('all'); setFilterVenue('all'); setFilterRating(0); setFilterSolo(false); setFilterGenre('all'); setSortOrder('newest'); setSearch('') }} style={{ width: '100%', padding: '8px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'none', border: '1px solid #2e2e50', color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>Reset all filters</button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px', paddingBottom: 90 }}>
        {view === 'home' && (
          <>
            {upcoming.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, paddingLeft: 4 }}>Upcoming — {upcoming.length}</div>
                {upcoming.map(c => <ConcertCard key={c.id} concert={c} onOpen={setSelected} />)}
                <div style={{ height: 1, background: '#0e0e1a', margin: '12px 0 16px' }} />
              </div>
            )}
            <div style={{ marginTop: upcoming.length > 0 ? 0 : 12 }}>
              <button onClick={() => setShowPast(p => !p)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px', marginBottom: showPast ? 4 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Past</span>
                  <span style={{ fontSize: 10, color: '#2e2e50', fontFamily: "'DM Mono', monospace", background: '#13131f', border: '1px solid #1f1f35', borderRadius: 99, padding: '1px 7px' }}>{past.length}</span>
                </div>
                <span style={{ fontSize: 11, color: '#4a4870', transform: showPast ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
              </button>
              {showPast && past.map(c => <ConcertCard key={c.id} concert={c} onOpen={setSelected} />)}
            </div>
          </>
        )}
        {view === 'stats' && <StatsView concerts={concerts} settings={settings} />}
        {view === 'friends' && <FriendsView concerts={concerts} />}
        {view === 'artists' && <ArtistsView concerts={concerts} onOpen={setSelected} />}
        {view === 'settings' && <SettingsView settings={settings} onUpdate={updateSetting} concerts={concerts} onSaveConcert={onSaveConcert} onSignOut={onSignOut} userEmail={userEmail} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#0c0c14', borderTop: '1px solid #0d1a14', display: 'flex', paddingBottom: 8 }}>
        <TabBtn id="home" icon="♪" label="Shows" />
        <TabBtn id="artists" icon="★" label="Artists" />
        <TabBtn id="stats" icon="◎" label="Stats" />
        <TabBtn id="friends" icon="◉" label="Friends" />
        <TabBtn id="settings" icon="⚙" label="Settings" />
      </div>
    </div>
  )
}

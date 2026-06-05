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

const DONUT_PALETTE = ["#a78bfa","#f472b6","#38bdf8","#34d399","#fb923c","#818cf8","#e879f9","#22d3ee","#facc15","#fb7185"];
const GENRE_COLORS = DONUT_PALETTE;
const VENUE_COLORS = DONUT_PALETTE;

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
            {concert.seenAs && !isFestival && (() => {
              const cfg = {
                Headliner: { bg: "#2a1f4a", color: "#a78bfa" },
                Support:   { bg: "#1a2a3d", color: "#60a5fa" },
                Guest:     { bg: "#2d2010", color: "#fbbf24" },
              }[concert.seenAs];
              return cfg ? (
                <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: "0.05em", padding: "2px 6px", borderRadius: 99, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{concert.seenAs.toUpperCase()}</span>
              ) : null;
            })()}
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
  const [setlist, setSetlist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSetlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = encodeURIComponent(`${concert.artist} ${concert.venue} ${concert.date.slice(0,10)}`);
      const dateFormatted = concert.date.replace(/-/g, "");
      const res = await fetch(
        `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(concert.artist)}&date=${concert.date.split("-").reverse().join("-")}`,
        { headers: { "x-api-key": "undefined", Accept: "application/json" } }
      );
      // setlist.fm requires an API key — we'll link to it instead
      throw new Error("API_KEY_NEEDED");
    } catch (e) {
      setError("api_key");
    }
    setLoading(false);
  };

  const setlistUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(concert.artist)}+${concert.date.split("-")[0]}`;

  return (
    <div>
      <a
        href={setlistUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 8, fontSize: 12,
          background: "#13131f", border: "1px solid #2a4a3a",
          color: "#a78bfa", textDecoration: "none", fontFamily: "'DM Mono', monospace"
        }}
      >
        🎵 View on setlist.fm ↗
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
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(settings.venueSizes||[]).map(vs => (
                  <button key={vs} onClick={()=>update("venueSize",form.venueSize===vs?null:vs)} style={{
                    padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer",
                    background: form.venueSize===vs ? "#a78bfa" : "#13131f",
                    color: form.venueSize===vs ? "#0c0c14" : "#6b6a8f",
                    border: `1px solid ${form.venueSize===vs ? "#a78bfa" : "#2e2e50"}`,
                    fontWeight: form.venueSize===vs ? 700 : 400
                  }}>{vs}</button>
                ))}
              </div>
            ) : (
              <div style={{ color:"#c4c2f0", fontSize:14 }}>
                {concert.venueSize}
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
            ) : <div style={{ color:"#c4c2f0", fontSize:14 }}>{concert.genre}{concert.subgenre && <span style={{ color:"#6b6a8f" }}> · {concert.subgenre}</span>}</div>}
          </div>
        )}

        {/* Subgenre */}
        {(editing || concert.subgenre) && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Subgenre</div>
            {editing ? (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(settings.subgenres||[]).map(g => (
                  <button key={g} onClick={()=>update("subgenre",form.subgenre===g?null:g)} style={{
                    padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer",
                    background: form.subgenre===g ? "#38bdf8" : "#13131f",
                    color: form.subgenre===g ? "#0c0c14" : "#6b6a8f",
                    border: `1px solid ${form.subgenre===g ? "#38bdf8" : "#2e2e50"}`,
                    fontWeight: form.subgenre===g ? 700 : 400
                  }}>{g}</button>
                ))}
              </div>
            ) : <div style={{ color:"#c4c2f0", fontSize:14 }}>{concert.subgenre}</div>}
          </div>
        )}

        {/* Language */}
        {(editing || (Array.isArray(concert.language) ? concert.language.length : concert.language)) && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Language</div>
            {editing ? (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(() => {
                  const langs = Array.isArray(form.language) ? form.language : form.language ? [form.language] : [];
                  return (settings.languages||[]).map(l => {
                    const on = langs.includes(l);
                    return (
                      <button key={l} onClick={()=>update("language", on ? langs.filter(x=>x!==l) : [...langs, l])} style={{
                        padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer",
                        background: on ? "#a78bfa" : "#13131f",
                        color: on ? "#0c0c14" : "#6b6a8f",
                        border: `1px solid ${on ? "#a78bfa" : "#2e2e50"}`,
                        fontWeight: on ? 700 : 400
                      }}>{l}</button>
                    );
                  });
                })()}
              </div>
            ) : <div style={{ color:"#c4c2f0", fontSize:14 }}>{(Array.isArray(concert.language) ? concert.language : concert.language ? [concert.language] : []).join(', ')}</div>}
          </div>
        )}

        {/* Seen as */}
        {(editing || concert.seenAs) && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Seen as</div>
            {editing ? (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {["Headliner","Support","Guest","Festival"].map(opt => (
                  <button key={opt} onClick={() => update("seenAs", form.seenAs === opt ? null : opt)} style={{
                    padding:"4px 10px", borderRadius:99, fontSize:12, cursor:"pointer",
                    background: form.seenAs === opt ? "#a78bfa" : "#13131f",
                    color: form.seenAs === opt ? "#0c0c14" : "#6b6a8f",
                    border: `1px solid ${form.seenAs === opt ? "#a78bfa" : "#2e2e50"}`,
                    fontWeight: form.seenAs === opt ? 700 : 400
                  }}>{opt}</button>
                ))}
              </div>
            ) : <div style={{ color:"#c4c2f0", fontSize:14 }}>{concert.seenAs}</div>}
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
              <StarRating value={form.rating} onChange={v => update("rating", v)} max={settings.ratingSystem || 5} />
            ) : (
              <div style={{ color: "#a78bfa", fontSize: 18 }}>
                {concert.rating ? "★".repeat(concert.rating) + "☆".repeat((settings.ratingSystem || 5) - concert.rating) : <span style={{ color: "#2e2e4a" }}>Not rated yet</span>}
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
            <SetlistSection concert={concert} />
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

function StatsView({ concerts, settings = {}, onNavigate = () => {}, onUpdateSetting = () => {} }) {
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

  const venueRoomCount = {};
  past.forEach(c => {
    const key = c.room ? `${c.venue} · ${c.room}` : c.venue;
    venueRoomCount[key] = (venueRoomCount[key] || 0) + 1;
  });
  const topVenuesByRoom = Object.entries(venueRoomCount).sort((a,b) => b[1]-a[1]).slice(0, topVenuesRows);

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

  // Year counts including upcoming
  const allYearCount = {};
  const upcomingYearCount = {};
  concerts.forEach(c => {
    const y = getYear(c.date);
    allYearCount[y] = (allYearCount[y] || 0) + 1;
    if (!isPast(c.date)) upcomingYearCount[y] = (upcomingYearCount[y] || 0) + 1;
  });
  const allYears = Object.keys(allYearCount).sort();

  // Month counts including upcoming
  const allYearMonthCount = {};
  concerts.forEach(c => {
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
  const totalMerch = past.reduce((sum, c) => {
    const m = (c.merch || []).reduce((s,x) => s + (parseFloat(x.price)||0), 0);
    const y = getYear(c.date);
    yearMerchSpend[y] = (yearMerchSpend[y] || 0) + m;
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
  past.forEach(c => { if (c.genre) genreCount[c.genre] = (genreCount[c.genre] || 0) + 1; });
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
    const n = c.friends?.length || 0;
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
            <text x={cx} y={cy+2} textAnchor="middle" dominantBaseline="middle" fill="#e2e0ff" fontSize={size*0.14} fontFamily="'Syne',sans-serif" fontWeight="800">{total}</text>
            <text x={cx} y={cy+size*0.16} textAnchor="middle" dominantBaseline="middle" fill="#4a4870" fontSize={size*0.09} fontFamily="'DM Mono',monospace">{label}</text>
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
      id: "artists", label: "Artists",
      charts: [
        { id: "genres-pie", label: "🥧 Genres" },
        { id: "shows",      label: "📅 Shows over time" },
        { id: "artists",    label: "🎤 Top artists" },
        ...(rated.length > 0 ? [{ id: "ratings", label: "⭐ Ratings" }] : []),
        { id: "language",   label: "🗣️ Language" },
      ]
    },
    {
      id: "friends", label: "Friends",
      charts: [
        { id: "solo",          label: "👯 Solo vs with friends" },
        { id: "friends-chart", label: "👥 Most shows with" },
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
        { id: "merch-breakdown", label: "📦 What I buy" },
      ]
    },
  ];

  const [statsTab, setStatsTab] = useState(defaultStatsTab);
  const [showStatsSettings, setShowStatsSettings] = useState(false);
  const [chartGroup, setChartGroup] = useState("artists");
  const [selectedChart, setSelectedChart] = useState("artists");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [chartOptions, setChartOptions] = useState({});
  const chartOpt = (id, def) => chartOptions[id] ?? def;
  const setChartOpt = (id, val) => setChartOptions(o => ({ ...o, [id]: val }));

  const hiddenChartGroups = settings.hiddenChartGroups || [];
  const hiddenCharts = settings.hiddenCharts || [];
  const visibleChartGroups = CHART_GROUPS
    .filter(g => !hiddenChartGroups.includes(g.id))
    .map(g => ({ ...g, charts: g.charts.filter(c => !hiddenCharts.includes(c.id)) }))
    .filter(g => g.charts.length > 0);
  const activeGroup = visibleChartGroups.find(g => g.id === chartGroup) || visibleChartGroups[0];
  const activeChart = activeGroup?.charts.find(c => c.id === selectedChart) || activeGroup?.charts[0];

  const renderChart = (id) => {
    switch(id) {
      case "shows": {
        const sView = chartOpt("shows", "cumulative");
        const maxAll = Math.max(...Object.values(allYearCount), 1);
        const hmAllYears = Object.keys(allYearMonthCount).sort();
        const hmMax = Math.max(...hmAllYears.flatMap(y => Array.from({length:12}, (_,m) => allYearMonthCount[y]?.[m] || 0)), 1);
        const todayYear = new Date().getFullYear().toString();
        return (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"bars",label:"Bars"},{id:"line",label:"Line"},{id:"heatmap",label:"Heatmap"},{id:"cumulative",label:"Cumulative"}]} value={sView} onChange={v => setChartOpt("shows", v)} />
            {sView === "bars" && (() => (
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 10, height: 4, borderRadius: 1, background: "#a78bfa" }} />
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Past</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 10, height: 4, borderRadius: 1, background: "#38bdf8" }} />
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Upcoming</span>
                  </div>
                </div>
                {Object.keys(allYearCount).sort((a,b) => b.localeCompare(a)).map(y => {
                  const total = allYearCount[y];
                  const upcoming = upcomingYearCount[y] || 0;
                  const pastCount = total - upcoming;
                  return (
                    <div key={y} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ color: "#c4c2f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", width: 36, flexShrink: 0 }}>{y}</span>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", width: Math.max(16, (total / maxAll) * 80) }}>
                          {pastCount > 0 && <div style={{ flex: pastCount, background: "#a78bfa" }} />}
                          {upcoming > 0 && <div style={{ flex: upcoming, background: "#38bdf8", opacity: 0.85 }} />}
                        </div>
                        <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 28, textAlign: "right" }}>{total}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            ))()}
            {sView === "line" && (() => {
              const n = allYears.length;
              if (n < 2) return <div style={{ color: "#2e2e4a", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Need at least 2 years of data</div>;
              const xOf = i => (i/(n-1))*274+3;
              const yOf = v => 86-(v/maxAll)*76;
              const splitIdx = allYears.findIndex(y => y >= todayYear);
              const pastYears = splitIdx === -1 ? allYears : allYears.slice(0, splitIdx + 1);
              const futureYears = splitIdx === -1 ? [] : allYears.slice(splitIdx);
              const pastPath = pastYears.length > 1 ? "M " + pastYears.map((y,i) => `${xOf(allYears.indexOf(y))},${yOf(allYearCount[y])}`).join(" L ") : null;
              const futurePath = futureYears.length > 1 ? "M " + futureYears.map(y => `${xOf(allYears.indexOf(y))},${yOf(allYearCount[y])}`).join(" L ") : null;
              const firstPastX = pastYears.length ? xOf(0) : 3;
              const lastPastX = pastYears.length ? xOf(pastYears.length - 1) : 3;
              return (
                <>
                  <svg width="100%" height={100} viewBox="0 0 280 92" preserveAspectRatio="none">
                    <defs><linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2"/><stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/></linearGradient></defs>
                    {pastPath && <path d={pastPath + ` L ${lastPastX},88 L ${firstPastX},88 Z`} fill="url(#sGrad)" />}
                    {pastPath && <path d={pastPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                    {futurePath && <path d={futurePath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />}
                    {allYears.map((y, i) => <circle key={y} cx={xOf(i)} cy={yOf(allYearCount[y])} r="3" fill={y >= todayYear ? "#38bdf8" : "#a78bfa"} />)}
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{allYears[0]}</span>
                    <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{allYears[allYears.length-1]}</span>
                  </div>
                </>
              );
            })()}
            {sView === "heatmap" && (
              <>
                <div style={{ display: "flex", marginLeft: 30 }}>
                  {monthNames.map((name, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{name[0]}</div>)}
                </div>
                {hmAllYears.map(y => (
                  <div key={y} style={{ display: "flex", alignItems: "center", marginTop: 3 }}>
                    <span style={{ width: 30, fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{y}</span>
                    {Array.from({length:12}, (_, m) => {
                      const count = allYearMonthCount[y]?.[m] || 0;
                      const pastC = yearMonthCount[y]?.[m] || 0;
                      const isUpcoming = count > 0 && pastC === 0;
                      const intensity = count / hmMax;
                      const color = isUpcoming ? `rgba(56,189,248,${0.15+intensity*0.85})` : `rgba(167,139,250,${0.15+intensity*0.85})`;
                      const textColor = isUpcoming ? (intensity>0.55?"#0c0c14":"#38bdf8") : (intensity>0.55?"#0c0c14":"#a78bfa");
                      return (
                        <div key={m} style={{ flex:1, aspectRatio:"1", borderRadius:2, margin:"0 1px", background: count > 0 ? color : "#0e0e1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {count > 0 && <span style={{ fontSize:7, color: textColor, fontFamily:"'DM Mono',monospace", lineHeight:1 }}>{count}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
            {sView === "cumulative" && (() => {
              const allSorted = [...concerts].sort((a,b) => a.date.localeCompare(b.date));
              if (allSorted.length < 2) return <div style={{ color: "#2e2e4a", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Not enough data yet</div>;
              const n = allSorted.length;
              const W = 300, H = 80;
              const firstMs = new Date(allSorted[0].date).getTime();
              const lastMs = new Date(allSorted[n-1].date).getTime();
              const rangeMs = lastMs - firstMs || 1;
              const todayMs = new Date().getTime();
              const todayX = Math.min(W - 3, ((todayMs - firstMs) / rangeMs) * (W - 6) + 3);
              const coords = allSorted.map((c, i) => ({
                x: ((new Date(c.date).getTime() - firstMs) / rangeMs) * (W - 6) + 3,
                y: H - 6 - ((i + 1) / n) * (H - 14),
                isPast: isPast(c.date),
              }));
              const pastCoords = coords.filter(p => p.isPast);
              const upcomingCoords = coords.filter(p => !p.isPast);
              const todayY = pastCoords.length > 0 ? pastCoords[pastCoords.length - 1].y : coords[0].y;
              const pastPath = pastCoords.length > 0 ? "M " + pastCoords.map(p => `${p.x},${p.y}`).join(" L ") : null;
              const upcomingPath = upcomingCoords.length > 0 ? `M ${todayX},${todayY} L ` + upcomingCoords.map(p => `${p.x},${p.y}`).join(" L ") : null;
              const areaPath = pastCoords.length > 0 ? pastPath + ` L ${todayX},${H-4} L ${pastCoords[0].x},${H-4} Z` : null;
              return (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 10, height: 2, background: "#a78bfa", borderRadius: 1 }} />
                      <span style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>past</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 10, height: 2, background: "#38bdf8", borderRadius: 1, opacity: 0.7 }} />
                      <span style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>upcoming</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 100, paddingTop: 2, paddingBottom: 6 }}>
                      <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{n}</span>
                      <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{Math.round(n/2)}</span>
                      <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>0</span>
                    </div>
                    <svg style={{ flex: 1 }} height={100} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                      <defs><linearGradient id="cumGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25"/><stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/></linearGradient></defs>
                      {areaPath && <path d={areaPath} fill="url(#cumGrad2)" />}
                      {pastPath && <path d={pastPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                      {upcomingPath && <path d={upcomingPath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />}
                    </svg>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{allSorted[0].date.slice(0,7)}</span>
                    <span style={{ fontSize: 10, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>{past.length} past · {concerts.length - past.length} upcoming</span>
                    <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{allSorted[n-1].date.slice(0,7)}</span>
                  </div>
                </>
              );
            })()}
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
        return (
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
          <ChartToggle options={[{id:"bars",label:"Bars"},{id:"line",label:"Line"}]} value={ysView} onChange={v => setChartOpt("year-spend", v)} />
          {ysView === "bars" && <>
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
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#34d399" }} />
              <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Merch</span>
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
              const merch = yearMerchSpend[y] || 0;
              const spendW = Math.max(4, (spend / maxSpend) * 100);
              const avgW = avg ? Math.max(4, (avg / maxSpend) * 100) : 0;
              const merchW = merch > 0 ? Math.max(4, (merch / maxSpend) * 100) : 0;
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
                    {/* Merch bar */}
                    {merch > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ height: 7, borderRadius: 3, background: "#34d399", width: `${merchW}%`, opacity: 0.85, transition: "width 0.5s ease" }} />
                        <span style={{ fontSize: 10, color: "#34d399", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>€{Math.round(merch)}</span>
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
            const spendPts = activeYearsYS.map((y, i) => ({ x: xOf(i), y: yOf(yearSpend[y] || 0) }));
            const spendPath = "M " + spendPts.map(p => `${p.x},${p.y}`).join(" L ");
            const avgPts = activeYearsYS.map((y, i) => {
              const avg = yearTicketCount[y] ? yearTicketSum[y] / yearTicketCount[y] : null;
              return avg !== null ? { x: xOf(i), y: yOf(avg) } : null;
            });
            const avgPath = avgPts.reduce((acc, pt, i) => {
              if (!pt) return acc;
              if (i === 0 || !avgPts[i - 1]) return acc + `M ${pt.x},${pt.y}`;
              return acc + ` L ${pt.x},${pt.y}`;
            }, '');
            const merchPts = activeYearsYS.map((y, i) => ({ x: xOf(i), y: yOf(yearMerchSpend[y] || 0) }));
            const merchPath = "M " + merchPts.map(p => `${p.x},${p.y}`).join(" L ");
            return (
              <>
                <div style={{ display: "flex", gap: 14, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 16, height: 2, background: "#f472b6", borderRadius: 1 }} />
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Total spend</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 16, height: 2, background: "#38bdf8", borderRadius: 1 }} />
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Avg ticket</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 16, height: 2, background: "#34d399", borderRadius: 1 }} />
                    <span style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Merch</span>
                  </div>
                </div>
                <svg width="100%" height={100} viewBox={`0 0 ${totalW} 92`} preserveAspectRatio="none">
                  <defs><linearGradient id="ysGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f472b6" stopOpacity="0.2"/><stop offset="100%" stopColor="#f472b6" stopOpacity="0"/></linearGradient></defs>
                  {/* Gridlines */}
                  <line x1={leftPad} y1={yTop} x2={totalW} y2={yTop} stroke="#1f1f35" strokeWidth="1" />
                  <line x1={leftPad} y1={yOf(mid)} x2={totalW} y2={yOf(mid)} stroke="#1f1f35" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1={leftPad} y1={yBot} x2={totalW} y2={yBot} stroke="#1f1f35" strokeWidth="1" />
                  {/* Y axis labels */}
                  <text x={leftPad - 4} y={yTop + 3} textAnchor="end" fill="#4a4870" fontSize="7" fontFamily="monospace">€{Math.round(maxSpendYS)}</text>
                  <text x={leftPad - 4} y={yOf(mid) + 3} textAnchor="end" fill="#4a4870" fontSize="7" fontFamily="monospace">€{Math.round(mid)}</text>
                  <text x={leftPad - 4} y={yBot + 1} textAnchor="end" fill="#4a4870" fontSize="7" fontFamily="monospace">€0</text>
                  {/* Chart lines */}
                  <path d={spendPath + ` L ${spendPts[n-1].x},${yBot} L ${spendPts[0].x},${yBot} Z`} fill="url(#ysGrad)" />
                  <path d={spendPath} fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {spendPts.map((pt, i) => <circle key={activeYearsYS[i]} cx={pt.x} cy={pt.y} r="3" fill="#f472b6" />)}
                  {avgPath && <path d={avgPath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {avgPts.map((pt, i) => pt && <circle key={activeYearsYS[i] + 'a'} cx={pt.x} cy={pt.y} r="3" fill="#38bdf8" />)}
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
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18, flexShrink: 0 }}>#{i+1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#c4c2f0", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.artist}</div>
                    <div style={{ color: "#4a4870", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{c.date.slice(0,4)} · {c.venue}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <div style={{ height: 4, borderRadius: 2, background: "#a78bfa", width: Math.max(12, (amount / exMax) * 50) }} />
                    <span style={{ color: "#a78bfa", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 50, textAlign: "right" }}>€{amount?.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case "over-time": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          {(() => {
            if (cumulative.length < 2) return <div style={{ color: "#2e2e4a", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Not enough data yet</div>;
            const n = cumulative.length;
            const maxC = cumulative[n-1].count;
            const pts = cumulative.map((d, i) => `${(i/(n-1))*294+3},${96-(d.count/maxC)*88}`);
            const linePath = "M " + pts.join(" L ");
            const areaPath = linePath + ` L 297,96 L 3,96 Z`;
            return (<>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 120, paddingTop: 2, paddingBottom: 6 }}>
                  <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{maxC}</span>
                  <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>{Math.round(maxC / 2)}</span>
                  <span style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textAlign: "right", lineHeight: 1 }}>0</span>
                </div>
                <svg style={{ flex: 1 }} height={120} viewBox="0 0 300 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#lineGrad)" />
                  <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={3} cy={96-(cumulative[0].count/maxC)*88} r="3" fill="#a78bfa" />
                  <circle cx={297} cy={96-(cumulative[n-1].count/maxC)*88} r="3" fill="#a78bfa" />
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{sortedPast[0]?.date.slice(0,7)}</span>
                <span style={{ fontSize: 10, color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>{past.length} total</span>
                <span style={{ fontSize: 10, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>{sortedPast[sortedPast.length-1]?.date.slice(0,7)}</span>
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
      case "solo": {
        const soloView = chartOpt("solo", "overview");
        const groupSizeLabels = ["0","1","2","3","4","5","6+"];
        const groupSizeColors = ["#6b6a8f","#a78bfa","#818cf8","#60a5fa","#34d399","#fbbf24","#f472b6"];
        const maxGroupSize = Math.max(...groupSizeLabels.map(k => groupSizeDist[k] || 0), 1);
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"overview",label:"Overview"},{id:"group",label:"Group size"}]} value={soloView} onChange={v => setChartOpt("solo", v)} />
            {soloView === "overview" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Donut showLabels segments={[{ value: withFriends.length, color: "#a78bfa" }, { value: solo.length, color: "#6b6a8f" }]} size={100} />
                <div style={{ flex: 1 }}>
                  {[{ label: "With friends", color: "#a78bfa" }, { label: "Solo", color: "#6b6a8f" }].map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: s.color, flexShrink: 0 }} />
                      <span style={{ color: "#c4c2f0", fontSize: 11 }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (() => {
              const gsLegendLabels = groupSizeLabels.map(k => k === "0" ? "Solo" : k === "1" ? "1 friend" : k === "6+" ? "6+ friends" : `${k} friends`);
              const allGs = groupSizeLabels.map((k, i) => ({ label: gsLegendLabels[i], count: groupSizeDist[k] || 0, color: groupSizeColors[i] })).filter(x => x.count > 0).sort((a,b) => b.count - a.count);
              const top4Gs = allGs.slice(0, 4);
              const othersGs = allGs.slice(4).reduce((s, x) => s + x.count, 0);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <Donut showLabels size={110} centerText={null} segments={[
                    ...top4Gs.map(x => ({ value: x.count, color: x.color })),
                    ...(othersGs > 0 ? [{ value: othersGs, color: "#4a4870" }] : [])
                  ]} />
                  <div style={{ flex: 1 }}>
                    {[...top4Gs, ...(othersGs > 0 ? [{ label: "Others", color: "#4a4870" }] : [])].map(x => (
                      <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 1, background: x.color, flexShrink: 0 }} />
                        <span style={{ color: x.label === "Others" ? "#4a4870" : "#c4c2f0", fontSize: 11 }}>{x.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      }
      case "venue-size": {
        const top4VS = venueEntries.slice(0, 4);
        const othersVS = venueEntries.slice(4).reduce((s,[,n])=>s+n,0);
        return venueEntries.length === 0 ? (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Tag shows with a venue size to see this</div>
          </div>
        ) : (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px", display: "flex", alignItems: "center", gap: 14 }}>
            <Donut showLabels size={110} segments={[
              ...top4VS.map(([name, n], i) => ({ value: n, color: VENUE_COLORS[i] })),
              ...(othersVS > 0 ? [{ value: othersVS, color: "#4a4870" }] : [])
            ]} />
            <div style={{ flex: 1 }}>
              {[...top4VS, ...(othersVS > 0 ? [["Others", othersVS]] : [])].map(([name], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: i < 4 ? VENUE_COLORS[i] : "#4a4870", flexShrink: 0 }} />
                  <span style={{ color: name === "Others" ? "#4a4870" : "#c4c2f0", fontSize: 11 }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
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
      case "ratings": {
        const rView = chartOpt("ratings", "dist");
        const maxRatingDist = Math.max(...Object.values(ratingDist), 1);
        const ratingYears = Object.keys(ratingByYear).sort();
        const maxAvgRating = 5;
        const ratingColors = { 5:"#a78bfa", 4:"#818cf8", 3:"#38bdf8", 2:"#34d399", 1:"#6b6a8f" };
        const rAll = [5,4,3,2,1].filter(n => ratingDist[n]).map(n => ({ stars: n, count: ratingDist[n], color: ratingColors[n] })).sort((a,b) => b.count - a.count);
        const top4R = rAll.slice(0, 4);
        const othersR = rAll.slice(4).reduce((s,x) => s+x.count, 0);
        const rSegs = [...top4R.map(x => ({ value: x.count, color: x.color })), ...(othersR > 0 ? [{ value: othersR, color: "#4a4870" }] : [])];
        const rLegend = [...top4R, ...(othersR > 0 ? [{ stars: 0, color: "#4a4870" }] : [])];
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"dist",label:"Distribution"},{id:"pie",label:"Pie"},{id:"year",label:"By year"}]} value={rView} onChange={v => setChartOpt("ratings", v)} />
            {rView === "dist" ? (
              <>
                {[5,4,3,2,1].map(n => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ color: "#a78bfa", fontSize: 11, width: 56, flexShrink: 0, letterSpacing: "-1px" }}>{"★".repeat(n)}</span>
                    <div style={{ flex: 1, height: 7, background: "#0e0e1a", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: "#a78bfa", width: `${(ratingDist[n]/maxRatingDist)*100}%` }} />
                    </div>
                    <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 20, textAlign: "right" }}>{ratingDist[n]}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #1e3028", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b6a8f", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>average</span>
                  <span style={{ color: "#a78bfa", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{avgRating} ★</span>
                </div>
              </>
            ) : rView === "pie" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Donut showLabels size={110} centerText={`${avgRating}★`} segments={rSegs} />
                <div style={{ flex: 1 }}>
                  {rLegend.map((x, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: x.color, flexShrink: 0 }} />
                      <span style={{ color: x.stars ? "#c4c2f0" : "#4a4870", fontSize: 11 }}>{x.stars ? "★".repeat(x.stars) : "Others"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              ratingYears.map(y => {
                const avg = ratingByYear[y].sum / ratingByYear[y].count;
                return (
                  <div key={y} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ color: "#c4c2f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", width: 36, flexShrink: 0 }}>{y}</span>
                    <div style={{ flex: 1, height: 7, background: "#0e0e1a", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: "#a78bfa", width: `${(avg / maxAvgRating) * 100}%` }} />
                    </div>
                    <span style={{ color: "#a78bfa", fontSize: 12, fontFamily: "'DM Mono', monospace", width: 28, textAlign: "right" }}>{avg.toFixed(1)} ★</span>
                  </div>
                );
              })
            )}
          </div>
        );
      }
      case "artists": {
        const aView = chartOpt("artists", "count");
        const artistItems = aView === "alpha"
          ? [...topArtists].sort((a, b) => a[0].localeCompare(b[0]))
          : topArtists;
        const medals = ["🥇","🥈","🥉"];
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"count",label:"Most seen"},{id:"alpha",label:"A–Z"}]} value={aView} onChange={v => setChartOpt("artists", v)} />
            {artistItems.map(([name, count], i) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: aView === "count" && i < 3 ? 14 : 10, width: 20, textAlign: "center", flexShrink: 0, color: "#2e2e50", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                    {aView === "count" && i < 3 ? medals[i] : `#${i+1}`}
                  </span>
                  <span style={{ color: "#c4c2f0", fontSize: 13 }}>{name}</span>
                </div>
                <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{count}x</span>
              </div>
            ))}
          </div>
        );
      }
      case "friends-chart": return (
        <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
          {topFriends.map(([name, count], i) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18 }}>#{i+1}</span>
                <span style={{ color: "#c4c2f0", fontSize: 12 }}>{name}</span>
              </div>
              <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{count} shows</span>
            </div>
          ))}
        </div>
      );
      case "venues": {
        const vView = chartOpt("venues", "venue");
        const vItems = vView === "room" ? topVenuesByRoom : topVenues;
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"venue",label:"By venue"},{id:"room",label:"By room"}]} value={vView} onChange={v => setChartOpt("venues", v)} />
            {vItems.map(([name, count], i) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, color: "#2e2e50", fontFamily: "'DM Mono', monospace", width: 18 }}>#{i+1}</span>
                  <span style={{ color: "#c4c2f0", fontSize: 12 }}>{name}</span>
                </div>
                <span style={{ color: "#6b6a8f", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{count}x</span>
              </div>
            ))}
          </div>
        );
      }
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
          {/* Top 3 list with toggle */}
          {(topMerchItems.length > 0 || topMerchTypes.length > 0) && (() => {
            const moView = chartOpt("merch-overview", "price");
            return (
              <>
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
              </>
            );
          })()}
        </div>
      );
      case "merch-breakdown": {
        const mbView = chartOpt("merch-breakdown", "types");
        const noMerch = topMerchTypes.length === 0 && topArtistMerch.length === 0;
        return (
          <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px" }}>
            <ChartToggle options={[{id:"types",label:"By type"},{id:"artists",label:"By artist"}]} value={mbView} onChange={v => setChartOpt("merch-breakdown", v)} />
            {noMerch
              ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Log merch on a show to see this</div>
              : mbView === "types"
                ? topMerchTypes.map(([type, count], i) => (
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
        const gpData = chartOpt("gp-data", "main");
        const gpView = chartOpt("gp-view", "pie");
        const gpSource = gpData === "sub" ? topSubgenres : topGenres;
        const top4 = gpSource.slice(0, 4);
        const othersCount = gpSource.slice(4).reduce((s, [,n]) => s + n, 0);
        const emptyLabel = gpData === "sub" ? "subgenres" : "genres";
        return (
          <div style={{ background: "#13131f", border: "1px solid #1e3028", borderRadius: 12, padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <ChartToggle options={[{id:"main",label:"Main"},{id:"sub",label:"Subgenre"}]} value={gpData} onChange={v => setChartOpt("gp-data", v)} />
              <div style={{ width: 1, height: 18, background: "#2e2e50", flexShrink: 0 }} />
              <ChartToggle options={[{id:"pie",label:"Pie"},{id:"list",label:"List"}]} value={gpView} onChange={v => setChartOpt("gp-view", v)} color="#6d28d9" />
            </div>
            {gpView === "list" ? (
              gpSource.length === 0
                ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Tag shows with {emptyLabel} to see this</div>
                : <ListStat title="" items={gpSource} suffix="x" />
            ) : gpSource.length === 0
              ? <div style={{ color: "#2e2e4a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Tag shows with {emptyLabel} to see this</div>
              : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Donut size={110} showLabels label="shows" segments={[
                    ...top4.map(([g, n], i) => ({ value: n, color: GENRE_COLORS[i] })),
                    ...(othersCount > 0 ? [{ value: othersCount, color: "#4a4870" }] : []),
                  ]} />
                  <div style={{ flex: 1 }}>
                    {[...top4, ...(othersCount > 0 ? [["Others", othersCount]] : [])].map(([name], i) => (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 1, background: i < 4 ? GENRE_COLORS[i] : "#4a4870", flexShrink: 0 }} />
                        <span style={{ color: name === "Others" ? "#4a4870" : "#c4c2f0", fontSize: 11 }}>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
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
                        <Donut showLabels size={110} segments={[
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
      default: return null;
    }
  };

  return (
    <div style={{ padding: "0 0 100px" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid #0d1a14", marginBottom: 0, alignItems: "stretch" }}>
        {[{ id: "summary", label: "Summary" }, { id: "charts", label: "Charts" }].map(t => (
          <button key={t.id} onClick={() => setStatsTab(t.id)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            padding: "14px 0 12px", fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800,
            color: statsTab === t.id ? "#a78bfa" : "#5a5880",
            borderBottom: `2px solid ${statsTab === t.id ? "#a78bfa" : "transparent"}`,
            marginBottom: -1
          }}>{t.label}</button>
        ))}
        <button onClick={() => setShowStatsSettings(s => !s)} style={{
          background: showStatsSettings ? "#1a1a30" : "none", border: "none",
          borderLeft: "1px solid #1f1f35", cursor: "pointer", padding: "0 16px",
          color: showStatsSettings ? "#a78bfa" : "#4a4870", fontSize: 16, lineHeight: 1
        }}>⚙</button>
      </div>
      {showStatsSettings && (() => {
        const summaryBlocks = [
          { id: "stats1", label: "Stats" }, { id: "stats2", label: "Financial" },
          { id: "cumulative", label: "Cumulative" }, { id: "pies", label: "Genres & Venues" },
          { id: "upnext", label: "Up next" },
        ];
        const hiddenBlocks = settings.hiddenSummaryBlocks || [];
        const hiddenGroups = settings.hiddenChartGroups || [];
        const hiddenChts = settings.hiddenCharts || [];
        const toggleBlock = id => onUpdateSetting("hiddenSummaryBlocks", hiddenBlocks.includes(id) ? hiddenBlocks.filter(x => x !== id) : [...hiddenBlocks, id]);
        const toggleGroup = id => onUpdateSetting("hiddenChartGroups", hiddenGroups.includes(id) ? hiddenGroups.filter(x => x !== id) : [...hiddenGroups, id]);
        const toggleChart = id => onUpdateSetting("hiddenCharts", hiddenChts.includes(id) ? hiddenChts.filter(x => x !== id) : [...hiddenChts, id]);
        const pill = (label, active, onClick, small = false) => (
          <button onClick={onClick} style={{
            padding: small ? "2px 8px" : "3px 10px", borderRadius: 99, fontSize: small ? 9 : 10, cursor: "pointer",
            fontFamily: "'DM Mono', monospace", border: `1px solid ${active ? "#a78bfa" : "#1f1f35"}`,
            background: active ? "#1a1a30" : "none", color: active ? "#a78bfa" : "#4a4870",
          }}>{label}</button>
        );
        return (
          <div style={{ background: "#0f0f1e", borderBottom: "1px solid #0d1a14", padding: "12px 16px" }}>
            <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Summary</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
              {summaryBlocks.map(b => pill(b.label, !hiddenBlocks.includes(b.id), () => toggleBlock(b.id)))}
            </div>
            <div style={{ fontSize: 9, color: "#4a4870", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Charts</div>
            {CHART_GROUPS.map(g => (
              <div key={g.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {pill(g.label, !hiddenGroups.includes(g.id), () => toggleGroup(g.id))}
                </div>
                {!hiddenGroups.includes(g.id) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 10, borderLeft: "2px solid #1f1f35" }}>
                    {g.charts.map(c => pill(c.label, !hiddenChts.includes(c.id), () => toggleChart(c.id), true))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── SUMMARY ── */}
      {statsTab === "summary" && (
        <div style={{ padding: "16px 16px 0" }}>

          {/* Row 1: shows / festivals / countries / avg per year */}
          {!(settings.hiddenSummaryBlocks||[]).includes("stats1") && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
            {[
              { label: "shows", value: shows.length, nav: { view: 'home', filterType: 'concerts' } },
              { label: "festivals", value: festivals.length, nav: { view: 'home', filterType: 'festivals' } },
              { label: "countries", value: Object.keys(countryCount).length, nav: null },
              { label: "avg / year", value: avgPerYear ?? "—", nav: null },
            ].map(b => (
              <div key={b.label} onClick={b.nav ? () => onNavigate(b.nav) : undefined} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 8, padding: "6px 4px", textAlign: "center", cursor: b.nav ? "pointer" : "default" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "#a78bfa", lineHeight: 1 }}>{b.value}</div>
                <div style={{ fontSize: 8, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{b.label}</div>
              </div>
            ))}
          </div>}

          {/* Row 2: total spend / avg ticket all time / avg ticket this year */}
          {!(settings.hiddenSummaryBlocks||[]).includes("stats2") && (() => {
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
                  <div key={b.label} onClick={() => { setStatsTab("charts"); setChartGroup("financial"); setSelectedChart("year-spend"); window.scrollTo(0,0); }} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 8, padding: "6px 6px", textAlign: "center", cursor: "pointer" }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: b.color, lineHeight: 1 }}>{b.value}</div>
                    <div style={{ fontSize: 9, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Cumulative line chart */}
          {!(settings.hiddenSummaryBlocks||[]).includes("cumulative") && <div onClick={() => { setStatsTab("charts"); setChartGroup("artists"); setSelectedChart("shows"); window.scrollTo(0,0); }} style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 12, cursor: "pointer" }}>
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
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingBottom: 14, flexShrink: 0 }}>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{n}</span>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{Math.round(n/2)}</span>
                    <span style={{ fontSize: 8, color: "#4a4870", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>0</span>
                  </div>
                  <svg style={{ flex: 1 }} viewBox={`0 0 ${W} ${H+14}`} style={{ overflow: "visible" }}>
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
                <div onClick={() => { setStatsTab("charts"); setChartGroup("artists"); setSelectedChart("genres-pie"); window.scrollTo(0,0); }} style={{ flex: 1, padding: "12px", cursor: "pointer", borderRight: "1px solid #1f1f35" }}>
                  {topGenres.length === 0 ? (
                    <div style={placeholderStyle}>add genres to shows</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <Donut size={80} showLabels labelPad={0.06} centerText="Genres" segments={[
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
                <div onClick={() => { setStatsTab("charts"); setChartGroup("venues"); setSelectedChart("venue-size"); window.scrollTo(0,0); }} style={{ flex: 1, padding: "12px", cursor: "pointer" }}>
                  {venueEntries.length === 0 ? (
                    <div style={placeholderStyle}>set venue size on shows</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <Donut size={80} showLabels labelPad={0.06} centerText={["VENUE", "SIZE"]} segments={[
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
            {visibleChartGroups.map(g => (
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

function FriendsView({ concerts, onOpen }) {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('most-shows');
  const [showSortPanel, setShowSortPanel] = useState(false);

  const past = concerts.filter(c => isPast(c.date));
  const allFriends = [...new Set(past.flatMap(c => c.friends))].sort();

  const friendEntries = allFriends.map(name => {
    const shows = past.filter(c => c.friends.includes(name));
    const sortedShows = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    const firstShow = sortedShows[0] || null;
    const lastShow = sortedShows[sortedShows.length - 1] || null;
    const upcoming = concerts.filter(c => !isPast(c.date) && c.friends.includes(name));
    const genreCount = {};
    shows.forEach(c => { if (c.genre) genreCount[c.genre] = (genreCount[c.genre] || 0) + 1; });
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
    .sort((a, b) => {
      if (sortBy === 'most-shows') return b.shows.length - a.shows.length;
      if (sortBy === 'alpha') return a.name.localeCompare(b.name);
      if (sortBy === 'recent') return (b.lastShow?.date || '').localeCompare(a.lastShow?.date || '');
      return 0;
    });

  if (selectedFriend) {
    const f = friendEntries.find(fd => fd.name === selectedFriend);
    if (!f) return null;
    const yearSpan = f.firstShow && f.lastShow && f.firstShow.date.slice(0,4) !== f.lastShow.date.slice(0,4)
      ? `${f.firstShow.date.slice(0,4)} – ${f.lastShow.date.slice(0,4)}`
      : f.firstShow ? f.firstShow.date.slice(0,4) : '';
    const sectionLabel = { fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 };
    const card = { background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "14px", marginBottom: 12 };

    return (
      <div style={{ padding: "0 0 100px" }}>
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1f1f35", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSelectedFriend(null)} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#e2e0ff", lineHeight: 1 }}>{f.name}</div>
            <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
              {f.shows.length} show{f.shows.length !== 1 ? 's' : ''} together{yearSpan ? ` · ${yearSpan}` : ''}
            </div>
          </div>
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
              {f.upcoming.map(c => <ArtistShowRow key={c.id} concert={c} onOpen={onOpen} />)}
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
      {/* Search + sort */}
      <div style={{ padding: "12px 16px 0", position: "relative", zIndex: 10 }}>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#4a4870", fontSize: 13, pointerEvents: "none" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friend..."
            style={{ width: "100%", background: "#13131f", border: `1px solid ${search ? "#a78bfa" : "#1f1f35"}`, borderRadius: 10, color: "#c4c2f0", padding: "9px 32px 9px 32px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4a4870", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>}
        </div>
        <div style={{ display: "flex", gap: 6, paddingBottom: 10, alignItems: "center" }}>
          <button onClick={() => setShowSortPanel(p => !p)} style={{
            background: showSortPanel || sortBy !== 'most-shows' ? '#1a1a30' : 'none',
            border: `1px solid ${showSortPanel || sortBy !== 'most-shows' ? '#a78bfa' : '#1f1f35'}`,
            borderRadius: 99, padding: '5px 11px', cursor: 'pointer',
            color: sortBy !== 'most-shows' ? '#a78bfa' : '#6b6a8f', fontSize: 12,
            fontFamily: "'DM Mono', monospace", fontWeight: sortBy !== 'most-shows' ? 700 : 400, flexShrink: 0
          }}>Sort</button>
          {sortBy !== 'most-shows' && <button onClick={() => setSortBy('most-shows')} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#a78bfa', border: '1px solid #a78bfa', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>↕ {sortBy === 'alpha' ? 'A–Z' : 'Recent'} ×</button>}
        </div>
        {showSortPanel && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Sort</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{id:'most-shows',label:'Most shows'},{id:'alpha',label:'A–Z'},{id:'recent',label:'Most recent'}].map(s => (
                <button key={s.id} onClick={() => { setSortBy(s.id); setShowSortPanel(false); }} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortBy === s.id ? '#a78bfa' : '#0c0c14', color: sortBy === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortBy === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
              ))}
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
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#e2e0ff", marginBottom: 3 }}>{name}</div>
              {lastShow && <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", marginBottom: topGenres.length ? 4 : 0 }}>last: {formatDate(lastShow.date)}</div>}
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
          <div style={{ textAlign: "center", color: "#2e2e4a", padding: "40px 0", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>no friends found</div>
        )}
      </div>
    </div>
  );
}

function ArtistsView({ concerts, onOpen }) {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("most-seen");
  const [filterGenre, setFilterGenre] = useState("all");
  const [filterMinSeen, setFilterMinSeen] = useState(0);
  const [filterUpcoming, setFilterUpcoming] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Group all concerts by artist
  const artistMap = {};
  concerts.forEach(c => {
    if (!artistMap[c.artist]) artistMap[c.artist] = [];
    artistMap[c.artist].push(c);
  });

  const allGenres = [...new Set(concerts.map(c => c.genre).filter(Boolean))].sort();

  const artistEntries = Object.entries(artistMap).map(([name, shows]) => {
    const pastShows = shows.filter(c => isPast(c.date));
    const upcomingShows = shows.filter(c => !isPast(c.date));
    const rated = pastShows.filter(c => c.rating);
    const avgRating = rated.length ? rated.reduce((s, c) => s + c.rating, 0) / rated.length : null;
    const sortedPast = [...pastShows].sort((a, b) => a.date.localeCompare(b.date));
    const firstShow = sortedPast[0] || null;
    const lastShow = sortedPast[sortedPast.length - 1] || null;
    const genreCount = {};
    shows.forEach(c => { if (c.genre) genreCount[c.genre] = (genreCount[c.genre] || 0) + 1; });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { name, shows, pastShows, upcomingShows, pastCount: pastShows.length, avgRating, firstShow, lastShow, topGenre };
  });

  const activeFilterCount = [filterGenre !== 'all', filterMinSeen > 0, filterUpcoming].filter(Boolean).length;

  const sorted = artistEntries
    .filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGenre !== 'all' && a.topGenre !== filterGenre) return false;
      if (filterMinSeen > 0 && a.pastCount < filterMinSeen) return false;
      if (filterUpcoming && a.upcomingShows.length === 0) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'most-seen') return b.pastCount - a.pastCount || a.name.localeCompare(b.name);
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

  if (selectedArtist) {
    const shows = artistMap[selectedArtist].sort((a,b) => b.date.localeCompare(a.date));
    const pastShows = shows.filter(c => isPast(c.date));
    const upcomingShows = shows.filter(c => !isPast(c.date));
    return (
      <div style={{ padding: "0 0 100px" }}>
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

        {/* Filter pills row */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center', overflowX: 'auto' }}>
          <button onClick={() => setShowFilters(f => !f)} style={{
            background: showFilters || activeFilterCount > 0 ? '#1a1a30' : 'none',
            border: `1px solid ${showFilters || activeFilterCount > 0 ? '#a78bfa' : '#1f1f35'}`,
            borderRadius: 99, padding: '5px 11px', cursor: 'pointer',
            color: activeFilterCount > 0 ? '#a78bfa' : '#6b6a8f', fontSize: 12,
            fontFamily: "'DM Mono', monospace", fontWeight: activeFilterCount > 0 ? 700 : 400, flexShrink: 0
          }}>
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </button>
          {sortBy !== 'most-seen' && <button onClick={() => setSortBy('most-seen')} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#a78bfa', border: '1px solid #a78bfa', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>↕ {sortBy === 'alpha' ? 'A–Z' : sortBy === 'recently-seen' ? 'Recent' : 'Rating'} ×</button>}
          {filterGenre !== 'all' && <button onClick={() => setFilterGenre('all')} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#a78bfa', border: '1px solid #a78bfa', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>{filterGenre} ×</button>}
          {filterMinSeen > 0 && <button onClick={() => setFilterMinSeen(0)} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#a78bfa', border: '1px solid #a78bfa', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>{filterMinSeen}+ seen ×</button>}
          {filterUpcoming && <button onClick={() => setFilterUpcoming(false)} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', flexShrink: 0, background: '#1a1a30', color: '#818cf8', border: '1px solid #818cf8', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>upcoming ×</button>}
        </div>

        {/* Filter + sort panel */}
        {showFilters && (
          <div style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Sort</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[{id:'most-seen',label:'Most seen'},{id:'alpha',label:'A–Z'},{id:'recently-seen',label:'Recently seen'},{id:'rating',label:'Avg rating'}].map(s => (
                  <button key={s.id} onClick={() => setSortBy(s.id)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: sortBy === s.id ? '#a78bfa' : '#0c0c14', color: sortBy === s.id ? '#0c0c14' : '#6b6a8f', border: `1px solid ${sortBy === s.id ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{s.label}</button>
                ))}
              </div>
            </div>
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
                  <button onClick={() => setFilterGenre('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterGenre === 'all' ? '#a78bfa' : '#0c0c14', color: filterGenre === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterGenre === 'all' ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
                  {allGenres.map(g => (
                    <button key={g} onClick={() => setFilterGenre(filterGenre === g ? 'all' : g)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterGenre === g ? '#a78bfa' : '#0c0c14', color: filterGenre === g ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterGenre === g ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{g}</button>
                  ))}
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
        {sorted.map(({ name, pastCount, upcomingShows, firstShow, lastShow, avgRating, topGenre }) => (
          <button key={name} onClick={() => setSelectedArtist(name)} style={{
            width: "100%", textAlign: "left", background: "#13131f",
            border: "1px solid #1f1f35", borderLeft: `3px solid ${getBorderColor(pastCount)}`,
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
                  : lastShow ? formatDate(lastShow.date) : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#6b6a8f', lineHeight: 1 }}>{pastCount}</span>
                <span style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginLeft: 3 }}>time{pastCount !== 1 ? 's' : ''}</span>
              </div>
              {upcomingShows.length > 0 && (
                <div style={{ fontSize: 9, color: '#818cf8', fontFamily: "'DM Mono', monospace" }}>+{upcomingShows.length} soon</div>
              )}
            </div>
          </button>
        ))}
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", color: "#2e2e4a", padding: "40px 0", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>no artists found</div>
        )}
      </div>
    </div>
  );
}

function ArtistShowRow({ concert, onOpen }) {
  const past = isPast(concert.date);
  const isFestival = concert.type === "festival";
  return (
    <button onClick={() => onOpen(concert)} style={{
      width: "100%", textAlign: "left",
      background: isFestival ? "#0e0e16" : past ? "#0e0e1a" : "#13131f",
      border: `1px solid ${isFestival ? "#2a1f35" : "#1f1f35"}`,
      borderLeft: `3px solid ${isFestival ? "#f472b6" : "#2e2e4a"}`,
      borderRadius: 10, padding: "11px 14px",
      cursor: "pointer", marginBottom: 6, display: "flex", alignItems: "center", gap: 12
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          {isFestival && <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 600, padding: "1px 5px", borderRadius: 99, background: "#1a1030", color: "#f472b6" }}>FEST</span>}
          <span style={{ fontSize: 13, color: "#e2e0ff", fontWeight: 500 }}>{formatDate(concert.date)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#6b6a8f", fontFamily: "'DM Mono', monospace" }}>
          {concert.venue}{concert.room ? ` · ${concert.room}` : ""} · {concert.city}
        </div>
        {concert.tour && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2 }}>{concert.tour}</div>}
        {concert.friends.length > 0 && <div style={{ fontSize: 10, color: "#4a4870", marginTop: 2 }}>w. {concert.friends.join(", ")}</div>}
        {concert.rating && <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 3 }}>{"★".repeat(concert.rating)}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
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
    genre: null, subgenre: null, language: [], venueSize: null, seenAs: null
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(settings.venueSizes||[]).map(vs => (
              <button key={vs} onClick={() => update('venueSize', form.venueSize===vs ? null : vs)} style={{
                padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                background: form.venueSize===vs ? '#a78bfa' : '#13131f',
                color: form.venueSize===vs ? '#0c0c14' : '#6b6a8f',
                border: `1px solid ${form.venueSize===vs ? '#a78bfa' : '#2e2e50'}`,
                fontWeight: form.venueSize===vs ? 700 : 400
              }}>{vs}</button>
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
          {fieldLabel('Subgenre')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(settings.subgenres||[]).map(g => (
              <button key={g} onClick={() => update('subgenre', form.subgenre===g ? null : g)} style={{
                padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                background: form.subgenre===g ? '#38bdf8' : '#13131f',
                color: form.subgenre===g ? '#0c0c14' : '#6b6a8f',
                border: `1px solid ${form.subgenre===g ? '#38bdf8' : '#2e2e50'}`,
                fontWeight: form.subgenre===g ? 700 : 400
              }}>{g}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Language')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(() => {
              const langs = Array.isArray(form.language) ? form.language : form.language ? [form.language] : [];
              return (settings.languages||[]).map(l => {
                const on = langs.includes(l);
                return (
                  <button key={l} onClick={() => update('language', on ? langs.filter(x=>x!==l) : [...langs, l])} style={{
                    padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                    background: on ? '#a78bfa' : '#13131f',
                    color: on ? '#0c0c14' : '#6b6a8f',
                    border: `1px solid ${on ? '#a78bfa' : '#2e2e50'}`,
                    fontWeight: on ? 700 : 400
                  }}>{l}</button>
                );
              });
            })()}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {fieldLabel('Seen as')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Headliner','Support','Guest','Festival'].map(opt => (
              <button key={opt} onClick={() => update('seenAs', form.seenAs === opt ? null : opt)} style={{
                padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                background: form.seenAs === opt ? '#a78bfa' : '#13131f',
                color: form.seenAs === opt ? '#0c0c14' : '#6b6a8f',
                border: `1px solid ${form.seenAs === opt ? '#a78bfa' : '#2e2e50'}`,
                fontWeight: form.seenAs === opt ? 700 : 400
              }}>{opt}</button>
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
  const [newSubgenre, setNewSubgenre] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newVenueSize, setNewVenueSize] = useState("");
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const sec = id => ({ open: openSection === id, onToggle: () => setOpenSection(s => s === id ? null : id) });

  const lUpdate = (key, value) => { setLocal(prev => ({ ...prev, [key]: value })); setSaved(false); };
  const handleSettingsSave = () => {
    Object.entries(local).forEach(([k, v]) => onUpdate(k, v));
    setSaved(true);
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

  const handleCsvExport = () => {
    const headers = ['ID','Date','Artist','Venue','Room','City','Country','Type','Tour','Genre','SubGenre','Language','Rating','TicketPrice','Friends','Solo','VenueSize','Notes'];
    const rows = concerts.map(c => [
      c.id, c.date, c.artist, c.venue, c.room||'', c.city, c.country, c.type, c.tour||'',
      c.genre||'', c.subgenre||'', (Array.isArray(c.language) ? c.language.join('; ') : c.language||''), c.rating||'', c.ticketPrice||'',
      (c.friends||[]).join('; '), c.solo?'yes':'', c.venueSize||'', (c.notes||'').replace(/\n/g,' ')
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
      for (const concert of parsed) await onSaveConcert(concert);
      setImportStatus("success");
      setImportText("");
      setTimeout(() => { setImportStatus(null); window.location.reload(); }, 1500);
    } catch (e) {
      setImportStatus("error");
    }
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
    if (lines.length < 2) return [];
    const headers = parseRow(lines[0]);
    return lines.slice(1).map(line => {
      const vals = parseRow(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return {
        id: obj.ID || `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: obj.Date, artist: obj.Artist, venue: obj.Venue, room: obj.Room || null,
        city: obj.City, country: obj.Country, type: obj.Type || 'concert',
        tour: obj.Tour || null, genre: obj.Genre || null, subgenre: obj.SubGenre || null,
        language: obj.Language ? obj.Language.split('; ').filter(Boolean) : [],
        rating: obj.Rating ? parseInt(obj.Rating) : null,
        ticketPrice: obj.TicketPrice ? parseFloat(obj.TicketPrice) : null,
        friends: obj.Friends ? obj.Friends.split('; ').filter(Boolean) : [],
        solo: obj.Solo === 'yes', venueSize: obj.VenueSize || null, notes: obj.Notes || null, merch: [], support: [],
      };
    });
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const concerts = file.name.endsWith('.csv')
          ? parseCSV(ev.target.result)
          : JSON.parse(ev.target.result);
        if (!Array.isArray(concerts)) throw new Error();
        for (const c of concerts) await onSaveConcert(c);
        setImportStatus("success");
        setTimeout(() => { setImportStatus(null); window.location.reload(); }, 1500);
      } catch { setImportStatus("error"); }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  return (
    <div style={{ padding: "16px 20px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#e2e0ff" }}>Settings</div>
        <button onClick={handleSettingsSave} style={{
          background: saved ? "#a78bfa" : "#1a1a30",
          border: `1px solid ${saved ? "#a78bfa" : "#2e2e50"}`,
          color: saved ? "#0c0c14" : "#a78bfa",
          borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all 0.15s"
        }}>{saved ? "Saved" : "Save"}</button>
      </div>

      <Collapsible title="◆  Preferences" {...sec("preferences")}>
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "0 16px", marginBottom: 4 }}>
          <Row label="Color theme" sub="Changes instantly, no save needed">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {[{id:'purple',label:'Purple'},{id:'blue',label:'Blue'},{id:'green',label:'Green'},{id:'red',label:'Red'},{id:'orange',label:'Orange'},{id:'mono',label:'Mono'}].map(o => (
                <button key={o.id} onClick={() => { onUpdate('colorTheme', o.id); lUpdate('colorTheme', o.id); }} style={{
                  padding: "4px 10px", borderRadius: 99, fontSize: 11, cursor: "pointer",
                  background: (local.colorTheme||'purple') === o.id ? "#a78bfa" : "#13131f",
                  color: (local.colorTheme||'purple') === o.id ? "#0c0c14" : "#6b6a8f",
                  border: `1px solid ${(local.colorTheme||'purple') === o.id ? "#a78bfa" : "#1f1f35"}`,
                  fontWeight: (local.colorTheme||'purple') === o.id ? 700 : 400, fontFamily: "'DM Mono', monospace"
                }}>{o.label}</button>
              ))}
            </div>
          </Row>
          <Row label="Opening tab" sub="Which tab opens on launch">
            <OptionPills value={local.defaultTab} options={[{id:"stats",label:"Stats"},{id:"home",label:"Shows"},{id:"artists",label:"Artists"}]} onChange={v => lUpdate("defaultTab", v)} />
          </Row>
          <Row label="Past shows" sub="Show past concerts by default">
            <OptionPills value={local.defaultShowPast} options={[{id:"open",label:"Open"},{id:"closed",label:"Closed"}]} onChange={v => lUpdate("defaultShowPast", v)} />
          </Row>
          <Row label="Stats tab" sub="Which stats view opens first">
            <OptionPills value={local.defaultStatsTab} options={[{id:"summary",label:"Summary"},{id:"charts",label:"Charts"}]} onChange={v => lUpdate("defaultStatsTab", v)} />
          </Row>
          <Row label="Top artists" sub="Rows shown in charts">
            <Stepper value={local.topArtistsRows} onChange={v => lUpdate("topArtistsRows", v)} />
          </Row>
          <Row label="Top friends" sub="Rows shown in charts">
            <Stepper value={local.topFriendsRows} onChange={v => lUpdate("topFriendsRows", v)} />
          </Row>
          <Row label="Top venues" sub="Rows shown in charts">
            <Stepper value={local.topVenuesRows} onChange={v => lUpdate("topVenuesRows", v)} />
          </Row>
          <Row label="Most expensive" sub="Rows shown in list">
            <Stepper value={local.topExpensiveRows} onChange={v => lUpdate("topExpensiveRows", v)} min={3} max={20} />
          </Row>
          <Row label="Rating system" sub="Stars used when rating shows">
            <OptionPills value={String(local.ratingSystem || 5)} options={[{id:"5",label:"5 stars"},{id:"10",label:"10 stars"}]} onChange={v => lUpdate("ratingSystem", Number(v))} />
          </Row>
        </div>
      </Collapsible>

      <Collapsible title="◈  Tags" {...sec("tags")}>
        {[
          { label: "Genres", items: genres, onRemove: removeGenre, input: newGenre, onInput: setNewGenre, onAdd: addGenre, placeholder: "Add genre..." },
          { label: "Subgenres", items: subgenres, onRemove: removeSubgenre, input: newSubgenre, onInput: setNewSubgenre, onAdd: addSubgenre, placeholder: "Add subgenre..." },
          { label: "Languages", items: languages, onRemove: removeLanguage, input: newLanguage, onInput: setNewLanguage, onAdd: addLanguage, placeholder: "Add language..." },
          { label: "Venue sizes", items: venueSizes, onRemove: removeVenueSize, input: newVenueSize, onInput: setNewVenueSize, onAdd: addVenueSize, placeholder: "Add venue size..." },
          { label: "Merch items", items: categories, onRemove: removeCategory, input: newCategory, onInput: setNewCategory, onAdd: addCategory, placeholder: "Add category..." },
        ].map(({ label, ...props }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#6b6a8f", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
            <TagManager {...props} />
          </div>
        ))}
      </Collapsible>

      <Collapsible title="◉  Account & Data" {...sec("account")}>
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "16px", marginBottom: 4 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={handleCsvExport} style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #2e2e50", color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif" }}>Export CSV</button>
            {!exportData
              ? <button onClick={handleExport} style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "#1a1a30", border: "1px solid #a78bfa", color: "#a78bfa", fontFamily: "'DM Sans', sans-serif" }}>Export JSON</button>
              : <button onClick={() => setExportData(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #1f1f35", color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif" }}>Close</button>
            }
          </div>
          {exportData && (
            <div style={{ marginBottom: 10 }}>
              <textarea readOnly value={exportData} rows={4} style={{ width: "100%", background: "#0c0c14", border: "1px solid #1f1f35", borderRadius: 8, color: "#6b6a8f", padding: "10px", fontSize: 10, fontFamily: "'DM Mono', monospace", resize: "none", boxSizing: "border-box", marginBottom: 6 }} />
              <button onClick={handleCopy} style={{ width: "100%", padding: "8px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: exportStatus === "copied" ? "#a78bfa" : "#1a1a30", border: `1px solid ${exportStatus === "copied" ? "#a78bfa" : "#2e2e50"}`, color: exportStatus === "copied" ? "#0c0c14" : "#a78bfa", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{exportStatus === "copied" ? "Copied!" : "Copy to clipboard"}</button>
            </div>
          )}
          <div style={{ borderTop: "1px solid #1a1a2e", paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: "#6b6a8f", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>Restore from backup</div>
            {importStatus === "success" && <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 8 }}>Restored! Reloading...</div>}
            {importStatus === "error" && <div style={{ fontSize: 11, color: "#f472b6", marginBottom: 8 }}>Could not read file — make sure it's a valid export</div>}
            <input type="file" accept=".json" id="import-json" onChange={handleFileImport} style={{ display: "none" }} />
            <input type="file" accept=".csv" id="import-csv" onChange={handleFileImport} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={() => document.getElementById('import-json').click()} style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "#1a1a30", border: "1px solid #a78bfa", color: "#a78bfa", fontFamily: "'DM Sans', sans-serif" }}>Select JSON file</button>
              <button onClick={() => document.getElementById('import-csv').click()} style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #2e2e50", color: "#c4c2f0", fontFamily: "'DM Sans', sans-serif" }}>Select CSV file</button>
            </div>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Or paste JSON here..." rows={2} style={{ width: "100%", background: "#0c0c14", border: `1px solid ${importStatus === "error" ? "#f472b6" : "#1f1f35"}`, borderRadius: 8, color: "#c4c2f0", padding: "10px", fontSize: 10, fontFamily: "'DM Mono', monospace", resize: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <button onClick={handleImport} disabled={!importText.trim()} style={{ width: "100%", padding: "9px", borderRadius: 8, fontSize: 12, cursor: importText.trim() ? "pointer" : "not-allowed", background: "none", border: "1px solid #1f1f35", color: importText.trim() ? "#c4c2f0" : "#2e2e4a", fontFamily: "'DM Sans', sans-serif" }}>Restore from paste</button>
          </div>
          <div style={{ borderTop: "1px solid #1a1a2e", marginTop: 14, paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>
              signed in as <span style={{ color: "#6b6a8f" }}>{userEmail}</span>
            </div>
            <button onClick={onSignOut} style={{ width: "100%", padding: "11px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "none", border: "1px solid #f472b6", color: "#f472b6", fontFamily: "'DM Mono', monospace" }}>log out</button>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="◇  Help" {...sec("help")}>
        <div style={{ background: "#13131f", border: "1px solid #1f1f35", borderRadius: 12, padding: "16px", marginBottom: 4 }}>
          {[
            { label: "🐛 Report a bug or suggest a feature", url: "https://github.com/HoltropAF/concert_tracker/issues/new" },
            { label: "📋 View all issues & requests", url: "https://github.com/HoltropAF/concert_tracker/issues" },
            { label: "📦 Releases & changelog", url: "https://github.com/HoltropAF/concert_tracker/releases" },
            { label: "📖 Documentation (wiki)", url: "https://github.com/HoltropAF/concert_tracker/wiki" },
          ].map(({ label, url }) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "#a78bfa", fontSize: 13, fontFamily: "'DM Sans', sans-serif", textDecoration: "none", paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid #1a1a2e" }}>{label} ↗</a>
          ))}
          <div style={{ fontSize: 11, color: "#4a4870", fontFamily: "'DM Mono', monospace" }}>
            Tips: CSV imports use the ID column to avoid duplicates · Tap any summary chart to jump to the full chart · Use the ⚙ in Stats to show/hide sections
          </div>
        </div>
      </Collapsible>
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
  const [filterSubgenre, setFilterSubgenre] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [showPast, setShowPast] = useState(settings.defaultShowPast === 'open')

  const allFriends = [...new Set(concerts.flatMap(c => c.friends))].sort()

  const THEME_FILTER = { purple:'', blue:'hue-rotate(-50deg)', green:'hue-rotate(-145deg)', red:'hue-rotate(90deg)', orange:'hue-rotate(130deg)', mono:'grayscale(1)' };
  const themeFilter = THEME_FILTER[settings.colorTheme] ?? '';

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
    filterRating !== 0, filterSolo, filterGenre !== 'all', filterSubgenre !== 'all'
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
    if (filterSubgenre !== 'all' && c.subgenre !== filterSubgenre) return false
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

  if (showAdd) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", filter: themeFilter || undefined }}>
      <AddConcertForm
        onSave={c => { onSaveConcert(c); setShowAdd(false); setSelected(c) }}
        onClose={() => setShowAdd(false)}
        settings={settings}
        friends={allFriends}
      />
    </div>
  )

  if (selected) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", filter: themeFilter || undefined }}>
      <ConcertDetail concert={selected} onClose={() => setSelected(null)} onSave={handleSave} settings={settings} friends={allFriends} onDelete={onDeleteConcert} />
    </div>
  )

  return (
    <div style={{ background: '#0c0c14', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: "'DM Sans', sans-serif", filter: themeFilter || undefined }}>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', position: 'sticky', top: 0, background: '#0c0c14', zIndex: 50, borderBottom: '1px solid #0d1a14' }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#e2e0ff', lineHeight: 1 }}>concert tracker</div>
          <div style={{ fontSize: 10, color: '#5a5880', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
            {allPast.length} shows · {concerts.filter(c => !isPastDate(c.date)).length} upcoming
          </div>
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
            <button onClick={() => setShowAdd(true)} style={{
              background: '#1a1a30', border: '1px solid #a78bfa',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              color: '#a78bfa', fontSize: 18, lineHeight: 1, fontWeight: 300, flexShrink: 0
            }}>+</button>
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
            <button onClick={() => setShowFilters(f => !f)} style={{
              background: showFilters || activeFilterCount > 0 ? '#1a1a30' : 'none',
              border: `1px solid ${showFilters || activeFilterCount > 0 ? '#a78bfa' : '#1f1f35'}`,
              borderRadius: 99, padding: '5px 11px', cursor: 'pointer',
              color: activeFilterCount > 0 ? '#a78bfa' : '#6b6a8f', fontSize: 12,
              fontFamily: "'DM Mono', monospace", fontWeight: activeFilterCount > 0 ? 700 : 400, flexShrink: 0
            }}>
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            </button>
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
                {Array.from({ length: settings.ratingSystem || 5 }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setFilterRating(filterRating === n ? 0 : n)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterRating === n ? '#a78bfa' : '#0c0c14', color: filterRating === n ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterRating === n ? '#a78bfa' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{n}★</button>
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
            {(settings.subgenres||[]).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Subgenre</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  <button onClick={() => setFilterSubgenre('all')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterSubgenre === 'all' ? '#38bdf8' : '#0c0c14', color: filterSubgenre === 'all' ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterSubgenre === 'all' ? '#38bdf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>All</button>
                  {(settings.subgenres||[]).map(g => (
                    <button key={g} onClick={() => setFilterSubgenre(filterSubgenre === g ? 'all' : g)} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: filterSubgenre === g ? '#38bdf8' : '#0c0c14', color: filterSubgenre === g ? '#0c0c14' : '#6b6a8f', border: `1px solid ${filterSubgenre === g ? '#38bdf8' : '#1f1f35'}`, fontFamily: "'DM Mono', monospace" }}>{g}</button>
                  ))}
                </div>
              </div>
            )}
            {activeFilterCount > 0 && (
              <button onClick={() => { setFilterYear('all'); setFilterType('all'); setFilterFriend('all'); setFilterVenue('all'); setFilterRating(0); setFilterSolo(false); setFilterGenre('all'); setFilterSubgenre('all'); setSortOrder('newest'); setSearch('') }} style={{ width: '100%', padding: '8px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'none', border: '1px solid #2e2e50', color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>Reset all filters</button>
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
        {view === 'stats' && <StatsView concerts={concerts} settings={settings} onNavigate={({ view: v, filterType: ft }) => { setView(v); if (ft !== undefined) setFilterType(ft); }} onUpdateSetting={updateSetting} />}
        {view === 'friends' && <FriendsView concerts={concerts} onOpen={setSelected} />}
        {view === 'artists' && <ArtistsView concerts={concerts} onOpen={setSelected} />}
        {view === 'settings' && <SettingsView settings={settings} onUpdate={updateSetting} concerts={concerts} onSaveConcert={onSaveConcert} onSignOut={onSignOut} userEmail={userEmail} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#0c0c14', borderTop: '1px solid #0d1a14', display: 'flex', paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))', zIndex: 100 }}>
        <TabBtn id="home" icon="♪" label="Shows" />
        <TabBtn id="artists" icon="★" label="Artists" />
        <TabBtn id="stats" icon="◎" label="Stats" />
        <TabBtn id="friends" icon="◉" label="Friends" />
        <TabBtn id="settings" icon="⚙" label="Settings" />
      </div>
    </div>
  )
}

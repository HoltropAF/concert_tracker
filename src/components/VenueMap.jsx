import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Leaflet's default marker icon references image paths that don't survive
// bundling — build our own small colored-dot icons instead (also lets us
// distinguish visited vs. upcoming-only venues by color).
function dotIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #0c0c14;box-shadow:0 0 0 1px ${color};"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  })
}

const VISITED_ICON = dotIcon('#a78bfa')
const UPCOMING_ONLY_ICON = dotIcon('#34d399')

// points: [{ name, lat, lng, pastCount, upcomingCount }]
// focus: optional { lat, lng, zoom } — if set, centers there instead of
// fitting bounds to all points (used for the single-venue mini preview).
export default function VenueMap({ points, onSelect, height = 360, focus = null, interactive = true, autoOpenName = null }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: interactive,
      attributionControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tap: interactive,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = []
    points.forEach(p => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return
      const icon = p.pastCount > 0 ? VISITED_ICON : UPCOMING_ONLY_ICON
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map)
      const label = p.pastCount > 0
        ? `${p.pastCount}× visited`
        : `${p.upcomingCount} upcoming`
      marker.bindPopup(
        `<div style="font-family:'DM Sans',sans-serif;min-width:120px">` +
        `<div style="font-weight:700;margin-bottom:2px">${escapeHtml(p.name)}</div>` +
        `<div style="font-size:11px;color:#666">${label}</div>` +
        `</div>`
      )
      if (onSelect) marker.on('click', () => onSelect(p.name))
      if (autoOpenName && p.name === autoOpenName) marker.openPopup()
      markers.push(marker)
    })
    if (focus) {
      map.setView([focus.lat, focus.lng], focus.zoom ?? 14)
    } else if (markers.length > 0) {
      const group = L.featureGroup(markers)
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 13 })
    } else {
      map.setView([20, 0], 2)
    }
    return () => { markers.forEach(m => m.remove()) }
  }, [points, onSelect, focus, autoOpenName])

  return <div ref={containerRef} style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }} />
}

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

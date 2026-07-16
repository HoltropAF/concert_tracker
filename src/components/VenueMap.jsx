import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Google-Maps-style pin markers built from CSS, not raster images (keeps the
// bundle small and lets us theme colors dynamically). Two shapes:
//  - teardrop (rounded pin) for venues that are mainly regular concerts
//  - diamond for venues that are purely festival grounds
// Both carry a small music-note glyph so they read as "concert" at a glance,
// similar to the fork/knife or "P" glyphs in the reference style.
function pinIcon(color, shape) {
  const size = 15
  const noteSvg = `<svg viewBox="0 0 24 24" width="6" height="6" style="position:absolute;top:${shape === 'diamond' ? '3.5px' : '2.5px'};left:50%;transform:translateX(-50%) rotate(45deg);" fill="#fff"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`
  const shapeStyle = shape === 'diamond'
    ? `width:${size * 0.72}px;height:${size * 0.72}px;border-radius:3px;transform:rotate(45deg);`
    : `width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);`
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      <div style="${shapeStyle}position:absolute;left:0;top:0;right:0;bottom:0;margin:auto;background:${color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>
      ${noteSvg}
    </div>`
  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: shape === 'diamond' ? [size / 2, size / 2] : [size / 2, size],
    popupAnchor: [0, shape === 'diamond' ? -size / 2 : -size],
  })
}

const ICONS = {
  'pin-visited': pinIcon('#a78bfa', 'pin'),
  'pin-upcoming': pinIcon('#34d399', 'pin'),
  'diamond-visited': pinIcon('#a78bfa', 'diamond'),
  'diamond-upcoming': pinIcon('#34d399', 'diamond'),
}

// points: [{ name, lat, lng, pastCount, upcomingCount, shape: 'pin' | 'diamond' }]
// focus: optional { lat, lng, zoom } — if set, centers there instead of
// fitting bounds to all points (used for the single-venue mini preview).
// showZoomControl: show +/- buttons even when the map is otherwise static.
// clickOpensMaps: tapping a pin opens Google Maps for that point instead of
// showing an in-app popup (used for the single-venue preview/expanded view).
export default function VenueMap({ points, onSelect, height = 360, focus = null, interactive = true, autoOpenName = null, fitPoints = null, showZoomControl = false, clickOpensMaps = false }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: interactive || showZoomControl,
      attributionControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tap: true,
    })
    // CartoDB Positron — free, no API key, a clean light basemap (closer to
    // the reference style than the standard OSM tiles, and easier to read
    // with colored pins on top).
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors © CARTO',
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
      const shapeKey = p.shape === 'diamond' ? 'diamond' : 'pin'
      const iconKey = `${shapeKey}-${p.pastCount > 0 ? 'visited' : 'upcoming'}`
      const marker = L.marker([p.lat, p.lng], { icon: ICONS[iconKey] }).addTo(map)
      if (clickOpensMaps) {
        marker.on('click', () => {
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=`, '_blank', 'noopener')
        })
      } else {
        const label = p.pastCount > 0
          ? `${p.pastCount}× visited`
          : `${p.upcomingCount} upcoming`
        const extraLines = [
          p.parking ? `🚗 ${escapeHtml(p.parking)}` : null,
          p.transit ? `🚌 ${escapeHtml(p.transit)}` : null,
        ].filter(Boolean).map(l => `<div style="font-size:11px;color:#666;margin-top:3px">${l}</div>`).join('')
        marker.bindPopup(
          `<div style="font-family:'DM Sans',sans-serif;min-width:120px">` +
          `<div style="font-weight:700;margin-bottom:2px">${escapeHtml(p.name)}</div>` +
          `<div style="font-size:11px;color:#666">${label}${p.shape === 'diamond' ? ' · festival' : ''}</div>` +
          extraLines +
          `</div>`
        )
        if (onSelect) marker.on('click', () => onSelect(p.name))
        if (autoOpenName && p.name === autoOpenName) marker.openPopup()
      }
      markers.push(marker)
    })
    if (focus) {
      map.setView([focus.lat, focus.lng], focus.zoom ?? 14)
    } else {
      const boundsSource = (fitPoints && fitPoints.length > 0 ? fitPoints : points).filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
      if (boundsSource.length > 0) {
        const b = L.latLngBounds(boundsSource.map(p => [p.lat, p.lng]))
        map.fitBounds(b.pad(0.2), { maxZoom: 13 })
      } else if (markers.length > 0) {
        const group = L.featureGroup(markers)
        map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 13 })
      } else {
        map.setView([20, 0], 2)
      }
    }
    return () => { markers.forEach(m => m.remove()) }
  }, [points, onSelect, focus, autoOpenName, fitPoints, clickOpensMaps])

  return <div ref={containerRef} style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }} />
}

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

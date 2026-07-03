import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// * Outermost safety net: catches any crash in App() itself — including hooks that
// * throw before AppErrorBoundary inside App has a chance to render.
// * Shows a styled recovery screen with two options:
// *   • Reload — lets the waiting SW activate on the next navigation
// *   • Clear cache and reload — programmatically unregisters the SW and wipes
// *     Cache Storage so the next load is guaranteed fresh
class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false, errorMessage: null }
  }

  static getDerivedStateFromError(error) {
    return { crashed: true, errorMessage: error?.message || String(error) }
  }

  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary] App crashed:', error, info)
    this.setState({ errorMessage: error?.message || String(error) })
  }

  clearCacheAndReload() {
    const reload = () => window.location.reload()
    if (!('serviceWorker' in navigator)) { reload(); return }
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .then(() => caches.keys())
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(reload)
      .catch(reload)
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ maxWidth: 360, width: '100%', background: '#13131f', border: '1px solid #f472b6', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#e2e0ff', marginBottom: 10 }}>Something went wrong</div>
          <div style={{ color: '#6b6a8f', fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Mono', monospace", marginBottom: this.state.errorMessage ? 10 : 20 }}>
            The app failed to start. Reloading usually fixes it — or clear the cache for a guaranteed fresh start.
          </div>
          {this.state.errorMessage && (
            <div style={{ color: '#f472b6', fontSize: 11, lineHeight: 1.5, fontFamily: "'DM Mono', monospace", marginBottom: 16, wordBreak: 'break-word', textAlign: 'left', background: '#0c0c14', borderRadius: 6, padding: '8px 10px' }}>
              {this.state.errorMessage}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ display: 'block', width: '100%', minHeight: 44, borderRadius: 8, border: 'none', background: '#a78bfa', color: '#0c0c14', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}
          >
            Reload app
          </button>
          <button
            onClick={() => this.clearCacheAndReload()}
            style={{ display: 'block', width: '100%', minHeight: 40, borderRadius: 8, border: '1px solid #2a2850', background: 'none', color: '#6b6a8f', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Mono', monospace" }}
          >
            Clear cache &amp; reload
          </button>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
)

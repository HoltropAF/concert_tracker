// Runs before the app bundle. Kept out of index.html so the Content-Security-Policy
// in vercel.json can forbid inline scripts (which is what blocks injected script).

// Same cached stats the app writes after every load, so returning visitors see
// their real numbers immediately instead of an empty line.
try {
  var _c = JSON.parse(localStorage.getItem('splash_counts') || 'null')
  if (_c) {
    document.getElementById('boot-counts').textContent =
      _c.concerts + ' concerts · ' + _c.festivals + ' festivals · ' + _c.upcoming + ' upcoming'
  }
} catch (e) {}

// The Google Fonts stylesheet loads as media="print" so it never blocks first paint;
// switch it on once it has arrived.
(function () {
  var fonts = document.getElementById('app-fonts')
  if (!fonts) return
  if (fonts.sheet) fonts.media = 'all'
  else fonts.addEventListener('load', function () { fonts.media = 'all' })
})()

// Emergency fallback: if JS fails to load (SW cache miss on a chunk), show a
// clear-cache button after 6 seconds so the user isn't stuck on a blank screen.
setTimeout(function () {
  if (window.__appMounted || document.getElementById('root').children.length > 0) return
  var bs = document.getElementById('boot-splash')
  if (bs) bs.remove()
  var s = document.createElement('style')
  s.textContent = '#_fb{position:fixed;inset:0;z-index:9999;background:#0c0c14;display:flex;align-items:center;justify-content:center;font-family:sans-serif}#_fb div{max-width:320px;width:100%;background:#13131f;border:1px solid #f472b6;border-radius:12px;padding:24px;text-align:center}#_fb h2{color:#e2e0ff;font-size:18px;margin:0 0 10px}#_fb p{color:#6b6a8f;font-size:12px;line-height:1.6;margin:0 0 18px}#_fb button{display:block;width:100%;padding:12px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:700;margin-bottom:8px}#_fb .p{background:#a78bfa;border:none;color:#0c0c14}#_fb .s{background:none;border:1px solid #2a2850;color:#6b6a8f}'
  document.head.appendChild(s)
  var d = document.createElement('div')
  d.id = '_fb'
  d.innerHTML = '<div><h2>Something went wrong</h2><p>The app couldn\'t load — probably a stale browser cache. Clear the cache and reload to fix it.</p><button class="p" type="button">Clear cache &amp; reload</button><button class="s" type="button">Just reload</button></div>'
  document.body.appendChild(d)
  d.querySelector('.p').addEventListener('click', function () {
    var r = function () { location.reload() }
    if (!navigator.serviceWorker) { r(); return }
    navigator.serviceWorker.getRegistrations()
      .then(function (a) { return Promise.all(a.map(function (x) { return x.unregister() })) })
      .then(function () { return caches.keys() })
      .then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n) })) })
      .then(r).catch(r)
  })
  d.querySelector('.s').addEventListener('click', function () { location.reload() })
}, 6000)

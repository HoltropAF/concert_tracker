import test from 'node:test'
import assert from 'node:assert/strict'
import {parseMojo} from '../../server/mojo.js'
test('MOJO extracts date and encoded venue separator without claiming availability',()=>{
 const html='<h2 class="agenda-list__title">oktober 2026</h2><li class="c-agenda-item"><a href="/concerten/example" class="agenda-item__link"><span class="agenda-item__date-day">25</span><h3 class="agenda-item__title">Example Artist</h3><div class="agenda-item__subtitle">Ziggo Dome &#x2014; Amsterdam</div></a></li>'
 const {events}=parseMojo(html,{artist:'Example Artist',today:'2026-10-21'})
 assert.equal(events.length,1)
 assert.equal(events[0].venue,'Ziggo Dome')
 assert.equal(events[0].city,'Amsterdam')
 assert.equal(events[0].date,'2026-10-25')
 assert.equal(events[0].status,'Check promoter site')
 assert.throws(()=>parseMojo('<html>Access denied</html>',{today:'2026-10-21'}))
 assert.equal(parseMojo(html,{artist:'Other Artist',today:'2026-10-21'}).events.length,0)
})

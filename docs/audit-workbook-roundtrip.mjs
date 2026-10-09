import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import XLSX from 'xlsx'
import { normalizeSetlistRows, isSectionRow } from '../src/lib/setlistRows.js'

const source = fs.readFileSync(new URL('../src/components/ConcertTracker.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const between = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)))
const fixture = {
  id: 'roundtrip', artist: 'QA Festival', date: '2026-09-20', endDate: '2026-09-22', type: 'festival',
  wishlist: true, attendanceMode: 'online', onlineType: 'concert', platform: 'QA stream',
  venue: '', city: '', country: '', friends: ['QA Friend'], tickets: [{ name: 'GA', price: 25 }],
  ticketType: 'GA', ticketAddons: ['Early entry'], otherCosts: [{ name: 'Travel', price: 10 }],
  acts: [{ name: 'QA Act', day: 1 }], support: [{ name: 'QA Support', role: 'guest' }],
  photo: 'qa/photo.jpg', photoTags: ['QA Friend'], photoPos: { x: 20, y: 30 }, notes: 'First line\nSecond line',
  customMetadata: 'x'.repeat(40000), rating: 4.5,
  setlist: ['First', { type: 'section', label: 'Encore' }, { name: 'Last', info: 'Acoustic', cover: 'QA Original', spotifyId: 'qa-track' }],
  supportSetlists: { 'QA Support': ['Opening'] },
}
let bytes, completion, exported = 0
const staged = []
const context = {
  loadXlsx: async () => ({ ...XLSX, writeFile: wb => { bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) } }),
  exportRows: [fixture], concerts: [fixture, { id: 'excluded', artist: 'Excluded', support: ['Excluded support'], setlist: ['Excluded song'] }],
  normalizeSetlistRows, isSectionRow,
  getSongName: s => typeof s === 'string' ? s : s?.name || '',
  getSongInfo: s => typeof s === 'string' ? null : s?.info || null,
  getSupportName: s => typeof s === 'string' ? s : s.name,
  getSupportRole: s => typeof s === 'string' ? 'support' : s.role,
  getFriends: c => c.friends || [], ticketTotal: c => (c.tickets || []).reduce((n,t) => n + Number(t.price), 0),
  recordExport: () => exported++,
  FileReader: class { readAsArrayBuffer() { completion = this.onload({ target: { result: bytes } }) } },
  excelDateToIso: value => value || null,
  stageImport: rows => staged.push(...rows),
  setImportStatus: status => { if (status === 'error') throw new Error('Import failed') },
  setImportMessage: () => {},
}
vm.createContext(context)
await vm.runInContext(`${between('  const handleXlsxExport = async () => {', '  const handleExport = async () => {')}\nhandleXlsxExport()`, context)
assert.equal(exported, 1)
const workbook = XLSX.read(bytes, { type: 'buffer' })
for (const name of ['Shows', 'Setlists', 'Support acts', 'Record details']) {
  assert.ok(!JSON.stringify(XLSX.utils.sheet_to_json(workbook.Sheets[name])).includes('Excluded'))
}
context.concerts = []
vm.runInContext(`${between('  const handleXlsxImport = (e) => {', '\n\n  return (')}\nhandleXlsxImport({target:{files:[{}],value:'fixture.xlsx'}})`, context)
await completion
assert.equal(staged.length, 1)
const restored = JSON.parse(JSON.stringify(staged[0]))
for (const key of ['photo', 'photoTags', 'photoPos', 'notes', 'customMetadata', 'rating', 'wishlist', 'endDate', 'attendanceMode', 'onlineType', 'platform', 'ticketType', 'ticketAddons', 'otherCosts', 'acts', 'setlist', 'support', 'supportSetlists']) {
  assert.deepEqual(restored[key], fixture[key], key)
}
console.log('PASS: real XLSX round trip preserves status, lineup, online details, expenses, songs and headings; export scope is respected.')

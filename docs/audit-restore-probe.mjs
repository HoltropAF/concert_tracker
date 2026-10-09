// Read-only reproduction of the existing XLSX import handler with workbook fixtures.
// No browser, database, or filesystem writes are performed by the handler.
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const source = fs.readFileSync(new URL('../src/components/ConcertTracker.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const start = source.indexOf('  const handleXlsxImport = (e) => {')
const end = source.indexOf('\n\n  return (', start)
if (start < 0 || end < 0) throw new Error('Could not locate XLSX import handler')
const handler = source.slice(start, end)

for (const withSupportSheet of [false, true]) {
  const shows = [{ ID: 'qa-restore', Artist: 'QA Restore Band', Date: '2026-09-20' }]
  const sheets = { Shows: shows, ...(withSupportSheet ? {
    'Support acts': [{ ConcertID: 'qa-restore', SupportAct: 'QA Opener', Role: 'guest' }],
    Setlists: [
      { ConcertID: 'qa-restore', Position: 2, Song: 'Second', IsSupport: 'no' },
      { ConcertID: 'qa-restore', Position: 1, Song: 'First', IsSupport: 'no', Note: 'Acoustic' },
      { ConcertID: 'qa-restore', Position: 1, Song: 'Opening', IsSupport: 'yes', Performer: 'QA Opener' },
    ],
  } : {}) }
  const staged = [], writes = [], messages = []
  let completion
  const context = {
    FileReader: class { readAsArrayBuffer() { completion = this.onload({ target: { result: 'fixture' } }) } },
    loadXlsx: async () => ({ read: () => ({ Sheets: sheets }), utils: { sheet_to_json: rows => rows } }),
    concerts: [],
    onSaveConcert: async value => { writes.push(value); return { error: null } },
    getSupportName: value => typeof value === 'string' ? value : value.name,
    stageImport: value => staged.push(...value),
    excelDateToIso: value => value,
    setImportStatus: () => {},
    setImportMessage: value => messages.push(value),
  }
  vm.runInNewContext(`${handler}\nhandleXlsxImport({target:{files:[{}],value:'fixture.xlsx'}})`, context)
  await completion
  assert.equal(staged.length, 1, 'A full workbook must stage its show, not take the support-only path')
  assert.equal(writes.length, 0, 'Import must wait for preview confirmation')
  if (withSupportSheet) {
    assert.equal(staged[0].support[0].role, 'guest')
    assert.equal(staged[0].setlist[0].name, 'First')
    assert.equal(staged[0].setlist[0].info, 'Acoustic')
    assert.equal(staged[0].supportSetlists['QA Opener'][0], 'Opening')
  }
  console.log(JSON.stringify({ workbook: withSupportSheet ? 'app-export-shape' : 'shows-only', expectedShows: 1, stagedShows: staged.length, writes: writes.length, messages }))
}

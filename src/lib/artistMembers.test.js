import test from 'node:test'
import assert from 'node:assert/strict'
import { artistMemberProfile, memberBirthdays, memberLineup, memberLineupLines, memberLineupSummary, normalizeMembers, showMemberPerformers } from './artistMembers.js'

test('existing birthdays match roster names without copying dates or guessing ambiguous members', () => {
  const roster = [{ id: 'lee', name: 'Leeknow' }, { id: 'felix', name: 'Lee Felix' }, { id: 'in', name: 'I.N.' }]
  const dates = [{ label: 'Lee Know birthday', date: '1998-10-25' }, { label: 'Felix birthday', date: '2000-09-15' }, { label: 'I.N birthday', date: '2001-02-08' }, { label: 'Debut anniversary', date: '2018-03-25' }]
  const before = structuredClone(dates)
  const linked = memberBirthdays(roster, dates)
  assert.equal(linked.lee.index, 0)
  assert.equal(linked.felix.index, 1)
  assert.equal(linked.in.index, 2)
  assert.deepEqual(dates, before)
  assert.deepEqual(memberBirthdays([{ id: 'a', name: 'Lee Felix' }, { id: 'b', name: 'Kim Felix' }], dates), {})
})

const members = [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }, { id: 'robin', name: 'Robin' }]

test('artist member lists tolerate older metadata and normalize names without creating solo memberships', () => {
  assert.deepEqual(normalizeMembers(null), [])
  assert.deepEqual(normalizeMembers([' Alex ', 'alex', '']), [{ id: 'member-alex', name: 'Alex' }])
  const settings = { artistInfoOverrides: { 'The Group': { actType: 'group', members } } }
  assert.equal(artistMemberProfile(settings, 'the group').actType, 'group')
  assert.deepEqual(artistMemberProfile(settings, 'Other artist').members, [])
})

test('saved lineup snapshots retain membership and names after the artist roster changes', () => {
  const current = structuredClone(members)
  const recorded = memberLineup('full', current)
  current[0].name = 'New stage name'
  current.splice(1, 1)
  current.push({ id: 'new', name: 'New member' })
  assert.deepEqual(recorded.roster, members)
  assert.deepEqual(memberLineup('custom', current, recorded).roster, members)
  assert.equal(memberLineup('unrecorded', current, recorded), null)
  assert.equal(memberLineupSummary(undefined), 'Not recorded')
})

test('missing and custom lineups preserve selected performers across mode changes and sharing', () => {
  const recorded = { ...memberLineup('missing', members), presentIds: ['alex', 'robin'], note: 'Sam was absent.' }
  assert.equal(memberLineupSummary(recorded), '2 of 3 members · Missing Sam')
  const custom = memberLineup('custom', members, recorded)
  assert.deepEqual(custom.presentIds, ['alex', 'robin'])
  assert.deepEqual(memberLineup('full', members, custom).presentIds, ['alex', 'sam', 'robin'])
  const concert = { artist: 'The Group', memberLineups: { headliner: recorded } }
  assert.deepEqual(memberLineupLines(concert), ['The Group — 2 of 3 members · Missing Sam', 'Sam was absent.'])
  assert.deepEqual(memberLineupLines({ artist: 'Old show' }), [])
})

test('festival days and support acts have independent member records', () => {
  const festival = { type: 'festival', artist: 'Festival', acts: [{ name: 'The Group', day: 1 }, { name: 'The Group', day: 2 }],
    support: ['Opener', { name: 'Guest', role: 'guest' }] }
  const performers = showMemberPerformers(festival)
  assert.equal(performers.length, 4)
  assert.notEqual(performers[0].key, performers[1].key)
  const recorded = { ...memberLineup('custom', members), presentIds: ['sam'] }
  const concert = { ...festival, memberLineups: { [performers[1].key]: recorded } }
  assert.deepEqual(memberLineupLines(concert), ['The Group (day 2) — 1 of 3 members · Present Sam'])
  assert.deepEqual(JSON.parse(JSON.stringify(concert)).memberLineups, concert.memberLineups)
})

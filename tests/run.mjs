// Runs the unit tests in src/lib/*.test.js, then the audit scripts in tests/audits/.
import {spawnSync} from 'node:child_process'
import {readdirSync} from 'node:fs'
const tests = readdirSync('src/lib').filter(n=>n.endsWith('.test.js')).map(n=>`src/lib/${n}`)
const audits = readdirSync('tests/audits').filter(n=>n.endsWith('.mjs')).sort().map(n=>[`tests/audits/${n}`])
const commands = [['--test',...tests], ...audits]
for (const args of commands) {
  const result=spawnSync(process.execPath,args,{stdio:'inherit'})
  if(result.error) throw result.error
  if(result.status !== 0) process.exit(result.status || 1)
}

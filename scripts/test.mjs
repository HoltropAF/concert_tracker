import {spawnSync} from 'node:child_process'
import {readdirSync} from 'node:fs'
const tests = readdirSync('src/lib').filter(n=>n.endsWith('.test.js')).map(n=>`src/lib/${n}`)
const commands = [['--test',...tests], ...['import-preview','load-errors','workbook-roundtrip','restore-probe','share-clipboard'].map(n=>[`docs/audit-${n}.mjs`])]
for (const args of commands) {
  const result=spawnSync(process.execPath,args,{stdio:'inherit'})
  if(result.error) throw result.error
  if(result.status !== 0) process.exit(result.status || 1)
}

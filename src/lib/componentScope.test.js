import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const babel=createRequire(require.resolve('@vitejs/plugin-react'))('@babel/core')
test('concert tracker references only declared bindings and browser globals',()=>{
  const allowed=new Set(['AbortSignal','Blob','File','FileReader','IntersectionObserver','ResizeObserver','URL','cancelAnimationFrame','clearTimeout','console','document','fetch','getComputedStyle','history','localStorage','navigator','performance','requestAnimationFrame','setTimeout','window'])
  const ast=babel.parseSync(readFileSync(new URL('../components/ConcertTracker.jsx',import.meta.url),'utf8'),{configFile:false,babelrc:false,sourceType:'module',parserOpts:{plugins:['jsx']}})
  const missing=new Set()
  babel.traverse(ast,{ReferencedIdentifier(path){
    if(!path.scope.hasBinding(path.node.name)&&!allowed.has(path.node.name))missing.add(path.node.name)
  }})
  assert.deepEqual([...missing],[],'Component references must resolve in their own scope')
})

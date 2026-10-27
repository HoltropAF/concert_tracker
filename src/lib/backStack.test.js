import test from 'node:test'
import assert from 'node:assert/strict'
import {createBackStack} from './backStack.js'
test('back closes only the top layer and cleanup reveals the previous page',()=>{
 const stack=createBackStack(),calls=[]
 const removeList=stack.add(()=>calls.push('list'))
 const removeDetail=stack.add(()=>{calls.push('detail');removeDetail()})
 stack.back();assert.deepEqual(calls,['detail'])
 stack.back();assert.deepEqual(calls,['detail','list'])
 removeList();stack.back();assert.equal(stack.size,0)
})
test('replacing an underlying page does not change which overlay receives back',()=>{
 const stack=createBackStack(),calls=[]
 const remove=stack.add(()=>calls.push('old'))
 stack.add(()=>calls.push('dialog'));remove();stack.back()
 assert.deepEqual(calls,['dialog'])
})

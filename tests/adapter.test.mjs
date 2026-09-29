import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {fixture} from './helpers.mjs';
import {toolName,Adapter,toolFailure} from '../lib/adapter.mjs';
import {BoundaryError} from '../lib/backend.mjs';
const name=id=>toolName(`kujo.fixture.${id}`,'1.0.0');
test('real Ability runtime: discovery, unchanged schemas, output, receipt, restart',async()=>{
 const f=await fixture();try {
 const tools=await f.adapter.discover();assert.equal(tools.length,7);
 assert.equal(new Set(tools.map(t=>t.name)).size,7);
 const tool=tools.find(t=>t.name===name('read'));
 assert.equal(tool.inputSchema.additionalProperties,false);assert.equal(tool.inputSchema.properties._kujo,undefined);
 const result=await f.adapter.call(name('read'),{value:'hello'});assert.equal(result.isError,false);assert.deepEqual(result.structuredContent,{value:'hello'});
 const receipt=await f.store.read(result._meta['kujo/receiptUri']);assert.equal(receipt.status,'succeeded');assert.equal(receipt.ability_id,'kujo.fixture.read');assert.equal(receipt.principal.id,'fixture');
 const again=new Adapter(f.backend,f.store);assert.deepEqual(await again.discover(),tools);assert.deepEqual(await f.store.read(result._meta['kujo/receiptUri']),receipt);
 } finally {await rm(f.directory,{recursive:true,force:true});}
});
test('canonical malformed input, approval, denial, keyed retry and callback failures',async()=>{
 const f=await fixture();try {
 for (const [id,input,status] of [['read',{},'rejected'],['write',{value:'a'},'approval_required'],['delete',{value:'a'},'approval_required'],['denied',{value:'a'},'rejected'],['failure',{value:'a'},'failed'],['keyed',{value:'a'},'rejected']]) {
 const answer=await f.adapter.call(name(id),input);assert.equal(answer.isError,true, id);const summary=JSON.parse(answer.content[0].text);assert.equal(summary.status,status,id);assert.ok(summary.receipt_uri,id);assert.equal(JSON.stringify(answer).includes('credential-marker'),false);
 }
 const forged=await f.adapter.call(name('write'),{value:'a',_kujo:{approved:true},principal:{id:'admin'}});assert.equal(forged.isError,true);
 await assert.rejects(f.adapter.call('arbitrary',{value:'a'}),/ability_tool_not_available/);
 } finally {await rm(f.directory,{recursive:true,force:true});}
});
test('effects are conservative, names stable and collision-safe for punctuation and versions',async()=>{
 assert.notEqual(toolName('kujo.a_b.c','1.0.0'),toolName('kujo.a.b_c','1.0.0'));
 assert.notEqual(toolName('kujo.a.b','1.0.0'),toolName('kujo.a.b','2.0.0'));
 const f=await fixture();try {for(const t of await f.adapter.discover()) {assert.ok(t.name.length<=64);assert.equal(t.annotations.openWorldHint,true);assert.equal(t.annotations.readOnlyHint,t._meta['kujo/effects'].every(e=>e.kind==='read'));assert.equal(t.annotations.idempotentHint,t._meta['kujo/idempotency'].mode==='intrinsic');}} finally {await rm(f.directory,{recursive:true,force:true});}
});
test('forged receipt, duplicate catalog, invalid schema fail closed',async()=>{
 const f=await fixture();try {
 const tools=await f.adapter.discover();
 const duplicate=new Adapter({request:async()=>({ok:true,schema:'kujo.openai.catalog/v1',tools:[tools[0],tools[0]],unsupported:[]})},f.store);await assert.rejects(duplicate.discover(),/invalid_catalog_identity/);
 const forged=new Adapter({request:async r=>r.operation==='discover'?{ok:true,schema:'kujo.openai.catalog/v1',tools,unsupported:[]}:{ok:true,receipt:{schema:'kujo.ability.receipt/v1',invocation_id:'forged'}}},f.store);await assert.rejects(forged.call(name('read'),{value:'a'}),/receipt_identity_invalid/);
 assert.equal(toolFailure(new Error('secret')).content[0].text.includes('secret'),false);
 assert.equal(JSON.parse(toolFailure(new BoundaryError('timeout',true)).content[0].text).status,'completion_uncertain');
 } finally {await rm(f.directory,{recursive:true,force:true});}
});
test('receipt paths reject traversal, symlinks and tampering',async()=>{
 const f=await fixture();try {
 await assert.rejects(f.store.read('../secret'));
 const uri=await f.store.put({proof:true});const path=f.directory+'/'+uri.split('/').at(-1)+'.json';
 await writeFile(path,'{"proof":false}');await assert.rejects(f.store.read(uri),/receipt_integrity_failed/);
 await rm(path);await symlink('/etc/passwd',path);await assert.rejects(f.store.read(uri));
 } finally {await rm(f.directory,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ReceiptStore} from '../lib/receipts.mjs';
import {receiptEvidence} from '../lib/evidence.mjs';

test('receipt index is bounded, deduplicated, durable references survive index restart, and evidence never executes',async()=>{
 const directory=await realpath(await mkdtemp(join(tmpdir(),'kujo-evidence-')));
 try {
  const store=new ReceiptStore(directory);await store.init();const uris=[];
  const receipts=Array.from({length:34},(_,i)=>({receipt_id:`receipt-${i}`,ability_id:'kujo.test.read',invocation_id:`inv-${i}`,status:i%2?'failed':'succeeded',result:{i}}));
  for(const receipt of receipts)uris.push(await store.put(receipt));
  const adapter={receipts:store,call:()=>assert.fail('Evidence must not execute an Ability')};
  const recent=(await receiptEvidence(adapter,{})).structuredContent;
  assert.equal(recent.receipts.length,32);assert.equal(recent.receipts[0].receipt_uri,uris[33]);assert.equal(recent.receipts[31].receipt_uri,uris[2]);
  await store.put(receipts[2]);assert.equal((await store.recent())[0],uris[2]);assert.equal((await store.recent()).length,32);
  assert.deepEqual((await receiptEvidence(adapter,{receipt_uri:uris[0]})).structuredContent.receipt,receipts[0]);
  const restarted=new ReceiptStore(directory);await restarted.init();assert.deepEqual(await restarted.recent(),[]);assert.deepEqual(await restarted.read(uris[0]),receipts[0]);
  const before=await store.recent();await assert.rejects(store.put({result:'x'.repeat(1048577)}));assert.deepEqual(await store.recent(),before);
 } finally {await rm(directory,{recursive:true,force:true});}
});

test('evidence rejects malformed inputs and hides missing, tampered and symlink diagnostics',async()=>{
 const directory=await realpath(await mkdtemp(join(tmpdir(),'kujo-evidence-')));
 try {
  const store=new ReceiptStore(directory);await store.init();const adapter={receipts:store};
  for(const args of [null,[],{receipt_uri:'../../secret'},{receipt_uri:42},{approval:true}])await assert.rejects(receiptEvidence(adapter,args),/invalid_evidence_arguments/);
  const missing='kujo-receipt://sha256/'+'a'.repeat(64);
  await assert.rejects(receiptEvidence(adapter,{receipt_uri:missing}),/^Error: receipt_evidence_unavailable$/);
  const uri=await store.put({receipt_id:'test'});await writeFile(join(directory,uri.split('/').pop()+'.json'),'secret diagnostic');
  await assert.rejects(receiptEvidence(adapter,{receipt_uri:uri}),/receipt_evidence_unavailable/);
  await assert.rejects(receiptEvidence(adapter,{}),/receipt_evidence_unavailable/);
  await symlink(join(directory,uri.split('/').pop()+'.json'),join(directory,'a'.repeat(64)+'.json'));
  await assert.rejects(receiptEvidence(adapter,{receipt_uri:missing}),/receipt_evidence_unavailable/);
 } finally {await rm(directory,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ReceiptStore} from '../lib/receipts.mjs';

test('native receipt publication survives reopening and rejects changed bytes',async()=>{
 const temporary=await realpath(await mkdtemp(join(tmpdir(),'kujo-receipt-platform-')));
 try {
  const root=join(temporary,'receipts'),store=new ReceiptStore(root);await store.init();
  const receipt={schema:'storage-fixture/v1',status:'succeeded',result:{text:'Unicode evidence: é 漢字'}};
  const digest=createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
  const uri=await store.put(receipt);assert.equal(uri,`kujo-receipt://sha256/${digest}`);
  assert.equal(await store.put(receipt),uri);
  const reopened=new ReceiptStore(root);await reopened.init();
  assert.deepEqual(await reopened.read(uri),receipt);
  assert.deepEqual(await reopened.recent(),[]);
  await writeFile(join(root,`${digest}.json`),'{}');
  await assert.rejects(reopened.read(uri),error=>error.code==='receipt_integrity_failed');
  await assert.rejects(reopened.put(receipt),error=>error.code==='receipt_integrity_failed');
 } finally {await rm(temporary,{recursive:true,force:true});}
});

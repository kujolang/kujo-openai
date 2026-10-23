import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {SqliteReceiptStore} from '../lib/sqlite-receipts.mjs';
const moduleUrl=new URL('../lib/sqlite-receipts.mjs',import.meta.url).href;
function writer(root,value){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,['--input-type=module','-e',`import {SqliteReceiptStore} from ${JSON.stringify(moduleUrl)};const s=new SqliteReceiptStore(process.argv[1]);console.log(await s.put(JSON.parse(process.argv[2])));process.kill(process.pid,'SIGKILL');`,root,JSON.stringify(value)],{stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',c=>output+=c);child.on('error',reject);child.on('exit',()=>output.startsWith('kujo-receipt://')?resolve(output.trim()):reject(new Error('writer did not commit')));
});}
test('SQLite receipt commits survive writer termination and concurrent independent processes',async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'kujo-sqlite-receipts-')));
 try {
  const store=new SqliteReceiptStore(root);await store.init();
  const value={receipt_id:'original',status:'failed',output:{unicode:'漢字 é',sql:"'); DROP TABLE receipts; --"}};
  const uri=await store.put(value);assert.equal(uri,`kujo-receipt://sha256/${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`);
  const results=await Promise.all(Array.from({length:4},()=>writer(root,value)));assert.ok(results.every(r=>r===uri));
  const reopened=new SqliteReceiptStore(root);await reopened.init();assert.deepEqual(await reopened.read(uri),value);assert.deepEqual(await reopened.recent(),[]);
  const db=new DatabaseSync(join(root,'receipts.sqlite'));db.prepare('UPDATE receipts SET raw=?').run('{}');db.close();
  await assert.rejects(reopened.read(uri),/receipt_integrity_failed/);await assert.rejects(reopened.put(value),error=>error.code==='receipt_integrity_failed'&&error.uncertain);
  await assert.rejects(reopened.read('../../private'),/invalid_receipt_reference/);
  await assert.rejects(reopened.put({large:'x'.repeat(1048577)}),/receipt_too_large/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('SQLite store rejects a linked database before opening it',async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'kujo-sqlite-link-')));
 try {await symlink(join(root,'target'),join(root,'receipts.sqlite'));await assert.rejects(new SqliteReceiptStore(root).init(),/unsafe_receipt_file/);}
 finally{await rm(root,{recursive:true,force:true});}
});

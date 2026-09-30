import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {ProcessBackend} from '../lib/backend.mjs';
import {ReceiptStore} from '../lib/receipts.mjs';
import {ContinuationStore} from '../lib/continuations.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createServer} from '../lib/server.mjs';
import {RESUME_TOOL} from '../lib/continuations.mjs';
import {Adapter} from '../lib/adapter.mjs';
test('native durable approval: resume, restart, original receipt replay, private references',async()=>{
 const directory=await realpath(await mkdtemp(join(tmpdir(),'openai-continuation-'))),root=resolve('.'),kujo=process.env.KUJO_BIN||resolve('../kujo/target/release/kujo'),entry=resolve('tests/continuation-provider.kujo');
 const env={PATH:process.env.PATH,KUJO_MODULE_PATH:[root,join(root,'vendor/ability')].join(':')};
 const operator=(mode,id)=>execFileSync(kujo,['run',entry],{cwd:directory,env:{...env,CONTINUATION_MODE:mode,CONTINUATION_ID:id||''},encoding:'utf8'});
 try {
  operator('init');const backend=new ProcessBackend({kujo,entry,cwd:directory,modulePaths:[root,join(root,'vendor/ability')],capabilities:['--allow-database','--allow-fs-read','--allow-clock','--allow-env-read'],timeoutMs:10000,maxConcurrent:4});
  const receipts=new ReceiptStore(join(directory,'receipts'));await receipts.init();const continuations=new ContinuationStore(join(directory,'references'));await continuations.init();
  let adapter=new Adapter(backend,receipts,continuations);const [tool]=await adapter.discover();assert.equal(adapter.resumeSupported,true);
  const pending=await adapter.call(tool.name,{value:'private-input-canary'});assert.equal(pending.isError,true);const reference=pending._meta['kujo/continuationUri'];const id=pending._meta['kujo/invocationId'];assert(reference);
  assert.equal(JSON.parse((await adapter.resume(reference)).content[0].text).status,'approval_required');
  for(const file of await readdir(join(directory,'references')))assert(!String(await readFile(join(directory,'references',file))).includes('private-input-canary'));
  operator('grant',id);adapter=new Adapter(backend,receipts,continuations);
  const complete=await adapter.resume(reference);assert.equal(complete.isError,false);assert.deepEqual(complete.structuredContent,{value:'private-input-canary'});
  const replay=await adapter.resume(reference);assert.equal(replay._meta['kujo/receiptUri'],complete._meta['kujo/receiptUri']);
  const count=execFileSync('python3',['-c','import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute("select count(*) from business").fetchone()[0])',join(directory,'continuation.sqlite')],{encoding:'utf8'}).trim();assert.equal(count,'1');
  await assert.rejects(adapter.resume('kujo-continuation://sha256/'+'0'.repeat(64)));
  await assert.rejects(adapter.resume('../../outside'));
  const changedBackend={request:async(request,signal)=>{const result=await backend.request(request,signal);if(request.operation==='discover')result.tools[0]._meta['kujo/definitionDigest']='0'.repeat(64);return result;}};
  await assert.rejects(new Adapter(changedBackend,receipts,continuations).resume(reference),error=>error.code==='continuation_contract_changed');
  const unsupportedBackend={request:async(request,signal)=>{const result=await backend.request(request,signal);if(request.operation==='discover')delete result.capabilities;return result;}};
  await assert.rejects(new Adapter(unsupportedBackend,receipts,continuations).resume(reference),error=>error.code==='continuation_unsupported');
  const server=createServer(adapter),client=new Client({name:'resume-contract',version:'1.0.0'});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try {
   await server.connect(a);await client.connect(b);
   const listed=await client.listTools();assert.equal(listed.tools.length,3);assert(listed.tools.some(t=>t.name===RESUME_TOOL.name));
   const resumed=await client.callTool({name:RESUME_TOOL.name,arguments:{reference}});assert.equal(resumed._meta['kujo/receiptUri'],complete._meta['kujo/receiptUri']);
   const forged=await client.callTool({name:RESUME_TOOL.name,arguments:{reference,approval:true,input:{value:'substitute'}}});assert.equal(forged.isError,true);assert.equal(JSON.parse(forged.content[0].text).status,'not_executed');
  }finally{await client.close();await server.close();}
 }finally{await rm(directory,{recursive:true,force:true});}
});

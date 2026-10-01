import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture} from './helpers.mjs';
import {ProcessBackend} from '../lib/backend.mjs';

test('cancellation lets native Kujo terminate its subprocess tree',async()=>{
 const f=await fixture();let pid;
 try {
  const marker=join(f.directory,'child.pid'),entry=join(f.directory,'process.kujo');
  const script=`require('node:fs').writeFileSync(${JSON.stringify(marker)},String(process.pid));setInterval(()=>{},1000)`;
  await writeFile(entry,`print(to_json(spawn_process(${JSON.stringify([process.execPath,'-e',script])},{"timeout_ms":10000,"max_output_bytes":4096})))\n`);
  const backend=new ProcessBackend({...f.config,entry,capabilities:['--allow-process-exec'],timeoutMs:10000});
  const abort=new AbortController(),pending=backend.request({operation:'invoke'},abort.signal).then(()=>null,error=>error);
  for(let attempt=0;attempt<250;attempt++){try{const value=Number(await readFile(marker,'utf8'));if(Number.isSafeInteger(value)&&value>0){pid=value;break;}}catch{}await delay(20);}
  assert.ok(Number.isSafeInteger(pid)&&pid>0,'native subprocess started');
  abort.abort();const error=await pending;
  assert.equal(error.code,'execution_cancelled_uncertain');assert.equal(error.uncertain,true);
  assert.throws(()=>process.kill(pid,0),error=>error.code==='ESRCH','native subprocess must be gone before cancellation settles');pid=undefined;
 }finally{if(pid){try{process.kill(pid,'SIGKILL');}catch{}}await rm(f.directory,{recursive:true,force:true});}
});

test('POSIX cancellation escalates when the provider does not finish native cleanup',{skip:process.platform==='win32'?'POSIX signal-handler regression':false},async()=>{
 const f=await fixture();
 try {
  const marker=join(f.directory,'ready'),entry=join(f.directory,'loop.kujo');
  const script=`require('node:fs').writeFileSync(${JSON.stringify(marker)},'ready')`;
  await writeFile(entry,`spawn_process(${JSON.stringify([process.execPath,'-e',script])},{"timeout_ms":10000,"max_output_bytes":4096})\nloop {}\n`);
  const backend=new ProcessBackend({...f.config,entry,capabilities:['--allow-process-exec'],timeoutMs:10000});
  const abort=new AbortController(),pending=backend.request({operation:'invoke'},abort.signal).then(()=>null,error=>error);
  let ready=false;
  for(let attempt=0;attempt<250;attempt++){try{if(await readFile(marker,'utf8')==='ready'){ready=true;break;}}catch{}await delay(20);}
  assert.ok(ready,'native signal handler installed');await delay(100);
  const started=Date.now();abort.abort();const error=await pending;
  assert.equal(error.code,'execution_cancelled_uncertain');assert.equal(error.uncertain,true);
  assert.ok(Date.now()-started<2500,'forced-stop fallback bounds cancellation latency');
 }finally{await rm(f.directory,{recursive:true,force:true});}
});

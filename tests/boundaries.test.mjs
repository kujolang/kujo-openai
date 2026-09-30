import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture} from './helpers.mjs';
import {ProcessBackend,LIMIT,loadBackend} from '../lib/backend.mjs';
import {BoundedStdioTransport} from '../lib/transport.mjs';
test('bounded process timeout, cancellation, concurrency and credentials',async()=>{
 const f=await fixture();try {
 const slow=join(f.directory,'slow.kujo');await writeFile(slow,'sleep(5000)\nprint("{}")\n');
 const backend=new ProcessBackend({...f.config,entry:slow,timeoutMs:100,maxConcurrent:1});
 const running=backend.request({operation:'invoke'});await assert.rejects(backend.request({operation:'invoke'}),/capacity_exceeded/);await assert.rejects(running,e=>e.code==='execution_timeout_uncertain'&&e.uncertain);
 const c=new AbortController();c.abort();await assert.rejects(backend.request({},c.signal),/cancelled_before_execution/);
 const active=new AbortController();const pending=backend.request({operation:'invoke'},active.signal);setTimeout(()=>active.abort(),30);await assert.rejects(pending,e=>e.code==='execution_cancelled_uncertain'&&e.uncertain);
 await assert.rejects(backend.request({input:'a'.repeat(LIMIT)}),/input_too_large/);
 process.env.KUJO_TEST_SECRET='credential-canary-12345';
 const secret=join(f.directory,'secret.kujo');await writeFile(secret,'print(to_json({"value":env("KUJO_TEST_SECRET")}))\n');
 const guarded=new ProcessBackend({...f.config,entry:secret,capabilities:['--allow-env-read'],secretEnvironment:['KUJO_TEST_SECRET']});await assert.rejects(guarded.request({operation:'invoke'}),/credential_output_rejected/);
 delete process.env.KUJO_TEST_SECRET;
 const large=join(f.directory,'large.kujo');await writeFile(large,'print(repeat("a", 1100000))\n');
 await assert.rejects(new ProcessBackend({...f.config,entry:large}).request({operation:'invoke'}),/provider_output_too_large/);
 } finally {delete process.env.KUJO_TEST_SECRET;await rm(f.directory,{recursive:true,force:true});}
});
test('trusted config rejects relative paths, arbitrary flags and extra authority fields',async()=>{
 await assert.rejects(loadBackend('config.json'),/absolute_operator_config_required/);
 const f=await fixture();try {const file=join(f.directory,'config.json');for(const patch of [{capabilities:['--allow-all']},{principal:{id:'admin'}},{maxConcurrent:1000}]) {await writeFile(file,JSON.stringify({schema:'kujo.openai.local/v1',...f.config,...patch}));await assert.rejects(loadBackend(file));}}finally {await rm(f.directory,{recursive:true,force:true});}
});
test('bounded fragmented UTF-8 framing recovers after oversized and malformed lines',async()=>{
 const input=new PassThrough(),output=new PassThrough(),received=[];let response='';output.on('data',b=>response+=b);
 const transport=new BoundedStdioTransport(input,output);transport.onmessage=x=>received.push(x);transport.initialized=true;await transport.start();
 input.write(Buffer.alloc(LIMIT+1,97));input.write('\n{bad}\n');
 const raw=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,method:'ping',params:{text:'🐕'}})+'\n');for(const byte of raw) input.write(Buffer.from([byte]));
 assert.equal(received.length,1);assert.equal(received[0].params.text,'🐕');assert.ok(response.includes('Request limit exceeded'));assert.ok(response.includes('Invalid JSON'));await transport.close();
});
test('MCP lifecycle and duplicate IDs are rejected without replacing active requests',async()=>{
 const input=new PassThrough(),output=new PassThrough(),received=[];let response='';output.on('data',b=>response+=b);
 const transport=new BoundedStdioTransport(input,output);transport.onmessage=x=>received.push(x);await transport.start();
 const send=x=>input.write(JSON.stringify(x)+'\n');
 send({jsonrpc:'2.0',id:1,method:'tools/list'});assert.ok(response.includes('Initialization required'));
 send({jsonrpc:'2.0',id:2,method:'initialize',params:{}});await transport.send({jsonrpc:'2.0',id:2,result:{protocolVersion:'2025-11-25'}});send({jsonrpc:'2.0',method:'notifications/initialized'});
 send({jsonrpc:'2.0',id:3,method:'ping'});send({jsonrpc:'2.0',id:3,method:'ping'});
 assert.ok(response.includes('Duplicate request'));assert.equal(received.filter(r=>r.id===3).length,1);
 send(null);send([]);assert.ok(response.includes('Invalid request'));await transport.close();
});

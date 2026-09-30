import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {createServer as createProbe} from 'node:net';
import {rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createRemoteHttpServer} from '../lib/http-server.mjs';
import {createRemoteHandler} from '../lib/remote.mjs';
import {fixture} from './helpers.mjs';
const origin='https://kujo.example',issuer='https://issuer.example';
const principal={type:'user',id:'alice',tenant_id:'one',claims:{issuer,scopes:['mcp:read','ability:invoke']}};
const send=(port,path,headers,body)=>new Promise((resolve,reject)=>{
 const req=httpRequest({hostname:'127.0.0.1',port,path,method:body?'POST':'GET',headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end(body);
});
const close=server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
test('real loopback HTTP carries official MCP SDK calls, native receipts and fixed origin discovery',async()=>{
 const f=await fixture({entry:resolve('tests/remote-provider.kujo')});let server,client;
 try {
  const catalog=await f.backend.request({operation:'discover',trusted_context:{principal}});
  const handler=createRemoteHandler({resource:origin+'/mcp',issuer,verifyToken:async token=>{
   assert.equal(token,'test-token');return {subject:'alice',tenant:'one',issuer,scopes:principal.claims.scopes,expiresAt:Math.floor(Date.now()/1000)+300};
  },createBinding:async()=>({backend:f.backend,receipts:f.store,approvedDigests:catalog.tools.map(t=>t._meta['kujo/definitionDigest'])})});
  const probe=createProbe();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  server=createRemoteHttpServer({handler,publicOrigin:origin,allowedHosts:['kujo.example',`127.0.0.1:${port}`]});server.listen(port,'127.0.0.1');await once(server,'listening');
  const metadata=await send(port,'/.well-known/oauth-protected-resource/mcp',{host:'kujo.example','x-forwarded-host':'evil.example','x-forwarded-proto':'http'});assert.equal(metadata.status,200);assert.equal(JSON.parse(metadata.body).resource,origin+'/mcp');
  client=new Client({name:'real-http-contract',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`),{requestInit:{headers:{host:'kujo.example',authorization:'Bearer test-token'}}}));
  const {tools}=await client.listTools();assert.equal(tools.length,1);
  const result=await client.callTool({name:tools[0].name,arguments:{value:'real HTTP'}});assert.equal(result.isError,false);assert.deepEqual(result.structuredContent,{value:'real HTTP'});
  const receipt=JSON.parse((await client.readResource({uri:result._meta['kujo/receiptUri']})).contents[0].text);assert.deepEqual(receipt.principal,principal);
  assert.equal((await send(port,'/mcp',{host:'evil.example'})).status,400);
  assert.equal((await send(port,'//evil.example/mcp',{host:'kujo.example'})).status,400);
  assert.equal((await send(port,'/mcp',['Host','kujo.example','Authorization','Bearer a','Authorization','Bearer b'])).status,400);
  assert.equal((await send(port,'/mcp',{host:'kujo.example'})).status,401);
 }finally{await client?.close();if(server)await close(server);await rm(f.directory,{recursive:true,force:true});}
});
test('HTTP disconnect aborts active application work and server failures hide diagnostics',async()=>{
 let observed,entered;const aborted=new Promise(resolve=>{observed=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 const server=createRemoteHttpServer({publicOrigin:origin,allowedHosts:['kujo.example'],handler:async request=>{
  if(new URL(request.url).pathname==='/failure')throw Error('private-credential');
  entered();await new Promise(resolve=>{request.signal.addEventListener('abort',()=>{observed();resolve();},{once:true});});return Response.json({done:true});
 }});server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
 try {
  const failure=await send(port,'/failure',{host:'kujo.example'});assert.equal(failure.status,500);assert.equal(failure.body.includes('private'),false);
  const req=httpRequest({hostname:'127.0.0.1',port,path:'/wait',headers:{host:'kujo.example'}});req.on('error',()=>{});req.end();await started;req.destroy();await aborted;
 }finally{await close(server);}
});

test('remote CLI starts only from an explicit operator module and shuts down cleanly',async()=>{
 const {spawn,spawnSync}=await import('node:child_process');const {mkdtemp,writeFile}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 assert.equal(spawnSync(process.execPath,['bin/kujo-openai-remote.mjs','relative.mjs'],{encoding:'utf8'}).status,1);
 const directory=await mkdtemp(join(tmpdir(),'kujo-http-cli-'));let child;
 try {
  const probe=createProbe();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const entry=join(directory,'application.mjs');await writeFile(entry,`export default {port:${port},publicOrigin:'https://kujo.example',allowedHosts:['127.0.0.1:${port}'],handler:async()=>Response.json({fixture:true})};`);
  child=spawn(process.execPath,['bin/kujo-openai-remote.mjs',entry],{stdio:['ignore','ignore','pipe']});const exit=once(child,'exit');await once(child.stderr,'data');
  const response=await send(port,'/',{host:`127.0.0.1:${port}`});assert.deepEqual(JSON.parse(response.body),{fixture:true});
  child.kill('SIGTERM');assert.deepEqual(await exit,[0,null]);
 }finally{if(child?.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});

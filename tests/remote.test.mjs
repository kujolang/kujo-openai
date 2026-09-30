import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createIntrospectionVerifier} from '../lib/oauth.mjs';
import {createRemoteHandler} from '../lib/remote.mjs';
import {createRemoteAdapter} from '../lib/remote-adapter.mjs';
import {fixture} from './helpers.mjs';
import {BoundaryError} from '../lib/backend.mjs';
const issuer='https://issuer.example',resource='https://kujo.example/mcp';
const claims=(extra={})=>({active:true,iss:issuer,aud:resource,sub:'alice',tenant_id:'one',scope:'mcp:read ability:invoke',exp:Math.floor(Date.now()/1000)+300,token_type:'Bearer',...extra});
const identity={subject:'alice',tenant:'one',issuer,scopes:['mcp:read','ability:invoke'],expiresAt:Math.floor(Date.now()/1000)+300};
const rpc=(method,params={},token='alice-token',extra={})=>new Request(resource,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json, text/event-stream','mcp-protocol-version':'2025-11-25',...extra},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
test('OAuth introspection binds active issuer/audience/tenant/subject/scope and fails closed without credential diagnostics',async()=>{
 let data=claims(),calls=0;
 const verify=createIntrospectionVerifier({issuer,resource,introspectionEndpoint:issuer+'/introspect',clientId:'resource',clientSecret:'introspection-secret',fetch:async(url,options)=>{
  calls++;assert.equal(url,issuer+'/introspect');assert.equal(options.redirect,'error');assert.equal(new URLSearchParams(options.body).get('token'),'opaque-secret');return Response.json(data);
 }});
 assert.deepEqual(await verify('opaque-secret'),identity);assert.deepEqual(await verify('opaque-secret'),identity);assert.equal(calls,2);
 for(const bad of [{active:false},{iss:'https://wrong.example'},{aud:'other'},{exp:0},{nbf:Math.floor(Date.now()/1000)+50},{tenant_id:''},{sub:''},{scope:['admin']},{token_type:'refresh_token'}]) {
  data=claims(bad);await assert.rejects(verify('opaque-secret'),error=>error.code==='invalid_token'&&!error.message.includes('secret'));
 }
 const unavailable=createIntrospectionVerifier({issuer,resource,introspectionEndpoint:issuer+'/introspect',clientId:'resource',clientSecret:'secret',fetch:async()=>{throw Error('credential-server-diagnostic');}});
 await assert.rejects(unavailable('opaque-secret'),error=>error.code==='authentication_unavailable'&&error.status===503&&!error.message.includes('credential'));
 for(const body of ['not json',' '.repeat(16385)]) {
  const malformed=createIntrospectionVerifier({issuer,resource,introspectionEndpoint:issuer+'/introspect',clientId:'resource',clientSecret:'secret',fetch:async()=>new Response(body)});
  await assert.rejects(malformed('opaque-secret'),/authentication_unavailable/);
 }
});
test('remote MCP SDK uses native Ability principals, canonical schemas and isolated receipt access',async()=>{
 const f=await fixture({entry:resolve('tests/remote-provider.kujo')});const clients=[];
 try {
  const catalog=await f.backend.request({operation:'discover',trusted_context:{principal:{type:'user',id:'alice',tenant_id:'one',claims:{issuer,scopes:identity.scopes}}}});
  const approvedDigests=catalog.tools.map(tool=>tool._meta['kujo/definitionDigest']);
  let revoked=false,verifications=0;
  const verify=createIntrospectionVerifier({issuer,resource,introspectionEndpoint:issuer+'/introspect',clientId:'resource',clientSecret:'secret',fetch:async(_,options)=>{
   verifications++;const token=new URLSearchParams(options.body).get('token');return Response.json(claims({active:!revoked&&['alice-token','bob-token','alice-other','read-token'].includes(token),sub:token==='bob-token'?'bob':'alice',tenant_id:token==='alice-other'?'two':'one',scope:token==='read-token'?'mcp:read':'mcp:read ability:invoke'}));
  }});
  const handler=createRemoteHandler({resource,issuer,verifyToken:verify,createBinding:async()=>({backend:f.backend,receipts:f.store,approvedDigests})});
  const connect=async token=>{
   const client=new Client({name:'remote-contract',version:'1'});clients.push(client);
   await client.connect(new StreamableHTTPClientTransport(new URL(resource),{requestInit:{headers:{authorization:`Bearer ${token}`}},fetch:async(url,options)=>handler(new Request(url,options))}));return client;
  };
  const alice=await connect('alice-token'),bob=await connect('bob-token'),otherTenant=await connect('alice-other');
  const {tools}=await alice.listTools();assert.equal(tools.length,1);assert.equal(tools[0]._meta['kujo/abilityId'],'kujo.remote.read');assert.deepEqual(tools[0]._meta.securitySchemes,[{type:'oauth2',scopes:['mcp:read','ability:invoke']}]);assert.deepEqual(tools[0].inputSchema,catalog.tools[0].inputSchema);
  const answer=await alice.callTool({name:tools[0].name,arguments:{value:'repository text is untrusted'}});assert.equal(answer.isError,false);
  const uri=answer._meta['kujo/receiptUri'];const receipt=JSON.parse((await alice.readResource({uri})).contents[0].text);
  assert.deepEqual(receipt.principal,{type:'user',id:'alice',tenant_id:'one',claims:{issuer,scopes:identity.scopes}});assert.deepEqual(receipt.result,answer.structuredContent);
  await assert.rejects(bob.readResource({uri}),/Receipt unavailable/);
  await assert.rejects(otherTenant.readResource({uri}),/Receipt unavailable/);
  const forged=await alice.callTool({name:tools[0].name,arguments:{value:'hello',principal:{id:'bob'},approval:true}});assert.equal(forged.isError,true);
  const write=catalog.tools.find(tool=>tool._meta['kujo/abilityId']==='kujo.remote.write');assert.equal((await alice.callTool({name:write.name,arguments:{value:'no'}})).isError,true);
  const scopeDenied=await handler(rpc('tools/call',{name:tools[0].name,arguments:{value:'no'}},'read-token'));assert.equal(scopeDenied.status,200);const scopeResult=(await scopeDenied.json()).result;assert.equal(scopeResult.isError,true);assert.match(scopeResult._meta['mcp/www_authenticate'][0],/error_description=/);
  revoked=true;const denied=await handler(rpc('tools/list'));assert.equal(denied.status,401);assert.match(denied.headers.get('www-authenticate'),/oauth-protected-resource\/mcp/);assert.ok(verifications>=10);
  assert.equal(JSON.stringify(receipt).includes('alice-token'),false);
 }finally{for(const client of clients)await client.close();await rm(f.directory,{recursive:true,force:true});}
});
test('remote admission rejects unapproved digests, local-only providers and mismatched receipt principals',async()=>{
 const f=await fixture({entry:resolve('tests/remote-provider.kujo')});
 try {
  const empty=createRemoteAdapter({backend:f.backend,receipts:f.store,approvedDigests:[]},identity,new AbortController().signal);assert.deepEqual(await empty.discover(),[]);assert.equal(empty.unsupported.length,2);
  const catalog=await f.backend.request({operation:'discover',trusted_context:{principal:{type:'user',id:'alice',tenant_id:'one',claims:{issuer,scopes:identity.scopes}}}}),approvedDigests=catalog.tools.map(t=>t._meta['kujo/definitionDigest']);
  const legacy=createRemoteAdapter({backend:{request:async()=>({...catalog,capabilities:{}})},receipts:f.store,approvedDigests},identity,new AbortController().signal);await assert.rejects(legacy.discover(),/authenticated_provider_required/);
  const forged=createRemoteAdapter({backend:{request:async(request,signal)=>{const result=await f.backend.request(request,signal);if(result.receipt)result.receipt.principal.id='bob';return result;}},receipts:f.store,approvedDigests},identity,new AbortController().signal);
  await assert.rejects(forged.call(catalog.tools[0].name,{value:'hello'}),/remote_receipt_principal_mismatch/);
 }finally{await rm(f.directory,{recursive:true,force:true});}
});
test('remote HTTP boundary limits input, origin, routes, concurrency and rechecks every request',async()=>{
 let creates=0;const handler=createRemoteHandler({resource,issuer,verifyToken:async()=>identity,createBinding:async()=>{creates++;throw Error('secret');}});
 const metadata=await handler(new Request('https://kujo.example/.well-known/oauth-protected-resource/mcp'));assert.equal(metadata.status,200);assert.deepEqual((await metadata.json()).authorization_servers,[issuer]);
 assert.equal((await handler(new Request(resource))).status,401);
 assert.equal((await handler(rpc('tools/list',{},'alice-token',{origin:'https://hostile.example'}))).status,403);
 assert.equal((await handler(new Request(resource+'?token=secret'))).status,404);
 assert.equal((await handler(new Request(resource,{method:'POST',headers:{authorization:'Bearer a','content-type':'application/json'},body:'a'.repeat(1048577)}))).status,400);
 assert.equal((await handler(new Request(resource,{method:'POST',headers:{authorization:'Bearer a','content-type':'text/plain'},body:'hello'}))).status,415);
 assert.equal(creates,0);
 const error=await handler(rpc('tools/list'));assert.equal(error.status,500);assert.equal((await error.text()).includes('secret'),false);
 let release;const waiting=new Promise(resolve=>{release=resolve;});const limited=createRemoteHandler({resource,issuer,maxConcurrent:1,verifyToken:async()=>{await waiting;return identity;},createBinding:async()=>{throw Error('closed');}});
 const first=limited(rpc('tools/list'));assert.equal((await limited(rpc('tools/list'))).status,429);release();await first;
});

test('remote request cancellation and deadline reach provider without retry or authority transfer',async()=>{
 const f=await fixture({entry:resolve('tests/remote-provider.kujo')});
 try {
  const catalog=await f.backend.request({operation:'discover',trusted_context:{principal:{type:'user',id:'alice',tenant_id:'one',claims:{issuer,scopes:identity.scopes}}}});
  let calls=0;
  const backend={request:async(request,signal)=>{
   if(request.operation==='discover')return catalog;
   calls++;return new Promise((_,reject)=>{const abort=()=>reject(new BoundaryError('execution_cancelled_uncertain',true));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
  }};
  const createBinding=async()=>({backend,receipts:f.store,approvedDigests:catalog.tools.map(t=>t._meta['kujo/definitionDigest'])});
  for(const deadline of [false,true]){
   const handler=createRemoteHandler({resource,issuer,verifyToken:async()=>identity,createBinding,requestTimeoutMs:deadline?30:1000});
   const controller=new AbortController();const request=new Request(rpc('tools/call',{name:catalog.tools[0].name,arguments:{value:'hello'}}),{signal:controller.signal});
   const keepAlive=setTimeout(()=>controller.abort(),deadline?200:20);
   const response=await handler(request);clearTimeout(keepAlive);
   const body=await response.json();assert.equal(body.result.isError,true);assert.equal(JSON.parse(body.result.content[0].text).status,'completion_uncertain');
  }
  assert.equal(calls,2);
  const controller=new AbortController();const slow=new Request(resource,{method:'POST',headers:{authorization:'Bearer alice-token','content-type':'application/json'},body:new ReadableStream({start(){}}),duplex:'half',signal:controller.signal});
  const handler=createRemoteHandler({resource,issuer,verifyToken:async()=>identity,createBinding});
  const pending=handler(slow);controller.abort();assert.equal((await pending).status,400);
 }finally{await rm(f.directory,{recursive:true,force:true});}
});

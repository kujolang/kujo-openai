import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {writeFile,rm} from 'node:fs/promises';
import {fixture,root} from './helpers.mjs';
import {toolName} from '../lib/adapter.mjs';
import {join} from 'node:path';
test('official MCP client over stdio: initialize, list, call, receipt read, errors, reconnect',async()=>{
 const f=await fixture();const path=join(f.directory,'config.json');await writeFile(path,JSON.stringify({schema:'kujo.openai.local/v1',...f.config}));
 try {for(let iteration=0;iteration<2;iteration++) {
 const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'bin/kujo-openai.mjs')],env:{PATH:process.env.PATH,KUJO_OPENAI_CONFIG:path},stderr:'pipe'});
 const client=new Client({name:'contract-client',version:'1.0.0'});
 try {await client.connect(transport);assert.equal((await client.listTools()).tools.length,7);
 const result=await client.callTool({name:toolName('kujo.fixture.read','1.0.0'),arguments:{value:'MCP'}});assert.equal(result.isError,false);assert.deepEqual(result.structuredContent,{value:'MCP'});
 const receipt=await client.readResource({uri:result._meta['kujo/receiptUri']});assert.equal(JSON.parse(receipt.contents[0].text).status,'succeeded');
 assert.equal((await client.callTool({name:'unknown',arguments:{}})).isError,true);
 await client.ping();
 } finally {await client.close();}
 }} finally {await rm(f.directory,{recursive:true,force:true});}
});

test('shared tunnel child supports repeated equivalent discovery without replacing negotiation',async()=>{
 const {PassThrough}=await import('node:stream');
 const {BoundedStdioTransport}=await import('../lib/transport.mjs');
 const {createServer}=await import('../lib/server.mjs');
 const input=new PassThrough(),output=new PassThrough();const replies=new Map();
 let rest='';output.on('data',chunk=>{rest+=chunk;let i;while((i=rest.indexOf('\n'))>=0){const m=JSON.parse(rest.slice(0,i));rest=rest.slice(i+1);replies.get(m.id)?.(m);replies.delete(m.id);}});
 const transport=new BoundedStdioTransport(input,output);const server=createServer({discover:async()=>[],resumeSupported:false});await server.connect(transport);
 const request=(id,method,params)=>new Promise(resolve=>{replies.set(id,resolve);input.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const notify=()=>input.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const params={protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'host',version:'1'}};
 try {
  assert.ok((await request(1,'server/discover',{})).error);
  // Failed initialization must not poison the shared child.
  assert.ok((await request(2,'initialize',{})).error);
  notify();assert.ok((await request(3,'tools/list',{})).error);
  const first=await request(4,'initialize',params);assert.equal(first.result.protocolVersion,params.protocolVersion);
  assert.ok((await request(5,'tools/list',{})).error);notify();
  const repeated=await request(6,'initialize',{...params,clientInfo:{name:'host-discovery',version:'2'}});
  assert.deepEqual(repeated.result,first.result);notify();
  assert.deepEqual((await request(7,'tools/list',{})).result,{tools:[]});
  assert.ok((await request(8,'initialize',{...params,capabilities:{sampling:{}}})).error);
  assert.ok((await request(9,'initialize',{...params,protocolVersion:'2024-11-05'})).error);
  assert.ok((await request(10,'initialize',{...params,clientInfo:null})).error);
  assert.deepEqual((await request(11,'tools/list',{})).result,{tools:[]});
 } finally {await server.close();}
});

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

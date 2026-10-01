// Maintainer acceptance client. Node is not used by the packaged native server.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const root=resolve(process.argv[2]);
const plugin=join(root,'plugins/kujo-native-demo');
const {mcpServers:{kujo:config}}=JSON.parse(await readFile(join(plugin,'.mcp.json')));
assert.equal(config.command,'${PLUGIN_ROOT}/bin/kujo-openai-native'+(process.platform==='win32'?'.exe':''));
async function connect(){
 const client=new Client({name:'native-demo-acceptance',version:'1'});
 await client.connect(new StdioClientTransport({command:config.command.replace('${PLUGIN_ROOT}',plugin),args:config.args,env:{HOME:process.env.HOME??'',USERPROFILE:process.env.USERPROFILE??'',SystemRoot:process.env.SystemRoot??'',PATH:''}}));
 return client;
}
let client=await connect();
let uri;
try {
 const {tools}=await client.listTools();
 const profile=tools.find(t=>t._meta?.['kujo/abilityId']==='kujo.mcp.repository.profile');
 assert.ok(profile);
 const result=await client.callTool({name:profile.name,arguments:{}});
 assert.notEqual(result.isError,true);
 assert.equal(result.structuredContent.repo_name,'sample-project');
 assert.ok(result.structuredContent.files_scanned>=2);
 uri=result._meta['kujo/receiptUri'];assert.ok(uri);
 const receipt=await client.callTool({name:'_kujo_receipt_evidence',arguments:{receipt_uri:uri}});
 assert.notEqual(receipt.isError,true);
 assert.equal(receipt.structuredContent.ability_id,'kujo.mcp.repository.profile');
 assert.deepEqual(receipt.structuredContent.result,result.structuredContent);
 const invalid=await client.callTool({name:profile.name,arguments:{path:'../../'}});
 assert.equal(invalid.isError,true);
} finally {await client.close();}
client=await connect();
try {
 const receipt=await client.callTool({name:'_kujo_receipt_evidence',arguments:{receipt_uri:uri}});
 assert.notEqual(receipt.isError,true);
 assert.equal(receipt.structuredContent.status,'succeeded');
 console.log(JSON.stringify({discovery:true,canonical_profile:true,receipt_match:true,invalid_input_rejected:true,restart_evidence:true,receipt_uri:uri,host_ui_verified:false}));
} finally {await client.close();}

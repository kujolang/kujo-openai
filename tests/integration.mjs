import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {loadBackend} from '../lib/backend.mjs';
import {ReceiptStore} from '../lib/receipts.mjs';
import {Adapter} from '../lib/adapter.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const config=execFileSync(process.execPath,['scripts/configure-mcp-pack.mjs',process.env.KUJO_MCP_SOURCE || '../mcp'],{encoding:'utf8'}).trim();
const backend=await loadBackend(config),store=new ReceiptStore(backend.config.stateDirectory);await store.init();
const adapter=new Adapter(backend,store);const tools=await adapter.discover();assert.equal(tools.length,2);
const checks=[];
for(const [id,input,expected] of [
 ['kujo.mcp.repository.profile',{},false],
 ['kujo.mcp.manifest.validate',{manifest:'tests/fixtures/mcp-core-valid-manifest.json'},false],
 ['kujo.mcp.manifest.validate',{manifest:'../outside.json'},true],
 ['kujo.mcp.manifest.validate',{manifest:'C:/outside.json'},true],
 ['kujo.mcp.manifest.validate',{manifest:'; touch /tmp/forged'},true]]) {
 const tool=tools.find(t=>t._meta['kujo/abilityId']===id);
 const canonical=JSON.parse(await readFile(resolve(backend.config.cwd,'packs/mcp_core',id+'.json')));
 assert.deepEqual(tool.inputSchema,canonical.input_schema);assert.deepEqual(tool.outputSchema,canonical.output_schema);
 const result=await adapter.call(tool.name,input);assert.equal(result.isError,expected,JSON.stringify(result));
 const receipt=await store.read(result._meta['kujo/receiptUri']);assert.equal(receipt.ability_id,id);
 checks.push({ability:id,status:receipt.status,receipt_id:receipt.receipt_id,passed:true});
}
await mkdir('docs/evidence',{recursive:true});
await writeFile('docs/evidence/mcp-core.json',JSON.stringify({date:new Date().toISOString(),source_commit:'a7ec0dd8e6bcae303ab1431b4586dfe3e91f3a5a',checks},null,2)+'\n');
console.log('5 canonical MCP core integration cases passed; schemas and receipts preserved.');

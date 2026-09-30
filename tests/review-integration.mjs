import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,rm,access,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const directory=await mkdtemp(join(tmpdir(),'openai-review-')),repository=join(directory,'repository');await mkdir(repository);
const git=args=>execFileSync('git',['-C',repository,...args],{encoding:'utf8'});
const release=process.env.KUJO_REVIEW_RELEASE==='1';
let client;
try {
 git(['init','-q']);git(['config','user.name','Test']);git(['config','user.email','test@example.com']);
 await writeFile(join(repository,'test.txt'),'before\n');git(['add','.']);git(['commit','-qm','initial']);await writeFile(join(repository,'test.txt'),'after\n');
 const config=execFileSync(process.execPath,['scripts/configure-review-pack.mjs',repository,...(release?['--release-signals']:[])],{encoding:'utf8'}).trim();
 const transport=new StdioClientTransport({command:process.execPath,args:[resolve('bin/kujo-openai.mjs')],env:{PATH:process.env.PATH,KUJO_OPENAI_CONFIG:config},stderr:'pipe'});
 client=new Client({name:'canonical-review-integration',version:'1.0.0'});await client.connect(transport);
 const {tools}=await client.listTools();assert.equal(tools.length,release?3:2);const checks=[];
 for(const tool of tools) {
  assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:true});
  const result=await client.callTool({name:tool.name,arguments:{}});assert.equal(result.isError,false,JSON.stringify(result));if(tool._meta['kujo/abilityId']==='kujo.shipcheck.repository.scan') {
   assert.deepEqual(tool.outputSchema,JSON.parse(await readFile(resolve(process.env.KUJO_SHIPCHECK_SOURCE||'../shipcheck','schemas/shipcheck-report.schema.json'),'utf8')));
   assert.equal(result.structuredContent.summary.gate_passed,0);assert.equal(result.structuredContent.summary.total_checks,16);assert.ok(result.structuredContent.summary.failed_errors>0);
  } else assert.equal(result.structuredContent.summary.files_changed,1);
  const resource=await client.readResource({uri:result._meta['kujo/receiptUri']});const receipt=JSON.parse(resource.contents[0].text);assert.equal(receipt.ability_id,tool._meta['kujo/abilityId']);assert.deepEqual(receipt.result,result.structuredContent);assert.equal(receipt.audit.source_revisions["patchbrief.kujo"],"a4da5942e9668924cd2f2869859bf05b006edda5");checks.push({ability:receipt.ability_id,status:receipt.status,receipt_id:receipt.receipt_id});
  const invalid=await client.callTool({name:tool.name,arguments:{path:'../../etc',command:'touch injected',approval:true}});assert.equal(invalid.isError,true);checks.push({ability:receipt.ability_id,case:'forged path/command/approval',passed:true});
 }
 const canary=join(directory,'executed');git(['config','filter.hostile.clean',`touch ${canary}`]);
 for(const tool of tools){const result=await client.callTool({name:tool.name,arguments:{}});assert.equal(result.isError,true);const resource=await client.readResource({uri:result._meta['kujo/receiptUri']});assert.equal(JSON.parse(resource.contents[0].text).error.code,'repository_executable_configuration');checks.push({ability:tool._meta['kujo/abilityId'],case:'executable Git configuration rejected',passed:true});}
 await assert.rejects(access(canary));await mkdir('docs/evidence',{recursive:true});await writeFile(release?'docs/evidence/release-review.json':'docs/evidence/repository-review.json',JSON.stringify({date:new Date().toISOString(),transport:'official MCP SDK stdio client',checks},null,2)+'\n');console.log(`${checks.length} real ${release?'release':'repository'}-review MCP cases passed; canonical receipts preserved.`);
} finally {await client?.close();await rm(directory,{recursive:true,force:true});}

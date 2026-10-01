import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {configureReviewPack} from '../lib/review-pack-config.mjs';
import {findExecutable} from '../lib/setup.mjs';
import {resolveKujoBinary} from '@kujolang/kujo-runtime';
import {mkdtemp,writeFile,mkdir,rm,access,readFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const directory=await realpath(await mkdtemp(join(tmpdir(),'openai-review-'))),repository=join(directory,'repository');await mkdir(repository);
const git=args=>execFileSync('git',['-C',repository,...args],{encoding:'utf8'});
const release=process.env.KUJO_REVIEW_RELEASE==='1';
let client;
try {
 git(['init','-q']);git(['config','user.name','Test']);git(['config','user.email','test@example.com']);
 await writeFile(join(repository,'test.txt'),'before\n');git(['add','.']);git(['commit','-qm','initial']);await writeFile(join(repository,'test.txt'),'after\n');
 const config=await configureReviewPack({repository,binary:process.env.KUJO_BIN||resolveKujoBinary(),git:await findExecutable('git'),stateDirectory:join(directory,'provider'),sourcePaths:Object.fromEntries(['patchbrief','changebucket','shipcheck'].map(product=>[product,process.env[`KUJO_${product.toUpperCase()}_SOURCE`]])),release});
 assert.equal(config,join(directory,'provider','config.json'),'test provisioning must stay inside the disposable fixture');
 const transport=new StdioClientTransport({command:process.execPath,args:[resolve('bin/kujo-openai.mjs')],env:{PATH:process.env.PATH,KUJO_OPENAI_CONFIG:config},stderr:'pipe'});
 client=new Client({name:'canonical-review-integration',version:'1.0.0'});await client.connect(transport);
 const {tools:catalog}=await client.listTools();assert.equal(catalog.length,release?4:3);const tools=catalog.filter(t=>t._meta?.['kujo/abilityId']);const checks=[],failures=[];
 const verify=async(tool,scenario,action)=>{try{await action();}catch(error){failures.push(new Error(`${tool._meta['kujo/abilityId']} (${scenario}): ${error.message}`));}};
 for(const tool of tools) await verify(tool,'execution and receipt',async()=>{
  assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:true});
  const result=await client.callTool({name:tool.name,arguments:{}});assert.equal(result.isError,false,JSON.stringify(result));if(tool._meta['kujo/abilityId']==='kujo.shipcheck.repository.scan') {
   assert.deepEqual(tool.outputSchema,JSON.parse(await readFile(resolve(process.env.KUJO_SHIPCHECK_SOURCE||'../shipcheck','schemas/shipcheck-report.schema.json'),'utf8')));
   assert.equal(result.structuredContent.summary.gate_passed,0);assert.equal(result.structuredContent.summary.total_checks,16);assert.ok(result.structuredContent.summary.failed_errors>0);
   assert.equal(result.structuredContent.checks.find(check=>check.name==='git-repo')?.passed,1,'fixture Git repository must be detected');
   assert.equal(result.structuredContent.checks.find(check=>check.name==='readme')?.passed,0,'fixture deliberately has no README');
  } else assert.equal(result.structuredContent.summary.files_changed,1);
  const resource=await client.readResource({uri:result._meta['kujo/receiptUri']});const receipt=JSON.parse(resource.contents[0].text);assert.equal(receipt.ability_id,tool._meta['kujo/abilityId']);assert.deepEqual(receipt.result,result.structuredContent);assert.equal(receipt.audit.source_revisions["patchbrief.kujo"],"0e8d6bd6fd226b09b807f8758ade08096c8b70f0");checks.push({ability:receipt.ability_id,status:receipt.status,receipt_id:receipt.receipt_id});
  const evidence=await client.callTool({name:'_kujo_receipt_evidence',arguments:{receipt_uri:result._meta['kujo/receiptUri']}});assert.deepEqual(evidence.structuredContent.receipt,receipt);
  const invalid=await client.callTool({name:tool.name,arguments:{path:'../../etc',command:'touch injected',approval:true}});assert.equal(invalid.isError,true);checks.push({ability:receipt.ability_id,case:'forged path/command/approval',passed:true});
 });
 const canary=join(directory,'executed');git(['config','filter.hostile.clean',`touch ${canary}`]);
 for(const tool of tools) await verify(tool,'executable Git configuration',async()=>{const result=await client.callTool({name:tool.name,arguments:{}});assert.equal(result.isError,true);const resource=await client.readResource({uri:result._meta['kujo/receiptUri']});assert.equal(JSON.parse(resource.contents[0].text).error.code,'repository_executable_configuration');checks.push({ability:tool._meta['kujo/abilityId'],case:'executable Git configuration rejected',passed:true});});
 await assert.rejects(access(canary));if(failures.length)throw new AggregateError(failures,'Canonical review contract failures');await mkdir('docs/evidence',{recursive:true});await writeFile(release?'docs/evidence/release-review.json':'docs/evidence/repository-review.json',JSON.stringify({date:new Date().toISOString(),transport:'official MCP SDK stdio client',checks},null,2)+'\n');console.log(`${checks.length} real ${release?'release':'repository'}-review MCP cases passed; canonical receipts preserved.`);
} finally {await client?.close();await rm(directory,{recursive:true,force:true});}

// Networked clean-install acceptance: no ecosystem checkout or KUJO_BIN required.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,delimiter} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const temporary=await mkdtemp(join(tmpdir(),'kujo-install-acceptance-'));
const repository=join(temporary,'repository'),home=join(temporary,'state');
const entry=process.env.KUJO_TEST_INSTALLED_ENTRY || resolve('bin/kujo-openai.mjs');
let client;
try {
 await mkdir(repository);const git=args=>execFileSync('git',['-C',repository,...args],{stdio:'pipe'});
 git(['init','-q']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.com']);
 await writeFile(join(repository,'sample.txt'),'before\n');git(['add','.']);git(['commit','-qm','fixture']);await writeFile(join(repository,'sample.txt'),'after\n');
 const env={PATH:process.env.PATH,HOME:process.env.HOME,USERPROFILE:process.env.USERPROFILE,SystemRoot:process.env.SystemRoot,KUJO_OPENAI_HOME:home};
 const setup=()=>JSON.parse(execFileSync(process.execPath,[entry,'setup',repository],{cwd:repository,env,encoding:'utf8',timeout:600000}));
 // Run initial provisioning in the isolated environment with library diagnostics.
 // All paths, input and Git remotes here are test-owned; production CLI diagnostics
 // remain redacted. The second run still exercises the installed public CLI.
 const setupModule=pathToFileURL(resolve(entry,'../../lib/setup.mjs')).href;
 const initialScript=`import {setupLocal} from ${JSON.stringify(setupModule)}; console.log(JSON.stringify(await setupLocal({repository:process.argv[1]})));`;
 const first=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',initialScript,repository],{cwd:repository,env,encoding:'utf8',timeout:600000})),second=setup();assert.equal(first.config,second.config);assert.equal(first.repository,await realpath(repository));
 const configuration=JSON.parse(await readFile(first.config,'utf8'));
 // Direct read-only provider probe preserves native diagnostics for this fixture.
 execFileSync(configuration.kujo,['run',configuration.entry,'--untrusted',...configuration.capabilities],{
  cwd:configuration.cwd,env:{PATH:process.env.PATH,KUJO_MODULE_PATH:configuration.modulePaths.join(delimiter)},
  input:JSON.stringify({operation:'discover'}),encoding:'utf8',timeout:60000
 });
 await mkdir(join(repository,'nested'));
 const catalog=JSON.parse(execFileSync(process.execPath,[entry,'catalog'],{cwd:join(repository,'nested'),env,encoding:'utf8'}));assert.equal(catalog.tools.length,3);
 client=new Client({name:'kujo-clean-install-acceptance',version:'1.0.0'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[entry,'serve'],cwd:join(repository,'nested'),env,stderr:'pipe'}));
 const {tools}=await client.listTools();assert.equal(tools.length,4);
 for(const tool of tools.filter(t=>t._meta?.['kujo/abilityId'])) {
  const result=await client.callTool({name:tool.name,arguments:{}});assert.equal(result.isError,false,JSON.stringify(result));
  if(tool._meta['kujo/abilityId']==='kujo.shipcheck.repository.scan') {
   assert.equal(result.structuredContent.summary.gate_passed,0);
   assert.equal(result.structuredContent.summary.total_checks,16);
   assert.equal(result.structuredContent.checks.find(check=>check.name==='git-repo')?.passed,1,'installed tool must recognize the real Git fixture');
   assert.equal(result.structuredContent.checks.find(check=>check.name==='readme')?.passed,0);
  }
  else assert.equal(result.structuredContent.summary.files_changed,1);
  const evidence=await client.callTool({name:'_kujo_receipt_evidence',arguments:{receipt_uri:result._meta['kujo/receiptUri']}});
  assert.equal(evidence.isError,false);assert.equal(evidence.structuredContent.receipt.ability_id,tool._meta['kujo/abilityId']);
  assert.deepEqual(evidence.structuredContent.receipt.result,result.structuredContent);
 }
 console.log('PASS: fresh runtime/source setup, repeat setup, nested project discovery, 3 canonical tool executions and exact receipt lookups');
} finally {await client?.close();await rm(temporary,{recursive:true,force:true});}

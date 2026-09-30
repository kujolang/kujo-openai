import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,access,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const temp=await mkdtemp(join(tmpdir(),'kujo-openai-codex-'));
const profile=join(temp,'profile'),market=join(temp,'market');await mkdir(profile);await mkdir(join(market,'.agents/plugins'),{recursive:true});
const run=args=>execFileSync('codex',args,{env:{...process.env,CODEX_HOME:profile},encoding:'utf8',timeout:30000});
try {
 const version=run(['--version']).trim();
 execFileSync('unzip',['-q',resolve('dist/kujo-openai-0.1.0.zip'),'-d',market]);
 await writeFile(join(market,'.agents/plugins/marketplace.json'),JSON.stringify({name:'kujo-openai-test',plugins:[{name:'kujo-openai',source:{source:'local',path:'./kujo-openai'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Developer Tools'}]}));
 const marketplace=JSON.parse(run(['plugin','marketplace','add',market,'--json']));assert.equal(marketplace.marketplaceName,'kujo-openai-test');
 const installed=JSON.parse(run(['plugin','add','kujo-openai@kujo-openai-test','--json']));assert.equal(installed.version,'0.1.0');
 await access(join(installed.installedPath,'lib/adapter.mjs'));await access(join(installed.installedPath,'node_modules/@modelcontextprotocol/sdk/package.json'));
 assert.match(run(['plugin','list']),/installed, enabled/);
 const configured=JSON.parse(await readFile('.local/mcp-core/config.json'));
 const bundledProvider=join(installed.installedPath,'acceptance-provider.kujo');await cp(configured.entry,bundledProvider);
 configured.entry=bundledProvider;configured.modulePaths=configured.modulePaths.map(path=>path===resolve('.')?installed.installedPath:path===resolve('vendor/ability')?join(installed.installedPath,'vendor/ability'):path);
 const installedConfig=join(temp,'installed-config.json');await writeFile(installedConfig,JSON.stringify(configured));
 const catalog=JSON.parse(execFileSync(process.execPath,[join(installed.installedPath,'bin/kujo-openai.mjs'),'catalog'],{env:{...process.env,KUJO_OPENAI_CONFIG:installedConfig},encoding:'utf8',timeout:30000}));assert.equal(catalog.tools.length,2);
 run(['plugin','remove','kujo-openai@kujo-openai-test']);run(['plugin','marketplace','remove','kujo-openai-test']);
 await writeFile('docs/evidence/codex-profile.json',JSON.stringify({date:new Date().toISOString(),archive_sha256:createHash('sha256').update(await readFile('dist/kujo-openai-0.1.0.zip')).digest('hex'),source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),version,isolated_profile:true,install:true,dependencies_present:true,installed_catalog:true,bundled_native_projection:true,remove:true,live_model_test:false},null,2)+'\n');
 console.log('Isolated Codex plugin install/list/remove passed: '+version);
} finally {await rm(temp,{recursive:true,force:true});}

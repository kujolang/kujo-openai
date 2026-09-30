import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
test('portable plugin and MCP manifests validate against official versioned schemas',async()=>{
 const ajv=new Ajv({strict:false,validateFormats:false});
 for(const name of ['plugin','mcp']) {
 const schema=JSON.parse(await readFile(`schemas/${name}.schema.json`));const data=JSON.parse(await readFile(`${name}.json`));const validate=ajv.compile(schema);assert.equal(validate(data),true,JSON.stringify(validate.errors));
 }
 const plugin=JSON.parse(await readFile('plugin.json')),pkg=JSON.parse(await readFile('package.json'));assert.equal(plugin.version,pkg.version);
 assert.equal((await readdir('skills')).length,3);
 for(const name of await readdir('skills')) {const text=await readFile(`skills/${name}/SKILL.md`,'utf8');assert.ok(text.startsWith(`---\nname: ${name}\n`));assert.ok(text.includes('description:'));assert.ok(text.length<12000);assert.equal(text.includes('/Users/'),false);}
 assert.equal(JSON.stringify(plugin).includes('ai-plugin'),false);
});
test('Codex compatibility metadata matches portable package',async()=>{
 const portable=JSON.parse(await readFile('plugin.json')),compat=JSON.parse(await readFile('.codex-plugin/plugin.json'));
 assert.equal(compat.name,portable.name);assert.equal(compat.version,portable.version);assert.deepEqual(compat.interface,portable.extensions['com.openai'].interface);
 const mcp=JSON.parse(await readFile('mcp.json')),legacy=JSON.parse(await readFile('.mcp.json'));
 assert.deepEqual(legacy.mcpServers.kujo.args,mcp.mcpServers.kujo.args);assert.equal(legacy.mcpServers.kujo.command,mcp.mcpServers.kujo.command);
});


test('remote package requires operator HTTPS metadata and preserves canonical source manifests',async()=>{
 const {remotePackageManifests}=await import('../lib/remote-package.mjs');
 const original=JSON.parse(await readFile('plugin.json')),before=structuredClone(original);
 const configuration={schema:'kujo.openai.remote-package/v1',resource:'https://kujo.example/mcp',websiteURL:'https://kujo.example',supportURL:'https://kujo.example/support',privacyPolicyURL:'https://kujo.example/privacy',termsOfServiceURL:'https://kujo.example/terms'};
 const result=remotePackageManifests(original,configuration);assert.deepEqual(original,before);
 const ajv=new Ajv({strict:false,validateFormats:false});for(const name of ['plugin','mcp'])assert.equal(ajv.compile(JSON.parse(await readFile(`schemas/${name}.schema.json`)))(result[name]),true);
 assert.deepEqual(result.mcp.mcpServers,{kujo:{type:'streamable-http',url:configuration.resource}});
 assert.equal(result.plugin.extensions['com.openai'].interface.privacyPolicyURL,configuration.privacyPolicyURL);
 assert.throws(()=>remotePackageManifests(original,{...configuration,resource:'private-secret'}),error=>!String(error).includes('private-secret'));
 for(const change of [{resource:'http://local/mcp'},{resource:'https://user:secret@kujo.example/mcp'},{resource:'https://kujo.example/mcp?token=secret'},{privacyPolicyURL:undefined},{authorization:'Bearer secret'}])assert.throws(()=>remotePackageManifests(original,{...configuration,...change}));
});

test('remote ZIP is reproducible and contains one HTTPS MCP without local runtimes or credentials',async()=>{
 const {mkdtemp,cp,mkdir,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join,resolve}=await import('node:path');const {execFileSync}=await import('node:child_process');
 const temporary=await mkdtemp(join(tmpdir(),'kujo-remote-package-'));
 try {
  for(const path of ['skills','docs','LICENSE','package.json','package-lock.json','plugin.json'])await cp(path,join(temporary,path),{recursive:true});
  await mkdir(join(temporary,'vendor'));await cp('vendor/LOCK.json',join(temporary,'vendor/LOCK.json'));
  const configuration=join(temporary,'operator.json');await writeFile(configuration,JSON.stringify({schema:'kujo.openai.remote-package/v1',resource:'https://kujo.example/mcp',websiteURL:'https://kujo.example',supportURL:'https://kujo.example/support',privacyPolicyURL:'https://kujo.example/privacy',termsOfServiceURL:'https://kujo.example/terms'}));
  const build=()=>JSON.parse(execFileSync(process.execPath,[resolve('scripts/package.mjs'),'--remote',configuration],{cwd:temporary,encoding:'utf8'}));
  const first=build(),second=build();assert.equal(first.sha256,second.sha256);
  const names=execFileSync('unzip',['-Z1',second.archive],{encoding:'utf8'}).trim().split('\n');
  assert.ok(names.includes('kujo-openai/plugin.json'));assert.ok(names.includes('kujo-openai/skills/kujo-ship-review/SKILL.md'));
  assert.equal(names.some(name=>/\/(node_modules|bin|vendor|\.codex-plugin)\//.test(name)||name.endsWith('operator.json')||name.endsWith('.mcp.json')),false);
  const mcp=JSON.parse(execFileSync('unzip',['-p',second.archive,'kujo-openai/mcp.json'],{encoding:'utf8'}));assert.deepEqual(mcp.mcpServers,{kujo:{type:'streamable-http',url:'https://kujo.example/mcp'}});
 }finally{await rm(temporary,{recursive:true,force:true});}
});

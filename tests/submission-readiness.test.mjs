import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {preinstalledReadiness} from '../lib/submission-readiness.mjs';
test('current Node archive cannot qualify as preinstalled-only submission',async()=>{
 const result=preinstalledReadiness({mcp:JSON.parse(await readFile('mcp.json'))});
 assert.equal(result.ready,false);
 assert.deepEqual(result.blockers,['preinstalled_native_entrypoint_unverified','native_plugin_host_acceptance_missing','openai_local_distribution_unconfirmed']);
});
test('invented native command alone cannot remove runtime or host acceptance gates',()=>{
 const result=preinstalledReadiness({mcp:{mcpServers:{kujo:{type:'stdio',command:'kujo',args:['mcp','serve']}}}});
 assert.equal(result.ready,false);
 assert.deepEqual(result.blockers,['preinstalled_native_entrypoint_unverified','native_plugin_host_acceptance_missing','openai_local_distribution_unconfirmed']);
});
test('caller booleans cannot certify a public native plugin',()=>{
 const result=preinstalledReadiness({mcp:{mcpServers:{kujo:{type:'stdio',command:'kujo',args:['mcp','serve']}}},nativeAcceptance:true,hostApproval:true});
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes('preinstalled_native_entrypoint_unverified'));
 assert.ok(result.blockers.includes('native_plugin_host_acceptance_missing'));
 assert.ok(result.blockers.includes('openai_local_distribution_unconfirmed'));
});
test('remote and absent configurations cannot satisfy local distribution',()=>{
 for(const mcp of [null,{mcpServers:{kujo:{type:'streamable-http',url:'https://example.invalid/mcp'}}}])assert.ok(preinstalledReadiness({mcp}).blockers.includes('local_stdio_required'));
});
test('submission packaging refuses before writing any archive',async()=>{
 const {execFile}=await import('node:child_process');
 const {promisify}=await import('node:util');
 const {mkdtemp,mkdir,copyFile,readdir,rm}=await import('node:fs/promises');
 const {join}=await import('node:path');
 const {tmpdir}=await import('node:os');
 const root=await mkdtemp(join(tmpdir(),'kujo-submission-gate-'));
 try {
  await mkdir(join(root,'scripts'));await mkdir(join(root,'lib'));
  for(const path of ['scripts/package.mjs','lib/submission-readiness.mjs','lib/remote-package.mjs','mcp.json','package.json'])await copyFile(path,join(root,path));
  await assert.rejects(promisify(execFile)(process.execPath,['scripts/package.mjs','--submission'],{cwd:root}),e=>e.code===1&&JSON.parse(e.stderr.trim()).ready===false);
  assert.equal((await readdir(root)).includes('dist'),false);
 } finally {await rm(root,{recursive:true,force:true});}
});
test('packaged branding retains the official K and upload-compatible PNG',async()=>{
 const {createHash}=await import('node:crypto');
 const svg=await readFile('assets/kujo-logomark.svg');
 assert.equal(createHash('sha256').update(svg).digest('hex'),'cecb66eae65116fadf29a93ce3adae28956b17cfaf1e8d9e0910c280935ef412');
 const png=await readFile('assets/kujo-icon.png');
 assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);
 assert.ok(png.length<=10000);
 const p=JSON.parse(await readFile('plugin.json'));
 for(const key of ['logo','logoDark','composerIcon','composerIconDark'])assert.equal(p.extensions['com.openai'].interface[key],'./assets/kujo-icon.png');
});

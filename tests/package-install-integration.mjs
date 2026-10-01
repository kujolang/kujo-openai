// Exercise the distributable, not the checkout: package omissions and optional
// runtime dependencies must fail before a release reaches a fresh machine.
import assert from 'node:assert/strict';
import {artifactFixture,verifyInstalledArtifact} from './runtime-artifact-fixture.mjs';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve('.');
const candidate=artifactFixture();
const temporary=await realpath(await mkdtemp(join(tmpdir(),'kujo-package-install-')));
try {
 const npm=process.env.npm_execpath;
 assert.ok(npm,'Run this acceptance test with npm run test:install');
 const runNpm=(args,cwd)=>execFileSync(process.execPath,[npm,...args],{cwd,encoding:'utf8',timeout:600000,stdio:['ignore','pipe','pipe']});
 const packed=JSON.parse(runNpm(['pack','--json','--ignore-scripts','--pack-destination',temporary],root));
 assert.equal(packed.length,1);
 const consumer=join(temporary,'consumer');await mkdir(consumer);
 // Root-only override: exercise an unpublished runtime without changing the
 // adapter tarball's declared registry dependency or accepting nested fallback.
 if(candidate)await writeFile(join(consumer,'package.json'),JSON.stringify({
  private:true,overrides:{'@kujolang/kujo-runtime':'$@kujolang/kujo-runtime'}
 }));
 runNpm(['install','--ignore-scripts','--no-audit','--no-fund','--package-lock=false',...(candidate?[candidate.runtime,candidate.platform]:[]),join(temporary,packed[0].filename)],consumer);
 const installed=join(consumer,'node_modules','@kujolang','kujo-openai');
 assert.equal(await realpath(installed),installed,'Install must be independent of the source checkout');
 const manifest=JSON.parse(await readFile(join(installed,'package.json'),'utf8'));
 assert.equal(manifest.name,'@kujolang/kujo-openai');
 assert.deepEqual(manifest.dependencies,JSON.parse(await readFile(join(root,'package.json'),'utf8')).dependencies,'Candidate testing must not rewrite the adapter dependency declaration');
 if(candidate)console.log('Verified candidate runtime provenance:',JSON.stringify(await verifyInstalledArtifact(installed,candidate)));
 const env={...process.env,KUJO_TEST_INSTALLED_ENTRY:join(installed,'bin','kujo-openai.mjs')};
 delete env.KUJO_BIN;delete env.KUJO_OPENAI_CONFIG;
 execFileSync(process.execPath,[join(root,'tests','setup-integration.mjs')],{cwd:consumer,env,timeout:600000,stdio:'inherit'});
 console.log(candidate?'PASS: isolated candidate-artifact npm install (not published-package acceptance)':'PASS: isolated npm tarball install with lifecycle scripts disabled and target-platform runtime dependency');
} finally {await rm(temporary,{recursive:true,force:true});}

import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {artifactFixture} from './runtime-artifact-fixture.mjs';
test('candidate acceptance is opt-in and rejects partial or ambiguous package inputs',()=>{
 assert.equal(artifactFixture({}),null);
 const valid={KUJO_TEST_RUNTIME_TARBALL:resolve('runtime.tgz'),KUJO_TEST_PLATFORM_TARBALL:resolve('platform.tgz'),KUJO_TEST_RUNTIME_COMMIT:'a'.repeat(40)};
 assert.deepEqual(artifactFixture(valid),{runtime:valid.KUJO_TEST_RUNTIME_TARBALL,platform:valid.KUJO_TEST_PLATFORM_TARBALL,commit:valid.KUJO_TEST_RUNTIME_COMMIT});
 for(const key of Object.keys(valid)){const missing={...valid};delete missing[key];assert.throws(()=>artifactFixture(missing));}
 for(const change of [{KUJO_TEST_RUNTIME_TARBALL:'runtime.tgz'},{KUJO_TEST_PLATFORM_TARBALL:'https://example.invalid/package.tgz'},{KUJO_TEST_RUNTIME_COMMIT:'main'},{KUJO_TEST_RUNTIME_COMMIT:''}])assert.throws(()=>artifactFixture({...valid,...change}));
});

test('installed candidate verification rejects forged provenance and binary digests',async()=>{
 const {mkdtemp,mkdir,cp,readFile,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join,dirname}=await import('node:path');
 const {createRequire}=await import('node:module');
 const {verifyInstalledArtifact}=await import('./runtime-artifact-fixture.mjs');
 const require=createRequire(import.meta.url);
 const runtimeRoot=dirname(require.resolve('@kujolang/kujo-runtime/package.json'));
 const platformRoot=dirname(dirname(require('@kujolang/kujo-runtime').resolveKujoBinary()));
 const temporary=await mkdtemp(join(tmpdir(),'kujo-artifact-proof-'));
 try {
  await writeFile(join(temporary,'package.json'),'{}');
  const scope=join(temporary,'node_modules','@kujolang');await mkdir(scope,{recursive:true});
  await cp(runtimeRoot,join(scope,'kujo-runtime'),{recursive:true});
  const platform=join(scope,`kujo-${process.platform}-${process.arch}`);await cp(platformRoot,platform,{recursive:true});
  const path=join(platform,'metadata.json');const metadata=JSON.parse(await readFile(path,'utf8'));
  assert.deepEqual(await verifyInstalledArtifact(temporary,{commit:metadata.gitCommit}),metadata);
  await assert.rejects(verifyInstalledArtifact(temporary,{commit:'0'.repeat(40)}),/reviewed candidate commit/);
  await writeFile(path,JSON.stringify({...metadata,sha256:'0'.repeat(64)}));
  await assert.rejects(verifyInstalledArtifact(temporary,{commit:metadata.gitCommit}));
 }finally{await rm(temporary,{recursive:true,force:true});}
});

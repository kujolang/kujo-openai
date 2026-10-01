// Test-only opt-in. Production setup still uses its declared registry dependency.
import assert from 'node:assert/strict';
import {readFile,realpath} from 'node:fs/promises';
import {isAbsolute,join,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
export function artifactFixture(environment=process.env) {
 const values=['KUJO_TEST_RUNTIME_TARBALL','KUJO_TEST_PLATFORM_TARBALL','KUJO_TEST_RUNTIME_COMMIT'].map(key=>environment[key]);
 if(values.every(value=>value===undefined))return null;
 assert.ok(values.every(value=>typeof value==='string'&&value.length),'Complete candidate artifact inputs required');
 const [runtime,platform,commit]=values;
 assert.ok([runtime,platform].every(path=>isAbsolute(path)&&path.endsWith('.tgz')),'Candidate packages require absolute tarball paths');
 assert.match(commit,/^[0-9a-f]{40}$/);
 return {runtime,platform,commit};
}
export async function verifyInstalledArtifact(installed,fixture) {
 const require=createRequire(join(installed,'package.json'));
 const runtime=require('@kujolang/kujo-runtime');
 const binary=await realpath(runtime.resolveKujoBinary());
 const platformRoot=dirname(dirname(binary));
 const metadata=JSON.parse(await readFile(join(platformRoot,'metadata.json'),'utf8'));
 const manifest=JSON.parse(await readFile(join(platformRoot,'package.json'),'utf8'));
 assert.equal(metadata.gitCommit,fixture.commit,'Installed binary must come from the reviewed candidate commit');
 assert.equal(metadata.target,`${process.platform}-${process.arch}`);
 assert.equal(metadata.runtimeVersion,require('@kujolang/kujo-runtime/package.json').version,'Candidate resolver and binary versions must match');
 assert.equal(manifest.version,metadata.runtimeVersion);
 assert.equal(metadata.sha256,createHash('sha256').update(await readFile(binary)).digest('hex'));
 for(const name of ['preinstall','install','postinstall'])assert.equal(manifest.scripts?.[name],undefined);
 return metadata;
}

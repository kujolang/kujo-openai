import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const files = ['ability.kujo', 'LICENSE', 'src/index.kujo', 'src/internal.kujo', 'src/contract.kujo', 'src/contracts.kujo', 'src/registry.kujo', 'src/runtime.kujo', 'src/profile.kujo', 'schema/ability.schema.json', 'examples/content_find.json', 'tests/contract_tests.kujo', 'tests/fixtures/semantics_conformance.json', 'tests/runtime_contract_tests.kujo'];
const sha = b => createHash('sha256').update(b).digest('hex');
if (process.argv.includes('--verify')) {
 const lock = JSON.parse(await readFile('vendor/LOCK.json'));
 for (const [path, digest] of Object.entries(lock.files)) {
  if (sha(await readFile(`vendor/ability/${path}`)) !== digest) throw Error(`Vendor integrity failure: ${path}`);
 }
 console.log(`Verified ${Object.keys(lock.files).length} canonical Ability files at ${lock.commit}`);
} else {
 const commit = execFileSync('git', ['-C', '../ability', 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
 const hashes = {};
 for (const path of files) {
  const body = execFileSync('git', ['-C', '../ability', 'show', `${commit}:${path}`]);
  await mkdir(`vendor/ability/${path.split('/').slice(0,-1).join('/')}`, {recursive:true});
  await writeFile(`vendor/ability/${path}`, body); hashes[path] = sha(body);
 }
 await writeFile('vendor/LOCK.json', JSON.stringify({repository:'https://github.com/kujolang/ability', commit, files:hashes}, null, 2)+'\n');
}

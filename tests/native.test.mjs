import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {kujo,root} from './helpers.mjs';
import {join} from 'node:path';
test('unchanged pinned Ability definition and execution conformance suites',()=>{
 for(const file of ['contract_tests.kujo','runtime_contract_tests.kujo']) {
 const output=execFileSync(kujo,['run',join(root,'vendor/ability/tests',file),'--interpreter'],{cwd:join(root,'vendor/ability'),encoding:'utf8',timeout:60000});
 assert.match(output,/passed/);
 }
});
test('native host projection equals direct canonical runtime and admits future Abilities',()=>{
 assert.match(execFileSync(kujo,['run','tests/projection-contract.kujo'],{cwd:root,encoding:'utf8',timeout:60000}),/passed/);
});

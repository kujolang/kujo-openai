import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm,access,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {configuredProject,projectDirectory,setupLocal,findExecutable} from '../lib/setup.mjs';
import {REVIEW_REVISIONS} from '../lib/review-pack-config.mjs';

test('startup resolves only provisioned user-state config and never repository configuration',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'kujo-setup-discovery-'));
 try {
  const home=join(temp,'state'),repo=join(temp,'repo'),nested=join(repo,'src');await mkdir(nested,{recursive:true});
  await writeFile(join(repo,'config.json'),'untrusted repository config');
  await assert.rejects(configuredProject(nested,home),/project_setup_required/);
  const directory=projectDirectory(home,await realpath(repo));
  await mkdir(directory,{recursive:true});const config=join(directory,'config.json');await writeFile(config,'{}');
  assert.equal(await configuredProject(nested,home),config);
  await rm(config);await symlink(join(repo,'config.json'),config);
  await assert.rejects(configuredProject(nested,home),/unsafe_setup_file/);
  await rm(directory,{recursive:true});
  await symlink(repo,directory,process.platform==='win32'?'junction':'dir');
  await assert.rejects(configuredProject(nested,home),/unsafe_setup_directory/);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('setup rejects untrusted cache links and preserves an existing setup lock',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'kujo-setup-boundary-'));
 try {
  const repo=join(temp,'repo'),home=join(temp,'state');await mkdir(repo);await mkdir(home);
  const git=await findExecutable('git');execFileSync(git,['init',repo],{stdio:'ignore'});
  const lock=join(home,'setup.lock');await mkdir(lock);await writeFile(join(lock,'owner'),'existing setup');
  await assert.rejects(setupLocal({repository:repo,home}),/setup_in_progress_or_stale_lock/);
  await access(join(lock,'owner'));await rm(lock,{recursive:true});
  await mkdir(join(home,'sources'));
  const cache=join(home,'sources',`patchbrief-${REVIEW_REVISIONS['patchbrief.kujo']}`);
  await symlink(repo,cache,process.platform==='win32'?'junction':'dir');
  await assert.rejects(setupLocal({repository:repo,home}),/unsafe_setup_directory/);
  await assert.rejects(access(lock));await access(repo);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('setup fails before downloads when the selected directory is not a Git root',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'kujo-setup-invalid-'));
 try {
  const repo=join(temp,'repo'),home=join(temp,'state');await mkdir(repo);
  await assert.rejects(setupLocal({repository:repo,home}));
  await assert.rejects(access(join(home,'sources')));
  await assert.rejects(access(join(home,'setup.lock')));
 }finally{await rm(temp,{recursive:true,force:true});}
});

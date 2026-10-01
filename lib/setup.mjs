import {access,lstat,mkdir,realpath,rename,rm,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,dirname,delimiter,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolveKujoBinary} from '@kujolang/kujo-runtime';
import {configureReviewPack,REVIEW_REVISIONS} from './review-pack-config.mjs';

export function setupHome() {
 return resolve(process.env.KUJO_OPENAI_HOME||join(homedir(),'.local','share','kujo','openai'));
}
export async function findExecutable(name) {
 for(const directory of (process.env.PATH||'').split(delimiter).filter(isAbsolute)) {
  for(const suffix of process.platform==='win32'?['.exe','']:['']) {
   const candidate=join(directory,name+suffix);
   try{await access(candidate,constants.X_OK);if((await lstat(candidate)).isFile()||(await lstat(candidate)).isSymbolicLink())return await realpath(candidate);}catch{}
  }
 }
 throw new Error('required_executable_unavailable');
}
export function projectDirectory(home,repository) {
 return join(home,'projects',createHash('sha256').update(repository).digest('hex'));
}
async function privateDirectory(path) {
 await mkdir(path,{recursive:true,mode:0o700});
 const info=await lstat(path);
 if(!info.isDirectory()||info.isSymbolicLink())throw new Error('unsafe_setup_directory');
}
async function safeOutput(path) {
 try{const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink())throw new Error('unsafe_setup_file');}
 catch(error){if(error.code!=='ENOENT')throw error;}
}
function gitRun(git,args,cwd,home) {
 // Pinned sources must not activate a user's Git aliases, hooks or filters.
 return execFileSync(git,['-c',`core.hooksPath=${join(home,'setup.lock','no-hooks')}`, ...args],{
  cwd,encoding:'utf8',timeout:180000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe'],
  env:{PATH:process.env.PATH||'',HOME:home,USERPROFILE:home,SystemRoot:process.env.SystemRoot||'',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:join(home,'setup.lock','gitconfig'),GIT_TERMINAL_PROMPT:'0',GIT_ALLOW_PROTOCOL:'https'}
 }).trim();
}

// Called only by the operator's explicit CLI setup action, never a model tool.
export async function setupLocal({repository=process.cwd(),home=setupHome()}={}) {
 repository=await realpath(repository);home=resolve(home);
 const binary=resolveKujoBinary(),git=await findExecutable('git');
 await privateDirectory(home);
 // macOS temporary roots may pass through /var -> /private/var. Store canonical
 // absolute paths so receipt-directory integrity checks remain strict.
 home=await realpath(home);
 const lock=join(home,'setup.lock');
 try{await mkdir(lock,{mode:0o700});}catch{throw new Error('setup_in_progress_or_stale_lock');}
 try {
  await mkdir(join(lock,'no-hooks'),{mode:0o700});
  await writeFile(join(lock,'gitconfig'),'',{flag:'wx',mode:0o600});
  if(await realpath(gitRun(git,['-C',repository,'rev-parse','--show-toplevel'],home,home))!==repository)throw new Error('git_worktree_root_required');
  const sourcesRoot=join(home,'sources');await privateDirectory(sourcesRoot);
  const sourcePaths={};
  for(const [entry,commit] of Object.entries(REVIEW_REVISIONS)) {
   const product=entry.replace(/\.kujo$/,'');
   const target=join(sourcesRoot,`${product}-${commit}`);
   let exists=true;try{await lstat(target);}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}
   if(!exists) {
    const temporary=join(lock,product);
    gitRun(git,['clone','--no-checkout','--filter=blob:none',`https://github.com/kujolang/${product}.git`,temporary],home,home);
    gitRun(git,['-C',temporary,'checkout','--detach',commit],home,home);
    await rename(temporary,target);
   }
   await privateDirectory(target);
   if(gitRun(git,['-C',target,'rev-parse','HEAD'],home,home)!==commit||gitRun(git,['-C',target,'status','--porcelain','--untracked-files=all'],home,home))throw new Error('installed_source_integrity_failed');
   sourcePaths[product]=target;
  }
  await privateDirectory(join(home,'projects'));
  const stateDirectory=projectDirectory(home,repository);await privateDirectory(stateDirectory);
  for(const name of ['audit','home','receipts'])await privateDirectory(join(stateDirectory,name));
  for(const name of ['provider.kujo','config.json'])await safeOutput(join(stateDirectory,name));
  const config=await configureReviewPack({repository,binary,git,stateDirectory,sourcePaths,release:true});
  return {schema:'kujo.openai.setup/v1',repository,config,runtime:binary,mode:'trusted-local',capabilities:'canonical-repository-review-with-release-signals'};
 } finally {await rm(lock,{recursive:true,force:true});}
}

// Resolve only an already provisioned user-owned configuration. Startup does not
// install software, trust a repository, or read configuration from that repository.
export async function configuredProject(start=process.cwd(),home=setupHome()) {
 let directory=await realpath(start);
 while(true) {
  const candidate=join(projectDirectory(home,directory),'config.json');
  try {
   await safeOutput(candidate);await access(candidate);
   for(const path of [home,join(home,'projects'),dirname(candidate)]) {
    const info=await lstat(path);if(!info.isDirectory()||info.isSymbolicLink())throw new Error('unsafe_setup_directory');
   }
   return candidate;
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const parent=dirname(directory);if(parent===directory)break;directory=parent;
 }
 throw new Error('project_setup_required');
}

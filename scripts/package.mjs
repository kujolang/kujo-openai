import {mkdtemp,mkdir,cp,readdir,stat,utimes,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,isAbsolute} from 'node:path';
import {remotePackageManifests} from '../lib/remote-package.mjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const pkg=JSON.parse(await readFile('package.json'));
const args=process.argv.slice(2);
if(args.length && (args.length!==2||args[0]!=='--remote'||!isAbsolute(args[1])))throw new Error('Usage: package.mjs [--remote /absolute/operator/package.json]');
let remote=null;
if(args.length){try{remote=remotePackageManifests(JSON.parse(await readFile('plugin.json')),JSON.parse(await readFile(args[1])));}catch{throw new Error('Remote package configuration could not be validated');}}
const archiveName=`kujo-openai-${pkg.version}${remote?'-remote':''}.zip`;
const output=remote?'dist/remote':'dist';
const temporary=await mkdtemp(join(tmpdir(),'kujo-openai-package-')),stage=join(temporary,'kujo-openai');
await mkdir(stage);await mkdir(output,{recursive:true});
try {
 const included=remote?['skills','docs','assets','LICENSE']: [...pkg.files,'package.json','package-lock.json','node_modules'];
 for(const path of included) await cp(path,join(stage,path),{recursive:true,filter:source=>!source.endsWith('/.bin')});
 if(remote){
  await writeFile(join(stage,'plugin.json'),JSON.stringify(remote.plugin,null,2)+'\n');
  await writeFile(join(stage,'mcp.json'),JSON.stringify(remote.mcp,null,2)+'\n');
  await writeFile(join(stage,'README.md'),'# Kujo remote plugin\n\nThis portable package connects to the operator-configured HTTPS MCP endpoint. OAuth linking and available tools depend on that deployment. Building this archive does not verify the service, grant directory approval or certify Codex legacy-profile compatibility. See docs/SUBMISSION.md for live acceptance gates.\n');
 }

 const files=[];
 async function walk(path) {for(const name of (await readdir(path)).sort()) {const full=join(path,name);if((await stat(full)).isDirectory()) await walk(full);else {await utimes(full,new Date('2000-01-01T00:00:00Z'),new Date('2000-01-01T00:00:00Z'));files.push(full.slice(temporary.length+1));}}}
 await walk(stage);
 const archive=resolve(join(output,archiveName));await rm(archive,{force:true});
 execFileSync('zip',['-X','-q',archive,'-@'],{cwd:temporary,input:files.sort().join('\n')+'\n'});
 const digest=createHash('sha256').update(await readFile(archive)).digest('hex');
 await writeFile(join(output,'SHA256SUMS'),`${digest}  ${archiveName}\n`);
 const lock=JSON.parse(await readFile('package-lock.json'));
 await writeFile(join(output,'dependencies.json'),JSON.stringify({schema:'kujo.openai.dependencies/v1',packages:Object.entries(remote?{}:lock.packages).filter(([path])=>path).map(([path,p])=>({path,version:p.version,integrity:p.integrity,license:p.license}))},null,2)+'\n');
 await writeFile(join(output,'provenance.json'),JSON.stringify({schema:'kujo.openai.package-provenance/v1',signed:false,archive:archiveName,profile:remote?'remote-portable':'local',...(remote?{resource:remote.mcp.mcpServers.kujo.url}:{} ),sha256:digest,ability:JSON.parse(await readFile('vendor/LOCK.json')),lock_sha256:createHash('sha256').update(await readFile('package-lock.json')).digest('hex')},null,2)+'\n');
 console.log(JSON.stringify({archive,sha256:digest,files:files.length,signed:false}));
} finally {await rm(temporary,{recursive:true,force:true});}

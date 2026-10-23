// Isolated packaging/host acceptance. No host credentials or repositories mounted.
import {execFileSync} from 'node:child_process';
import {mkdtemp,copyFile,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('.'),context=await mkdtemp(join(tmpdir(),'kujo-sandbox-'));
const name=`kujo-acceptance-${context.split('-').at(-1).toLowerCase()}`;
const image=`${name}:test`;
let created=false;
const docker=(args,options={})=>execFileSync('docker',args,{stdio:'inherit',timeout:900000,...options});
try {
 const packed=JSON.parse(execFileSync(process.execPath,[process.env.npm_execpath,'pack','--ignore-scripts','--json','--pack-destination',context],{cwd:root,encoding:'utf8'}));
 const tarball=join(context,packed[0].filename);
 await copyFile(tarball,join(context,'package.tgz'));
 for(const file of ['Dockerfile','acceptance.mjs'])await copyFile(join(root,'tests/sandbox',file),join(context,file));
 await copyFile(join(root,'tests/setup-integration.mjs'),join(context,'setup-integration.mjs'));
 await copyFile(join(root,'package-lock.json'),join(context,'adapter-lock.json'));
 docker(['build','-t',image,context]);
 docker(['create','--name',name,'--cap-drop=ALL','--security-opt=no-new-privileges',image]);created=true;
 docker(['start','--attach',name]);
 const state=JSON.parse(docker(['inspect',name,'--format','{{json .State}}'],{encoding:'utf8',stdio:'pipe'}));
 if(state.ExitCode!==0)throw new Error(`Sandbox acceptance exited ${state.ExitCode}`);
 docker(['cp',`${name}:/tmp/kujo-sandbox-result.json`,join(context,'result.json')]);
 const evidence={...JSON.parse(await readFile(join(context,'result.json'),'utf8')),date:new Date().toISOString(),source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),package_sha256:createHash('sha256').update(await readFile(tarball)).digest('hex'),image_id:docker(['image','inspect',image,'--format','{{.Id}}'],{encoding:'utf8',stdio:'pipe'}).trim(),host_mounts:false,unprivileged_user:true};
 await mkdir('.local',{recursive:true});await writeFile('.local/sandbox-acceptance.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Sandbox results: .local/sandbox-acceptance.json');
} finally {
 if(created)docker(['rm','--force',name]);
 // Remove only this run's named image, retaining reusable build cache.
 try{docker(['image','rm',image]);}catch{}
 await rm(context,{recursive:true,force:true});
}

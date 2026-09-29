import {mkdtemp,mkdir,cp,readdir,stat,utimes,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const pkg=JSON.parse(await readFile('package.json'));
const temporary=await mkdtemp(join(tmpdir(),'kujo-openai-package-')),stage=join(temporary,'kujo-openai');
await mkdir(stage);await mkdir('dist',{recursive:true});
try {
 for(const path of [...pkg.files,'package.json','package-lock.json','node_modules']) await cp(path,join(stage,path),{recursive:true,filter:source=>!source.endsWith('/.bin')});
 const files=[];
 async function walk(path) {for(const name of (await readdir(path)).sort()) {const full=join(path,name);if((await stat(full)).isDirectory()) await walk(full);else {await utimes(full,new Date('2000-01-01T00:00:00Z'),new Date('2000-01-01T00:00:00Z'));files.push(full.slice(temporary.length+1));}}}
 await walk(stage);
 const archive=resolve(`dist/kujo-openai-${pkg.version}.zip`);await rm(archive,{force:true});
 execFileSync('zip',['-X','-q',archive,'-@'],{cwd:temporary,input:files.sort().join('\n')+'\n'});
 const digest=createHash('sha256').update(await readFile(archive)).digest('hex');
 await writeFile('dist/SHA256SUMS',`${digest}  kujo-openai-${pkg.version}.zip\n`);
 const lock=JSON.parse(await readFile('package-lock.json'));
 await writeFile('dist/dependencies.json',JSON.stringify({schema:'kujo.openai.dependencies/v1',packages:Object.entries(lock.packages).filter(([path])=>path).map(([path,p])=>({path,version:p.version,integrity:p.integrity,license:p.license}))},null,2)+'\n');
 await writeFile('dist/provenance.json',JSON.stringify({schema:'kujo.openai.package-provenance/v1',signed:false,archive:`kujo-openai-${pkg.version}.zip`,sha256:digest,ability:JSON.parse(await readFile('vendor/LOCK.json')),lock_sha256:createHash('sha256').update(await readFile('package-lock.json')).digest('hex')},null,2)+'\n');
 console.log(JSON.stringify({archive,sha256:digest,files:files.length,signed:false}));
} finally {await rm(temporary,{recursive:true,force:true});}

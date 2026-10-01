// Provision canonical Ability bindings; no product schemas or commands are defined here.
import {writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const REVIEW_REVISIONS=Object.freeze({'patchbrief.kujo':'0e8d6bd6fd226b09b807f8758ade08096c8b70f0','changebucket.kujo':'030eea63c60449f82c9ba2680227485d318fdb6d','shipcheck.kujo':'0a9f5795e9498f3698d5da6bb66642544251dd37'});
export async function configureReviewPack({repository:requestedRepository,binary:requestedBinary,git:requestedGit,stateDirectory,sourcePaths={},release=true}) {
 const repository=await realpath(requestedRepository),binary=await realpath(requestedBinary),git=await realpath(requestedGit);
 if(await realpath(execFileSync(git,['-C',repository,'rev-parse','--show-toplevel'],{encoding:'utf8'}).trim())!==repository) throw Error('Select a Git worktree root');
 const revisions=Object.fromEntries(Object.entries(REVIEW_REVISIONS).filter(([key])=>release||key!=='shipcheck.kujo'));
const sources={};
for(const product of (release?['patchbrief','changebucket','shipcheck']:['patchbrief','changebucket'])) {
 const source=await realpath(sourcePaths[product] || `../${product}`);
 if(execFileSync(git,['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==revisions[`${product}.kujo`] || execFileSync(git,['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim()) throw Error(`${product} must match reviewed clean revision ${revisions[`${product}.kujo`]}`);
 sources[product]=source;
}
const directory=resolve(stateDirectory);await mkdir(directory,{recursive:true,mode:0o700});
for(const path of ['audit','home']) await mkdir(join(directory,path),{recursive:true,mode:0o700});
const configuration={...sources,kujo:binary,git,repository,revisions,home:join(directory,'home'),path:process.env.PATH};
const entry=join(directory,'provider.kujo');
await writeFile(entry,`from vendor.ability.packs.repository_review.runtime import create_repository_review_registry, repository_review_policy
from vendor.ability.ability import list_ability_definitions, register_ability_exposure
from src.projection import discover, invoke
func visible(entry,context){return true}
func audit(phase,invocation,payload){
 name:=invocation["invocation_id"]+"-"+phase+".json"
 write_file_atomic_beneath(${JSON.stringify(join(directory,'audit'))},name,to_json(payload),false)
 return {"ok":true,"event_id":name,"source_revisions":${JSON.stringify(revisions)}}
}
created:=create_repository_review_registry(${JSON.stringify(configuration)})
assert(created["ok"],"review registry unavailable")
registry:=created["registry"]
for entry in list_ability_definitions(registry,"sdk") {
 exposure:=entry["exposure"];exposure["surface"]:="mcp"
 step:=register_ability_exposure(registry,exposure);assert(step["ok"],"exposure rejected");registry=step["registry"]
}
request:=parse_json(read_stdin(1048576))
context:={"principal":{"type":"workload","id":"review-operator","tenant_id":"local","claims":{}},"invocation_id":"discovery"}
if request["operation"]=="discover" {print(to_json(discover(registry,context,visible)))} else {
 context["invocation_id"]:=request["invocation_id"]
 print(to_json(invoke(registry,request["name"],request["input"],context,{"policy":repository_review_policy,"audit":audit},visible)))
}
`,{mode:0o600});
const config={schema:'kujo.openai.local/v1',kujo:binary,entry,cwd:packageRoot,stateDirectory:join(directory,'receipts'),modulePaths:[packageRoot,join(packageRoot,'vendor/ability')],capabilities:['--allow-fs-read','--allow-fs-write','--allow-process-exec','--allow-clock'],timeoutMs:60000,maxConcurrent:2};
const path=join(directory,'config.json');await writeFile(path,JSON.stringify(config,null,2)+'\n',{mode:0o600});return path;

}

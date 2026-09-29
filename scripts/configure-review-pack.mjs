// Operator provisioning only. Product contracts and handlers live in Ability.
import {writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
if(!process.argv[2]) throw Error('Usage: node scripts/configure-review-pack.mjs /absolute/trusted/repository');
const repository=await realpath(process.argv[2]);
const binary=await realpath(process.env.KUJO_BIN || execFileSync('which',['kujo'],{encoding:'utf8'}).trim());
const git=await realpath(execFileSync('which',['git'],{encoding:'utf8'}).trim());
if(execFileSync(git,['-C',repository,'rev-parse','--show-toplevel'],{encoding:'utf8'}).trim()!==repository) throw Error('Select a Git worktree root');
const revisions={'patchbrief.kujo':'a4da5942e9668924cd2f2869859bf05b006edda5','changebucket.kujo':'030eea63c60449f82c9ba2680227485d318fdb6d'};
const sources={};
for(const product of ['patchbrief','changebucket']) {
 const source=await realpath(process.env[`KUJO_${product.toUpperCase()}_SOURCE`] || `../${product}`);
 if(execFileSync(git,['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==revisions[`${product}.kujo`] || execFileSync(git,['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim()) throw Error(`${product} must match reviewed clean revision ${revisions[`${product}.kujo`]}`);
 sources[product]=source;
}
const directory=resolve('.local/repository-review');await mkdir(directory,{recursive:true,mode:0o700});
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
const config={schema:'kujo.openai.local/v1',kujo:binary,entry,cwd:resolve('.'),stateDirectory:join(directory,'receipts'),modulePaths:[resolve('.'),resolve('vendor/ability')],capabilities:['--allow-fs-read','--allow-fs-write','--allow-process-exec','--allow-clock'],timeoutMs:60000,maxConcurrent:2};
const path=join(directory,'config.json');await writeFile(path,JSON.stringify(config,null,2)+'\n',{mode:0o600});console.log(path);

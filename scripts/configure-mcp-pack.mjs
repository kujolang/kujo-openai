// Operator-run integration of an existing canonical pack; no product handlers.
import {writeFile,mkdir,realpath,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const source=await realpath(process.argv[2] || '../mcp');
const binary=await realpath(process.env.KUJO_BIN || execFileSync('which',['kujo'],{encoding:'utf8'}).trim());
const expected='a7ec0dd8e6bcae303ab1431b4586dfe3e91f3a5a';
if (execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==expected || execFileSync('git',['-C',source,'status','--porcelain','--','packs/mcp_core','src/make'],{encoding:'utf8'}).trim()) throw Error('MCP source must match the reviewed clean revision '+expected);
const directory=resolve('.local/mcp-core');await mkdir(directory,{recursive:true,mode:0o700});
const audit=join(directory,'audit');await mkdir(audit,{mode:0o700,recursive:true});
const entry=join(directory,'provider.kujo');
const code=`from packs.mcp_core.runtime import create_mcp_core_ability_registry, mcp_core_policy
from vendor.ability.ability import list_ability_definitions, register_ability_exposure
from src.projection import discover, invoke
func visible(entry, context) {return true}
func audit(phase, invocation, payload) {
 name := invocation["invocation_id"] + "-" + phase + ".json"
 write_file_atomic_beneath(${JSON.stringify(audit)}, name, to_json(payload), false)
 return {"ok":true,"event_id":name}
}
created := create_mcp_core_ability_registry(${JSON.stringify(source)})
assert(created["ok"],"registry unavailable")
registry := created["registry"]
for entry in list_ability_definitions(registry,"sdk") {
 exposure := entry["exposure"]
 exposure["surface"] := "mcp"
 step := register_ability_exposure(registry,exposure)
 assert(step["ok"],"exposure rejected")
 registry = step["registry"]
}
request := parse_json(read_stdin(1048576))
context := {"principal":{"type":"workload","id":"mcp-core-operator","tenant_id":"local","claims":{}},"invocation_id":"discovery"}
if request["operation"] == "discover" {print(to_json(discover(registry,context,visible)))} else {
 context["invocation_id"] := request["invocation_id"]
 print(to_json(invoke(registry,request["name"],request["input"],context,{"policy":mcp_core_policy,"audit":audit},visible)))
}
`;
await writeFile(entry,code,{mode:0o600});
const config={schema:'kujo.openai.local/v1',kujo:binary,entry,cwd:source,stateDirectory:join(directory,'receipts'),modulePaths:[resolve('.'),source,resolve('vendor/ability')],capabilities:['--allow-fs-read','--allow-fs-write','--allow-clock'],maxConcurrent:4,timeoutMs:30000};
const path=join(directory,'config.json');await writeFile(path,JSON.stringify(config,null,2)+'\n',{mode:0o600});
console.log(path);

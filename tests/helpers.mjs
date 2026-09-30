import {resolveKujoBinary} from '@kujolang/kujo-runtime';
import {execFileSync} from 'node:child_process';
import {mkdtemp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {ProcessBackend} from '../lib/backend.mjs';
import {ReceiptStore} from '../lib/receipts.mjs';
import {Adapter} from '../lib/adapter.mjs';
export const root=resolve('.');
export const kujo=process.env.KUJO_BIN || resolveKujoBinary();
export async function fixture(overrides={}) {
 const directory=await realpath(await mkdtemp(join(tmpdir(),'kujo-openai-')));
 const config={kujo,entry:join(root,'tests/provider.kujo'),cwd:root,stateDirectory:directory,modulePaths:[],capabilities:['--allow-clock'],maxConcurrent:4,timeoutMs:30000,...overrides};
 const backend=new ProcessBackend(config),store=new ReceiptStore(directory);await store.init();
 return {adapter:new Adapter(backend,store),backend,store,directory,config};
}

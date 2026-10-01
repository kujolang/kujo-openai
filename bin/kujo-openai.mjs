#!/usr/bin/env node
import {loadBackend} from '../lib/backend.mjs';
import {ReceiptStore} from '../lib/receipts.mjs';
import {join} from 'node:path';
import {ContinuationStore} from '../lib/continuations.mjs';
import {Adapter} from '../lib/adapter.mjs';
import {createServer} from '../lib/server.mjs';
import {BoundedStdioTransport} from '../lib/transport.mjs';
import {setupLocal,configuredProject} from '../lib/setup.mjs';
try {
 if(process.argv[2]==='setup') {
  if(process.argv.length>4)throw new Error('invalid_setup_arguments');
  console.log(JSON.stringify(await setupLocal({repository:process.argv[3]||process.cwd()}),null,2));
 } else {
 const backend=await loadBackend(process.env.KUJO_OPENAI_CONFIG||await configuredProject());
 const receipts=new ReceiptStore(backend.config.stateDirectory);await receipts.init();
 const continuations=new ContinuationStore(join(backend.config.stateDirectory,'continuations'));await continuations.init();
 const adapter=new Adapter(backend,receipts,continuations);
 if (process.argv[2] === 'catalog') {console.log(JSON.stringify({tools:await adapter.discover(),unsupported:adapter.unsupported},null,2));}
 else if (!process.argv[2] || process.argv[2] === 'serve') {await createServer(adapter).connect(new BoundedStdioTransport());}
 else {throw new Error('unsupported_command');}
 }
} catch(error) {
 const messages={receipt_storage_durability_unavailable:'This filesystem cannot provide the required durable receipt storage. Windows storage support is not yet available; no Ability was executed.',project_setup_required:'Run kujo-openai setup once from the repository you want to use.',required_executable_unavailable:'Git must be installed and available on PATH.',setup_in_progress_or_stale_lock:'Another setup is running, or an interrupted setup left a lock. Inspect the Kujo data directory before removing that lock.'};
 process.stderr.write((messages[error.message]||'Kujo OpenAI failed; verify the trusted installation and configuration.')+'\n');process.exitCode=1;
}

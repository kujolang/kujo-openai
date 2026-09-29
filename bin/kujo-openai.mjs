#!/usr/bin/env node
import {loadBackend} from '../lib/backend.mjs';
import {ReceiptStore} from '../lib/receipts.mjs';
import {Adapter} from '../lib/adapter.mjs';
import {createServer} from '../lib/server.mjs';
import {BoundedStdioTransport} from '../lib/transport.mjs';
try {
 const backend=await loadBackend(process.env.KUJO_OPENAI_CONFIG);
 const receipts=new ReceiptStore(backend.config.stateDirectory);await receipts.init();
 const adapter=new Adapter(backend,receipts);
 if (process.argv[2] === 'catalog') {console.log(JSON.stringify({tools:await adapter.discover(),unsupported:adapter.unsupported},null,2));}
 else if (!process.argv[2] || process.argv[2] === 'serve') {await createServer(adapter).connect(new BoundedStdioTransport());}
 else {throw new Error('unsupported_command');}
} catch {process.stderr.write('Kujo OpenAI failed; check the operator configuration and installed runtime.\n');process.exitCode=1;}

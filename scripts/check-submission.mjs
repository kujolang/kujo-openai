import {readFile} from 'node:fs/promises';
import {preinstalledReadiness} from '../lib/submission-readiness.mjs';
// Neither success evidence nor approval is inferred from a manifest or env var.
const result=preinstalledReadiness({mcp:JSON.parse(await readFile(new URL('../mcp.json',import.meta.url)))});
console.log(JSON.stringify(result,null,2));
process.exitCode=result.ready?0:1;

import {randomUUID, createHash} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import {BoundaryError} from './backend.mjs';
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export const toolName = (id, version) => `${id.replaceAll('.', '_').slice(0,26)}_${createHash('sha256').update(`${id}@${version}`).digest('hex').slice(0,32)}`;
export class Adapter {
 constructor(backend, receipts) {this.backend = backend; this.receipts = receipts; this.tools = new Map();}
 async discover(signal) {
  const result = await this.backend.request({operation:'discover'}, signal);
  if (result?.ok !== true || result.schema !== 'kujo.openai.catalog/v1' || !Array.isArray(result.tools) || result.tools.length > 256 || !Array.isArray(result.unsupported)) throw new BoundaryError('invalid_catalog');
  const next = new Map();
  const ajv = new Ajv({strict:false, allErrors:false, validateFormats:false, loadSchema:undefined});
  for (const tool of result.tools) {
   const m = tool?._meta;
   if (!object(m) || typeof m['kujo/abilityId'] !== 'string' || typeof m['kujo/abilityVersion'] !== 'string' || !/^[a-f0-9]{64}$/.test(m['kujo/definitionDigest'] || '') || tool.name !== toolName(m['kujo/abilityId'], m['kujo/abilityVersion']) || next.has(tool.name)) throw new BoundaryError('invalid_catalog_identity');
   if (typeof tool.description !== 'string' || tool.inputSchema?.type !== 'object' || tool.outputSchema?.type !== 'object') throw new BoundaryError('invalid_catalog_schema');
   // Compilation is a protocol compatibility check. Canonical Ability owns validation.
   let validateOutput;
   try {ajv.compile(tool.inputSchema); validateOutput = ajv.compile(tool.outputSchema);} catch {throw new BoundaryError('unsupported_host_schema');}
   next.set(tool.name, {tool:structuredClone(tool), validateOutput});
  }
  this.tools = next;
  this.unsupported = structuredClone(result.unsupported);
  return [...next.values()].map(x => x.tool);
 }
 async call(name, input, signal) {
  if (!object(input)) throw new BoundaryError('invalid_arguments');
  // Re-resolve discovery each time; revocation never depends on a stale host cache.
  await this.discover(signal);
  const selected = this.tools.get(name);
  if (!selected) throw new BoundaryError('ability_tool_not_available');
  const invocationId = randomUUID();
  const result = await this.backend.request({operation:'invoke', name, input, invocation_id:invocationId}, signal);
  const receipt = result?.receipt, meta = selected.tool._meta;
  if (!receipt) {
   if (result?.ok !== false || typeof result.code !== 'string') throw new BoundaryError('invalid_execution_response', true);
   return {isError:true, content:[{type:'text',text:JSON.stringify({ok:false, status:'completion_uncertain', code:result.code})}]};
  }
  if (receipt.schema !== 'kujo.ability.receipt/v1' || receipt.invocation_id !== invocationId || receipt.ability_id !== meta['kujo/abilityId'] || receipt.ability_version !== meta['kujo/abilityVersion'] || receipt.definition_digest !== meta['kujo/definitionDigest'] || receipt.surface !== 'mcp' || !['succeeded','failed','rejected','approval_required','in_progress','cancelled','timed_out'].includes(receipt.status) || typeof receipt.receipt_id !== 'string' || !Number.isInteger(receipt.started_at_ms) || !Number.isInteger(receipt.completed_at_ms) || receipt.completed_at_ms < receipt.started_at_ms) throw new BoundaryError('receipt_identity_invalid', true);
  const success = receipt.status === 'succeeded';
  if (result.ok !== success || (success && !selected.validateOutput(receipt.result))) throw new BoundaryError('receipt_result_invalid', true);
  const uri = await this.receipts.put(receipt);
  const summary = {ok:success, status:receipt.status, ability_id:receipt.ability_id, receipt_id:receipt.receipt_id, receipt_uri:uri, ...(receipt.error ? {error:receipt.error} : {})};
  return {isError:!success, content:[{type:'text',text:JSON.stringify(summary)}, ...(success ? [{type:'text',text:JSON.stringify(receipt.result)}] : [])], ...(success ? {structuredContent:receipt.result} : {}), _meta:{'kujo/receiptUri':uri, 'kujo/invocationId':invocationId}};
 }
}
export function toolFailure(error) {
 const known = error instanceof BoundaryError;
 return {isError:true, content:[{type:'text',text:JSON.stringify({ok:false, status:known && !error.uncertain ? 'not_executed' : 'completion_uncertain', code:known ? error.code : 'internal_failure'})}]};
}

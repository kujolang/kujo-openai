import {ReceiptStore} from './receipts.mjs';
import {BoundaryError} from './backend.mjs';
export const RESUME_TOOL = {
 name:'_kujo_resume_invocation',title:'Resume a pending Kujo invocation',
 description:'Ask the application to resume or reconcile an existing invocation using its saved reference. This does not approve execution. The application must independently enforce the original identity, input, policy, approval and retry contract.',
 inputSchema:{type:'object',required:['reference'],properties:{reference:{type:'string',pattern:'^kujo-continuation://sha256/[a-f0-9]{64}$'}},additionalProperties:false},
 annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:true,idempotentHint:false}
};
export class ContinuationStore {
 constructor(root){this.store=new ReceiptStore(root);}
 async init(){await this.store.init();}
 async put(value){return (await this.store.put({schema:'kujo.openai.continuation/v1',...value})).replace('kujo-receipt:','kujo-continuation:');}
 async read(reference){
  if(typeof reference!=='string'||!/^kujo-continuation:\/\/sha256\/[a-f0-9]{64}$/.test(reference))throw new BoundaryError('invalid_continuation_reference');
  let value;
  try {value=await this.store.read(reference.replace('kujo-continuation:','kujo-receipt:'));}catch{throw new BoundaryError('continuation_unavailable');}
  if(!value || value.schema!=='kujo.openai.continuation/v1'||typeof value.name!=='string'||typeof value.invocationId!=='string'||!/^[-a-f0-9]{36}$/.test(value.invocationId)||!value.meta)throw new BoundaryError('invalid_continuation');
  return value;
 }
}

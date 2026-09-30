import {BoundaryError} from './backend.mjs';
export const EVIDENCE_NAME='_kujo_receipt_evidence';
// Host infrastructure: makes the existing receipt resource surface available to
// clients that retain structuredContent but omit text content or resource APIs.
export function evidenceTool(adapter) {
 return {name:EVIDENCE_NAME,title:'Inspect Kujo execution receipts',
  description:'Retrieve canonical evidence for completed Kujo calls without rerunning them. With receipt_uri, read that exact receipt. Without it, list up to 32 receipts retained by this receipt-store instance, newest first. This is an operator/principal-scoped index, not a chat-specific or exhaustive history; it can be empty after restart. Match ability ID and invocation/timestamps, never assume the newest receipt belongs to this chat.',
  inputSchema:{type:'object',properties:{receipt_uri:{type:'string',pattern:'^kujo-receipt://sha256/[a-f0-9]{64}$'}},additionalProperties:false},
  outputSchema:{type:'object',properties:{kind:{enum:['recent','receipt']},receipts:{type:'array',items:{type:'object'}},receipt:{type:'object'},receipt_uri:{type:'string'},scope:{type:'string'}},required:['kind'],additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  ...(adapter.evidenceSecuritySchemes?{securitySchemes:adapter.evidenceSecuritySchemes,_meta:{securitySchemes:adapter.evidenceSecuritySchemes}}:{})};
}
export async function receiptEvidence(adapter,args) {
 if (!args || typeof args!=='object' || Array.isArray(args) || Object.keys(args).some(k=>k!=='receipt_uri') || ('receipt_uri' in args && (typeof args.receipt_uri!=='string'||!/^kujo-receipt:\/\/sha256\/[a-f0-9]{64}$/.test(args.receipt_uri)))) throw new BoundaryError('invalid_evidence_arguments');
 let result;
 try {
  if(args.receipt_uri) result={kind:'receipt',receipt_uri:args.receipt_uri,receipt:await adapter.receipts.read(args.receipt_uri)};
  else {
   const uris=await adapter.receipts.recent();
   if(!Array.isArray(uris)||uris.length>32)throw Error('Invalid index');
   const receipts=[];
   for(const uri of uris){const receipt=await adapter.receipts.read(uri);receipts.push({receipt_uri:uri,...Object.fromEntries(['receipt_id','ability_id','ability_version','invocation_id','status','started_at_ms','completed_at_ms'].map(k=>[k,receipt[k]]))});}
   result={kind:'recent',scope:'receipt-store-instance; not chat-specific; maximum 32; resets on store restart',receipts};
  }
 } catch {throw new BoundaryError('receipt_evidence_unavailable');}
 return {isError:false,structuredContent:result,content:[{type:'text',text:JSON.stringify(result)}]};
}

import {isDeepStrictEqual} from 'node:util';
import {Adapter} from './adapter.mjs';
import {BoundaryError} from './backend.mjs';
// Deployment certification is additional to canonical policy, never a grant.
export function createRemoteAdapter({backend,receipts,approvedDigests},identity,requestSignal) {
 if(!backend?.request||!receipts?.put||!receipts?.read||!Array.isArray(approvedDigests)||approvedDigests.some(d=>!/^([a-f0-9]{64})$/.test(d)))throw new BoundaryError('invalid_remote_binding');
 const approved=new Set(approvedDigests);
 const principal={type:'user',id:identity.subject,tenant_id:identity.tenant,claims:{issuer:identity.issuer,scopes:[...identity.scopes]}};
 const owns=receipt=>receipt?.principal?.type===principal.type&&receipt.principal.id===principal.id&&receipt.principal.tenant_id===principal.tenant_id&&receipt.principal.claims?.issuer===identity.issuer;
 const provider={request:async(request,signal)=>{
  const combined=AbortSignal.any([requestSignal,...(signal?[signal]:[])]);
  if(request.operation==='resume')throw new BoundaryError('remote_continuation_unsupported');
  const result=await backend.request({...request,trusted_context:{principal:structuredClone(principal)}},combined);
  if(request.operation==='discover') {
   if(result?.capabilities?.authenticated_context!=='principal-v1'||!Array.isArray(result.tools))throw new BoundaryError('authenticated_provider_required');
   const tools=[],unsupported=[...(result.unsupported||[])];
   for(const tool of result.tools) {
    const meta=tool?._meta;
    if(approved.has(meta?.['kujo/definitionDigest'])&&Array.isArray(meta['kujo/effects'])&&meta['kujo/effects'].every(effect=>effect.kind==='read')&&meta['kujo/semantics']?.executes_code===false&&meta['kujo/semantics']?.open_world===false&&meta['kujo/semantics']?.destructive===false){
     const securitySchemes=[{type:'oauth2',scopes:['mcp:read','ability:invoke']}];
     tools.push({...tool,securitySchemes,_meta:{...meta,securitySchemes}});
    }
    else unsupported.push({ability_id:meta?.['kujo/abilityId'],version:meta?.['kujo/abilityVersion'],code:'unsupported_remote_execution_profile'});
   }
   return {...result,tools,unsupported,capabilities:{authenticated_context:'principal-v1'}};
  }
  if(result?.receipt&&!isDeepStrictEqual(result.receipt.principal,principal))throw new BoundaryError('remote_receipt_principal_mismatch',true);
  return result;
 }};
 const scopedReceipts={
  async put(receipt){if(!owns(receipt))throw new BoundaryError('remote_receipt_principal_mismatch',true);return receipts.put(receipt);},
  async read(uri){const receipt=await receipts.read(uri);if(!owns(receipt))throw new BoundaryError('receipt_unavailable');return receipt;}
 };
 if (typeof receipts.recent==='function') scopedReceipts.recent=async()=>{
  const uris=await receipts.recent();
  if(!Array.isArray(uris)||uris.length>32)throw new BoundaryError('invalid_receipt_index');
  const visible=[];for(const uri of uris){if(owns(await receipts.read(uri)))visible.push(uri);}return visible;
 };
 const adapter=new Adapter(provider,scopedReceipts);
 adapter.evidenceSecuritySchemes=[{type:'oauth2',scopes:['mcp:read','ability:invoke']}];
 return adapter;
}

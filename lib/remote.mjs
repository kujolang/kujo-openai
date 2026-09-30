import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {createServer} from './server.mjs';
import {createRemoteAdapter} from './remote-adapter.mjs';
import {AuthenticationError,httpsURL,boundedJSON} from './oauth.mjs';
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'cache-control':'no-store',...headers}});
// Embeddable resource server. The operator supplies authenticated, isolated canonical adapters.
// This entry point deliberately does not load the local stdio configuration.
export function createRemoteHandler({resource,issuer,verifyToken,createBinding,allowedOrigins=[],maxConcurrent=16,maxBodyBytes=1048576,requestTimeoutMs=60000}) {
 const endpoint=httpsURL(resource);httpsURL(issuer);
 if(typeof verifyToken!=='function'||typeof createBinding!=='function'||!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>128||!Number.isInteger(maxBodyBytes)||maxBodyBytes<1024||maxBodyBytes>1048576)throw new Error('Invalid remote configuration');
 if(!Number.isInteger(requestTimeoutMs)||requestTimeoutMs<10||requestTimeoutMs>120000)throw new Error('Invalid request timeout');
 const origins=new Set(allowedOrigins.map(value=>httpsURL(value).origin));
 const metadata=new URL(`/.well-known/oauth-protected-resource${endpoint.pathname==='/'?'':endpoint.pathname}`,endpoint.origin).href;
 const challenge=(code,scope)=>`Bearer resource_metadata="${metadata}", error="${code}", error_description="A valid access token with the required scope is needed", scope="${scope}"`;
 let active=0;
 return async request=>{
  const url=new URL(request.url);
  if(request.method==='GET'&&url.href===metadata)return json({resource,authorization_servers:[issuer],scopes_supported:['mcp:read','ability:invoke'],bearer_methods_supported:['header']});
  if(url.href!==resource)return json({error:'not_found'},404);
  const origin=request.headers.get('origin');
  if(origin&&!origins.has(origin))return json({error:'origin_not_allowed'},403);
  if(active>=maxConcurrent)return json({error:'capacity_exceeded'},429,{'retry-after':'1'});
  active++;
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(requestTimeoutMs)]);
  let server,transport;
  try {
   const header=request.headers.get('authorization')||'';
   if(header.length>8192||!/^Bearer [A-Za-z0-9\-._~+/]+=*$/i.test(header))throw new AuthenticationError();
   // The verifier, not RPC arguments or headers claiming a user, establishes identity.
   const auth=await verifyToken(header.slice(7),signal);
   if(!auth||typeof auth.subject!=='string'||!auth.subject||typeof auth.tenant!=='string'||!auth.tenant||auth.issuer!==issuer||!Number.isSafeInteger(auth.expiresAt)||auth.expiresAt<=Math.floor(Date.now()/1000)||!Array.isArray(auth.scopes))throw new AuthenticationError();
   if(!auth.scopes.includes('mcp:read'))throw new AuthenticationError('insufficient_scope',403);
   if(request.method!=='POST')return json({error:'method_not_allowed'},405,{allow:'POST'});
   if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json({error:'unsupported_media_type'},415);
   let body;
   try {body=await boundedJSON(request,maxBodyBytes,AbortSignal.any([signal,AbortSignal.timeout(10000)]));}catch{return json({error:'invalid_or_oversized_body'},400);}
   if(!body||Array.isArray(body)||typeof body!=='object')return json({error:'invalid_request'},400);
   if(body.method==='tools/call'&&!auth.scopes.includes('ability:invoke')) {
    if(body.jsonrpc==='2.0'&&(typeof body.id==='string'||typeof body.id==='number'))return json({jsonrpc:'2.0',id:body.id,result:{isError:true,content:[{type:'text',text:JSON.stringify({ok:false,status:'not_executed',code:'insufficient_scope'})}],_meta:{'mcp/www_authenticate':[challenge('insufficient_scope','mcp:read ability:invoke')]}}});
    throw new AuthenticationError('insufficient_scope',403);
   }
   // No bearer credential is passed to the SDK, adapter, native provider or receipts.
   const identity=Object.freeze({subject:auth.subject,tenant:auth.tenant,issuer:auth.issuer,scopes:Object.freeze([...auth.scopes])});
   const binding=await createBinding(identity,signal);
   const adapter=createRemoteAdapter(binding,identity,signal);
   transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxRequestBodySize:maxBodyBytes});
   server=createServer(adapter);await server.connect(transport);
   const headers=new Headers({'content-type':'application/json',accept:request.headers.get('accept')||''});
   const version=request.headers.get('mcp-protocol-version');if(version)headers.set('mcp-protocol-version',version);
   const sanitized=new Request(resource,{method:'POST',headers,signal});
   return await transport.handleRequest(sanitized,{parsedBody:body});
  }catch(error){
   if(error instanceof AuthenticationError)return json({error:error.code},error.status,error.status===503?{}:{'www-authenticate':challenge(error.code,'mcp:read')});
   return json({error:'remote_request_failed'},500);
  }finally{await server?.close().catch(()=>{});active--;}
 };
}

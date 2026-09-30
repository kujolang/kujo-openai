// OAuth resource-server verification. Authorization-code/PKCE flows belong to the issuer.
export class AuthenticationError extends Error {
 constructor(code='invalid_token', status=401) {super(code);this.code=code;this.status=status;}
}
export function httpsURL(value) {
 const url=new URL(value);
 if(url.protocol!=='https:' || url.username || url.password || url.hash || url.search) throw new Error('HTTPS operator URL required');
 return url;
}
export async function boundedJSON(response, limit=16384, signal) {
 const reader=response.body?.getReader();if(!reader)throw new Error('Missing body');
 let size=0;const parts=[];
 let abort;
 const aborted=new Promise((_,reject)=>{abort=()=>reject(new Error('Read aborted'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});
 try {while(true){const {done,value}=await Promise.race([reader.read(),aborted]);if(done)break;size+=value.byteLength;if(size>limit)throw new Error('Body limit');parts.push(value);}}
 catch(error){void reader.cancel().catch(()=>{});throw error;}
 finally{signal?.removeEventListener('abort',abort);}
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
// Explicit issuer contract: RFC 7662 plus iss, aud, exp, sub and tenant_id.
// No positive cache: revocation is checked on every protected request.
export function createIntrospectionVerifier({issuer,resource,introspectionEndpoint,clientId,clientSecret,fetch:fetcher=fetch,timeoutMs=5000}) {
 for(const url of [issuer,resource,introspectionEndpoint]) httpsURL(url);
 if(typeof clientId!=='string'||!clientId||typeof clientSecret!=='string'||!clientSecret||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>10000)throw new Error('Invalid introspection configuration');
 const basic=Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64');
 return async (token,signal)=>{
  try {
   const deadline=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(signal?[signal]:[])]);
   const response=await fetcher(introspectionEndpoint,{method:'POST',redirect:'error',headers:{authorization:`Basic ${basic}`,'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body:new URLSearchParams({token,token_type_hint:'access_token'}),signal:deadline});
   if(!response.ok){await response.body?.cancel();throw new AuthenticationError('authentication_unavailable',503);}
   const data=await boundedJSON(response,16384,deadline);
   const now=Math.floor(Date.now()/1000),aud=Array.isArray(data.aud)?data.aud:[data.aud];
   const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\u0000-\u001f\u007f]/.test(value);
   if(data.active!==true||data.iss!==issuer||!aud.includes(resource)||!Number.isSafeInteger(data.exp)||data.exp<=now||(data.nbf!==undefined&&(!Number.isSafeInteger(data.nbf)||data.nbf>now))||!identifier(data.sub)||!identifier(data.tenant_id)||typeof data.scope!=='string'||data.scope.length>4096||!/^[\x21\x23-\x5b\x5d-\x7e ]*$/.test(data.scope)||String(data.token_type).toLowerCase()!=='bearer')throw new AuthenticationError();
   const scopes=Object.freeze([...new Set(data.scope.split(' ').filter(Boolean))]);
   return Object.freeze({subject:data.sub,tenant:data.tenant_id,scopes,expiresAt:data.exp,issuer});
  }catch(error){if(error instanceof AuthenticationError)throw error;throw new AuthenticationError('authentication_unavailable',503);}
 };
}

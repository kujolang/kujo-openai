import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {httpsURL} from './oauth.mjs';
// Loopback HTTP origin behind a trusted TLS terminator. Forwarded headers are never authority.
export function createRemoteHttpServer({handler,publicOrigin,allowedHosts}) {
 const origin=httpsURL(publicOrigin);
 if(origin.pathname!=='/'||typeof handler!=='function'||!Array.isArray(allowedHosts)||!allowedHosts.length||allowedHosts.some(host=>typeof host!=='string'||!/^[a-zA-Z0-9.:[\]-]+$/.test(host)))throw new Error('Invalid HTTP configuration');
 const hosts=new Set(allowedHosts.map(host=>host.toLowerCase()));
 const server=createServer({maxHeaderSize:16384,headersTimeout:10000,requestTimeout:120000,keepAliveTimeout:5000},async(req,res)=>{
  const reject=code=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store',connection:'close'});res.end(JSON.stringify({error:'request_rejected'}));};
  if(!hosts.has((req.headers.host||'').toLowerCase())||!req.url?.startsWith('/')||req.url.startsWith('//')||req.url.includes('\\'))return reject(400);
  // Node folds duplicate security headers; reject duplicates before constructing Web Headers.
  const counts=new Map();for(let i=0;i<req.rawHeaders.length;i+=2){const key=req.rawHeaders[i].toLowerCase();counts.set(key,(counts.get(key)||0)+1);}
  if(['host','authorization','origin','content-type','mcp-protocol-version'].some(key=>(counts.get(key)||0)>1))return reject(400);
  const controller=new AbortController();
  const disconnect=()=>{if(!res.writableFinished)controller.abort();};
  req.on('aborted',disconnect);res.on('close',disconnect);
  try {
   const headers=new Headers();for(let i=0;i<req.rawHeaders.length;i+=2)headers.append(req.rawHeaders[i],req.rawHeaders[i+1]);
   // The public origin is fixed by the operator, independent of Host/X-Forwarded-*.
   const request=new Request(origin.origin+req.url,{method:req.method,headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const response=await handler(request);
   if(controller.signal.aborted)return;
   res.writeHead(response.status,Object.fromEntries(response.headers));
   if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();
  }catch{if(!res.headersSent&&!res.destroyed)reject(500);else res.destroy();}
  finally{req.off('aborted',disconnect);res.off('close',disconnect);}
 });
 server.maxRequestsPerSocket=100;
 server.on('clientError',(_,socket)=>{if(socket.writable)socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');});
 return server;
}

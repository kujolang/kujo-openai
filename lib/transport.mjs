import {isDeepStrictEqual} from 'node:util';
import {JSONRPCMessageSchema, InitializeRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {LIMIT} from './backend.mjs';
// Bounded framing precedes official MCP protocol dispatch.
export class BoundedStdioTransport {
 constructor(input = process.stdin, output = process.stdout) {
  this.input=input; this.output=output; this.buffer=Buffer.alloc(0); this.discard=false;
  this.pending=new Set(); this.initialized=false; this.initializing=false; this.handshake=null; this.initializeId=undefined; this.initializeParams=null;
 }
 async start() {
  this.onData = chunk => {
   let start=0;
   for (let i=0;i<chunk.length;i++) if (chunk[i] === 10) {
    const part=chunk.subarray(start,i); start=i+1;
    if (!this.discard && this.buffer.length+part.length <= LIMIT) {
     const line=Buffer.concat([this.buffer,part]);
     if (line.length) this.accept(line);
    } else this.reject(-32600,'Request limit exceeded');
    this.buffer=Buffer.alloc(0);this.discard=false;
   }
   const tail=chunk.subarray(start);
   if (this.buffer.length+tail.length > LIMIT) {this.buffer=Buffer.alloc(0);this.discard=true;}
   else if (!this.discard) this.buffer=Buffer.concat([this.buffer,tail]);
  };
  this.onEnd=()=>this.onclose?.();
  this.input.on('data',this.onData);this.input.on('end',this.onEnd);
 }
 reject(code,message,id=null) {void this.send({jsonrpc:'2.0',id,error:{code,message}}).catch(()=>this.onerror?.(new Error('Transport write failed')));}
 accept(line) {
  let parsed;try {parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(line));} catch {this.reject(-32700,'Invalid JSON');return;}
  const checked=JSONRPCMessageSchema.safeParse(parsed);
  if (!checked.success) {this.reject(-32600,'Invalid request');return;}
  const request=checked.data;
  if ('method' in request && 'id' in request) {
   if (this.pending.has(request.id) || this.pending.size>=32) {this.reject(-32600,'Duplicate request or capacity exceeded');return;}
   if (request.method==='initialize') {
    if (this.handshake) {
     // A tunnel can reuse one stdio child for several host discovery handshakes.
     // Replay negotiation only: do not replace SDK client state or grant authority.
     const valid=InitializeRequestSchema.safeParse(request);
     if (!valid.success || request.params.protocolVersion!==this.initializeParams.protocolVersion || !isDeepStrictEqual(request.params.capabilities,this.initializeParams.capabilities)) {
      this.reject(-32600,'Initialization parameters changed; reconnect required',request.id);return;
     }
     void this.send({jsonrpc:'2.0',id:request.id,result:this.handshake}).catch(()=>this.onerror?.(new Error('Transport write failed')));return;
    }
    if (this.initializing) {this.reject(-32600,'Initialization in progress',request.id);return;}
    this.initializing=true;this.initializeId=request.id;this.initializeParams=structuredClone(request.params);
   } else if (!this.initialized) {this.reject(-32000,'Initialization required',request.id);return;}
   this.pending.add(request.id);
  }
  if (request.method==='notifications/initialized') {if (!this.handshake) return;this.initialized=true;}
  this.onmessage?.(request);
 }
 async send(message) {
  if ('id' in message && ('result' in message || 'error' in message)) {
   if (message.id===this.initializeId) {
    this.initializing=false;this.initializeId=undefined;
    if ('result' in message) this.handshake=structuredClone(message.result);
    else this.initializeParams=null;
   }
   this.pending.delete(message.id);
  }
  await new Promise((resolve,reject)=>this.output.write(JSON.stringify(message)+'\n', e=>e?reject(e):resolve()));
 }
 async close() {this.input.off('data',this.onData);this.input.off('end',this.onEnd);this.onclose?.();}
}

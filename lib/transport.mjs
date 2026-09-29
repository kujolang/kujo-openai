import {LIMIT} from './backend.mjs';
// Bounded framing in front of the official MCP protocol server.
export class BoundedStdioTransport {
 constructor(input = process.stdin, output = process.stdout) {this.input=input; this.output=output; this.buffer=Buffer.alloc(0); this.discard=false;}
 async start() {
  this.onData = chunk => {
   let start=0;
   for (let i=0;i<chunk.length;i++) if (chunk[i] === 10) {
    const part=chunk.subarray(start,i); start=i+1;
    if (!this.discard && this.buffer.length+part.length <= LIMIT) {
     const line=Buffer.concat([this.buffer,part]);
     if (line.length) {try {const message=JSON.parse(line.toString('utf8')); this.onmessage?.(message);} catch {this.send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});}}
    } else this.send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Request limit exceeded'}});
    this.buffer=Buffer.alloc(0);this.discard=false;
   }
   const tail=chunk.subarray(start);
   if (this.buffer.length+tail.length > LIMIT) {this.buffer=Buffer.alloc(0);this.discard=true;}
   else if (!this.discard) this.buffer=Buffer.concat([this.buffer,tail]);
  };
  this.onEnd=()=>this.onclose?.();
  this.input.on('data',this.onData);this.input.on('end',this.onEnd);
 }
 async send(message) {await new Promise((resolve,reject)=>this.output.write(JSON.stringify(message)+'\n', e=>e?reject(e):resolve()));}
 async close() {this.input.off('data',this.onData);this.input.off('end',this.onEnd);this.onclose?.();}
}

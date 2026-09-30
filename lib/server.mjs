import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {ListToolsRequestSchema, CallToolRequestSchema, ReadResourceRequestSchema, ListResourcesRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {BoundaryError} from './backend.mjs';
import {RESUME_TOOL} from './continuations.mjs';
import {toolFailure} from './adapter.mjs';
export function createServer(adapter) {
 const server = new Server({name:'kujo-openai',version:'0.1.0'}, {capabilities:{tools:{listChanged:false},resources:{}}});
 server.setRequestHandler(ListToolsRequestSchema, async (_, extra) => {const tools=await adapter.discover(extra.signal);return {tools:[...tools,...(adapter.resumeSupported ? [RESUME_TOOL] : [])]};});
 server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  try {if(request.params.name===RESUME_TOOL.name) {const args=request.params.arguments;if(!args||Object.keys(args).length!==1||typeof args.reference!=='string')throw new BoundaryError('invalid_continuation_arguments');return await adapter.resume(args.reference,extra.signal);}return await adapter.call(request.params.name, request.params.arguments ?? {}, extra.signal);}
  catch (error) {return toolFailure(error);}
 });
 server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources:[]}));
 server.setRequestHandler(ReadResourceRequestSchema, async request => {
  try {const receipt=await adapter.receipts.read(request.params.uri); return {contents:[{uri:request.params.uri,mimeType:'application/json',text:JSON.stringify(receipt)}]};}
  catch {throw new Error('Receipt unavailable');}
 });
 return server;
}

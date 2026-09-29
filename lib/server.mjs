import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {ListToolsRequestSchema, CallToolRequestSchema, ReadResourceRequestSchema, ListResourcesRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {toolFailure} from './adapter.mjs';
export function createServer(adapter) {
 const server = new Server({name:'kujo-openai',version:'0.1.0'}, {capabilities:{tools:{listChanged:false},resources:{}}});
 server.setRequestHandler(ListToolsRequestSchema, async (_, extra) => ({tools:await adapter.discover(extra.signal)}));
 server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  try {return await adapter.call(request.params.name, request.params.arguments ?? {}, extra.signal);}
  catch (error) {return toolFailure(error);}
 });
 server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources:[]}));
 server.setRequestHandler(ReadResourceRequestSchema, async request => {
  try {const receipt=await adapter.receipts.read(request.params.uri); return {contents:[{uri:request.params.uri,mimeType:'application/json',text:JSON.stringify(receipt)}]};}
  catch {throw new Error('Receipt unavailable');}
 });
 return server;
}

#!/usr/bin/env node
// Operator application module, never model input. No default provider or public listener.
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRemoteHttpServer} from '../lib/http-server.mjs';
try {
 const path=process.argv[2];if(process.argv.length!==3||!path||!isAbsolute(path))throw new Error('configuration');
 const {default:options}=await import(pathToFileURL(path).href);
 if(!options||!Number.isInteger(options.port)||options.port<1024||options.port>65535)throw new Error('configuration');
 const server=createRemoteHttpServer(options);
 server.listen(options.port,'127.0.0.1',()=>process.stderr.write(`Kujo remote origin listening on loopback port ${options.port}\n`));
 server.on('error',()=>{process.stderr.write('Remote listener failed\n');process.exitCode=1;});
 const shutdown=()=>{server.close();server.closeIdleConnections();const timer=setTimeout(()=>{server.closeAllConnections();},5000);timer.unref();};
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}catch{process.stderr.write('Remote startup failed: supply an absolute operator application module with handler, publicOrigin, allowedHosts and port\n');process.exitCode=1;}

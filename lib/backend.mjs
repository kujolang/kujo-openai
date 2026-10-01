import {spawn} from 'node:child_process';
import {readFile, realpath} from 'node:fs/promises';
import {isAbsolute,delimiter} from 'node:path';
export const LIMIT = 1024 * 1024;
export class BoundaryError extends Error {
 constructor(code, uncertain = false) { super(code); this.code = code; this.uncertain = uncertain; }
}
export async function loadBackend(path) {
 if (!path || !isAbsolute(path)) throw new BoundaryError('absolute_operator_config_required');
 const config = JSON.parse(await readFile(path, 'utf8'));
 const allowed = ['schema', 'kujo', 'entry', 'cwd', 'stateDirectory', 'timeoutMs', 'maxConcurrent', 'capabilities', 'modulePaths', 'secretEnvironment'];
 if (!config || config.schema !== 'kujo.openai.local/v1' || Object.keys(config).some(k => !allowed.includes(k))) throw new BoundaryError('invalid_operator_config');
 for (const key of ['kujo', 'entry', 'cwd', 'stateDirectory']) if (typeof config[key] !== 'string' || !isAbsolute(config[key])) throw new BoundaryError('absolute_operator_paths_required');
 for (const key of ['kujo', 'entry', 'cwd']) config[key] = await realpath(config[key]);
 const flags = ['--allow-fs-read', '--allow-fs-write', '--allow-clock', '--allow-random', '--allow-process-exec', '--allow-net-client', '--allow-env-read', '--allow-database'];
 if (!Array.isArray(config.capabilities) || config.capabilities.some(x => !flags.includes(x))) throw new BoundaryError('invalid_capabilities');
 if (config.modulePaths !== undefined && (!Array.isArray(config.modulePaths) || config.modulePaths.some(x => typeof x !== 'string' || !isAbsolute(x)))) throw new BoundaryError('invalid_module_paths');
 if (config.secretEnvironment !== undefined && (!Array.isArray(config.secretEnvironment) || config.secretEnvironment.some(x => typeof x !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(x)))) throw new BoundaryError('invalid_secret_configuration');
 config.timeoutMs ??= 30000; config.maxConcurrent ??= 4;
 if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 10 || config.timeoutMs > 120000 || !Number.isInteger(config.maxConcurrent) || config.maxConcurrent < 1 || config.maxConcurrent > 16) throw new BoundaryError('invalid_limits');
 return new ProcessBackend(config);
}
export class ProcessBackend {
 #active = 0;
 constructor(config) { this.config = Object.freeze(structuredClone(config)); }
 async request(request, signal) {
  if (signal?.aborted) throw new BoundaryError('cancelled_before_execution');
  if (this.#active >= this.config.maxConcurrent) throw new BoundaryError('capacity_exceeded');
  const raw = JSON.stringify(request);
  if (Buffer.byteLength(raw) > LIMIT) throw new BoundaryError('input_too_large');
  this.#active++;
  try { return await this.#run(raw, signal, ['invoke','resume'].includes(request.operation)); }
  finally { this.#active--; }
 }
 #run(raw, signal, execution) {
  return new Promise((resolve, reject) => {
   const env = {PATH: process.env.PATH || '', KUJO_MODULE_PATH: (this.config.modulePaths || []).join(delimiter)};
   const secrets = [];
   for (const key of this.config.secretEnvironment || []) {
    if (!process.env[key]) { reject(new BoundaryError('required_secret_missing')); return; }
    env[key] = process.env[key]; secrets.push(env[key]);
   }
   const child = spawn(this.config.kujo, ['run', this.config.entry, '--untrusted', ...this.config.capabilities], {cwd:this.config.cwd, env, detached:process.platform !== 'win32', stdio:['pipe','pipe','pipe'], shell:false});
   let output = [], size = 0, failure = null, escalation;
   const stop = code => {
    if (failure) return;
    failure = new BoundaryError(code, execution);
    // Kujo's POSIX handler cancels its own isolated subprocess groups. SIGKILL
    // would bypass that cleanup and leave canonical tool processes running.
    try { child.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM'); } catch {}
    escalation = setTimeout(() => {
     try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {}
     // Detached descendants can retain pipes. Bound the host wait without
     // claiming their termination or turning uncertain execution into success.
     child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
     clearTimeout(timer); signal?.removeEventListener('abort', abort);
     reject(failure);
    }, 500);
   };
   const abort = () => stop('execution_cancelled_uncertain');
   const timer = setTimeout(() => stop('execution_timeout_uncertain'), this.config.timeoutMs);
   signal?.addEventListener('abort', abort, {once:true});
   if (signal?.aborted) abort();
   child.stdout.on('data', b => {size += b.length; if (size > LIMIT) stop('provider_output_too_large'); else output.push(b);});
   // Diagnostics count toward the limit, but never reach public output or logs.
   child.stderr.on('data', b => {size += b.length; if (size > LIMIT) stop('provider_output_too_large');});
   child.stdin.on('error', () => {});
   child.on('error', () => {failure ??= new BoundaryError('provider_start_failed');});
   child.on('close', code => {
    clearTimeout(timer); clearTimeout(escalation); signal?.removeEventListener('abort', abort);
    if (failure) return reject(failure);
    if (code !== 0) return reject(new BoundaryError('provider_failed', execution));
    const body = Buffer.concat(output).toString('utf8');
    if (secrets.some(s => body.includes(s) || body.includes(JSON.stringify(s).slice(1,-1)))) return reject(new BoundaryError('credential_output_rejected', execution));
    try { resolve(JSON.parse(body)); } catch { reject(new BoundaryError('invalid_provider_response', execution)); }
   });
   child.stdin.end(raw);
  });
 }
}

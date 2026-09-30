import {createHash} from 'node:crypto';
import {mkdir, open, lstat, realpath} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {constants} from 'node:fs';
import {BoundaryError, LIMIT} from './backend.mjs';
export class ReceiptStore {
 constructor(root) {this.root = resolve(root); this.recentUris = new Set();}
 async init() {
  await mkdir(this.root, {recursive:true, mode:0o700});
  if ((await lstat(this.root)).isSymbolicLink() || await realpath(this.root) !== this.root) throw new BoundaryError('unsafe_receipt_directory');
  const stat = await lstat(this.root);
  if (process.platform !== 'win32' && (stat.mode & 0o077)) throw new BoundaryError('receipt_directory_must_be_private');
 }
 async put(receipt) {
  const raw = JSON.stringify(receipt), digest = createHash('sha256').update(raw).digest('hex');
  if (Buffer.byteLength(raw) > LIMIT) throw new BoundaryError('receipt_too_large', true);
  const path = join(this.root, `${digest}.json`);
  let fd;
  try {fd = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); await fd.writeFile(raw); await fd.sync();}
  catch (error) {if (error.code !== 'EEXIST') throw new BoundaryError('receipt_persistence_failed', true); if (JSON.stringify(await this.read(`kujo-receipt://sha256/${digest}`)) !== raw) throw new BoundaryError('receipt_integrity_failed', true);}
  finally {await fd?.close();}
  const directory = await open(this.root, 'r'); try {await directory.sync();} finally {await directory.close();}
  const uri = `kujo-receipt://sha256/${digest}`;
  this.recentUris.delete(uri);this.recentUris.add(uri);
  if (this.recentUris.size > 32) this.recentUris.delete(this.recentUris.values().next().value);
  return uri;
 }
 // Bounded instance-local index, not a filesystem or cross-user search.
 async recent() {return [...this.recentUris].reverse();}
 async read(uri) {
  const match = /^kujo-receipt:\/\/sha256\/([a-f0-9]{64})$/.exec(uri);
  if (!match) throw new BoundaryError('invalid_receipt_reference');
  const fd = await open(join(this.root, `${match[1]}.json`), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
   const stat = await fd.stat(); if (!stat.isFile() || stat.size > LIMIT) throw new BoundaryError('invalid_receipt_file');
   const raw = await fd.readFile();
   if (createHash('sha256').update(raw).digest('hex') !== match[1]) throw new BoundaryError('receipt_integrity_failed');
   return JSON.parse(raw.toString('utf8'));
  } finally {await fd.close();}
 }
}

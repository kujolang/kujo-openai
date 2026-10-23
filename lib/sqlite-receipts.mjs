import {createHash} from 'node:crypto';
import {mkdir,lstat,realpath,open} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {BoundaryError,LIMIT} from './backend.mjs';

// Local, single-operator store. SQLite owns native locking and commit durability;
// no model input selects database paths, SQL, pragmas or extension loading.
export class SqliteReceiptStore {
 constructor(root){this.root=resolve(root);this.path=join(this.root,'receipts.sqlite');this.recentUris=new Set();}
 async checkPaths(){
  const root=await lstat(this.root);
  if(!root.isDirectory()||root.isSymbolicLink()||await realpath(this.root)!==this.root)throw new BoundaryError('unsafe_receipt_directory');
  if(process.platform!=='win32'&&(root.mode&0o077))throw new BoundaryError('receipt_directory_must_be_private');
  for(const suffix of ['','-journal','-wal','-shm']) {
   try {
    const stat=await lstat(this.path+suffix);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new BoundaryError('unsafe_receipt_file');
    if(process.platform!=='win32'&&(stat.mode&0o077))throw new BoundaryError('receipt_file_must_be_private');
   }catch(error){if(error.code!=='ENOENT')throw error;}
  }
 }
 async connect(){
  await this.checkPaths();
  const {DatabaseSync}=await import('node:sqlite');
  const db=new DatabaseSync(this.path,{allowExtension:false,enableDoubleQuotedStringLiterals:false});
  try {
   db.exec('PRAGMA busy_timeout=1000; PRAGMA trusted_schema=OFF; PRAGMA journal_mode=DELETE; PRAGMA synchronous=EXTRA; PRAGMA fullfsync=ON;');
   if(db.prepare('PRAGMA synchronous').get().synchronous!==3)throw new Error('durability');
   return db;
  }catch(error){db.close();throw error;}
 }
 async init(){
  await mkdir(this.root,{recursive:true,mode:0o700});await this.checkPaths();
  let file;
  try{file=await open(this.path,'wx',0o600);}catch(error){if(error.code!=='EEXIST')throw new BoundaryError('receipt_storage_durability_unavailable');}
  finally{await file?.close();}
  let db;
  try{db=await this.connect();db.exec('CREATE TABLE IF NOT EXISTS receipts (digest TEXT PRIMARY KEY NOT NULL, raw TEXT NOT NULL) WITHOUT ROWID;');}
  catch(error){if(error instanceof BoundaryError)throw error;throw new BoundaryError('receipt_storage_durability_unavailable');}
  finally{db?.close();}
 }
 async put(receipt){
  const raw=JSON.stringify(receipt);
  if(Buffer.byteLength(raw)>LIMIT)throw new BoundaryError('receipt_too_large',true);
  const digest=createHash('sha256').update(raw).digest('hex');let db;
  try {
   db=await this.connect();db.exec('BEGIN IMMEDIATE');
   const existing=db.prepare('SELECT CASE WHEN length(CAST(raw AS BLOB))<=? THEN raw ELSE NULL END AS raw FROM receipts WHERE digest=?').get(LIMIT,digest);
   if(existing&&existing.raw!==raw)throw new BoundaryError('receipt_integrity_failed',true);
   if(!existing)db.prepare('INSERT INTO receipts(digest,raw) VALUES (?,?)').run(digest,raw);
   db.exec('COMMIT');
  }catch(error){if(error instanceof BoundaryError)throw new BoundaryError(error.code,true);throw new BoundaryError('receipt_persistence_failed',true);}
  finally{db?.close();}
  const uri=`kujo-receipt://sha256/${digest}`;this.recentUris.delete(uri);this.recentUris.add(uri);
  if(this.recentUris.size>32)this.recentUris.delete(this.recentUris.values().next().value);
  return uri;
 }
 async read(uri){
  const match=typeof uri==='string'&&/^kujo-receipt:\/\/sha256\/([a-f0-9]{64})$/.exec(uri);
  if(!match)throw new BoundaryError('invalid_receipt_reference');let db;
  try {
   db=await this.connect();
   const row=db.prepare('SELECT raw FROM receipts WHERE digest=? AND length(CAST(raw AS BLOB))<=?').get(match[1],LIMIT);
   if(!row||typeof row.raw!=='string'||createHash('sha256').update(row.raw).digest('hex')!==match[1])throw new BoundaryError('receipt_integrity_failed');
   return JSON.parse(row.raw);
  }catch(error){if(error instanceof BoundaryError)throw error;throw new BoundaryError('receipt_integrity_failed');}
  finally{db?.close();}
 }
 async recent(){return [...this.recentUris].reverse();}
}

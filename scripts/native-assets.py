#!/usr/bin/env python3
"""Build-time only: embed reviewed source bytes. No end-user installation."""
import hashlib, json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'native/internal/bundle/assets'
files = {}
ability = json.loads((root/'vendor/LOCK.json').read_text())
for path, expected in ability['files'].items():
    body = (root/'vendor/ability'/path).read_bytes()
    if hashlib.sha256(body).hexdigest() != expected:
        raise SystemExit('canonical Ability integrity failure: '+path)
    files['vendor/ability/'+path] = body
mcp_lock_path = root/'native/mcp-source.json'
mcp_lock = json.loads(mcp_lock_path.read_text())
# Vendoring is a maintainer action from an exact reviewed Git revision only.
if '--vendor-mcp' in sys.argv:
    source = root.parent/'mcp'
    for path in mcp_lock['files']:
        body = subprocess.check_output(['git','-C',str(source),'show',mcp_lock['commit']+':'+path])
        dest = root/'vendor/mcp'/path
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(body)
        mcp_lock['files'][path] = hashlib.sha256(body).hexdigest()
    mcp_lock_path.write_text(json.dumps(mcp_lock,indent=2)+'\n')
for path, expected in mcp_lock['files'].items():
    body = (root/'vendor/mcp'/path).read_bytes()
    if hashlib.sha256(body).hexdigest() != expected:
        raise SystemExit('canonical MCP integrity failure: '+path)
    files['mcp/'+path] = body
files['src/projection.kujo'] = (root/'src/projection.kujo').read_bytes()
files['provider.kujo'] = (root/'native/internal/bundle/provider.kujo').read_bytes()
files['provenance.json'] = (json.dumps({'ability':ability,'mcp':mcp_lock},sort_keys=True,indent=2)+'\n').encode()
if '--verify' in sys.argv:
    actual = {p.relative_to(out).as_posix():p.read_bytes() for p in out.rglob('*') if p.is_file()}
    if files != actual: raise SystemExit('native assets drift; run python3 scripts/native-assets.py')
else:
    for path,body in files.items():
        dest = out/path
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(body)
print('Verified native source bundle: '+str(len(files))+' files' if '--verify' in sys.argv else 'Prepared native source bundle: '+str(len(files))+' files')

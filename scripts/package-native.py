#!/usr/bin/env python3
"""Build reviewable native adapter artifacts; never publish or install a runtime."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGETS = ('darwin/amd64', 'darwin/arm64', 'linux/amd64', 'linux/arm64', 'windows/amd64', 'windows/arm64')


def sha(body):
    return hashlib.sha256(body).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()


def objects(text):
    decoder = json.JSONDecoder()
    while text.strip():
        value, end = decoder.raw_decode(text.lstrip())
        yield value
        text = text.lstrip()[end:]


def run(args, env=None):
    return subprocess.check_output(args, cwd=ROOT/'native', env=env, text=True).strip()


def archive(path, files):
    # Fixed ordering, timestamps, mode and uncompressed bytes avoid dependence on
    # local timezone, filesystem metadata or zlib versions.
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_STORED) as target:
        for name, (body, mode) in sorted(files.items()):
            if name.startswith('/') or '..' in pathlib.PurePosixPath(name).parts or '\\' in name:
                raise ValueError('unsafe archive path')
            info = zipfile.ZipInfo(name, (2000, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (0o100000 | mode) << 16
            target.writestr(info, body)


def build(target, output):
    if target not in TARGETS:
        raise ValueError('unsupported target')
    system, architecture = target.split('/')
    env = {**os.environ, 'GOOS': system, 'GOARCH': architecture, 'CGO_ENABLED': '0',
           'GOWORK': 'off', 'GOFLAGS': '', 'GOTOOLCHAIN': 'local',
           'GOAMD64': 'v1', 'GOARM64': 'v8.0', 'GOEXPERIMENT': ''}
    version = json.loads((ROOT/'package.json').read_text())['version']
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version):
        raise ValueError('invalid package version')
    packages = list(objects(run(['go', 'list', '-mod=readonly', '-deps', '-json', './preflight'], env)))
    modules = {p['Module']['Path']: p['Module'] for p in packages if p.get('Module') and not p['Module'].get('Main')}
    files = {'LICENSE': ((ROOT/'LICENSE').read_bytes(), 0o644)}
    dependencies = []
    for name, module in sorted(modules.items()):
        if module.get('Replace') or not module.get('Sum') or not module.get('Dir'):
            raise ValueError('unverifiable dependency: ' + name)
        notices = []
        for path in sorted(pathlib.Path(module['Dir']).iterdir()):
            if path.is_file() and re.match(r'^(LICENSE|NOTICE|COPYING|COPYRIGHT|PATENTS)(\.|$)', path.name, re.I):
                body = path.read_bytes()
                entry = 'licenses/' + name + '/' + path.name
                files[entry] = (body, 0o644)
                notices.append({'path': entry, 'sha256': sha(body)})
        if not notices:
            raise ValueError('missing dependency license: ' + name)
        dependencies.append({'module': name, 'version': module['Version'], 'sum': module['Sum'], 'notices': notices})
    goroot = pathlib.Path(run(['go', 'env', 'GOROOT'], env))
    for name in ('LICENSE', 'PATENTS'):
        if (goroot/name).is_file():
            files['licenses/go/'+name] = ((goroot/name).read_bytes(), 0o644)
    for name in ('ability', 'mcp'):
        files['licenses/kujo-'+name+'/LICENSE'] = ((ROOT/'vendor'/name/'LICENSE').read_bytes(), 0o644)
    for name in ('kujo-logomark.svg', 'kujo-icon.png'):
        path = ROOT/'assets'/name
        files['assets/'+name] = (path.read_bytes(), 0o644)
    source_files = [p for p in (ROOT/'native').rglob('*') if p.is_file() and p.suffix in ('.go', '.mod', '.sum', '.json', '.kujo', '.md')]
    source_files += [ROOT/'scripts/package-native.py', ROOT/'scripts/native-assets.py', ROOT/'package.json', ROOT/'LICENSE']
    sources = {p.relative_to(ROOT).as_posix(): sha(p.read_bytes()) for p in sorted(source_files)}
    with tempfile.TemporaryDirectory(prefix='kujo-native-build-') as temporary:
        binary = pathlib.Path(temporary)/('kujo-openai-native.exe' if system == 'windows' else 'kujo-openai-native')
        run(['go', 'build', '-mod=readonly', '-trimpath', '-buildvcs=false', '-ldflags=-buildid=', '-o', str(binary), './preflight'], env)
        files[binary.name] = (binary.read_bytes(), 0o755)
    status = 'unverified_runtime_platform' if target == 'windows/arm64' else 'requires_host_acceptance'
    files['README.md'] = (('''# Kujo native adapter — local preview

Requires a separately installed Kujo 1.7.x runtime. Nothing in this archive
installs or downloads Kujo. No Node, npm, Git, API key or server is required.

Configure a supported local MCP client to launch the included executable with:

    --serve --project /absolute/path/to/project

Grant access through the host first. Explicit project selection is not an OS
sandbox. Only canonical read-only project profiling and MCP manifest validation
are bundled. Audit and receipt data remain in private per-project local state.

Official installation: https://github.com/kujolang/kujo/blob/main/docs/ECOSYSTEM_INSTALL.md
Source and support: https://github.com/kujolang/kujo-openai

This is a native adapter archive, NOT a Plugin Directory submission package.
Public local-MCP distribution, actual host folder permissions and live ChatGPT
acceptance remain unconfirmed. No publisher signature or notarization is supplied.
Windows x64 native execution is verified; Windows ARM64 execution is unverified.

Toolchain and dependencies, source digests and executable hash are recorded in
provenance.json. Checksums detect changed bytes; they do not authenticate a publisher.
''').encode(), 0o644)
    provenance = {'schema': 'kujo.openai.native-artifact/v1', 'version': version, 'target': target,
                  'publisher_signed': False, 'notarized': False, 'submission_ready': False,
                  'runtime_status': status, 'kujo_compatibility': '>=1.7.0 <1.8.0',
                  'go_version': run(['go', 'env', 'GOVERSION'], env), 'cgo_enabled': False,
                  'binary': binary.name, 'binary_sha256': sha(files[binary.name][0]),
                  'dependencies': dependencies, 'sources': sources,
                  'ability': json.loads((ROOT/'vendor/LOCK.json').read_text()),
                  'mcp': json.loads((ROOT/'native/mcp-source.json').read_text())}
    files['provenance.json'] = (encoded(provenance), 0o644)
    filename = f'kujo-openai-native-{version}-{system}-{architecture}.zip'
    output.mkdir(parents=True, exist_ok=True)
    destination = output/filename
    # Build into a sibling temporary file; never leave a partially built archive.
    with tempfile.NamedTemporaryFile(dir=output, prefix='.pending-', delete=False) as pending:
        pending_path = pathlib.Path(pending.name)
    try:
        archive(pending_path, files)
        os.replace(pending_path, destination)
    finally:
        pending_path.unlink(missing_ok=True)
    digest = sha(destination.read_bytes())
    (output/(filename+'.sha256')).write_text(digest+'  '+filename+'\n')
    return {'archive': str(destination), 'sha256': digest, 'target': target, 'files': len(files), 'submission_ready': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', action='append', choices=TARGETS, required=True)
    parser.add_argument('--output', type=pathlib.Path, default=ROOT/'dist/native')
    args = parser.parse_args()
    subprocess.run([sys.executable, str(ROOT/'scripts/native-assets.py'), '--verify'], check=True)
    run(['go', 'mod', 'verify'])
    for target in dict.fromkeys(args.target):
        print(json.dumps(build(target, args.output.resolve())))


if __name__ == '__main__':
    main()

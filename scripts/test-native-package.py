#!/usr/bin/env python3
"""Rebuild twice, inspect artifacts, and execute the extracted native host."""
import importlib.util
import json
import os
import pathlib
import re
import subprocess
import tempfile
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('native_package', ROOT/'scripts/package-native.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


def inspect(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), 'duplicate members'
        assert not any(n.startswith('/') or '..' in pathlib.PurePosixPath(n).parts or '\\' in n for n in names)
        assert not any('node_modules' in n or n.endswith('.mjs') or n in ('mcp.json', 'plugin.json') for n in names)
        metadata = json.loads(archive.read('provenance.json'))
        required_go = re.search(r'^go (\S+)$', (ROOT/'native/go.mod').read_text(encoding='utf-8'), re.M).group(1)
        assert metadata['go_version'] == 'go' + required_go, 'unapproved build toolchain'
        assert metadata['schema'] == 'kujo.openai.native-artifact/v1'
        assert metadata['submission_ready'] is False and metadata['publisher_signed'] is False
        assert metadata['binary_sha256'] == package.sha(archive.read(metadata['binary']))
        assert (archive.getinfo(metadata['binary']).external_attr >> 16) & 0o777 == 0o755
        assert metadata['dependencies'], 'dependency inventory absent'
        for dep in metadata['dependencies']:
            assert dep['version'] and dep['sum'].startswith('h1:') and dep['notices']
            for notice in dep['notices']:
                assert package.sha(archive.read(notice['path'])) == notice['sha256']
        for asset in ('kujo-icon.png', 'kujo-logomark.svg'):
            assert archive.read('assets/'+asset) == (ROOT/'assets'/asset).read_bytes()
        for info in archive.infolist():
            assert info.date_time == (2000, 1, 1, 0, 0, 0)
        return metadata


def main():
    runtime = os.environ.get('KUJO_NATIVE_TEST_BIN')
    if not runtime or not pathlib.Path(runtime).is_absolute():
        raise SystemExit('KUJO_NATIVE_TEST_BIN must name a compatible installed runtime; acceptance was not run')
    target = subprocess.check_output(['go', 'env', 'GOOS', 'GOARCH'], text=True, encoding="utf-8").strip().replace('\n', '/')
    subprocess.run([sys.executable, str(ROOT/'scripts/native-assets.py'), '--verify'], check=True)
    with tempfile.TemporaryDirectory(prefix='kujo-native-package-test-') as temporary:
        directory = pathlib.Path(temporary)
        first = package.build(target, directory/'first')
        second = package.build(target, directory/'second')
        assert first['sha256'] == second['sha256'], 'native archive is not reproducible'
        archive = pathlib.Path(first['archive'])
        metadata = inspect(archive)
        assert archive.with_suffix('.zip.sha256').read_text(encoding="utf-8").split()[0] == package.sha(archive.read_bytes())
        # Avoid extraction APIs: only the verified executable is materialized.
        executable = directory/metadata['binary']
        with zipfile.ZipFile(archive) as contents:
            executable.write_bytes(contents.read(metadata['binary']))
        executable.chmod(0o700)
        subprocess.run(['go', 'test', '-count=1', '-v', './integration'], cwd=ROOT/'native',
                       env={**os.environ, 'KUJO_NATIVE_HOST_BIN':str(executable)}, check=True)
        # Independent tamper check proves binary digest validation isn't cosmetic.
        damaged = directory/'tampered.zip'
        with zipfile.ZipFile(archive) as source, zipfile.ZipFile(damaged, 'w') as dest:
            for entry in source.infolist():
                body = source.read(entry.filename)
                if entry.filename == metadata['binary']:
                    body += b'tamper'
                dest.writestr(entry, body)
        try:
            inspect(damaged)
        except AssertionError:
            pass
        else:
            raise AssertionError('tampered executable accepted')
        print(json.dumps({'reproducible':True, 'extracted_acceptance':True, 'tampering_rejected':True,
                          'target':target, 'dependencies':len(metadata['dependencies']), 'sha256':first['sha256']}))


if __name__ == '__main__':
    main()

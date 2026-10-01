#!/usr/bin/env python3
"""Prepare an isolated local marketplace demo; no installation or publication."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2)+'\n', encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kujo', type=Path, required=True, help='Absolute path to an already installed Kujo 1.7 runtime')
    parser.add_argument('--output', type=Path, required=True, help='New local workspace directory; must not exist')
    args = parser.parse_args()
    if not args.kujo.is_absolute() or not args.kujo.is_file():
        parser.error('--kujo must name an existing absolute executable')
    output = args.output.absolute()
    if output.exists():
        parser.error('--output already exists; choose a new directory')
    system = {'Darwin':'darwin','Linux':'linux','Windows':'windows'}[platform.system()]
    arch = {'x86_64':'amd64','AMD64':'amd64','arm64':'arm64','aarch64':'arm64'}[platform.machine()]
    version = json.loads((ROOT/'package.json').read_text())['version']
    archive = ROOT/f'dist/native/kujo-openai-native-{version}-{system}-{arch}.zip'
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != archive.with_suffix('.zip.sha256').read_text().split()[0]:
        raise ValueError('native archive checksum mismatch')
    with zipfile.ZipFile(archive) as z:
        meta = json.loads(z.read('provenance.json'))
        if meta['target'] != f'{system}/{arch}' or meta['go_version'] != 'go1.26.8':
            raise ValueError('unexpected native target or compiler')
        name = 'kujo-openai-native.exe' if system=='windows' else 'kujo-openai-native'
        if meta['binary'] != name:
            raise ValueError('unexpected executable name')
        body = z.read(name)
        if hashlib.sha256(body).hexdigest() != meta['binary_sha256']:
            raise ValueError('native executable digest mismatch')
    output.mkdir(parents=True, mode=0o700)
    plugin = output/'plugins/kujo-native-demo'
    binary = plugin/'bin'/name
    binary.parent.mkdir(parents=True)
    binary.write_bytes(body)
    binary.chmod(0o700)
    project = output/'sample-project'
    project.mkdir()
    (project/'README.md').write_text('# Kujo sample project\n\nA small local project for repository profiling. No credentials or remote services.\n')
    (project/'main.py').write_text('def greeting(name):\n    return f"Hello, {name}!"\n')
    # The operator chooses this sample directory, not a model-supplied path.
    subprocess.run([str(binary),'--kujo',str(args.kujo),'--project',str(project)],check=True,timeout=10)
    shutil.copytree(ROOT/'assets',plugin/'assets')
    shutil.copytree(ROOT/'skills/kujo-repository-review',plugin/'skills/kujo-repository-review')
    for item in ['INSTALL.md','PRIVACY.md','LICENSE']:
        shutil.copy2(ROOT/item,plugin/item)
    interface = {'displayName':'Kujo Native Demo','shortDescription':'Local project profiling and receipts',
                 'longDescription':'Private native demo. Requires separately installed Kujo 1.7. Profiles the configured sample project and returns canonical evidence. Not public-directory approval or host filesystem isolation.',
                 'logo':'./assets/kujo-icon.png','composerIcon':'./assets/kujo-icon.png',
                 'defaultPrompt':['Inspect the sample project with Kujo.','Show the evidence behind that Kujo result.']}
    manifest = {'name':'kujo-native-demo','version':'0.1.0','description':'Private native Kujo demo; preinstalled runtime required.',
                'skills':'./skills/','mcpServers':'./.mcp.json','interface':interface}
    write_json(plugin/'.codex-plugin/plugin.json',manifest)
    command = {'command':'${PLUGIN_ROOT}/bin/'+name,'args':['--serve','--project',str(project),'--kujo',str(args.kujo)]}
    write_json(plugin/'.mcp.json',{'mcpServers':{'kujo':command}})
    write_json(output/'.agents/plugins/marketplace.json',{'name':'kujo-native-demo-local','interface':{'displayName':'Kujo Native Demo'},'plugins':[{'name':'kujo-native-demo','source':{'source':'local','path':'./plugins/kujo-native-demo'},'policy':{'installation':'AVAILABLE','authentication':'ON_INSTALL'},'category':'Developer Tools'}]})
    write_json(output/'demo-provenance.json',{'archive_sha256':digest,'native':meta,'public_submission':False})
    (output/'README.md').write_text('''# Kujo private native demo

Open this workspace in a local-capable Codex/ChatGPT Desktop environment.
Restart the app if needed, open Plugins Directory, select the Kujo Native Demo
local source, and install Kujo Native Demo. Start a new local conversation.

Try: "Inspect the sample project with Kujo." Then: "Show the receipt behind it."
The plugin is explicitly configured for sample-project only. It launches a native
adapter against the already installed runtime: no Node, npm, Git, API key, tunnel,
or server installation. Python was used only to prepare this local package.

This folder contains machine-specific paths and is not a public submission ZIP.
The tools profile structure and validate MCP manifests; they do not run tests or
review diffs. Operator project selection does not provide OS sandbox isolation.
Host loading/rendering must still be verified; browser-only ChatGPT is not this
local execution surface. No account settings were changed by preparation.
''')
    print(json.dumps({'workspace':str(output),'plugin':str(plugin),'project':str(project),'public_submission':False}))

if __name__=='__main__':
    main()

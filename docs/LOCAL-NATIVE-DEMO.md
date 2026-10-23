# Private native demo

Public-directory local-MCP approval does not prevent preparing a private local
marketplace package. This preview uses the real native adapter and canonical
Abilities, with an explicitly configured sample project. It is not a public
submission or a claim of host sandbox isolation.

## Prepare

Maintainer prerequisites: a previously built, checksum-verified native archive
in `dist/native`, Python, and an independently installed Kujo 1.7 runtime. Nothing
is downloaded or installed by this preparation command. Output must be a new
workspace directory.

```sh
python3 scripts/prepare-native-demo.py --kujo /absolute/installed/kujo --output /absolute/demo-workspace
node scripts/test-native-demo.mjs /absolute/demo-workspace
```

Node is only the acceptance test client; the prepared plugin launches the native
binary directly. The package includes the K icon, a repository-review Skill,
local MCP configuration, and a sample Python project. Configuration includes
machine-specific runtime and project paths. Do not upload or distribute it as a
public plugin ZIP. Reprepare on another machine using its installed runtime.

## Use in the app

1. Open the prepared workspace in a local-capable Codex/ChatGPT Desktop session.
2. Restart the app if its local marketplace has not refreshed.
3. In Plugins Directory, select the **Kujo Native Demo** local source and install
   **Kujo Native Demo**.
4. Start a fresh local conversation with that plugin enabled.
5. Ask: **Inspect the sample project with Kujo.**
6. Ask: **Show the canonical receipt behind that result.**

The current workspace can also have a local marketplace entry pointing at the
prepared plugin, with its own marketplace display name. Preparation itself does
not edit account configuration or enable a plugin.

The actual catalog contains repository profiling, contained MCP-manifest
validation and receipt evidence. It does not run a comprehensive change review,
tests, or release evaluation. Skills must report those missing capabilities.

## Verified versus pending

On macOS x64, the prepared manifest launched with an empty server PATH; discovery,
real sample profiling, exact result/receipt matching, malformed input rejection,
and receipt retrieval after restart passed. Runtime was preinstalled Kujo 1.7.0.
The acceptance client reports `host_ui_verified: false`: plugin installation,
icon rendering and model selection in a fresh app session still need observation.
A successful command-line client is not evidence that every ChatGPT surface can
launch local processes. Web/mobile local execution is not claimed.

Official [local marketplace instructions](https://developers.openai.com/plugins/build/plugins),
accessed 2026-10-01, document repo/personal marketplaces separately from public
submission and warn that availability varies by surface. Public local-MCP
launch/platform permissions still require the confirmation described in
[the unsent approval question](../OPENAI_LOCAL_MCP_APPROVAL.md).

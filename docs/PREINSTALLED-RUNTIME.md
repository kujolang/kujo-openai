# Preinstalled runtime contract

Decision: user attachment accepted 2026-10-01. Automatic provisioning is deferred. This document supersedes hosted/bootstrap plans for the near-term product.

## Verified implementation, not assumptions

| Component | Current contract | Native-only gap |
|---|---|---|
| Kujo 1.7.0 | `kujo run ENTRY --untrusted` executes a bounded canonical provider; `kujo mcp --help` lists `make` | No native stdio Ability MCP server |
| Current MCP entrypoint | `node ${PLUGIN_ROOT}/bin/kujo-openai.mjs serve` | Requires Node; cannot relabel as native |
| Review setup | npm runtime resolver, fixed Git source acquisition, operator-selected Git worktree | Requires Git; not ordinary folder onboarding |
| Ability | Vendored canonical discovery/execution/policy/receipts | Preserve unchanged through any native transport implementation |
| Preflight | Native `kujo-preflight [--kujo ABSOLUTE] [--project ABSOLUTE]` | Diagnosis only; not wired into a pretend MCP server |
| Folder authority | Trusted local operator config today | Host-selected root confinement/restart authorization not certified |

No launch command for the requested product has been verified. `mcp make` generates a server; it is not a long-running stdio server. A minimum native-MCP Kujo version cannot truthfully be published yet. The diagnostic recognizes stable `>=1.7.0 <1.8.0` only as the tested **provider** runtime family; patches still require release acceptance. This is not a promise of native MCP compatibility.

## Discovery boundary

The native locator is isolated in `native/preflight`: operator absolute override, then `~/.local/bin/kujo`, then absolute PATH entries. It ignores empty/relative entries, canonicalizes symlinks, excludes current/explicit project trees, checks executable/ancestor ownership and write bits on macOS/Linux, and rejects unsafe candidates. It never reads repository configuration, changes PATH, invokes a shell, installs or provisions software. Default install path is from the official installer; custom paths require operator configuration. Windows `.exe` selection compiles, but ACL/reparse validation is unimplemented and reports `runtime_permissions_unverified`; it does not rely on POSIX mode bits there.

The version probe has a 3s deadline, 4 KiB stdout limit, suppressed stderr and a minimal environment. No executable paths, user names, credentials or project contents appear in reports. Every current result exits 1 because native MCP readiness is not established. Reports do not constitute receipts or authorization.

| Status | User action |
|---|---|
| `runtime_missing` | Install Kujo independently using the linked official guide; reconnect after resolving prerequisites |
| `unsafe_runtime` | Use a trusted installation outside project/writable directories |
| `runtime_permission_denied` | Repair installation permissions without privilege escalation |
| `runtime_permissions_unverified` | Wait for verified native platform permission handling |
| `runtime_version_unsupported` | Use a reviewed compatible provider version; do not blindly downgrade or claim MCP support |
| `runtime_version_invalid`, `runtime_probe_failed` | Verify the official installation; raw errors stay private |
| `runtime_probe_timeout` | Investigate the installation; no automatic restart/retry |
| `invalid_project`, `project_unavailable` | Select an accessible absolute project through the host; no authority is granted by this flag |
| `native_mcp_unavailable` | Native stdio adapter work remains; a tunnel/Node workaround is not the selected product |

## Work still required in code

Implement a native bounded stdio transport using the existing canonical Ability projection, with receipt storage, cancellation, process cleanup and schema validation equivalent to the reference Node adapter. Either the Kujo runtime must gain this reviewed capability or a separately distributed native adapter must be accepted; neither exists in this commit. Keep authority in Ability, not a transport-specific tool registry. Do not copy product-specific wrappers. A change outside this repository must explicitly justify the missing runtime capability.

Resolve Git-dependent review handlers and package acquisition without promising a Git-free change review they cannot perform. Start with genuinely Git-independent canonical capabilities, explicitly reporting unsupported ones. Verify selected-root enforcement and Windows ACL/process behavior. Then replace the development manifest with an actually tested platform launch contract, repeat the complete MCP/receipt tests without Node/Git available, and obtain local public-distribution confirmation. No speculative native command, installer hook or remote fallback is provided here.

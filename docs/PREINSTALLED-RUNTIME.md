# Preinstalled runtime contract

The user installs Kujo independently. The plugin must not bootstrap it. An experimental compiled adapter now implements the native MCP path using the **existing `kujo run` provider protocol**. It does not invent `kujo mcp serve` or require a new Kujo subcommand.

```text
Supported local MCP host
        ↓ bounded stdio
Compiled kujo-openai-native adapter
        ↓ fixed argv + bounded JSON stdin
Preinstalled Kujo → canonical Ability provider
        ↓ canonical result and receipt
Durable local evidence → MCP tool/resource result
```

## Current contracts

| Component | Verified behavior | Remaining boundary |
|---|---|---|
| Kujo runtime | Stable 1.7 provider family; actual 1.7.0 exercised | Other releases require acceptance; `mcp make` is still only a generator |
| Experimental native entrypoint | `kujo-openai-native --serve --project ABSOLUTE`; optional trusted `--serve-config` | Bundled canonical read-only project profile; public host installation remains unverified |
| Default plugin entrypoint | Existing Node development profile | Must migrate packaging only after native platform/onboarding acceptance |
| Discovery | Known user install directory, absolute PATH, or explicit operator path; project shadows rejected | Windows ACL component verified; launcher integration pending; POSIX ACL coverage remains limited |
| Canonical execution | Identity/schema/effect projection, policy, approvals and receipts remain in Ability | No host-supplied authority; invocation-v1 continuation references preserve canonical resume |
| Receipt storage | Canonical bytes and content-addressed retrieval; Unix synced atomic files, staged Windows transactional database | Windows launcher acceptance pending; unsupported storage fails closed |
| Folder selection | Explicit launch configuration excludes project code from trusted code/state | Not an OS sandbox or proof of a provider's scope; real host grants remain unverified |

The version check accepts `>=1.7.0 <1.8.0` for provider compatibility, not as a claim that every patch/platform combination was tested. Build-time Go and the pinned official Go MCP SDK are compiled into the host; they are not end-user runtime prerequisites. No Node, Git, npm or API credential is used by the verified native execution path.

## Failure behavior

- Missing executable: `runtime_missing` with official installation guidance; no install/retry.
- Old/future/unrecognized version: `runtime_version_unsupported` or `runtime_version_invalid`.
- Unsafe project binary, writable executable ancestry or filesystem alias: `unsafe_runtime`.
- Platform permission validation unavailable: `runtime_permissions_unverified`.
- Missing/ambiguous project: `explicit_project_required` or `project_unavailable`.
- Project-controlled provider/import/config/state: rejected before provider invocation, including resolved symlink paths.
- Timeout/cancellation after an invocation starts: completion uncertain, no automatic retry.
- Canonical denial/approval requirement/domain failure: canonical receipt and explicit status preserved; never reported as success.
- Missing durable evidence after execution: `receipt_persistence_failed`, completion uncertain.
- Resume-capable provider: private durable reference saved before invocation; explicit resume preserves original invocation ID and checks the current definition digest. Unknown recovery versions fail with `native_continuation_unsupported`.

Diagnostic mode alone reports `provider_runtime_ready` for a compatible installation, with `nativeMcpVerified: false`. It did not start a server and cannot certify public readiness.

## Still required before the selected product can ship

final native platform packaging; Windows launcher integration with tested ACL/receipt components; actual host folder permission enforcement; clean-machine and live ChatGPT acceptance; publisher policies/reviewer materials; public local-MCP confirmation. The ordinary development ZIP remains gated from submission.

See [native build/run/test instructions](../native/README.md) and [submission checklist](PREINSTALLED-SUBMISSION.md). Earlier bootstrap/hosted designs and the diagnostic-only audit are historical evidence, not the current product plan.

# Native host implementation — 2026-10-01

This supersedes the diagnostic-only conclusion that no native adapter exists. It does **not** change the conclusion that public submission/end-user onboarding remain incomplete.

## Implemented

`native/internal/provider`: fixed-argv canonical Kujo process transport, bounded combined stdout/stderr, minimal environment, no retries, concurrency limits, timeout/cancellation and native child cleanup.

`native/internal/adapter`: official MCP SDK binding of canonical discovery, schema and identity verification, fresh discovery before calls, output/receipt validation, evidence tool/resources, explicit refusal of unsupported continuation guarantees. No product-specific wrappers.

`native/internal/receipts`: private content-addressed store, atomic publication after file fsync followed by directory fsync, confined reads, tamper/link checks, bounded instance-local reference index, restart persistence.

`native/internal/transport`: bounded newline framing, pending request limit, duplicate request/initialize rejection and refusal of tool calls disguised as notifications.

`native/preflight`: runtime diagnostics plus an explicit native server mode, private operator configuration validation and project/code/state separation. Case-alias checks use filesystem identity. A compatible diagnostic is now `provider_runtime_ready`; this does not mean MCP was tested by that diagnostic.

`native/integration`: compiled-executable acceptance with PATH empty and `/` as CWD, preinstalled Kujo fixture, real canonical tool discovery/call, receipt tool/resource access and retrieval after executable restart. This tests a canonical test registry, not ordinary repository onboarding.

## Verification commands

```sh
(cd native && go build -trimpath -o ../dist/kujo-openai-native ./preflight)
# Set the two paths to the independently available runtime and built host:
export KUJO_NATIVE_TEST_BIN=/absolute/kujo
export KUJO_NATIVE_HOST_BIN=/absolute/kujo-openai-native
(cd native && go test -race -count=1 -v ./... && go vet ./...)
npm run check
```

Actual execution in this session: macOS x64, official Kujo 1.7.0 runtime. 47 native top-level tests and 14 subtests passed with the race detector, zero failures and zero skips; `go vet ./...` passed. The reference Node suite remains 49/49, zero skips. All six native host cross-builds (darwin/linux/windows × amd64/arm64) passed, without implying execution on those platforms.

Native tests include actual Kujo subprocess-tree cancellation and timeout, canonical success/rejection/approval-required/failure, unchanged tools/schemas/metadata, forged receipt rejection, private-state failures, resource/evidence retrieval and restart. The integration host has no Node/Git executable on PATH. SDK-only tests use memory stores solely as isolated fixtures; the compiled-host acceptance uses the real durable store.

Initial test failures were fixture issues: permissive temporary-directory modes and a case-colliding fixture directory on macOS. Fixtures were corrected without relaxing private-directory or project exclusion checks. No final failure is treated as a pass.

CI now includes four native acceptance platforms with checksum-pinned Kujo archives. These CI preparation downloads are outside the adapter and are not plugin installation behavior. Job outcomes must be checked separately before upgrading platform claims.

## Remaining limits

Default `mcp.json` still launches the Node reference adapter. The native host requires explicit trusted application configuration; there is no automatic Git-free ordinary-project registry setup. Windows executable ACL and storage parity, continuation parity, actual host-enforced folder grants, platform-specific distribution/signing/license inventory, live ChatGPT acceptance and public local-MCP permission remain unfinished. No plugin submission, release publication, hosted deployment or OpenAI contact occurred.

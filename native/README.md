# Experimental native Ability host

This implementation uses a **preinstalled Kujo 1.7 runtime**. Go is needed to build it, not to run the resulting executable. The host never downloads Kujo, invokes npm/Git, or installs packages. Tool contracts and handlers remain in the canonical Kujo provider; the Go layer uses the official MCP SDK for transport.

It is not yet the default plugin package or the finished onboarding experience. Windows runtime ACL checks and durable storage remain blocked; continuation-capable catalogs are explicitly unsupported. Public local-MCP distribution is unconfirmed. No installer, hosted fallback or new `kujo mcp` subcommand is introduced.

## Build and run with a reviewed provider

From this directory:

```sh
go build -trimpath -o ../dist/kujo-openai-native ./preflight
```

Use `examples/operator-config.json` from the repository as the configuration shape. Supply absolute paths to an independently installed Kujo executable and a **working trusted canonical provider**, its import/CWD roots, a precreated private receipt directory and only the capabilities that provider needs. The example entrypoint is a template, not a runnable registry. Keep the config file mode 0600 and state directory mode 0700. Code, configuration, imports and state must be outside the explicitly selected project. Never place secret values in JSON; `secretEnvironment` names only explicitly allowed process environment entries.

```sh
./dist/kujo-openai-native --serve-config /absolute/private/operator.json --project /absolute/project
```

Run the command above from the repository root. Its stdio is MCP-only; startup errors go to stderr as bounded diagnostic codes and guidance. A selected project excludes repository code from launcher trust; it is **not** an OS filesystem sandbox or a provider's authorization policy. The provider must bind its own project scope and Ability policy, and the host must enforce its grants. There is no automatic provider installation or registration yet.

Without `--serve-config`, the executable checks runtime discovery/version only. `provider_runtime_ready` means a compatible executable was found; `nativeMcpVerified: false` correctly means that diagnostic did not start MCP. It must not be used as a submission-readiness result.

## Boundaries

- No inherited PATH or ambient credentials in provider execution. Process-producing handlers must bind absolute executables. Operator-selected capabilities become fixed argv; model input travels as JSON on stdin.
- 1 MiB input frames/provider IO budget, 4 MiB MCP output frames, 32 pending RPCs, 1–16 provider processes and at most 120 seconds per process. No automatic retries.
- Kujo gets SIGTERM for native child cleanup on POSIX, followed by process-group escalation. Real Kujo child cancellation/timeout tests verify cleanup; no claim that committed effects can be undone.
- Discovery is rechecked before each call. Identity/digest and output schemas are validated. Canonical approval/denial/failure receipts stay distinct from success and transport uncertainty.
- Receipts are content-addressed, fsynced and atomically linked into an `os.Root`-confined private directory. Read checks reject links, traversal, oversized files and hash mismatch. Unsupported directory durability fails before admitting calls. A 32-entry store-instance index resets on restart; stored receipts remain readable by reference.
- `_kujo_receipt_evidence` and `kujo-receipt://sha256/{digest}` expose evidence without rerunning an Ability. The index is not chat-specific.
- Resume-capable catalogs fail with `native_continuation_unsupported`; this implementation does not silently discard their recovery contract.

## Verify

Build the executable first. Set `KUJO_NATIVE_TEST_BIN` to a real installed Kujo 1.7 binary and `KUJO_NATIVE_HOST_BIN` to the built host, then run:

```sh
go test -race -count=1 -v ./...
go vet ./...
```

Tests without those variables explicitly skip real-runtime/executable cases. The acceptance test copies the verified runtime into a private temporary trusted install, launches the host with **empty PATH and `/` as CWD**, negotiates MCP, discovers tools, invokes a canonical Ability, reads its receipt by tool/resource and retrieves it after restarting the executable. It supplies a controlled canonical test registry, not a claim that end-user repository onboarding is complete. Real subprocess-tree tests use native Go fixtures, not Node.

The current CI matrix prepares checksum-pinned official runtime archives as a **test prerequisite**, then runs these checks on macOS x64/ARM64 and Linux x64/ARM64. CI installation is not behavior performed by the plugin. Check actual job results before claiming platform verification.

The SDK is pinned to `github.com/modelcontextprotocol/go-sdk v1.7.0`; all module checksums are in `go.sum`. See the [official SDK](https://github.com/modelcontextprotocol/go-sdk) (accessed 2026-10-01). The release packaging, dependency-license inventory and signing path for native artifacts still need completion.

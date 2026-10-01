# Experimental native Ability host

This implementation uses a **preinstalled Kujo 1.7 runtime**. Go is needed to build it, not to run the resulting executable. The host never downloads Kujo, invokes npm/Git, or installs packages. Tool contracts and handlers remain in the canonical Kujo provider; the Go layer uses the official MCP SDK for transport.

It is not yet the default plugin package or the finished onboarding experience. Windows x64 discovery, private state, native MCP execution and child-process cancellation have acceptance evidence; Windows ARM64 execution remains unverified; continuation-capable providers use private durable references and canonical resume. Public local-MCP distribution is unconfirmed. No installer, hosted fallback or new `kujo mcp` subcommand is introduced.

## Build and run

Build from this source checkout with Go 1.26.8. Native packaging requires this exact patched toolchain and records it in artifact provenance; Go is never an end-user prerequisite. Older preview binaries built with Go 1.25.3 must be rebuilt because the dependency audit found affected standard-library symbols.

```sh
cd native
go build -trimpath -o ../dist/kujo-openai-native ./preflight
cd ..
./dist/kujo-openai-native --serve --project /absolute/project
```

`--serve` ships two canonical read-only MCP pack Abilities: bounded repository profiling and contained MCP manifest validation. It needs only the compiled host and a compatible preinstalled Kujo. It does not require a Git repository. Source code is embedded at build time, extracted into a private launch directory, and removed on normal shutdown. No source/runtime download occurs. Canonical definitions are loaded from that trusted bundle, never from the selected project. The host writes audit/evidence under `~/.local/share/kujo/openai-native/<project-path-hash>`; `--state-directory` can select another trusted directory outside the project. Neither option grants OS permissions.

The reviewed source revision and file hashes are in `mcp-source.json`. Maintainers run `python3 scripts/native-assets.py --verify` from the repository root to verify embedded bytes against pinned canonical sources. Python is build/test tooling only. The generic provider path remains available for additional registered Abilities; new products do not get bespoke Go wrappers.

## Run with another reviewed provider

These commands require the source checkout (or source archive). The legacy npm/plugin package includes this guide for reference; it does not ship the native build sources or a native executable.

Use `examples/operator-config.json` from the repository as the configuration shape. Supply absolute paths to an independently installed Kujo executable and a **working trusted canonical provider**, its import/CWD roots, a precreated private receipt directory and only the capabilities that provider needs. The example entrypoint is a template, not a runnable registry. Keep the config file mode 0600 and state directory mode 0700. Code, configuration, imports and state must be outside the explicitly selected project. Never place secret values in JSON; `secretEnvironment` names only explicitly allowed process environment entries.

```sh
./dist/kujo-openai-native --serve-config /absolute/private/operator.json --project /absolute/project
```

Run the command above from the repository root. Its stdio is MCP-only; startup errors go to stderr as bounded diagnostic codes and guidance. A selected project excludes repository code from launcher trust; it is **not** an OS filesystem sandbox or a provider's authorization policy. The provider must bind its own project scope and Ability policy, and the host must enforce its grants. The bundled read-only profile handles ordinary project selection; custom providers remain explicit operator configuration.

Without `--serve` or `--serve-config`, the executable checks runtime discovery/version only. `provider_runtime_ready` means a compatible executable was found; `nativeMcpVerified: false` correctly means that diagnostic did not start MCP. It must not be used as a submission-readiness result.

## Boundaries

- No inherited PATH or ambient credentials in provider execution. Process-producing handlers must bind absolute executables. Operator-selected capabilities become fixed argv; model input travels as JSON on stdin.
- 1 MiB input frames/provider IO budget, 4 MiB MCP output frames, 32 pending RPCs, 1–16 provider processes and at most 120 seconds per process. No automatic retries.
- Kujo gets SIGTERM for native child cleanup on POSIX, followed by process-group escalation. Real Kujo child cancellation/timeout tests verify cleanup; no claim that committed effects can be undone.
- Discovery is rechecked before each call. Identity/digest and output schemas are validated. Canonical approval/denial/failure receipts stay distinct from success and transport uncertainty.
- Receipts preserve canonical bytes and content-addressed references. On Unix they are fsynced and atomically linked into an `os.Root`-confined private directory. The Windows backend uses private ACLs and synced bbolt transactions, with a two-second lock deadline and 256 MiB database cap. Read checks reject links, traversal, oversized files and hash mismatch. Unsupported directory durability fails before admitting calls. A 32-entry store-instance index resets on restart; stored receipts remain readable by reference.
- `_kujo_receipt_evidence` and `kujo-receipt://sha256/{digest}` expose evidence without rerunning an Ability. The index is not chat-specific.
- Providers declaring `resume: invocation-v1` expose `_kujo_resume_invocation`. The launcher stores private references in `stateDirectory/continuations` before invocation. References contain identity and definition digest, never original inputs or approval grants. Resume rechecks the catalog and sends only the saved invocation ID; Ability/application policy retains authority. No automatic retry or resume occurs. Unsupported recovery versions fail closed.

## Verify

Build the executable first. Set `KUJO_NATIVE_TEST_BIN` to a real installed Kujo 1.7 binary and `KUJO_NATIVE_HOST_BIN` to the built host, then run:

```sh
go test -race -count=1 -v ./...
go vet ./...
```

Tests without those variables explicitly skip real-runtime/executable cases. The acceptance test copies the verified runtime into a private temporary trusted install, launches the host with **empty PATH and `/` as CWD**, negotiates MCP, discovers tools, invokes a canonical Ability, reads its receipt by tool/resource and retrieves it after restarting the executable. A second executable acceptance case runs the bundled canonical MCP pack against a plain project, rejects project-local replacement source and unsafe paths/state, and retrieves evidence after restart. Public plugin installation and host folder authorization remain unverified. Real subprocess-tree tests use native Go fixtures, not Node.

The current CI matrix prepares checksum-pinned official runtime archives as a **test prerequisite**, then runs these checks on macOS x64/ARM64 and Linux x64/ARM64. CI installation is not behavior performed by the plugin. Check actual job results before claiming platform verification.

The SDK is pinned to `github.com/modelcontextprotocol/go-sdk v1.7.0`; all module checksums are in `go.sum`. See the [official SDK](https://github.com/modelcontextprotocol/go-sdk) (accessed 2026-10-01). Native preview archives now have a reproducible build and dependency-license inventory. Publisher signing/notarization and public plugin packaging remain incomplete.

## Native preview archives

From the repository root, maintainers can build an archive without npm:

```sh
python3 scripts/package-native.py --target darwin/arm64 --target linux/amd64
```

Targets are `darwin`, `linux` or `windows`, each with `amd64` or `arm64`. The command verifies embedded source hashes and Go module integrity, cross-compiles with CGO disabled, and writes ZIPs plus SHA-256 sidecars to `dist/native`. Each archive includes the official K assets, Kujo/Go/dependency license notices, exact module versions/checksums, source digests and binary provenance. Build-time Python/Go are not runtime requirements.

These are **native adapter artifacts, not public plugin ZIPs**. Windows artifacts still fail closed at runtime. Artifacts have no publisher signature/notarization; checksums alone do not establish publisher identity. The default plugin manifest remains the legacy development profile until supported native distribution and host authorization are validated.

Run `KUJO_NATIVE_TEST_BIN=/absolute/installed/kujo python3 scripts/test-native-package.py` to build twice, compare hashes, check archive paths/modes/branding/licenses, reject a tampered executable, and run both real MCP acceptance tests using the extracted binary. Runtime prerequisite absence fails this acceptance command explicitly. CI runs it on the native Unix matrix.

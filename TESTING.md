# Verification boundaries

The compiled native adapter has actual stdio/Ability/receipt acceptance evidence. The **public plugin product is still blocked**: native package selection, host folder grants and live ChatGPT installation are not certified by those tests.

## Reproduce

```sh
cd native
go build -trimpath -o ../dist/kujo-openai-native ./preflight
# Set KUJO_NATIVE_TEST_BIN to an independently installed Kujo 1.7.0 binary.
# Set KUJO_NATIVE_HOST_BIN to the absolute path of the binary built above.
go test -race -count=1 -v ./...
go vet ./...
```

Without both environment variables, actual runtime/host cases explicitly skip. They must be provided for acceptance evidence. Go and build-time Python are maintainer dependencies, not end-user requirements. See [native instructions](native/README.md) for archive verification and isolated extracted-binary acceptance.

Native tests cover runtime discovery and version rejection, repository shadowing, unsafe paths, environment/argument isolation, canonical schemas/effects/approvals, continuation recovery, bounded stdio, malformed traffic, cancellation, timeouts, crash uncertainty, receipt integrity and restart. Executable acceptance runs the compiled host with an empty PATH against a separately installed real Kujo runtime and a plain selected project. Fixtures support isolated boundary tests; canonical integration cases use the actual Ability implementation.

The Windows security workflow runs real ACL/reparse and transactional receipt tests. These prove components, not Windows launcher acceptance. See [Windows boundaries and exact CI evidence](docs/WINDOWS-NATIVE-BOUNDARIES.md).

## Platform interpretation

| Platform | Native evidence | Remaining boundary |
|---|---|---|
| macOS x64 | Actual canonical stdio calls, receipt retrieval/restart; 50 top-level tests and 16 subtests with race detection | Public plugin installation and host grants |
| macOS ARM64 | Cross-build; Unix acceptance workflow configured | Consult exact CI evidence before claiming execution |
| Linux x64 / ARM64 | Cross-build; Unix acceptance workflow configured | Consult exact CI evidence before claiming execution |
| Windows x64 | Actual ACL/reparse and receipt component tests | Launcher integration and full native MCP acceptance |
| Windows ARM64 | Cross-build | Actual runtime, storage and host execution unverified |

Cross-building does not prove execution, signing or host integration. Process termination tests do not simulate power loss or certify every storage device. Legacy five-platform Node installation tests do not establish native-only plugin compatibility.

## Legacy adapter and submission gate

```sh
npm run check
npm run check:submission       # expected exit 1: unresolved gates
npm run package:submission     # expected exit 1, no new archive
```

Node is needed only to maintain/test the legacy adapter. The existing development ZIP remains excluded from submission. Historical reports are in [legacy development](docs/LEGACY-DEVELOPMENT.md), [acceptance](docs/ACCEPTANCE.md) and the [initial preinstalled audit](docs/evidence/preinstalled-audit-2026-10-01.md); their diagnostic-only limitations predate the compiled server.

> Native implementation update: see [native tests and acceptance](native/README.md). A compiled experimental host now passes actual stdio calls, durable receipt retrieval and restart tests without Node/Git. The default public product remains blocked. Earlier diagnostic-only limitations below are historical unless still listed in the native guide.

# Verification boundaries

The native-only product is blocked; no end-to-end native MCP success is claimed.

## Reproduce

```sh
(cd native && go test -race -count=1 -v ./... && go vet ./...)
npm run check
npm run check:submission       # expected exit 1: unresolved gates
npm run package:submission     # expected exit 1, no new archive
```

Go is a maintainer build/test dependency for the standalone diagnostic, not an end-user prerequisite. Node remains necessary to test the existing development adapter; this does not meet the new native-only product requirement.

Native tests cover missing/default/PATH runtime discovery, GUI-style empty PATH, repository shadowing, explicit project binaries, symlinks in both directions, writable file/ancestors, permissions, old/future/invalid versions, environment and argument isolation, timeout, crash redaction, oversized output and invalid/excluded projects. Shell scripts are isolated probe fixtures; actual Kujo is tested separately. No fixture pretends to be a working native MCP server.

The existing adapter suite covers canonical projection, schemas, authority, receipts, protocol malformed traffic, cancellation, timeouts, concurrency, process crash and restart. Its existing integration/installed-package evidence applies only to the Node/Git development model. See [legacy developer guide](docs/LEGACY-DEVELOPMENT.md), [acceptance](docs/ACCEPTANCE.md) and the dated [new evidence](docs/evidence/preinstalled-audit-2026-10-01.md).

## Platform interpretation

| Platform | Preflight execution | Native-only plugin |
|---|---|---|
| macOS x64 | Tested in this session | BLOCKED: no native stdio contract |
| macOS ARM64 | Cross-build only; no execution in this session | Unverified |
| Linux x64 / ARM64 | Cross-build only unless subsequent CI evidence is recorded | Unverified |
| Windows x64 | Cross-build only; ACL verification deliberately fails closed | Unsupported pending boundary implementation |
| Windows ARM64 | Source can cross-build; no Kujo/runtime compatibility claim | Unsupported/unverified |

Cross-building does not prove launch, signing, host integration or behavior on that OS. Prior five-platform Node installation tests do not establish native-only compatibility.

Native MCP handshake, tools/list, representative call/receipt, cancellation, reconnect, duplicate initialize and graceful shutdown cannot be tested because no native server exists yet. Host folder permission tests and full clean-machine no-Node/no-Git acceptance remain unexecuted for the same reason, not silently skipped or marked passing.

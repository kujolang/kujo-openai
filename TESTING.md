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

Without both environment variables, actual runtime/host cases explicitly skip. They must be provided for acceptance evidence. Go 1.26.8 and build-time Python are maintainer dependencies, not end-user requirements. See [native instructions](native/README.md) for archive verification and isolated extracted-binary acceptance.

Native tests cover runtime discovery and version rejection, repository shadowing, unsafe paths, environment/argument isolation, canonical schemas/effects/approvals, continuation recovery, bounded stdio, malformed traffic, cancellation, timeouts, crash uncertainty, receipt integrity and restart. Executable acceptance runs the compiled host with an empty PATH against a separately installed real Kujo runtime and a plain selected project. Fixtures support isolated boundary tests; canonical integration cases use the actual Ability implementation.

The Windows security workflow runs real ACL/reparse and transactional receipt tests. It also verifies trusted runtime discovery, private operator configuration, real canonical MCP calls/restart and native child-process cancellation on Windows x64. See [Windows boundaries and exact CI evidence](docs/WINDOWS-NATIVE-BOUNDARIES.md).

## Platform interpretation

| Platform | Native evidence | Remaining boundary |
|---|---|---|
| macOS x64 | Actual canonical stdio calls, receipt retrieval/restart; 50 top-level tests and 16 subtests with race detection | Public plugin installation and host grants |
| macOS ARM64 | Cross-build; Unix acceptance workflow configured | Consult exact CI evidence before claiming execution |
| Linux x64 / ARM64 | Actual native race/vet and extracted-package execution, run 36916707929 at c3801c0 | Public plugin installation and host grants |
| Windows x64 | Go 1.26.8: 52 top-level + 25 subtests, vet, extracted executable/reproducibility/tamper checks | Public plugin installation and host grants |
| Windows ARM64 | Cross-build | Actual runtime, storage and host execution unverified |

Cross-building does not prove execution, signing or host integration. Process termination tests do not simulate power loss or certify every storage device. Legacy five-platform Node installation tests do not establish native-only plugin compatibility.

## Legacy adapter and submission gate

```sh
npm run check
npm run check:submission       # expected exit 1: unresolved gates
npm run package:submission     # expected exit 1, no new archive
```

Node is needed only to maintain/test the legacy adapter. The existing development ZIP remains excluded from submission. Historical reports are in [legacy development](docs/LEGACY-DEVELOPMENT.md), [acceptance](docs/ACCEPTANCE.md) and the [initial preinstalled audit](docs/evidence/preinstalled-audit-2026-10-01.md); their diagnostic-only limitations predate the compiled server.

## Native toolchain audit

On 2026-10-01, [audit run 36915606181](https://github.com/kujolang/kujo-openai/actions/runs/36915606181)
found four affected standard-library vulnerabilities in the Go 1.25.3 Windows
binary and five in macOS/Linux binaries: GO-2026-6218, GO-2026-4971,
GO-2026-4970 (Unix only), GO-2026-4602 and GO-2026-4601. Binary-symbol
findings are not proof that every issue is exploitable through the adapter.
Builds and packaging now pin Go 1.26.8; previous previews must be rebuilt.
[Go's vulnerability-checker documentation](https://go.dev/doc/security/vuln/)
and [GO-2026-4970](https://pkg.go.dev/vuln/GO-2026-4970) were reviewed on 2026-10-01.

Local patched-toolchain verification at `c3801c0`: race tests passed 49 top-level
tests and 16 subtests; two executable tests initially skipped because the host
variable was absent. Both subsequently passed against the actual extracted
archive through `python3 scripts/test-native-package.py`. `go vet ./...` passed.
The archive reproduced byte-for-byte and rejected executable tampering (SHA-256
`1c02296f69382936170fecd9fe26da3848b86e8a21fea3d123bcd4e8e2a53cd3`).
Logs: `.local/native-go1268-regression.json` and
`.local/native-go1268-package-stable.log`. An earlier reproducibility attempt
overlapped source edits and was discarded; this evidence uses stable sources.

[Patched audit run 36916707896](https://github.com/kujolang/kujo-openai/actions/runs/36916707896)
completed successfully on all six OS/CPU targets at `c3801c0`. Every binary scan
reported "No vulnerabilities found." Logs: `.local/security-go1268-*.log`.
This checks the current vulnerability database, not public-host compatibility.

Patched Linux x64 and ARM64 native jobs in
[run 36916707929](https://github.com/kujolang/kujo-openai/actions/runs/36916707929)
passed race tests, vet, two extracted executable acceptance cases and archive
reproducibility/tamper rejection (jobs `110552386306` and `110552386058`).
Archive SHA-256: x64 `020530606e2ee0d52d9c61cfd387588e5f54f30051528b65dbe907a6f3762961`;
ARM64 `87f8d2b1c37171aafd46b4b45990f182276893d00f14aed622188f862fc4316f`.
An explicit local negative check rejected Go 1.25.3 before creating an artifact.

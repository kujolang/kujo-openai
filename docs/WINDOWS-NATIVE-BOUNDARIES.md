# Windows native boundary implementation

Status: Windows x64 native launcher acceptance passed. ACL checks and transactional receipts are integrated with discovery, private operator configuration and bundled project execution. Windows ARM64 and public host installation remain unverified. Historical component-only evidence below is superseded by the launcher evidence at the end.

`native/internal/windowstrust` reads object security through a handle opened with `READ_CONTROL`, `FILE_READ_ATTRIBUTES`, `FILE_FLAG_OPEN_REPARSE_POINT` and directory-compatible flags. It rejects network/device paths, alternate streams and reparse points, then checks owner and DACL. The current user, SYSTEM, built-in Administrators and the exact Windows TrustedInstaller service SID are trusted; other owners fail closed. Unknown ACE layouts fail closed. NULL DACLs fail closed. Foreign write/change-owner/change-ACL/delete grants are rejected even if a deny ACE could cancel them. Directory ancestor delete-child grants are rejected; merely creating a sibling does not imply control of an already existing child. Private objects also reject foreign data-read and child-creation grants.

`MkdirPrivate` creates missing application directories with a protected inheritable DACL limited to the current user, SYSTEM and Administrators. It verifies existing directories rather than altering ACLs. Paths must already be selected by trusted host/operator configuration outside the project; this helper is not a model-facing operation.

Threat boundary: same-user administrators, SYSTEM and a compromised OS remain trusted. This is not a general sandbox or an effective-access evaluator for arbitrary enterprise ACLs. Conditional/object ACEs, network storage and reparse installations are unsupported, with explicit rejection. ACLs can change after inspection; callers must protect live object identity and apply project exclusion independently. Do not infer a filesystem grant from MCP roots or model content.

Tests include descriptor policies, real file DACL changes, reparse rejection, complete ancestor checks and private inheritance. The dedicated `Native Windows security boundaries` workflow runs on Windows; exact run results must be recorded before claiming validation. The library is now wired into native discovery and private state; see the launcher evidence below.

## Primary references (accessed 2026-10-01)

- [GetSecurityInfo](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-getsecurityinfo): handle-based owner/DACL retrieval and required access rights.
- [NULL versus empty DACLs](https://learn.microsoft.com/en-us/windows/win32/secauthz/null-dacls-and-empty-dacls): NULL grants broad access; an empty ACL denies it.
- [ACCESS_ALLOWED_ACE](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-access_allowed_ace): standard mask/SID layout.
- [Reparse points and file operations](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points-and-file-operations): explicit reparse-open behavior.
- [File security/access rights](https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights): file/directory permission meanings.
- [FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers): Windows file durability requires appropriate writable handles; the POSIX directory-sync implementation is not assumed portable.

Windows CI identified the drive-root owner as TrustedInstaller. The policy recognizes that exact service SID and verifies it against Windows account lookup in a test; it does not accept arbitrary service accounts. See [Windows Resource Protection](https://learn.microsoft.com/en-us/windows/win32/wfp/about-windows-file-protection) (accessed 2026-10-01) for the service's operating-system authority. This resolves an overly restrictive owner check without accepting ordinary foreign writers.

## Verified evidence

Windows x64 GitHub run [36908125981](https://github.com/kujolang/kujo-openai/actions/runs/36908125981), job `110524006026`, commit `96aaf6a`: **8 top-level tests and 16 subtests passed, zero failures/skips**, plus Windows `go vet`. This includes full real ancestor traversal, exact TrustedInstaller identity lookup, protected directory creation and inherited private file ACLs. Earlier failing runs exposed the missing TrustedInstaller owner allowance and a test-only ACL restoration issue; both were corrected and rerun. This does not certify launcher integration, storage durability or Windows ARM64 execution.

Cross-compilation of the security test executable for Windows x64 and ARM64 passed. The unchanged macOS native regression suite passed 50 top-level tests and 16 subtests with race detection; `go vet ./...` passed. Local log references: `.local/windows-security-96aaf6a.log`, `.local/native-windows-foundation-regression.json`.

## Transactional receipt storage

The staged Windows backend in `native/internal/receipts/store_windows.go` uses bbolt 1.5.0 with syncing enabled. Canonical JSON bytes, SHA-256 references and the 32-entry instance-local index match the Unix store contract. Windows stores records in `receipts-v1.db`; it does not imitate POSIX directory fsync. Database handles exist only for an operation, allowing separate processes to use the same private store. Lock contention has a two-second deadline. The database has a 256 MiB cap; capacity/locking/write failures remain explicit, with uncertain completion after execution. There is no automatic Ability retry or evidence eviction.

The directory is protected by the ACL helper and held open for read access without delete sharing. A metadata-only handle was insufficient to prevent renaming on Windows; real CI caught this and the read-handle fix passed. Each database open rejects reparse objects, public data-read grants, oversized files and missing/empty existing databases before mapping. Existing digest keys must contain identical bytes. Open/commit/read failures expose sanitized boundary codes. Same-user/administrator tampering remains outside isolation guarantees, but modified record bytes are detected on retrieval.

Windows x64 run [36909954515](https://github.com/kujolang/kujo-openai/actions/runs/36909954515), job `110529852890`, commit `c784a35`: **18 top-level tests and 16 subtests passed, zero failures/skips**, plus Windows vet. Ten receipt tests cover concurrent instances/reopen, exact canonical bytes, malformed/oversized values, bounded index and closed store, tampering, missing database, lock deadline, reparse/directory identity, corrupt/empty database, private ACLs, committed child-process exit and forced termination before commit. The interrupted transaction remains absent, the previous receipt survives, and subsequent writes recover the process lock.

The lock test permits the dependency's 50 ms polling interval around its deadline; it still rejects unbounded waiting. These tests establish process-crash behavior on the CI filesystem, not simulated power-loss guarantees for every disk or network storage. Network paths remain unsupported. At that milestone the launcher deliberately rejected Windows; the integrated evidence below supersedes that restriction.

The macOS regression passed **50 top-level tests and 16 subtests** with race detection and no test skips/failures. Both real executable acceptance tests passed again after rebuilding the host; `go vet ./...` passed. Windows x64/ARM64 test executables cross-compiled; only x64 was executed. A Windows preview archive built successfully with bbolt's license included, and remains explicitly `submission_ready: false`. Logs: `.local/windows-receipts-c784a35.log`, `.local/native-windows-store-regression.json`, `.local/native-windows-store-integration.json`.

Dependency references, accessed 2026-10-01: [bbolt 1.5.0 release](https://github.com/etcd-io/bbolt/releases/tag/v1.5.0), [pinned Windows sync and lock implementation](https://github.com/etcd-io/bbolt/blob/v1.5.0/bolt_windows.go). This build-time library is linked into the executable; users do not install a database service or Go.


## Integrated Windows x64 launcher evidence

Run [36912436042](https://github.com/kujolang/kujo-openai/actions/runs/36912436042), job `110538672342`, adapter commit `f945d22`: **38 top-level tests and 23 subtests passed, zero failures/skips**, plus vet. This includes two real Kujo 1.7.0 MCP executable tests (canonical fixture and bundled repository profile), canonical receipt tool/resource retrieval after restart, empty child PATH, seven launcher permission/discovery/version tests, and real native child-process termination for cancellation and timeout. The runtime ZIP was independently downloaded by CI and checked against pinned SHA-256 `ed0094f5add39c282bcafe82505ede0ae3059f9c1056dd44112fab47abb03cf3`; the adapter never downloads it.

Two failures were corrected without weakening trust boundaries. CI checkout ACLs were not suitable trusted provider code, so the test copies canonical sources into private operator state. Canonical MCP repository profiling concatenated `/` onto Windows verbatim paths; upstream MCP commit `e02905d` now uses native path joins and maintains slash-separated relative display names. Its full regression suite passed on macOS. The adapter vendors that immutable source, not a separate Windows handler. Upstream draft [PR 11](https://github.com/kujolang/mcp/pull/11) remains unmerged. Model/project-owned import aliases are rejected even when their target is outside the project.

The launcher does not turn `--project` into an OS permission grant. Host-controlled folder authorization, final plugin platform selection, publisher signing and actual ChatGPT installation remain separate unresolved work. Local Windows x64 acceptance must not be represented as public directory approval. Evidence logs: `.local/windows-launcher-f945d22.log`, `.local/mcp-windows-path-regression.log`, `.local/native-windows-profile-integration.json`.

## Patched full-suite and artifact acceptance

Run [36916707980](https://github.com/kujolang/kujo-openai/actions/runs/36916707980),
job `110552349742`, commit `c3801c0`, used Go 1.26.8 and passed **52 top-level
tests plus 25 subtests, zero failures/skips**, followed by vet. The Windows
archive built twice identically; both executable acceptance cases passed from
the extracted archive and modified executable bytes were rejected. Its SHA-256
was `e298766e6dd2d4ea926b55ca2f4c38dd4537778bef131b131a423902e40c1a34`.
Evidence: `.local/windows-go1268-c3801c0.log`.

This also verifies native path separators in provenance, exact vendored bytes
under Windows checkout, UTF-8 metadata independent of the Windows code page,
and canonical continuation/restart with native filesystem joins. Windows ARM64
remains cross-built and audited only; no compatible real runtime was executed.

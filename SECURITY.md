# Security model

This release is a **single-operator local adapter**, not a sandbox or multi-user gateway. Trust the runtime, installed application code, canonical Ability package and operator configuration. Treat MCP requests, repository files and tool outputs as untrusted data. Security reports: use the repository's private vulnerability reporting when available; otherwise contact the maintainer without posting credentials or exploit-sensitive data publicly.

## Boundaries and controls

| Threat | Control / test | Residual boundary |
|---|---|---|
| Prompt injection / hostile descriptions | Skills treat external content as data; canonical policy remains authoritative | Model behavior cannot be guaranteed by a skill |
| Malicious repository chooses code | Explicit absolute operator config; no repo config scanning; fixed argv | Operator must keep application/import roots outside untrusted worktrees |
| Path traversal / symlink escape | No model paths in transport; receipt URI grammar/no-follow/hash checks; real pack malicious-path tests | Domain handlers own their filesystem scope; local owner can alter trusted files |
| Shell injection | `spawn` with argv and `shell:false`; input over stdin | Approved application handlers may execute processes; host isolation required |
| Schema abuse / malformed inputs | Canonical schema validation, object-only projection, input/output byte limits | Trusted schemas may still be computationally costly; process timeout contains Kujo execution |
| Oversized traffic / concurrency | 1 MiB frames/results, max 32 pending RPCs, 1–16 processes (default 4), 120s maximum deadline | Output queue and disk retention require operator capacity planning |
| Credential leakage | Minimal child environment, explicit secret names, matching secret bytes rejected before persistence, raw stderr/exceptions suppressed | Encoded/derived secrets cannot be generically detected; application must never put credentials in results/audit |
| Cross-user contamination | No remote listener; one private state root per local operator | Sharing this process/store across users is unsupported |
| Confused deputy / forged identity | Principal and services are application-owned; no MCP authority controls; exact receipt identity checks | Application itself is trusted and must validate provider credentials |
| Forged receipts | Check Ability/version/digest/invocation/status/result; hash-addressed private storage | Not signed attestations; a compromised local owner/provider can forge local evidence |
| Approval bypass | No approval-issuance tool; native request-binding/consumption; direct-vs-projected conformance | Host confirmation alone is never sufficient |
| Retry amplification | No transport retries; concurrency limits; canonical keyed state untouched | Operator/application must reconcile uncertain effects |
| Destruction / external effects | Conservative annotations and canonical policy; no unrestricted shell surface | An `allow` policy is application authority; verify it before exposing consequential abilities |
| Malicious MCP client | Official SDK dispatch, strict framing, lifecycle checks, unknown tool denial | Local process launch credentials remain the host boundary |
| Dependency compromise | Exact npm lock, vendor commit/checksums, minimal transport dependencies, integrity gate | Checksums do not replace trusted release provenance and review |
| Cancellation / timeout | POSIX native cleanup signal then bounded group kill; uncertainty, no retry | Detached children and already committed effects can survive; Windows Kujo 1.7 child cleanup is exercised by native cancellation/timeout tests; externally isolate workloads requiring stronger containment |

## Authentication

Stdio inherits the local operator's authority to start the configured process. It is not OAuth. The application supplies a fixed principal or independently authenticated context. Do not run the local provider behind a public HTTP proxy and call it multi-tenant.

MCP annotations describe effects; they neither authorize execution nor replace canonical schema checks. The vendored Ability definitions support explicit semantic metadata; the projection uses it when available and remains conservative when absent. No inference from names or descriptions grants authority.

## Secrets, audit and receipts

Never store credentials in config JSON, model arguments, prompts, tool definitions, receipts or errors. `secretEnvironment` contains names only. Application audit must redact/minimize data before persistence. The example audit writes native runtime payloads for the bounded read-only pack; review before replacing it with sensitive application abilities.

Store receipts outside repositories in a private canonical directory. Parent directories and imported code must be controlled by the operator. Receipt read access is local process access. Disk quotas/retention are operator obligations; failure to store evidence after an effect returns uncertainty, not success. Do not use `_meta` as secret storage.

## Unsupported remote execution

Dispatch, Workcell and process-producing abilities are not automatically exposed remotely. [Remote design](docs/REMOTE.md) specifies the additional identity, custody, isolation, egress, approval and reconciliation requirements. No remote security guarantee is asserted by offline tests.

## Explicit local setup

`kujo-openai setup` is an operator CLI action, not an MCP tool or an installation
hook. It resolves the locked official runtime package, acquires fixed reviewed
Git commits over HTTPS with global Git configuration/hooks disabled, and binds
one explicitly selected Git worktree. Setup serializes writes with an owned lock,
rejects linked cache/config targets, and does not replace dirty source caches.
Normal MCP startup only reads already provisioned user-owned configuration; it
never downloads software or interprets repository files as installation authority.
The package installation does not grant canonical execution approval. Protect the
user data directory, package installation and source cache as trusted executable
state. This is not protection against another process with the same user's rights.

## Preinstalled-runtime preflight

The native diagnostic is not an MCP server or sandbox. It locates an existing binary in the official user install directory, then absolute PATH entries, or an operator-supplied absolute path. It rejects the current/selected project and symlink targets inside those directories. On macOS/Linux it checks every lexical and resolved ancestor for owner and group/world write permissions; it does not accept a writable sticky directory. Windows ACL verification is not implemented and fails closed.

Only fixed `--version` is executed, without a shell, from the installation directory. Environment is empty on POSIX, version stdout is capped at 4 KiB, stderr is discarded, and the probe has a three-second deadline. Reports omit executable/project paths and raw child errors. No download, scan, package manager, retry, telemetry or provider execution occurs.

The local user and administrator remain trusted: this is not protection against same-user replacement between inspection and execution. POSIX ACL grants are not fully audited; require independently trusted installation directories. A malicious user-installed executable is arbitrary code: version probing is not a sandbox. Windows ACL support is an explicit native-product blocker.

A host-selected folder is not automatically an OS sandbox. MCP roots and model-provided paths are not authorization evidence. Before the native product can ship, demonstrate host filesystem enforcement and bind the canonical provider to the selected root across restarts. The current developer adapter's operator configuration does not establish public ChatGPT folder isolation.

## Experimental compiled MCP host

The native executable now also accepts explicit `--serve-config` and `--project` flags. The configuration must be private, absolute and schema-valid; resolved config, code/import/CWD and receipt paths must be outside the selected project. This does not certify that the provider implements a project-scoped filesystem policy. It prevents repository content from becoming launcher code, not all filesystem access by a trusted provider.

The provider runner strips ambient PATH and environment, sends only fixed capabilities and JSON data, and preserves uncertain completion on interruption. Stdio has a 1 MiB input frame, 4 MiB output frame and 32-pending-request bound; notifications cannot be used to make untracked tool calls. The SDK handles protocol dispatch. Receipt files are atomically published only after file sync, then directory sync; `os.Root` confines file operations. Integrity and inode checks reject tampering and link replacement. Runtime discovery additionally compares filesystem identities to catch case aliases on case-insensitive volumes.

The native host does not expose an approval issuer or shell tool. Resume-capable catalogs fail explicitly pending native recovery support. Windows remains blocked at the executable trust boundary; cross-compilation is not certification. The default packaged manifest is still the reference Node profile and must not be presented as this native implementation.

## Native build security

Native packages require Go 1.26.8, pinned in `native/go.mod` and CI. The
packager rejects other compilers and records the actual compiler in provenance.
Go and the vulnerability checker are maintainer tools, never end-user dependencies.
The binary audit uses pinned govulncheck against macOS, Linux and Windows binaries
on x64 and ARM64. A clean scan reflects the vulnerability database at scan time;
it does not establish host isolation or publisher authenticity.

The former Go 1.25.3 preview binaries contained affected standard-library symbols
reported by the binary audit. Rebuild them with the patched toolchain before use.
See [verification evidence](TESTING.md#native-toolchain-audit). No public release
was published by this task.

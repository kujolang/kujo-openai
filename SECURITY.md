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
| Cancellation / timeout | POSIX native cleanup signal then bounded group kill; uncertainty, no retry | Detached children and already committed effects can survive; Windows process-tree containment is uncertified; externally isolate such workloads |

## Authentication

Stdio inherits the local operator's authority to start the configured process. It is not OAuth. The application supplies a fixed principal or independently authenticated context. Do not run the local provider behind a public HTTP proxy and call it multi-tenant.

MCP annotations describe effects; they neither authorize execution nor replace canonical schema checks. Ability v1 lacks precise open-world and destructive/execute metadata; conservative annotations avoid claiming safety without evidence. Public submission remains gated on accurate reviewed semantics.

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

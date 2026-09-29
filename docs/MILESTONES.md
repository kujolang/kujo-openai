# Milestone evidence — 2026-09-29

## 1. Research / architecture

Changed: source-backed research, reviewed revision inventory, native projection decision and threat model. Files: `RESEARCH.md`, `research-revisions.json`, `ARCHITECTURE.md`, `SECURITY.md`.

Why: CMD's product dispatch table and historical generated runtime do not satisfy the requested portable capability architecture. Canonical Ability remains unchanged; the adapter uses the same registry/runtime contracts and existing MCP surface.

Verification: implementation and tests inspected across the requested repositories; current official OpenAI pages fetched, URLs/access date recorded. No README-only architecture assumption. Limitation: most requested review products do not yet own canonical packs. Next: domain-owned registrations, without OpenAI-specific wrappers.

## 2. Native projection / local execution

Changed: `src/projection.kujo`, `openai.kujo`, pinned `vendor/ability`, `lib/*`, `bin/*`, operator/application examples. Deterministic versioned names, unchanged schemas, explicit unsupported entries, application visibility, canonical policy/approval/idempotency, bounded transport and private receipt resources.

Tests: real native execution; direct-vs-projected equivalence for seven representative contracts; trusted bound approval and denied consumption; future registration without host changes; canonical upstream contract/runtime suites; schema/name/effect mapping; malformed/unknown input; forged receipt; path/symlink/integrity checks; timeout/cancel/concurrency; credential canary; no retry; no-receipt uncertainty; MCP framing/lifecycle/official client/reconnect.

Results: 17 Node test cases pass, including native suites. Six authored Kujo files pass `kujo check`. Tested with Kujo 1.6.0 and Node 26.7.0 on macOS x64; earlier 16-case baseline also passed on the available Kujo 1.5.0 runtime. The documented supported baseline remains 1.6+. Node 22/Linux is configured for CI and must be assessed from its actual run, not inferred from macOS results.

Limits: single-operator local trust; no sandbox; process-group termination cannot undo effects. Transport has no resumable approval/key-control channel. Native API accepts application-resolved context, but generic local mutation calls remain blocked without it. Output roots must be MCP-compatible objects. Open-world/destructive annotations are conservative because Ability v1 lacks precision. No receipt means uncertain completion after launch.

## 3. Real canonical pack

Changed: `scripts/configure-mcp-pack.mjs`, `tests/integration.mjs`, `docs/evidence/mcp-core.json`. This configures existing MCP core handlers rather than maintaining new OpenAI product handlers. Source commit pinned in setup and evidence.

Results: five integration cases passed on Kujo 1.6.0: repository profile, valid manifest, traversal, drive-qualified path, shell-like path. Successful schemas match the canonical JSON definitions exactly; all executed cases preserve canonical receipts. Private audit/receipt files remain in ignored `.local`, outside Git.

Limits: the existing pack binds its own MCP checkout as the root; it is not an arbitrary repository change reviewer. Broader workflows are unavailable until registered. No remote process/code execution is enabled.

## 4. Skills / package / host compatibility

Changed: three `skills/*/SKILL.md`, portable manifests, supported Codex compatibility manifests, versioned manifest schemas, packaging script, acceptance/privacy/submission/setup/extension docs and CI.

Results: official versioned portable schemas validate; compatibility manifests match. Two consecutive archive builds matched SHA-256. Archive includes locked production dependencies, checksum, dependency inventory and unsigned provenance. `npm audit --omit=dev --audit-level=high` found zero vulnerabilities at verification time. Isolated Codex CLI 0.144.4 install/list/remove and execution of the installed catalog passed (`evidence/codex-profile.json`). Live user profile was not modified.

Limits: no real ChatGPT model/tunnel evaluation, public endpoint, OAuth acceptance, directory submission or publication. Acceptance prompts are clearly marked pending. The current CLI needed compatibility manifests; portable schema validity alone did not prove installed behavior.

## 5. Completion boundary / handoff

The **local infrastructure milestone is verified**. The full mission's end-to-end “review my changes” experience and public installation are **not complete**. Remaining requirements are canonical review-tool registrations, trusted resumable approval/idempotency integration, precise host-neutral effect semantics, hosted identity/isolation, live host acceptance and submission materials. None is replaced by a permissive shell or handcrafted per-product wrapper.

SignalBox holds only the unresolved cross-host effect-semantics observation. Routine verification and session continuity belong in Strata. The repository is created privately; no npm package, public release, plugin directory entry or live hosted service was published.

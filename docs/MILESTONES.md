# Milestone evidence — 2026-09-29

## 1. Research / architecture

Changed: source-backed research, reviewed revision inventory, native projection decision and threat model. Files: `RESEARCH.md`, `research-revisions.json`, `ARCHITECTURE.md`, `SECURITY.md`.

Why: CMD's product dispatch table and historical generated runtime do not satisfy the requested portable capability architecture. Canonical Ability remains unchanged; the adapter uses the same registry/runtime contracts and existing MCP surface.

Verification: implementation and tests inspected across the requested repositories; current official OpenAI pages fetched, URLs/access date recorded. No README-only architecture assumption. Limitation: most requested review products do not yet own canonical packs. Next: domain-owned registrations, without OpenAI-specific wrappers.

## 2. Native projection / local execution

Changed: `src/projection.kujo`, `openai.kujo`, pinned `vendor/ability`, `lib/*`, `bin/*`, operator/application examples. Deterministic versioned names, unchanged schemas, explicit unsupported entries, application visibility, canonical policy/approval/idempotency, bounded transport and private receipt resources.

Tests: real native execution; direct-vs-projected equivalence for seven representative contracts; trusted bound approval and denied consumption; future registration without host changes; canonical upstream contract/runtime suites; schema/name/effect mapping; malformed/unknown input; forged receipt; path/symlink/integrity checks; timeout/cancel/concurrency; credential canary; no retry; no-receipt uncertainty; MCP framing/lifecycle/official client/reconnect.

Results: 17 Node test cases pass, including native suites. Six authored Kujo files pass `kujo check`. Tested with Kujo 1.6.0 and Node 26.7.0 on macOS x64; earlier 16-case baseline also passed on the available Kujo 1.5.0 runtime. The documented supported baseline remains 1.6+. Node 22/Linux CI also passed all gates in [run 36644324934](https://github.com/kujolang/kujo-openai/actions/runs/36644324934) at implementation commit `1edf35a`, including the checksum-pinned released Kujo 1.6.0, real pack integration and reproducible packaging.

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


## Host-neutral semantics follow-up — 2026-09-29

Ability now validates optional `semantics` (`open_world`, `destructive`, `executes_code`) in native Kujo, TypeScript, Python and the fixture devkit. Existing definition digests, runtime behavior and authority checks remain unchanged. Fourteen shared positive/negative cases cover missing/extra/mistyped facts and contradictions with declared effects. All upstream suites pass after rebasing onto the independently published Ability 1.2.0 release.

The adapter vendors Ability a9dc8f1b5c766c5fb7469e50e4911cf3bd862cfa unchanged, projects explicit facts, preserves execution metadata, and retains conservative defaults for legacy definitions. Its 17 tests pass, including direct canonical execution equivalence and all 14 semantic projection cases. Updated files: canonical vendor and lock, vendor script, native projection/tests, architecture/extension guidance, and this record. The earlier semantic-gap finding is addressed by this contract; product authors still need to review and declare facts. Enriched definitions require updated strict readers.

Next: supply host-neutral registered review capabilities and verify a real change-review workflow; complete trusted approval continuation, remote execution/authentication integration and live ChatGPT acceptance. The full mission remains active.

## Canonical change-review capability milestone — 2026-09-29

Ability `527d7674f232a368e0c7a0abdb018bdfbb850d07` adds an optional bounded JSON process binding and a host-neutral repository-review pack. It binds the real PatchBrief and ChangeBucket CLIs; the adapter adds only provisioning, exposure records and tests. Product commands and domain contracts remain outside the OpenAI adapter. A new compatible registry still needs no projection changes.

The binding keeps model input out of argv, cwd, environment and program selection; uses an explicit environment, bounded stdout/stderr and deadlines; and reports nonzero exits, invalid JSON, truncation and timeout as failures. Eight binding assertions and the full Ability core suite pass. The canonical pack integration passes two real CLI invocations and two hostile-filter rejections. Repository selection belongs to the operator; these read-only tools accept `{}`. PatchBrief output schema is read directly from its source schema; ChangeBucket's initial pack contract checks the documented report keys. Canonical receipt audit metadata preserves reviewed source revisions.

A reproducible PatchBrief textconv canary failed before the fix on VM and interpreter. PatchBrief `a4da5942e9668924cd2f2869859bf05b006edda5` disables textconv across full, fallback, stat and single-file diff paths; the full test fixture passes on VM and explicit interpreter. ChangeBucket is pinned at `030eea63c60449f82c9ba2680227485d318fdb6d`. This resolves the observed textconv path; it does not certify hostile repositories as safe.

The adapter's 17 contract/protocol tests and six actual change-review MCP cases pass. New files: canonical vendor binding/pack, `scripts/configure-review-pack.mjs`, `tests/review-integration.mjs`, and receipt evidence. Updates: plugin starters, change-review skill, setup/acceptance documentation and CI. CI at the prior semantics commit `77b5f1c` passed (run `36645659223`); the new review workflow is checked separately after push.

Limits: trusted operator-controlled POSIX checkout only; Git configuration guards are not race-free containment. Source pins are verified at provisioning, not cryptographic runtime attestation. No remote exposure or live ChatGPT acceptance is implied. Next: trusted approval/idempotency continuation, safe remote canonical runtime integration, remaining registered workflows and live host/submission acceptance. The full mission is not complete.

## Durable approval and continuation milestone — 2026-09-29

Ability `44f2e8123b5df9f3abd478426ab5a10ada1ebb3b` adds `services/local_sqlite.kujo`, an optional implementation of existing canonical audit, one-time grant consumption and keyed idempotency callbacks. Canonical policy, approval digests, execution ordering and receipt schemas are unchanged. Operator-issued exact grants can be revoked and consumed atomically. Completed keys replay original validated receipt bytes; started keys remain unresolved after interruption rather than permitting automatic duplicate execution. Audit stores commitments rather than raw input. Business and receipt commits remain separate, so this is not exactly-once execution.

The adapter adds an opt-in `invocation-v1` continuation protocol, private input-free descriptors, a narrowly scoped MCP resume tool, and native `prepare_invocation` to let applications stage the exact canonical invocation. The model cannot replace input, select a principal, grant approval or invent a retry key. The application authenticates the current caller, resolves the original staged request and re-enters canonical execution. Default read-only packs do not advertise this capability. The mutation provider in the tests is an isolated application fixture, not a production mutation catalog.

Files: Ability service, documentation and native/Node tests; adapter continuation store, adapter/server/backend/CLI integration, native projection export, pinned canonical vendor, `docs/CONTINUATIONS.md` and native continuation integration test. Tests: full Ability suite passes in interpreter and VM; eight competing processes produce one fixture business write, restart replays the original receipt, altered/revoked/forged grants fail, conflicts and persistent started state fail closed, and corrupted receipt storage is rejected. Adapter suite: 18 tests pass, including actual native approval and MCP continuation, changed-definition rejection, unsupported-provider rejection, private descriptor contents and forged-control rejection.

Remaining: production application approval UI/authentication and reconciliation are application-owned and have not been deployed; remote canonical execution/isolation, remaining workflows, live ChatGPT acceptance and public submission are still incomplete. Next integrate the canonical runtime behind a remotely authenticated provider without exposing the trusted-local review profile to untrusted tenants.

Post-push verification: Ability CI `36648221588` passed at `44f2e81`; adapter CI `36648673780` passed at `59e91a7`, including core tests, real MCP core/review integrations and reproducible packaging. The full requirement ledger is [COMPLETION.md](COMPLETION.md); local continuation infrastructure is not a substitute for production approval or remote/live-host acceptance.

## 2026-09-29 — Canonical release signals

Ability `1378738` adds opt-in `kujo.shipcheck.repository.scan@1.0.0` to its trusted-local review pack. Existing configurations still yield the same two definitions. ShipCheck is pinned at `111bfc83c832050877cb9d4fd82908aaf6d14749`; its published schema and fixed scan command remain in Ability, not host wrappers. The implementation grants shell execution only to the reviewed product process for its quoted Git detection helper, and retains the pack's executable-configuration guard.

Canonical tests pass for both configurations: two real CLI executions plus two hostile-filter rejections, and three executions plus three rejections. The release MCP integration passes nine cases, comparing ShipCheck's schema exactly and preserving its failed domain gate inside a successful canonical execution receipt. Files: Ability pack/runtime/docs/test, adapter vendor lock, provisioning script, review integration, CI, ship skill and setup/acceptance/completion documentation.

This milestone enables a real release-evidence catalog and teaches the skill to distinguish observations from readiness. It does not run tests, verify artifacts, register Spec/Eval/Scout/Scent, certify hostile repositories, or prove live ChatGPT behavior. The in-app ChatGPT page was signed out; a user sign-in request is pending. Remote canonical execution and public submission gates remain in COMPLETION.md. Next: authenticate the host for live acceptance and implement the authenticated remote canonical execution boundary without exposing trusted-local review handlers.

## 2026-09-29 — Authenticated remote resource-server boundary

Added `lib/oauth.mjs`, `lib/remote.mjs`, `lib/remote-adapter.mjs` and five native/SDK test suites. The design reuses the existing projection/Adapter and canonical runtime; it does not implement a second orchestration engine or enable local review processes remotely. OAuth introspection establishes identity for each request; tokens are removed before SDK/provider execution. Exact digest certification plus explicit canonical semantics bounds the first remote execution class. Principal-bound receipt validation/read access supplements the application's tenant-isolated storage and policy.

Verified five suites: issuer/audience/expiry/not-before/revocation/scope/tenant failures and credential diagnostics; native execution through official SDK Web Request transport; cross-subject and cross-tenant receipt rejection; legacy provider/certification failures; protocol input/origin/body/concurrency limits; cancellation/deadline uncertainty without retry. The issuer and native catalog are controlled test fixtures; live OAuth flows, TLS serving, isolated production providers and public deployment remain unverified. See REMOTE.md for the explicit application binding contract and sources accessed 2026-09-29.

Release-workflow CI passed at `eca36444cca61d51fea718863a4c91ef598303f5`, run `36649955680`, including the original six review cases, optional nine release cases and reproducible packaging. Next: connect a verified issuer and certified production provider, complete live ChatGPT acceptance after sign-in, and retain the full mission ledger until its deployment/submission gates are met.

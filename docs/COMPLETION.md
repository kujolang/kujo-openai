# Full-mission completion ledger

This ledger preserves the requested end state. A green local milestone does not complete the mission. Status is evidence-based as of 2026-09-30; live deployment and host behavior require fresh verification.

| Requirement | Current evidence | Status / remaining proof |
|---|---|---|
| Research Ability, CMD, Pi, MCP, Skills, Dispatch, Workcell, RunLedger, Eval, ShipCheck, Scout, Scent, Spec, PatchBrief, ChangeBucket and root conventions | RESEARCH.md and research-revisions.json record source/implementation/test review | Reviewed at recorded revisions; recheck changed contracts when integrating |
| Current official OpenAI plugins, directory, MCP, local/remote, skills, OAuth, annotation, approval, security and submission requirements | RESEARCH.md source URLs/access dates, official manifest schemas, SETUP/REMOTE/SUBMISSION | Research recorded; deployed conformance is separate |
| Name appropriate to ecosystem | kujo-openai repository/package, architecture rationale | Implemented |
| Ability owns definitions, schemas, effects, retry, policy and execution | Unmodified pinned canonical runtime; native projection/direct-execution comparison | Verified local |
| Generic discovery, binding and future capabilities | Registry-driven tool generation; future Ability contract test; two independent canonical packs | Verified local; no product command wrappers in adapter |
| Stable/reversible collision-safe naming | Identity hash, exact catalog reverse lookup, collision rejection tests | Verified |
| Input/output schema preservation | Exact projection and real MCP core / PatchBrief integration | Verified for MCP-compatible object schemas; unsupported schemas explicit |
| Precise effects semantics without name inference | Optional canonical semantics across native/TS/Python/devkit; legacy conservative defaults | Verified; product author declarations still require review |
| Authority, approval, retries | Canonical tests; local SQLite service tests; native MCP continuation test | Infrastructure verified. Production approval UI/authentication and business reconciliation remain application work |
| Receipts and provenance | Original canonical receipts, hash-addressed private resources, application audit source revisions | Canonical storage and remote principal isolation tested; structured receipt helper and exact IDs/URIs verified in live ChatGPT private-tunnel review |
| Pure/read/file/write/external/approval/retry/output/failure classes | Native contract fixtures plus real MCP core and review handlers | Representative test coverage; production mutation classes not registered by default |
| Repository Review skill | Skill, real MCP repository profile; optional review pack | Static/package validation; live ChatGPT selection/explanation pending |
| Change Review skill | Real PatchBrief + ChangeBucket through Ability/MCP, six integration cases | Installed three-Skill package performed live ChatGPT change review; explicit automatic Skill-file loading remains unproven |
| Release/Ship Review skill | Optional canonical PatchBrief + ChangeBucket + ShipCheck catalog, nine actual MCP cases and composition skill | Installed Skill loaded in Codex and composed all three live tools with exact receipt lookups; browser automatic Skill selection remains unproven |
| Spec/Eval/Scent/Scout workflows where applicable | Source-backed skill guidance and missing-capability handling | Corresponding production canonical registrations/compositions incomplete |
| Local transport and installation | Official SDK stdio tests; isolated Codex profile; real npm tarball installation on Linux/macOS with canonical tool/receipt calls (CI 36798888691) | Published runtime 1.7.0 and isolated adapter installation passed on Linux x64/arm64, macOS x64/arm64 and Windows x64 (CI 36866757041) |
| Install-and-use on each user computer | Owner clarification in SETUP.md; setup provisions pinned runtime and canonical sources | Node/Git, explicit repository setup and a supported local host remain prerequisites; automatic public-directory dependency installation and browser-to-local connectivity are unproven |
| Official Kujo K branding | Exact kujolang.ai SVG provenance and derived PNG are packaged | Installed ChatGPT still displays its placeholder; host asset ingestion remains unresolved |
| ChatGPT local client route | Official Secure MCP Tunnel/developer-mode setup documented | Private tunnel connected; three canonical read-only tools invoked successfully in ChatGPT (ACCEPTANCE.md); three Skills installed and live combined review verified; automatic browser Skill activation remains unproven |
| Remote trust architecture | REMOTE.md and inspected existing Ability gateway | Resource-server boundary tested with native Ability fixtures; isolated production provider/deployment incomplete |
| Publicly installable plugin | Portable current-format package, skills, metadata, starters; local and optional hosted profiles | Local distribution requires the host support documented in SUBMISSION.md. Hosted operation is optional, not a substitute for the owner's local install-and-use requirement; no production hosted execution is claimed |
| OAuth, per-user grants, isolation, credential custody, revocation/scopes | Official requirements and gateway source reviewed | Introspection, scope and principal/receipt isolation boundary tested; live issuer flows, credential custody and deployment tests incomplete |
| Workcell/Dispatch/process boundaries | SECURITY/REMOTE mark unrestricted remote execution unsupported | Correctly withheld; certified remote execution profiles still required if enabled |
| Security threat model and introduced local boundaries | SECURITY.md; injection/path/schema/receipt/approval/limits tests; PatchBrief textconv regression | Local tests pass. Remote threats require remote implementation and isolation tests |
| Explicit failure semantics | Canonical status/isError, no-receipt uncertainty, timeout/cancel tests | Verified local; remote reconciliation pending |
| Concurrency, restart, cancellation, timeouts, malicious clients, credentials | Adapter tests; eight-process SQLite contention/replay; framed MCP protocol tests | Verified within documented local trust boundary |
| Backwards compatibility | Legacy digest vectors and native suites; CMD/Pi unchanged; enriched-definition rollout documented | Verified for old definitions; older strict readers must update before enriched definitions |
| Extension process | EXTENDING.md, native projection and host-neutral pack/binding examples | Documented and tested for added definitions |
| Documentation 1–13 | README and ARCHITECTURE/SETUP/REMOTE/SECURITY/EXTENDING/CONTINUATIONS/ACCEPTANCE/SUBMISSION/PRIVACY | Written; unimplemented/live requirements explicitly labeled |
| Positive/negative submission tests | ACCEPTANCE.md and real protocol integration evidence | Model-selected live cases, dedicated reviewer account/walkthrough video and portal validation incomplete |
| End-to-end “@Kujo review these changes” | Canonical tools + real MCP + receipts proven | Live three-tool change review and grounded domain explanation verified; exact receipt visibility verified; packaged Skill selection remains pending |
| Commit/push/clean state and durable memory | Git remote refs, CI runs and Strata handoffs | Recheck at each milestone |

Do not claim remote readiness from local filesystem permissions, a simulated approval, a fixture identity, a green MCP client test, or the existing gateway's fixture-only execution path. Complete each outstanding proof against the intended host and distribution before closing the goal. Preserve the owner's local-first requirement: testing an optional hosted profile does not establish automatic installation or local repository access for public plugin users.

### Windows candidate adapter gate

The adapter now always requests the runtime's `--kill-children-on-exit`
job boundary when launching a provider on Windows. There is no fallback to
uncontained execution: older runtimes reject that option before running the
provider. This option does not grant capabilities or prove rollback.

`.github/workflows/windows-candidate.yml` builds immutable runtime candidate
`8c561cacdcb132faa310df2b81f56c27ff4537df`, then tests adapter cancellation and
three real canonical review tools, negative inputs, and exact receipts over
MCP. Candidate validation is separate from the installed-package matrix.
The dependency remains published runtime 1.6.0; Windows installation support
must not be claimed until a verified release is pinned and that matrix passes.

On 2026-10-01, the corrected Windows source-built cohort passed all nine real
release-review MCP cases, including positive Git detection and exact canonical
receipt/source-revision checks. Native cancellation and timeout tests passed
(two tests; one POSIX-only case skipped). See
[evidence/windows-candidate.json](evidence/windows-candidate.json) for immutable
source pins and the successful workflow run. This closes candidate integration,
not published-package acceptance: runtime 1.6.0 is still the dependency and the
optimized five-platform artifact cohort and installed-candidate matrix have now
passed; see [artifact evidence](evidence/runtime-artifact-candidate.json). A newly
versioned, authorized runtime release and registry-based acceptance remain required.

The unpublished 1.7.0 preparation is tracked in
[runtime PR #17](https://github.com/kujolang/kujo/pull/17). Its corrected commit
`f68750b368e6ebaf4dcaf588b4984651bb4d9670` passed the full release gate:
2,891 Rust tests passed, none failed, 17 ignored; both fixture runs passed
150 tests with 11 skipped. The candidate identity contract also passed.
Optional cargo-audit/cargo-deny were absent and skipped. All 25 PR checks passed.
All five optimized native artifacts and the neutral npm package have verified
source/version/digests, native/npm binary identity and lifecycle-script absence.
The versioned candidate installation matrix passed on all five targets, including
Windows: each performed fresh/repeat setup, nested discovery, three canonical
tool executions and exact receipt lookups. A local Intel Mac installation of the
same CI packages also passed. Publication jobs were skipped. Runtime publication,
registry-based acceptance and public ChatGPT local-host support remain outstanding.
See [versioned candidate evidence](evidence/runtime-1.7-candidate.json).

### Authorized 1.7.0 publication

On 2026-10-01 the owner supplied `UNBLOCK_V1_RELEASE`. Runtime PR #17 was
merged as `813072040a1ac643312f5163fcfa4f26474c9095`; its tree exactly matches
the tested candidate. Signed tag `v1.7.0` was verified locally and by GitHub.
The [tagged publication workflow](https://github.com/kujolang/kujo/actions/runs/36850604536)
is running. This removes the authorization blocker; it does not establish
publication, registry installation or public-host support. See
[publication evidence](evidence/runtime-1.7-publication.json).

### Published runtime and user-local acceptance

Runtime 1.7.0 native and npm publication completed. Published native smoke
36857820990 and npm smoke 36866507729 passed on all five platforms. The native
Windows smoke initially hit GitHub rate limiting; its failed-job rerun passed
without changing artifacts. Adapter commit `5f0ce50` pins 1.7.0; registry-based
installation run 36866757041 passed on all five platforms, with contracts and
receipt-storage checks green. Local tests passed 43/43. The user's configured
repository ran all three canonical tools and exact receipt lookups through MCP.
The private tunnel is offline and must be restarted for ChatGPT validation.
These results supersede the earlier 1.6.0 dependency/Windows-pending observations.
Crates.io remains a separate packaging/authentication gate; its dependency fix
is being prepared without rewriting the signed 1.7.0 release.

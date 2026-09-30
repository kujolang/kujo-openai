# Full-mission completion ledger

This ledger preserves the requested end state. A green local milestone does not complete the mission. Status is evidence-based as of 2026-09-29; live deployment and host behavior require fresh verification.

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
| Receipts and provenance | Original canonical receipts, hash-addressed private resources, application audit source revisions | Verified local; remote authenticated evidence access pending |
| Pure/read/file/write/external/approval/retry/output/failure classes | Native contract fixtures plus real MCP core and review handlers | Representative test coverage; production mutation classes not registered by default |
| Repository Review skill | Skill, real MCP repository profile; optional review pack | Static/package validation; live ChatGPT selection/explanation pending |
| Change Review skill | Real PatchBrief + ChangeBucket through Ability/MCP, six integration cases | Tool workflow verified; live ChatGPT skill behavior pending |
| Release/Ship Review skill | Catalog-aware skill describes responsibilities honestly | Real release-review catalog/composition and live acceptance incomplete |
| Spec/Eval/Scent/Scout workflows where applicable | Source-backed skill guidance and missing-capability handling | Corresponding production canonical registrations/compositions incomplete |
| Local transport and installation | Official SDK stdio tests; bounded frames/processes; isolated Codex plugin installation | Verified; Windows process containment not certified |
| ChatGPT local client route | Official Secure MCP Tunnel/developer-mode setup documented | Actual tunnel/workspace connection and live ChatGPT acceptance incomplete |
| Remote trust architecture | REMOTE.md and inspected existing Ability gateway | Design recorded; canonical authenticated remote execution not implemented |
| Publicly installable remote plugin | Portable current-format package, skills, metadata, starters | Stable public endpoint, authentication, verified domain and reviewer evidence incomplete |
| OAuth, per-user grants, isolation, credential custody, revocation/scopes | Official requirements and gateway source reviewed | New adapter remote implementation and live security tests incomplete |
| Workcell/Dispatch/process boundaries | SECURITY/REMOTE mark unrestricted remote execution unsupported | Correctly withheld; certified remote execution profiles still required if enabled |
| Security threat model and introduced local boundaries | SECURITY.md; injection/path/schema/receipt/approval/limits tests; PatchBrief textconv regression | Local tests pass. Remote threats require remote implementation and isolation tests |
| Explicit failure semantics | Canonical status/isError, no-receipt uncertainty, timeout/cancel tests | Verified local; remote reconciliation pending |
| Concurrency, restart, cancellation, timeouts, malicious clients, credentials | Adapter tests; eight-process SQLite contention/replay; framed MCP protocol tests | Verified within documented local trust boundary |
| Backwards compatibility | Legacy digest vectors and native suites; CMD/Pi unchanged; enriched-definition rollout documented | Verified for old definitions; older strict readers must update before enriched definitions |
| Extension process | EXTENDING.md, native projection and host-neutral pack/binding examples | Documented and tested for added definitions |
| Documentation 1–13 | README and ARCHITECTURE/SETUP/REMOTE/SECURITY/EXTENDING/CONTINUATIONS/ACCEPTANCE/SUBMISSION/PRIVACY | Written; unimplemented/live requirements explicitly labeled |
| Positive/negative submission tests | ACCEPTANCE.md and real protocol integration evidence | Model-selected live cases, dedicated reviewer account/walkthrough video and portal validation incomplete |
| End-to-end “@Kujo review these changes” | Canonical tools + real MCP + receipts proven | Actual ChatGPT workflow selection and grounded explanation not yet verified |
| Commit/push/clean state and durable memory | Git remote refs, CI runs and Strata handoffs | Recheck at each milestone |

Do not claim remote readiness from local filesystem permissions, a simulated approval, a fixture identity, a green MCP client test, or the existing gateway's fixture-only execution path. Complete each outstanding proof against the intended host and deployment before closing the goal.

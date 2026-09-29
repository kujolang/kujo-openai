# Research and decisions — 2026-09-29

## Naming and scope

`kujo-openai` / `@kujolang/kujo-openai` follows `kujo-pi` and `kujo-cmd`: Kujo plus host family. `openai` already names the provider integration repository. `kujo-chatgpt` would obscure Codex and API use. This is a host adapter, not an orchestrator or a second product catalog.

## CMD implementation findings

Reviewed `lib/catalog.mjs`, `lib/app.mjs`, `lib/executor.mjs`, `bin/kujo-cmd-mcp.mjs`, `.generated/local-runtime.mjs`, `.generated/BUILD.json`, `catalog/profiles.json`, `tests/runtime.test.mjs`, `tests/security.test.mjs` and `docs/ADR.md`.

1. Discovery loads a static catalog and resolves profile inheritance plus enabled/disabled IDs.
2. `createApp` binds each catalog entry to an adapter handler; runtime `describe()` supplies the public descriptors.
3. `executor.mjs` is an explicit product-to-CLI dispatch table. New entries need a handler unless an existing adapter fits.
4. MCP preserves domain schemas in metadata but inserts `_kujo` into input and returns an execution envelope under the domain output schema. Do not copy that schema/result mismatch.
5. Effects live in Ability definitions; CMD's read-only annotation checks all effects. Its local runtime treats non-read effects as approval-required.
6. Approval comes from a separate CLI flow, is bound to input/definition/invocation/principal, consumed under a state lock, and is not the host's confirmation UI.
7. Keyed idempotency reserves durable state and prevents a concurrent duplicate; it is not blanket permission to retry. Uncertain completion needs reconciliation.
8. File state stores receipts, approval records and bounded idempotency shards. Correlation fields are not authentication.
9. Profile selection, schemas, receipt production and authority are generic concepts worth reusing.
10. Command Code installation, configuration, skill placement, host labels and `_kujo` presentation are specific to that host.
11. The generated runtime is a pinned historical `mcp` JS implementation (`c41aa57`, source no longer present at current MCP HEAD), not the current native Ability runtime. Do not claim byte-equivalent semantics across them.
12. Reuse canonical native execution, not CMD's product wrappers, altered schema envelope, permissive descriptor validator, or historic generated runtime.

## Ecosystem contract map

All entries were inspected through README plus implementation/test paths. Exact reviewed revisions are in `research-revisions.json`. Source paths are relative to the named repository.

| Repository | Sources examined | Consequence |
|---|---|---|
| Ability | `src/{contract,contracts,registry,runtime}.kujo`, schema, SDK/RUNTIME docs, runtime contract tests | Registry owns definitions/bindings/exposures. Services own policy, audit, one-time approval and durable idempotency. Use this code directly. |
| MCP | `src/abilities/{projection,gateway}.kujo`, integration bridge, `packs/mcp_core/runtime.kujo`, test 11 | Existing host projection precedent, authenticated visibility callback, real bounded pack. Avoid existing summary-vs-output-schema mismatch. |
| Pi | `src/{operations,capabilities,core}.mjs`, `tests/service-contract.mjs`, README | Historical direct product CLI contracts and generic gateway tools coexist. Do not copy CLI mismatches or host-specific permission policy. |
| Skills | README, guide, PatchBrief/ShipCheck skills, launch rules | Reuse responsibilities and workflow intent; remove local developer paths, CLI fallback and implied tool availability. Skills cannot enforce security. |
| Dispatch | `src/adapters/mcp_ability_handoff.kujo`, HTTP/Ability assurance adapters, integration tests and docs | Correlation evidence is not replay authority. Persisted negotiation plus live verification remain required. Adapter must not become scheduler/retry engine. |
| Workcell | `src/policy/policy.kujo`, security/lifecycle docs, evidence recovery tests | Container/provider is isolation boundary. Workcell metadata alone is not sandboxing or hosted certification. |
| RunLedger | `src/{record,storage}.kujo`, tests | Run statuses and correlation are distinct from Ability receipts; preserve references rather than synthesize RunLedger records. |
| Eval | README, control/quality tests, control evidence contracts | Suites can run commands, HTTP and file checks. Actual evaluation verdict is distinct from successful invocation. |
| ShipCheck | `src/{scan,checks,report}.kujo`, CLI contract tests | Scans 16 release signals; does not run tests. Gate differs from informational scan. |
| Scout | `scout.kujo`, README, tests | Repository analysis can produce artifacts; not inherently a pure operation. No independently owned Ability pack found. |
| Scent | `scent.kujo`, defaults/CLI, README, tests | Bounded task context; dry-run and artifact production have different effects. No independently owned Ability pack found. |
| Spec | `src/{validate,export}.kujo`, README/tests | Validates task contracts; exports do not prove implementation conformance. |
| PatchBrief | `src/{git,summarize,suggest_tests}.kujo`, CLI tests | Heuristic diff brief and test suggestions; not proof tests ran. |
| ChangeBucket | `src/{diffsrc,analyze,budget}.kujo`, tests | Measures footprint and enforces budgets; not a semantic review. Ref validation and bounded untracked reads matter. |
| Kujo | AGENTS, module/stdin/capability standard-library contracts | Native semantics; `read_stdin` needs outer deadline; restricted capabilities are not a sandbox. |
| Ability gateway | `src/catalog.ts`, package/README | Existing multi-tenant gateway is a separate deployment boundary; its stored projected descriptors cannot replace canonical definitions here. |

MCP's launch catalog explicitly defers many of the requested tools until their domain repositories own versioned definitions, bounded handlers and conformance. This adapter therefore does not claim a working Scout-to-ShipCheck pipeline. Adding those canonical packs is ecosystem work, not an excuse to introduce OpenAI wrappers.

## Official OpenAI requirements

Accessed **2026-09-29**. These are current plugin docs, not historical ChatGPT plugin/Actions manifests. Requirements are release-sensitive; recheck before submission.

- [Plugin packaging](https://developers.openai.com/plugins/build/plugins): portable `plugin.json`, `mcp.json`, `skills/`; OpenAI presentation under `extensions.com.openai`. One directory serves ChatGPT and Codex; local package support varies by surface. The compatibility `.codex-plugin` format remains supported, but new portable layout is preferred.
- [MCP server](https://developers.openai.com/plugins/build/mcp-server): schemas, annotations, structured results, server authorization; public distribution uses stable HTTPS Streamable HTTP. Open-world includes internet reads; bounded private services need not be open-world. Annotation hints do not grant authority.
- [Authentication](https://developers.openai.com/plugins/build/auth): OAuth discovery, PKCE S256, audience/resource binding, issuer identification, exact registered redirect, scopes and authorization challenges. Choose supported CIMD/DCR or preconfigured client registration deliberately; never treat an MCP parameter as identity.
- [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt): test protocol first, then developer-mode tools, then installed skills; retain positive, negative and boundary prompt results. Refresh after metadata changes.
- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels): private stdio/HTTP can connect through outbound tunnel client; requires tunnel/runtime credentials and workspace association. It is not a public-submission endpoint.
- [Submission](https://developers.openai.com/plugins/deploy/submission): verified publishing identity, current package, one connected MCP per plugin, domain challenge, five positive and three negative cases, reviewer account where needed, walkthrough recording and release notes. Credentials stay outside the package. Submission approval and publication are separate.
- [Remote review](https://developers.openai.com/plugins/deploy/app-review): remote tools undergo review and ongoing checks. Discovery does not imply approval for publication of arbitrary new tools.
- [Security/privacy](https://developers.openai.com/plugins/guides/security-privacy): minimize information, validate inputs and authorize on server; injected external content is untrusted.
- [Skills](https://developers.openai.com/plugins/build/skills): focused reusable workflows, tested for activation and output. Packaged skills suffice; no need to implement draft MCP skill-import extension.

The local package is valid authoring material, not a claim of directory acceptance. No obsolete `ai-plugin.json`, OpenAPI Actions authentication, fake app ID, invented privacy URL, or fabricated live test is included.

## Decisions

- Native Kujo projection + untouched pinned Ability runtime. Node handles stdio/process lifetime and the official MCP SDK; it contains no product bindings or approval policy. This narrow host-transport exception avoids implementing another MCP protocol stack in Kujo.
- Keep canonical surface `mcp`; host correlation `openai` belongs in invocation metadata. No new Ability surface enum or API is necessary.
- Select existing explicit MCP exposures through an application-owned visibility callback. Recheck visibility for every call; never enumerate unexposed definitions.
- Exact version included in name identity; readable prefix plus 128-bit hash. Reverse via catalog. Detect collisions and fail closed. Adding a different Ability never renames existing tools.
- Preserve schemas unchanged. Successful `structuredContent` is the canonical result; receipt pointer/status goes in text and metadata. Failures use `isError` without claiming successful-schema compliance.
- Current effects cannot distinguish open-world reads, reversible writes, or process execution precisely. Conservative hints are safe for local experimentation but lack submission precision. A future optional host-neutral effect-semantics extension belongs in Ability with cross-language compatibility tests, not in product-specific OpenAI metadata.
- No automatic retries, no generic `ability_call`, no shell tool, no approval minting, no broad remote execution.

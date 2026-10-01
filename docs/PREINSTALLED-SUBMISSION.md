# Preinstalled-only submission checklist

**Status: BLOCKED.** Accessed official [packaging](https://developers.openai.com/plugins/build/plugins) and [submission](https://developers.openai.com/plugins/deploy/submission) docs on 2026-10-01. An internal technical/publisher blocker is labeled separately below: calling it “BLOCKED BY OPENAI” would be inaccurate.

| Requirement | State | Evidence / remaining work |
|---|---|---|
| Portable and Codex manifests | PASS (development profile) | Versioned schema/parity tests; actual entrypoint still Node |
| Prerequisite and honest listing | FIXED | Both manifests disclose preinstalled goal and current dependency gap |
| Brand | PASS (packaged asset) | Existing Kujo K PNG/SVG and manifest references; actual host rendering must be accepted again |
| Native local entrypoint | BLOCKED — implementation | Kujo 1.7.0 has no native stdio server |
| No Node/Git runtime dependencies | BLOCKED — implementation | Current transport/setup require them; native preflight alone is not the adapter |
| Missing-runtime diagnosis | FIXED (standalone diagnostic) | Native bounded preflight; not connected to host onboarding |
| Six-platform local launch | BLOCKED — implementation/acceptance | Cross-compilation is not execution; Windows ACL boundary fails closed |
| Selected-folder isolation | BLOCKED — implementation/acceptance | Operator-root setup differs from verified host grants |
| Ability semantics, approvals, receipts | PASS (development adapter) | Canonical tests remain applicable; native parity remains untested |
| Local execution/privacy disclosures | FIXED | README, INSTALL, SECURITY, PRIVACY, SUPPORT |
| Public website/support URLs | PASS (existing repo links) | Publisher identity verification is separate |
| Public privacy and terms URLs | BLOCKED — publisher | Local privacy notice supplied; publisher-approved terms and public listing metadata still needed |
| Five positive / three negative review cases | BLOCKED — acceptance | Rerun against final native-only package; legacy cases do not qualify |
| Reviewer walkthrough / host visuals | BLOCKED — acceptance | Record actual final flow; no fabricated recording or screenshots |
| Publisher verification / policies / rights | BLOCKED — publisher | Confirm in portal; no submission or acceptance performed |
| Public local MCP distribution | BLOCKED BY OPENAI | Exact question prepared in OPENAI_LOCAL_MCP_APPROVAL.md, not sent |
| Remote HTTPS/OAuth deployment | NOT APPLICABLE to chosen architecture | No hosted substitute; local exception still required |
| Automatic installation/hooks | NOT APPLICABLE | Not implemented or required |
| Release publication | NOT APPLICABLE now | Explicitly prohibited by task |

`npm run package:submission` intentionally exits 1 before creating a ZIP. Its limited gate prevents current native/host gaps from being overlooked; it does not validate legal terms, publisher identity or all review requirements. `npm run package` remains a legacy developer build and must not be submitted as this product.

Reviewer plan once the actual native implementation exists: positive discovery, repository read-only result, structured output, canonical receipt retrieval, restart/reconnect; negative missing runtime, unauthorized project, denied effect. Expand with actual workflow prompts and exact projected tool identities after catalog selection. Do not insert these unexecuted plans as passed review metadata.

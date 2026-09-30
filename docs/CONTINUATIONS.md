# Application-owned continuation

The optional `invocation-v1` provider capability supports approval continuation and reconciliation without changing domain tool schemas. It is disabled unless an application explicitly advertises it in its catalog:

```json
{"ok":true,"schema":"kujo.openai.catalog/v1","tools":[],"unsupported":[],"capabilities":{"resume":"invocation-v1"}}
```

A supporting application must durably associate each host-generated invocation ID with the original validated identity, exact definition and input (or safe input references), policy context and idempotency key. The ID is correlation, never authentication. Before accepting `resume`, authenticate the current caller and authorize access to that stored invocation; a model cannot choose a principal or substitute input. Recheck canonical availability, policy and approval through `execute_ability`. Do not resume non-retryable or uncertain operations by running them again without application evidence.

The adapter creates a private, hash-addressed continuation descriptor before the initial call. It stores only tool identity, definition digest and invocation ID, never input or approval grants. The descriptor survives adapter restart. Both the text summary and `_meta.kujo/continuationUri` return its reference, including on known uncertain transport failures. A reference grants no authority. Receipt references remain separate and unchanged.

When the provider supports this capability, MCP discovery adds `_kujo_resume_invocation` with one argument, `reference`. This administrative tool is additional to the dynamically projected domain tools. It accepts no payload, path, key, principal or approval claim. Its conservative effect hints reflect the potential effects of a pending invocation. The adapter verifies the current tool identity/digest before forwarding:

```json
{"operation":"resume","invocation_id":"original-host-generated-uuid"}
```

The provider must return the original canonical invocation identity and canonical receipt. For keyed replay, return the original receipt unchanged. The transport never generates a replacement idempotency key or automatically retries. Unknown, revoked or changed capabilities fail closed. A missing authoritative receipt remains uncertain rather than apparent success.

`prepare_invocation` in the native projection lets an application stage the exact invocation used by `invoke`. Preparation is neither authorization nor a claim that input is valid; only canonical execution makes those decisions. The application resolves grants from its own trusted store. Human approval happens through an independently authenticated application/operator channel, not an MCP approval boolean.

Ability's optional `services/local_sqlite.kujo` supplies local durable audit, exact one-time approval consumption and keyed receipt storage. It deliberately leaves a crashed started operation in-progress. Business effects and receipt commits are not one transaction. A recovery route must reconcile authoritative business evidence. See Ability's `docs/local-sqlite-services.md`; this is a single-operator local service, not remote tenant isolation.

The native test application (`tests/continuation-provider.kujo`) uses a private SQLite store and a separate operator environment to issue grants. It verifies pending approval, operator approval, native execution, restart replay, original receipt retrieval, rejection of forged control fields, changed definitions and unsupported continuation. This fixture does not register a production mutation workflow. The default MCP core and review packs remain read-only and do not advertise continuation until their owning application has such a workflow.

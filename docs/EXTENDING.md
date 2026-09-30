# Adding an Ability

The application integration is written once. New compatible registrations need no host-specific wrapper.

1. Define the semantic operation in its domain repository using `kujo.ability/v1`. Own the input/output schemas, effects and intrinsic/keyed/none idempotency there.
2. Register the exact definition and handler binding through Ability. Set a real handler timeout; use `kujo.result/v1` result mode when the handler already returns structured Kujo success/failure envelopes.
3. Register an enabled `mcp` exposure. Use application authorization to select which exposures are visible. Do not expose private descriptions before checking principal access.
4. Import this adapter's `openai.kujo` and call `discover(registry, context, visible)` or `invoke(registry, toolName, input, context, services, visible)`.
5. Provide application-owned `principal`, `invocation_id`, and, when independently verified, `approval` / `idempotency_key` in context. Supply canonical policy, durable audit, one-time approval consumption and durable idempotency services as required. See vendored runtime and upstream `docs/RUNTIME.md`.
6. Test direct canonical execution against projected execution, including denial and failure. Keep handler scope and effects honest. For object schemas supported by the host, the tool appears immediately on the next discovery without editing a product table.

## Process provider contract

The local adapter launches a trusted Kujo entrypoint per operation, writes one JSON request to stdin and closes it. The entrypoint writes exactly one JSON response to stdout. Diagnostics may use stderr but are discarded by the transport.

Discovery request: `{"operation":"discover"}`. Return the unmodified result of native `discover`.

Execution request: `{"operation":"invoke","name":"<projected-name>","input":{},"invocation_id":"<server-UUID>"}`. The entrypoint takes only these transport fields. It resolves principal and services itself and returns the unmodified native `invoke` result. It must not merge arbitrary request fields into trusted context.

Use `examples/provider.kujo` as a function-level template, and `scripts/configure-mcp-pack.mjs` as a working integration of an existing pack. Do not parse model text into shell commands, load bindings from a repository file, or use process-global memory for durable state.

## Host-specific exceptions

Non-object schemas cannot be advertised by this projection and are reported as unsupported. A UI-specific or account-profile tool may need an explicit host extension later; it must not duplicate domain schemas or grant authority. Declare optional host-neutral `semantics` in the canonical definition for precise annotations. No host-specific override files are needed; absent facts retain conservative defaults.

The native `invoke` API can accept an independently issued bound approval. The generic local process transport deliberately exposes no approval/key controls. Applications needing resumable human approval must supply a trusted control channel and stable invocation binding; exposing an `approved: true` argument is not an implementation of that channel.

For application-owned pending execution, see [continuation protocol](CONTINUATIONS.md). Keep durable grants and idempotency in the application/Ability services. The optional transport reference carries no authority and leaves canonical domain schemas unchanged.

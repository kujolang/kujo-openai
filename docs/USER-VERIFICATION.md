# Test your local Kujo connection

The adapter now uses published Kujo 1.7.0. Linux x64/arm64, macOS x64/arm64,
and Windows x64 passed isolated registry installations with three canonical
Ability executions and exact receipt lookups. This does not establish public
ChatGPT one-click installation support.

## Local verification

From the adapter checkout, with Node 22.13+ and Git installed:

```sh
npm ci --ignore-scripts
node bin/kujo-openai.mjs setup /absolute/path/to/your/repository
```

Launch the MCP server from that repository through your trusted local host, or
set `KUJO_OPENAI_CONFIG` to the configuration path printed by setup. The host
command is `node /absolute/path/to/kujo-openai/bin/kujo-openai.mjs serve`.
The model cannot select a different filesystem authority through tool input.

## Existing private ChatGPT tunnel

The previously installed private plugin can keep its existing tunnel identity.
Restart its local `.local/tunnel/start.command` from the adapter checkout and
enter the OpenAI key only into its local prompt. Keep that terminal running.
The machine-specific wrapper must reference the configuration printed by setup.
A connected directory badge alone is not proof that the server is reachable.

In ChatGPT, select Kujo and try:

- “Review the changes in the configured repository with Kujo.”
- “Assess release readiness and distinguish failed checks from execution errors.”
- “Show the exact Kujo receipts supporting that result.”

Expect registered ChangeBucket, PatchBrief and ShipCheck capabilities. Verify
that receipt evidence names the invoked Ability and matches its structured result.
A successful invocation can legitimately report that release checks failed.
Do not treat a missing capability, denied invocation or unreachable tunnel as a
successful review. Automatic Skill selection and the displayed brand icon need
separate checks in the actual ChatGPT UI.

## Crates.io status

Native and npm runtime installation works independently of crates.io. The
registry-compatible HTTP dependency fix is under review in runtime PR #18.
Its fork test suite and normalized package dry run passed, but it is not yet
published. Publishing requires local `cargo login`, followed by dependency
publication and a successful normalized root-package verification. Never paste
a registry token into a chat. The signed 1.7.0 tag must not be rewritten; a runtime
release containing the dependency fix requires a new signed version.

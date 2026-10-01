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

## Distribution scope and remaining steps

As of 2026-10-01, the publisher has deferred Cargo/crates.io packaging. Do not
request Cargo login, publish the HTTP fork, or make crates.io a plugin release
gate. The prepared runtime PR #18 is separate, deferred work. Kujo's compiled
runtime is already distributed through native releases and platform-specific
npm packages; plugin users do not need Rust or Cargo.

The next steps for the plugin are:

1. Finish verification and delivery of the pending runtime and website installer
   updates using the published 1.7.0 native/npm artifacts.
2. Confirm OpenAI supports installing and launching the npm package and its
   platform binary dependencies for public local MCP plugins, including Node/Git
   provisioning and explicit repository access. npm packaging alone does not
   establish one-click installation in ChatGPT.
3. Verify a fresh ChatGPT installation, workflow selection, three real tools,
   matching receipts, and the displayed Kujo K icon.
4. Complete submission metadata and review evidence, then submit through the
   supported distribution route. The private tunnel is a development connection,
   not evidence of public installation support.

See [the prepared support request](OPENAI-HOST-SUPPORT-REQUEST.md). A hosted
execution service is a separate architectural choice, not an automatic replacement
for the requested local installation experience.

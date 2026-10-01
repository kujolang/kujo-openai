# Kujo OpenAI

**Requires Kujo installed locally. Native-only public plugin: BLOCKED.**

Kujo Ability remains the source of truth for identities, schemas, effects, authority, execution and receipts. This repository projects those contracts into MCP tools without product-specific OpenAI wrappers.

The selected product flow is: install Kujo yourself → install the plugin on a supported local client → select a project → run authorized Kujo tools. The plugin must not install software or require Node, npm, Git, GitHub, credentials, tunnels or hosting. Web/mobile local filesystem access is not claimed.

That flow is **not implemented end to end yet**. An [experimental compiled native host](native/README.md) now runs canonical Kujo providers over bounded stdio without Node/Git and preserves durable receipts. Kujo itself still exposes `mcp make`, not a stdio server: the compiled adapter invokes the real `kujo run` provider contract. The default plugin manifest remains the legacy Node profile. Automatic project/provider onboarding, native distribution, Windows boundaries and public local-MCP approval remain separate gaps.

## What works today

- Existing development adapter: generic Ability projection, canonical policy, bounded MCP transport and durable receipts. Its Node/Git requirements remain explicit in [developer instructions](docs/LEGACY-DEVELOPMENT.md).
- Native host: explicit trusted provider configuration, canonical calls/receipts and bounded stdio. Its runtime diagnostic also handles missing/outdated installations. Build-time Go is not an end-user prerequisite. See the [native setup and limitations](native/README.md).
- Submission guard: `npm run check:submission` and `npm run package:submission` fail closed while native acceptance and public host support remain unverified. Ordinary `npm run package` still produces a legacy development archive, not a submission.

## Read next

[Install and use](INSTALL.md) · [Runtime contract](docs/PREINSTALLED-RUNTIME.md) · [Tests](TESTING.md) · [Security](SECURITY.md) · [Privacy](PRIVACY.md) · [Support](SUPPORT.md) · [Submission checklist](docs/PREINSTALLED-SUBMISSION.md) · [OpenAI question](OPENAI_LOCAL_MCP_APPROVAL.md)

No release was published, submission made, or support request sent. Historical hosted, bootstrap and tunnel documents are not the current product plan.

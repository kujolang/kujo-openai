# Packaging and submission

## Local package

`plugin.json`, `mcp.json` and `skills/` use the current portable Agent Plugins layout documented by OpenAI. The adapter does not use historical `ai-plugin.json` or GPT Actions. `npm run check` validates manifests against the fetched Agent Plugins 1.0 schemas. Schema source URLs are embedded in the manifests; fetched 2026-09-29.

Run `npm run package` after `npm ci`. It builds a ZIP with locked production Node dependencies, source/skills/docs, checksum, dependency inventory and unsigned provenance. Kujo itself is an operator-installed runtime; it is not downloaded or executed during plugin installation. The operator must provide a trusted application configuration. The package is local authoring/testing material and does not install into a live user profile.

## Public submission blockers

This release deliberately cannot claim public readiness:

- No deployed stable HTTPS Streamable HTTP endpoint, domain challenge or OAuth integration.
- No certified multi-user isolation or remote execution profile.
- Conservative v1 annotations need canonical semantic precision and review.
- Full repository/change/ship workflows require additional application-owned Ability packs.
- No live ChatGPT prompt/skill acceptance record, reviewer test account or walkthrough recording.
- Public privacy/support/terms metadata must reflect the actual deployment/publisher; no fake production URLs or reviewer credentials are packaged.

The local privacy notice describes local behavior only. It is not a hosted-service policy.

## Deployment path

Follow current [packaging](https://developers.openai.com/plugins/build/plugins), [submission](https://developers.openai.com/plugins/deploy/submission), and [remote review](https://developers.openai.com/plugins/deploy/app-review) docs (accessed 2026-09-29). Implement and verify `REMOTE.md`, replace the local MCP declaration with the real HTTPS endpoint, and include that server in the initial uploaded ZIP. The current submission accepts one connected MCP per plugin.

Complete verified publisher identity, required public metadata, domain verification and OAuth review setup. Run five positive and three negative cases with a dedicated sample-data reviewer account. Supply the walkthrough URL and release notes; submit credentials separately through the portal. Resolve automated checks and then submit for review. Publish only after approval and an explicit release decision. Secure MCP Tunnel is for private testing, not public directory distribution.

Do not mark an offline manifest/schema check as submission approval or invent an app registration ID. A newly discovered Ability can require host review even though no adapter code changes are needed.

The installed Codex CLI 0.144.4 required the supported `.codex-plugin/plugin.json` and `.mcp.json` compatibility files to retain version and component metadata. Both layouts are packaged and checked for parity. The isolated profile install/list/remove passed; this does not certify live model behavior.

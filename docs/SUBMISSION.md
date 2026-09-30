# Packaging and submission

## Local package

`plugin.json`, `mcp.json` and `skills/` use the current portable Agent Plugins layout documented by OpenAI. The adapter does not use historical `ai-plugin.json` or GPT Actions. `npm run check` validates manifests against the fetched Agent Plugins 1.0 schemas. Schema source URLs are embedded in the manifests; fetched 2026-09-29.

Run `npm run package` after `npm ci`. It builds a ZIP with locked production Node dependencies, source/skills/docs, checksum, dependency inventory and unsigned provenance. The locked npm dependencies include the platform-selected Kujo runtime. npm installation uses no lifecycle scripts. The local ZIP includes the build platform runtime and is not a universal cross-platform binary bundle. The operator must provide a trusted application configuration. The package is local authoring/testing material and does not install into a live user profile.

## Public submission blockers

This release deliberately cannot claim public readiness:

- No deployed stable HTTPS Streamable HTTP endpoint, domain challenge or OAuth integration.
- No certified multi-user isolation or remote execution profile.
- Canonical semantic precision is implemented; the deployed catalog and handler certification still need review.
- Trusted-local change/release packs are implemented; remote equivalents require certified application-owned providers.
- Live ChatGPT three-tool review is recorded in ACCEPTANCE.md; exact receipt-helper visibility and installed Codex Skill composition are verified. Automatic browser Skill-file loading remains unproven. No reviewer test account or walkthrough recording.
- Public privacy/support/terms metadata must reflect the actual deployment/publisher; no fake production URLs or reviewer credentials are packaged.

The local privacy notice describes local behavior only. It is not a hosted-service policy.

## Deployment path

Follow current [packaging](https://developers.openai.com/plugins/build/plugins), [submission](https://developers.openai.com/plugins/deploy/submission), and [remote review](https://developers.openai.com/plugins/deploy/app-review) docs (accessed 2026-09-29). Implement and verify `REMOTE.md`, then build the dedicated remote profile below with the real HTTPS endpoint and include that server in the initial uploaded ZIP. The current submission accepts one connected MCP per plugin.

Complete verified publisher identity, required public metadata, domain verification and OAuth review setup. Run five positive and three negative cases with a dedicated sample-data reviewer account. Supply the walkthrough URL and release notes; submit credentials separately through the portal. Resolve automated checks and then submit for review. Publish only after approval and an explicit release decision. Secure MCP Tunnel is for private testing, not public directory distribution.

Do not mark an offline manifest/schema check as submission approval or invent an app registration ID. A newly discovered Ability can require host review even though no adapter code changes are needed.

The installed Codex CLI 0.144.4 required the supported `.codex-plugin/plugin.json` and `.mcp.json` compatibility files to retain version and component metadata. Both layouts are packaged and checked for parity. The isolated profile install/list/remove passed; this does not certify live model behavior.

## Remote submission bundle

After choosing the real deployment, create an operator-owned JSON file with these required fields:

```json
{
  "schema": "kujo.openai.remote-package/v1",
  "resource": "https://YOUR-MCP-DOMAIN/mcp",
  "websiteURL": "https://YOUR-PUBLISHER-DOMAIN",
  "supportURL": "https://YOUR-PUBLISHER-DOMAIN/support",
  "privacyPolicyURL": "https://YOUR-PUBLISHER-DOMAIN/privacy",
  "termsOfServiceURL": "https://YOUR-PUBLISHER-DOMAIN/terms"
}
```

These are placeholders to replace, not deployed URLs. Include no credentials. All URLs require HTTPS, without user information, query or fragment; unknown configuration fields fail closed. The actual policies must describe the hosted service accurately.

```sh
node scripts/package.mjs --remote /absolute/operator/remote-package.json
```

The result is `dist/remote/kujo-openai-0.1.0-remote.zip`, with its own checksum, dependency inventory and unsigned provenance. It has the portable manifest, a single Streamable HTTP MCP declaration, Skills and documentation. It contains no native runtime, Node dependencies, local stdio command, operator configuration or legacy Codex compatibility manifest. Starters describe remote catalog/evidence access rather than promise unregistered review capabilities. Source manifests and the local archive are untouched. The remote artifact targets the current portable format; legacy Codex profile acceptance is only verified for the separate local bundle.

Tests compare generated manifests against the official schemas, reject missing/unsafe metadata and credential fields, inspect the actual ZIP contents, and compare two builds for reproducibility. They use temporary fixture URLs and never leave a fixture submission archive in the project output directory. These offline checks do not establish domain ownership, endpoint reachability, policy accuracy, OAuth compatibility, live host behavior or directory approval. Supply and verify those before submission.


### Reviewer evidence metadata

The remote configuration optionally accepts `review`, copied into
`extensions.com.openai.review` in the generated portable manifest. Supply it only
with cases appropriate to the actual deployed catalog and a reviewer-accessible
walkthrough. This is metadata transport, not evidence that the cases passed.
Omitting `review` keeps the existing development-package behavior.

`review.test_cases.positive` requires at least five cases and `negative` at least
three. Each case contains `description`, `prompt`, `tools_triggered` (an empty
string is valid when no tool should run), and `expected_behavior`. Optional
`file_attachment_urls` and `expected_output_url` must be credential-free HTTPS
URLs. `review.demo_recording_url` is required when supplying review metadata.
Optional `commerce` is boolean; `commerce_description` is text. Unknown fields,
incomplete case groups, unsafe URLs and oversized metadata fail validation with
generic diagnostics. Reviewer passwords/tokens belong in the submission portal,
never in this file or the ZIP. Text fields are operator-owned and must also be
reviewed for secrets; field validation cannot identify every secret in prose.

These fields follow the official [submission guide](https://developers.openai.com/plugins/deploy/submission)
(accessed 2026-09-30). Tests verify deep-copy preservation, source-manifest
immutability, rejection cases, and exact metadata in the reproducible remote ZIP.
The fixture cases used by tests are not shipped as production review claims.

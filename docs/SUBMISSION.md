> Historical development evidence/design. Superseded for the product plan by [preinstalled runtime](PREINSTALLED-RUNTIME.md) and [current submission checklist](PREINSTALLED-SUBMISSION.md). Do not use bootstrap, tunnel or hosted instructions as the selected install flow.

# Packaging and submission

## Local package

`plugin.json`, `mcp.json` and `skills/` use the current portable Agent Plugins layout documented by OpenAI. The adapter does not use historical `ai-plugin.json` or GPT Actions. `npm run check` validates manifests against the fetched Agent Plugins 1.0 schemas. Schema source URLs are embedded in the manifests; fetched 2026-09-29.

Run `npm run package` after `npm ci`. It builds a ZIP with locked production Node dependencies, source/skills/docs, checksum, dependency inventory and unsigned provenance. The locked npm dependencies include the platform-selected Kujo runtime. npm installation uses no lifecycle scripts. The local ZIP includes the build platform runtime and is not a universal cross-platform binary bundle. The operator must provide a trusted application configuration. The package is local authoring/testing material and does not install into a live user profile.

## Public distribution decision

The documented public submission path requires a hosted HTTPS MCP endpoint. Local
marketplace installation is separate from public directory distribution. A public
local MCP route requires confirmation from OpenAI; it is not established by our
container tests. See [the dated fact-check](PUBLIC-DISTRIBUTION-REVIEW.md).

The following are requirements remaining **if the optional hosted path is chosen**,
not authorization to build a hosted execution service:

- No deployed stable HTTPS Streamable HTTP endpoint, domain challenge or OAuth integration.
- No certified multi-user isolation or remote execution profile.
- Canonical semantic precision is implemented; the deployed catalog and handler certification still need review.
- Trusted-local change/release packs are implemented; remote equivalents require certified application-owned providers.
- Live ChatGPT three-tool review is recorded in ACCEPTANCE.md; exact receipt-helper visibility and installed Codex Skill composition are verified. Automatic browser Skill-file loading remains unproven. No reviewer test account or walkthrough recording.
- Public privacy/support/terms metadata must reflect the actual deployment/publisher; no fake production URLs or reviewer credentials are packaged.

The local privacy notice describes local behavior only. It is not a hosted-service policy.

## Distribution decision and host support

The intended product installs the runtime on the user's computer. The remote
bundle below is an optional deployment profile, not a replacement for that
requirement. Public directory installation of a local executable remains a host
integration prerequisite, not a missing domain configuration.

The official [packaging guide](https://developers.openai.com/plugins/build/plugins)
(accessed 2026-09-30) directs local MCP publishers who cannot use a hosted endpoint
to their OpenAI contact. It also states that npm sources skip lifecycle scripts,
and web plugin installation does not deploy hook scripts. Hook trust is separate
from installing a plugin. We must not promise a silent install.sh or postinstall
bootstrap based on these mechanisms.

The next host-support request should establish all of the following before a
public local package is represented as install-and-use:

- Which directory surfaces support local stdio MCP and platform-specific binaries?
- Does an npm plugin source install transitive/optional dependencies, or only
  extract the selected package? Is a self-contained platform bundle required?
- How does the host provide an explicitly selected local repository and persist
  its authorization across restarts without accepting model-supplied authority?
- Which mechanism supplies Node/Git prerequisites, updates, uninstall cleanup,
  and any browser-to-local authenticated connection?
- What local MCP review, signing, and platform acceptance evidence is required?

No support request has been sent by this repository. The existing private tunnel
proves developer connectivity only. The existing public mcp.kujolang.ai service
is a read-only catalog; its live overview explicitly states that commands never
execute. It must not be repurposed into a privileged relay without a separate
architecture and authorization review.

## Optional hosted deployment path

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

These are placeholders to replace, not deployed URLs. Include no credentials. The four listing URLs are limited to 1024 characters each. All URLs require HTTPS, without user information, query or fragment; unknown configuration fields fail closed. The actual policies must describe the hosted service accurately.

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

`review.test_cases.positive` requires exactly five cases and `negative` exactly
three for this single-MCP submission profile. Each case contains `description`, `prompt`, `tools_triggered` (an empty
string is valid for a negative case when no tool should run), and `expected_behavior`. Optional
`file_attachment_urls` and `expected_output_url` must be credential-free HTTPS
URLs. Positive descriptions are limited to 4000 characters and positive cases
require nonempty tool names. `review.demo_recording_url` is required when supplying review metadata.
Optional `commerce` is boolean; `commerce_description` is text. Unknown fields,
incomplete case groups, unsafe URLs and oversized metadata fail validation with
generic diagnostics. Reviewer passwords/tokens belong in the submission portal,
never in this file or the ZIP. Text fields are operator-owned and must also be
reviewed for secrets; field validation cannot identify every secret in prose.

These fields follow the official [submission guide](https://developers.openai.com/plugins/deploy/submission)
(accessed 2026-09-30). Tests verify deep-copy preservation, source-manifest
immutability, rejection cases, and exact metadata in the reproducible remote ZIP.
The fixture cases used by tests are not shipped as production review claims.

### Listing validation boundary

The portable schema permits OpenAI extension fields without enforcing their
submission limits. Packaging tests therefore separately check the shipped name,
subtitle, description, publisher, category, capability labels and starter prompts
against the official field reference (accessed 2026-09-30). The Codex fallback
also carries the same publisher object. These checks establish local metadata
conformance; they do not verify publisher identity, approve a directory listing,
or resolve the installed ChatGPT placeholder icon.

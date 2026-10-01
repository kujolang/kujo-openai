# OpenAI local MCP approval — draft, not sent

## Intended architecture

The user preinstalls Kujo. A plugin on a supported local-capable client would invoke a native Kujo Ability MCP server over stdio. The plugin would download no runtime and require no Node, npm, Git, GitHub account, API key, developer mode, tunnel or user hosting.

**Implementation caveat:** this is the requested architecture, not today's working package. Kujo 1.7.0 has `mcp make` only; the current stdio adapter uses Node and review setup uses Git. Native transport, Git-independent capability onboarding and host folder confinement are technical prerequisites, not matters OpenAI approval can fix.

## Requested capability

Can a public Plugin Directory package for supported ChatGPT Desktop/local clients launch a user-preinstalled native stdio MCP executable, without provisioning it? If so, which client/platform versions, executable path configuration, selected-folder permission mechanism, signing and review evidence are required? What happens when the executable is absent or incompatible, and can a native diagnostic be packaged with it?

## Security model to verify

User-controlled trusted installation; no silent bootstrap; deterministic safe executable discovery; explicit version/capability checks; least-privilege selected-project access enforced by the host/runtime; canonical Ability approvals and receipts in addition to host confirmation. A selected path or MCP roots notification alone is not authorization or an OS sandbox. Web/mobile local access is not claimed.

## Documentation basis

The [official packaging guide](https://developers.openai.com/plugins/build/plugins), accessed 2026-10-01, documents public HTTPS submission and directs local MCP cases to an OpenAI contact. Local marketplaces are separate from the universal public directory. The [submission guide](https://developers.openai.com/plugins/deploy/submission), accessed the same day, defines metadata, reviewer cases and walkthrough requirements. No public local exception or account-specific entitlement has been verified.

## Optional future enhancement

Automatic native-runtime provisioning only if explicitly supported and approved later. It is outside this release. No request has been sent, deployment made or plugin submitted.

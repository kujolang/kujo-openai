# Kujo OpenAI

Expose registered **Kujo Abilities** to OpenAI hosts through MCP. Ability owns identity, schemas, effects, handlers, authority and receipts. This adapter owns projection and transport. Clarity. Context. Control.

**0.1.0 is a tested local infrastructure milestone, not a public hosted service or a completed ecosystem review product.** Reference integrations run the canonical MCP core pack or Ability’s trusted-local repository-review pack (real PatchBrief, ChangeBucket and optional ShipCheck). Product handlers and contracts live in Ability; this adapter contains no product command wrappers. Scout, Scent and Eval remain unavailable unless registered by an application. Workflows report missing registrations. An embeddable remote OAuth resource-server boundary is tested; its live issuer, isolated provider, ChatGPT acceptance and public submission remain deployment gates.

```text
Application-owned Ability registry + policy + stores
                ↓
    native Kujo host projection
                ↓
   bounded process / official MCP SDK
                ↓
 local Codex MCP or ChatGPT Secure MCP Tunnel
```

## Install and verify

Requires Node 22.13+ and Git. npm installs the pinned Kujo 1.7.0 platform runtime automatically; no separate Kujo installation is needed. Local execution is tested on Linux x64/arm64, macOS x64/arm64 and Windows x64. Public host installation support is a separate requirement. No API key is needed for offline verification.

```sh
npm ci
npm run check
```

The canonical Ability runtime is vendored unchanged at a reviewed commit with SHA-256 verification. `npm run verify:vendor` checks every pinned file. Node handles protocol and process lifetime only; execution uses Kujo.

## Set up local repository review

From this checkout, after `npm ci`:

```sh
node bin/kujo-openai.mjs setup /path/to/your/repository
```

Setup acquires the pinned canonical review-tool sources, uses the bundled native
runtime and stores configuration privately under your user data directory. It
requires no Kujo account, API key, sibling ecosystem checkouts or environment
variable editing. Once provisioned, launch the plugin's local MCP server with that
repository (or a child directory) as its working directory. It discovers the
saved configuration and exposes PatchBrief, ChangeBucket and ShipCheck through
Ability. Other application registries still use explicit trusted configuration.

This removes manual provisioning for the local review pack; it is **not yet a
one-click public-directory installation**. Browser ChatGPT still needs a supported
connection to the local machine. The public-directory/local bootstrap integration
and Windows containment remain unverified. `npm run test:setup` exercises fresh
source acquisition and real MCP calls without a preinstalled Kujo binary.

## Run a real canonical pack

Obtain the MCP repository at the revision recorded in `docs/research-revisions.json`, then:

```sh
node scripts/configure-mcp-pack.mjs /absolute/path/to/mcp
export KUJO_OPENAI_CONFIG="$PWD/.local/mcp-core/config.json"
node bin/kujo-openai.mjs catalog
node bin/kujo-openai.mjs serve
```

The configuration command writes only this adapter's ignored `.local/mcp-core` directory. It verifies the MCP source revision and relevant tracked files. It does not modify the MCP checkout or install a plugin into your profile. The reference pack profiles that configured MCP checkout and validates contained generated manifests; it is not an arbitrary-repository reviewer.

Set `KUJO_MCP_SOURCE` for `npm run test:integration`. That integration runs the actual canonical handlers, tests success and malicious paths, compares schemas, and records evidence.

## Connect a host

For Codex, register the absolute Node launcher as a stdio MCP command and pass `KUJO_OPENAI_CONFIG` through the host's trusted environment. Or use this repository's portable plugin after installing its dependencies. Installation does not configure your application automatically.

For ChatGPT, use the current [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) path for a private stdio server, then connect it in developer mode. This requires your account's tunnel credentials and workspace association. A local stdio launch is not proof that the ChatGPT connection works. See [setup](docs/SETUP.md).

Public plugins need a stable HTTPS Streamable HTTP endpoint and appropriate user authentication. This repository does not open a public listener or ship a shared-user execution service.

## Extend

Register a definition, binding and enabled `mcp` exposure in your application registry. Import `discover` and `invoke` from this adapter's `openai.kujo`, provide server-owned visibility/context/services, and use the provider contract in [extension guide](docs/EXTENDING.md). A newly registered compatible Ability appears without editing the OpenAI adapter. There is no product switch or generic arbitrary-payload public tool.

## Documentation

- [Research and official sources](docs/RESEARCH.md)
- [Architecture, projection and receipts](docs/ARCHITECTURE.md)
- [Local and ChatGPT setup](docs/SETUP.md)
- [Adding Abilities](docs/EXTENDING.md)
- [Security and trust boundaries](SECURITY.md)
- [Remote architecture and OAuth](docs/REMOTE.md)
- [Skills and acceptance cases](docs/ACCEPTANCE.md)
- [Packaging and submission](docs/SUBMISSION.md)
- [Milestone evidence and limitations](docs/MILESTONES.md)

MIT. Source and support: [kujolang/kujo-openai](https://github.com/kujolang/kujo-openai).

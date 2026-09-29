# Kujo OpenAI

Expose registered **Kujo Abilities** to OpenAI hosts through MCP. Ability owns identity, schemas, effects, handlers, authority and receipts. This adapter owns projection and transport. Clarity. Context. Control.

**0.1.0 is a tested local infrastructure milestone, not a public hosted service or a completed ecosystem review product.** Reference integrations run the canonical MCP core pack or Ability’s trusted-local repository-review pack (real PatchBrief and ChangeBucket). Product handlers and contracts live in Ability; this adapter contains no product command wrappers. Scout, Scent, Eval and ShipCheck remain unavailable unless registered by an application. Workflows report missing registrations. Remote authentication, live ChatGPT acceptance and public submission remain deployment gates.

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

Requires Node 22+, Git and Kujo 1.6+ on macOS/Linux. Windows hard process-tree cancellation is not certified. No API key is needed for offline verification.

```sh
npm ci
npm run check
```

The canonical Ability runtime is vendored unchanged at a reviewed commit with SHA-256 verification. `npm run verify:vendor` checks every pinned file. Node handles protocol and process lifetime only; execution uses Kujo.

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

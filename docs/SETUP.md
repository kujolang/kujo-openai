# Local setup and ChatGPT validation

## Trusted local application

1. Install Node 22.13+ and Git. npm installs the pinned Kujo 1.7.0 native runtime.
2. Clone this repository and run `npm ci && npm run check`.
3. Configure an application using `examples/operator-config.json`. All executable, source, working-directory and state paths must be absolute. Keep this file and its application code outside untrusted repositories.
4. Implement the application provider contract in [EXTENDING](EXTENDING.md). Supply only necessary runtime capabilities. Kujo capability flags are not path-specific sandboxing.
5. Set `KUJO_OPENAI_CONFIG` in the MCP host's trusted environment; run `node bin/kujo-openai.mjs catalog` first. Review tools and `unsupported` entries.
6. Start `node bin/kujo-openai.mjs serve` through the host's stdio configuration. Stdout is exclusively MCP; startup errors are intentionally generic.

For the canonical MCP core example, `node scripts/configure-mcp-pack.mjs /absolute/mcp` produces a working config and native application entrypoint. It requires exactly the reviewed clean MCP revision. The reference registry binds to the MCP checkout itself because that is the existing pack's contract.

No global host profile is changed by these commands. Use a temporary Codex profile for installation checks. The portable plugin expects Node plus installed package dependencies and the operator config in its environment. A plain source ZIP without `node_modules` needs `npm ci`; `npm run package` produces a local archive including locked production dependencies.

## ChatGPT private connection

Follow the current [Secure MCP Tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) and [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt), accessed 2026-09-29:

- Create a tunnel in the correct Platform organization and associate the target ChatGPT workspace.
- Run the official tunnel client with its runtime credential from a secret manager, targeting this stdio command. Keep tunnel credentials out of the provider environment.
- Enable developer mode where account/workspace policy permits it.
- In ChatGPT Plugins, add a connection using the tunnel ID, inspect discovered tools and start a fresh conversation.
- Run the positive/negative cases in `ACCEPTANCE.md`; record actual selected tools, arguments, approval behavior, domain verdict and receipt evidence.
- Refresh connection metadata and retest after changes.

The repository does not provision a tunnel or claim that this account has developer-mode access. MCP client tests prove protocol behavior only. Local package installation support varies by OpenAI surface. No assumption is made that ChatGPT web can spawn a local process directly.

## Troubleshooting

An empty catalog usually means no enabled MCP exposures or the visibility callback denied them. Check the application's canonical registry; do not bypass policy. An unsupported catalog entry identifies a host projection limitation. A credential rejection means the provider emitted configured secret material; fix the provider before retrying. A timeout/cancellation after launch is uncertain; examine application audit and receipts before another attempt.

The server pins its supported MCP versions through the exact SDK dependency. Unknown client protocol versions negotiate using the SDK's supported version response; clients must accept the negotiated version or disconnect. The checked-in protocol tests exercise the official matching SDK client. Other host versions require acceptance evidence.

The installed Codex CLI 0.144.4 required the supported `.codex-plugin/plugin.json` and `.mcp.json` compatibility files to retain version and component metadata. Both layouts are packaged and checked for parity. The isolated profile install/list/remove passed; this does not certify live model behavior.


## Trusted local change review

Use Ability's canonical repository-review pack to expose actual PatchBrief and ChangeBucket tools. Obtain clean source checkouts at PatchBrief `0e8d6bd6fd226b09b807f8758ade08096c8b70f0` and ChangeBucket `030eea63c60449f82c9ba2680227485d318fdb6d` (siblings by default; override `KUJO_PATCHBRIEF_SOURCE` / `KUJO_CHANGEBUCKET_SOURCE`). From this adapter checkout:

```sh
KUJO_BIN=/absolute/path/to/kujo node scripts/configure-review-pack.mjs /absolute/trusted/repository
KUJO_OPENAI_CONFIG="$PWD/.local/repository-review/config.json" node bin/kujo-openai.mjs serve
```

Use this configuration in the installed plugin's MCP environment. The same projection/transport discovers both tools automatically. Inputs are `{}`; the operator selects the repository. The plugin change-review skill describes their responsibilities and limits. Run `KUJO_BIN=/absolute/path/to/kujo npm run test:review` for six real MCP protocol cases with canonical receipts, forged input rejection and hostile-filter rejection.

This profile is for an operator-controlled trusted local Git worktree. Source revisions are checked at provisioning and preserved in canonical receipt audit metadata; they do not cryptographically attest the executable at invocation time. Keep source checkouts and PATH under operator control. The pack rejects executable filters but cannot contain a hostile local actor or concurrent configuration changes. Never expose this profile as a multi-user remote service. See the vendored canonical pack README for the complete trust boundary.

The test config points at a disposable repository after testing; rerun provisioning for your intended repository before using the plugin.

## Release signals in the review pack

To add canonical ShipCheck release metadata scanning, obtain its clean reviewed checkout at `0a9f5795e9498f3698d5da6bb66642544251dd37` (sibling `shipcheck`, or `KUJO_SHIPCHECK_SOURCE`) and provision with:

```sh
KUJO_BIN=/absolute/path/to/kujo node scripts/configure-review-pack.mjs /absolute/trusted/repository --release-signals
```

This updates the same ignored local configuration with three canonical tools. Existing setup without the option still exposes two. ShipCheck's scan does not execute test suites or approve releases. Inspect its domain gate and individual checks even when the Ability execution succeeds. The ship-review skill combines this evidence with PatchBrief and ChangeBucket, and reports missing test/spec/artifact evidence. All three share the trusted-local restriction; this is not an uploaded-repository sandbox or remote deployment.

### Shared stdio tunnel discovery

The official tunnel client can keep one stdio child alive across host discovery
attempts. In the live ChatGPT creation attempt on 2026-09-30, ChatGPT tried
`server/discover`, fell back to MCP 2025-11-25 initialization, then initialized
again before listing tools. The adapter previously rejected that second handshake.
It now returns the original successful negotiation for another valid initialization
with the same protocol version and client capabilities. Client display information
may differ; it is never authentication or approval evidence. The SDK client state
and in-flight execution state are not replaced. Changed protocol versions or
capabilities require a fresh connection. Failed initialization can be retried, and
an initialized notification cannot enable calls before successful negotiation.

For callers that omit the lifecycle notification, tunnel-client v0.0.15 offers
`mcp.stdio_send_initialized_notification: true` in its YAML configuration.
See the [official configuration reference](https://github.com/openai/tunnel-client/blob/v0.0.15/docs/configuration.md), accessed 2026-09-30.
After modifying the adapter, restart the tunnel to replace its existing stdio child.
Check `/health/mcp` for successful initialization and tool discovery: `/readyz`
alone can report ready while MCP discovery has failed. This compatibility fix has
local regression coverage and successful live ChatGPT creation/discovery on
2026-09-30. See ACCEPTANCE.md for the live review and subsequent verified structured receipt lookup.

After updating a running tunnel's MCP server, restart the local client/server and refresh the installed app's tool catalog. The receipt helper `_kujo_receipt_evidence` should appear alongside the three canonical review tools. Use it to list recent receipt references, then read an exact URI; do not rerun an Ability merely to retrieve evidence. The recent index starts empty after restart.

## Intended end-user installation experience

Owner clarification (2026-09-30): Kujo should execute on each installing user's
computer. The intended product installs the appropriate Kujo runtime and required
packages for macOS, Windows or Linux, configures the Ability adapter, and avoids
manual tunnel/API-key/configuration steps. `https://mcp.kujolang.ai/mcp` is the
preferred public address if a remote entry point is needed. This preference does
not mean all repository execution should move to a Kujo-hosted service.

This is a product requirement, not implemented one-click installation. Current
OpenAI packaging documentation says web plugin installation does not deploy local
hook scripts; hooks require user trust, and npm marketplace installation skips
lifecycle scripts. Public MCP submission currently requires a remote HTTPS
endpoint or coordination with OpenAI for local MCP support. Source:
https://developers.openai.com/plugins/build/plugins (accessed 2026-09-30).

Therefore investigate a supported desktop-local distribution with packaged,
versioned platform runtimes and explicit host trust first. Do not assume running
install.sh/npm postinstall on directory installation is supported. A cloud ChatGPT
connection to the preferred public address would still need an installed,
authenticated local companion to reach a user's machine; the URL itself supplies
neither local execution nor repository authorization. A relay/companion is a
separate possible design, not a deployed or approved feature. Keep canonical
Ability policy, local repository consent and receipt ownership intact.


## Automatic local review provisioning

`node bin/kujo-openai.mjs setup /absolute/repository` is the current local setup
entry point from an installed checkout. A packaged CLI exposes the same action
as `kujo-openai setup`; this does not assert that this package is published on npm.
It selects the official platform package, downloads reviewed Git source commits,
and generates the canonical review-pack binding and private state. Repeat setup
reuses clean pinned sources. A setup lock prevents simultaneous provisioning;
after a crash, inspect and remove the stale lock only when no setup is running.
Modified source caches and symlinks fail closed rather than being deleted.

The default data root is `~/.local/share/kujo/openai`; operator-supplied
`KUJO_OPENAI_HOME` can relocate it. Startup finds configurations for the current
working directory or its ancestors in that user-owned root. It never consumes a
configuration file from the repository, installs software during MCP discovery,
or grants approval from tool input. `KUJO_OPENAI_CONFIG` remains an explicit
operator override. The host must launch local MCP in the selected project; if it
does not, use its supported project/configuration mechanism. Repository selection
and host trust cannot be silently inferred from a web plugin installation.

Supported runtime artifacts are determined by `@kujolang/kujo-runtime@1.7.0`.
This does not certify every OS's process containment or the host's dependency
installation behavior. The local ZIP contains the build machine's installed
platform dependencies; use npm dependency resolution on the target platform,
not an archive built on a different OS. Public directory one-click onboarding is
still an acceptance requirement, not a claim of this CLI milestone.

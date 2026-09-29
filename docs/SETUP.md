# Local setup and ChatGPT validation

## Trusted local application

1. Install Node 22+ and Kujo 1.6+ from verified releases.
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

# Local privacy notice

Kujo OpenAI 0.1.0 does not operate a hosted data service or collect telemetry. Its configured application executes locally. The chosen MCP host receives tool descriptions, inputs, results, and requested receipt evidence; that host's own data terms apply. A Secure MCP Tunnel sends MCP traffic through OpenAI.

The adapter stores canonical receipts in the operator-selected private directory. The reference application also stores canonical audit payloads in `.local/mcp-core/audit`. These may contain repository metadata and operation results. The operator controls access, backups, retention and deletion. There is no automatic expiry. Deleting local receipts removes access to that evidence but does not undo an operation.

Applications must minimize sensitive inputs and outputs and keep credentials out of metadata, receipts, logs and errors. Secret matching is defense in depth, not general data-loss prevention. Remote deployments require a separate operator-owned privacy policy reflecting their actual storage, sharing, retention, subprocessors, user access and deletion practices.

# Privacy

The native preflight performs no network requests or telemetry. It checks executable metadata and runs `--version`; it does not read project files. Its report contains platform, version and a bounded diagnostic, not home/project paths or raw child output.

The native MCP server reads the explicitly configured project when an Ability is invoked. Its bundled capabilities profile repository structure and validate contained MCP manifests; project metadata and validation results can reach the connected host. It extracts bundled provider source into private local state and removes that temporary source on normal shutdown. Durable audit and receipt records remain until the operator deletes them. The native adapter adds no telemetry or runtime download. Custom operator-configured providers may have additional effects, described and governed by their canonical Ability contracts.

Both the native server and existing development adapter run configured Kujo applications locally. Connected hosts receive tool descriptions, inputs, results and requested evidence under their own data terms. Local execution does not mean repository information stays off the host service.

Canonical receipts and application audit records may contain repository metadata and results. They persist in operator-controlled state directories, have no automatic expiry, and can be deleted by the operator when no process is using them. Deletion removes evidence and does not undo operations. Credentials must never enter tool output, receipts or logs.

This is the repository's local software notice, not a hosted-service policy or legal approval for a public listing. Publisher-approved public privacy and terms URLs still need to be supplied and verified before submission. See [support](SUPPORT.md).

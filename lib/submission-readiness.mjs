// This is a fail-closed release gate, not OpenAI approval or an MCP runtime.
export function preinstalledReadiness({mcp, nativeAcceptance = false, hostApproval = false}) {
 const blockers = [];
 const server = mcp?.mcpServers?.kujo;
 if (!server || server.type !== 'stdio') blockers.push('local_stdio_required');
 if (!server || server.command !== 'kujo') blockers.push('preinstalled_native_entrypoint_unverified');
 if (!nativeAcceptance) blockers.push('native_stdio_acceptance_missing');
 if (!hostApproval) blockers.push('openai_local_distribution_unconfirmed');
 return {schema:'kujo.openai.submission-readiness/v1',ready: blockers.length === 0,blockers};
}

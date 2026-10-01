// A development-package guard, not an approval verifier. Native artifact tests
// do not establish a public plugin launch contract or host folder grants.
export function preinstalledReadiness({mcp}) {
 const blockers = [];
 const server = mcp?.mcpServers?.kujo;
 if (!server || server.type !== 'stdio') blockers.push('local_stdio_required');
 // No final native plugin profile has been implemented/accepted yet. Do not
 // recognize an invented `kujo mcp serve` command or caller-supplied booleans
 // as evidence. Replace these gates only with reviewed final-package evidence.
 blockers.push('preinstalled_native_entrypoint_unverified');
 blockers.push('native_plugin_host_acceptance_missing');
 blockers.push('openai_local_distribution_unconfirmed');
 return {schema:'kujo.openai.submission-readiness/v1',ready:false,blockers};
}

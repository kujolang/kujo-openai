import {httpsURL} from './oauth.mjs';
export function remotePackageManifests(plugin,configuration) {
 const fields=['schema','resource','websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL'];
 if(!configuration||configuration.schema!=='kujo.openai.remote-package/v1'||Object.keys(configuration).some(key=>!fields.includes(key)))throw new Error('Invalid remote package configuration');
 try{for(const field of fields.slice(1))httpsURL(configuration[field]);}catch{throw new Error('Invalid remote package HTTPS metadata');}
 const projected=structuredClone(plugin);
 const presentation=projected.extensions['com.openai'].interface;
 for(const field of fields.slice(2))presentation[field]=configuration[field];
 presentation.longDescription='Discover and invoke remotely registered Kujo Abilities with canonical authority and evidence. Available workflows depend on the authenticated catalog and its certified execution profiles.';
 presentation.defaultPrompt=['Show me the Kujo capabilities available to my account.','Show me the evidence behind this Kujo result.'];
 return {plugin:projected,mcp:{$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{kujo:{type:'streamable-http',url:configuration.resource}}}};
}

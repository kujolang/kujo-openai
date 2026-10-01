import {httpsURL} from './oauth.mjs';
function reviewMetadata(review) {
 const invalid=()=>{throw new Error('Invalid remote package review metadata');};
 const object=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
 const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=8192;
 const url=value=>{try{httpsURL(value);}catch{invalid();}};
 if(!object(review,['test_cases','demo_recording_url','commerce','commerce_description']))invalid();
 if(!object(review.test_cases,['positive','negative']))invalid();
 for(const [kind,requiredCount] of [['positive',5],['negative',3]]) {
  const cases=review.test_cases[kind];
  if(!Array.isArray(cases)||cases.length!==requiredCount)invalid();
  for(const item of cases) {
   if(!object(item,['description','prompt','tools_triggered','expected_behavior','file_attachment_urls','expected_output_url']))invalid();
   if(!['description','prompt','expected_behavior'].every(key=>text(item[key])))invalid();
   if(kind==='positive'&&item.description.length>4000)invalid();
   // A negative test can legitimately expect no tools.
   if(typeof item.tools_triggered!=='string'||item.tools_triggered.length>8192)invalid();
   if(kind==='positive'&&!item.tools_triggered.trim())invalid();
   if(item.file_attachment_urls!==undefined){if(!Array.isArray(item.file_attachment_urls)||item.file_attachment_urls.length>20)invalid();for(const value of item.file_attachment_urls)url(value);}
   if(item.expected_output_url!==undefined)url(item.expected_output_url);
  }
 }
 url(review.demo_recording_url);
 if(review.commerce!==undefined&&typeof review.commerce!=='boolean')invalid();
 if(review.commerce_description!==undefined&&!text(review.commerce_description))invalid();
 return structuredClone(review);
}
export function remotePackageManifests(plugin,configuration) {
 const fields=['schema','resource','websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL'];
 if(!configuration||configuration.schema!=='kujo.openai.remote-package/v1'||Object.keys(configuration).some(key=>!fields.includes(key)&&key!=='review'))throw new Error('Invalid remote package configuration');
 try{for(const field of fields.slice(1)){httpsURL(configuration[field]);if(field!=='resource'&&configuration[field].length>1024)throw new Error();}}catch{throw new Error('Invalid remote package HTTPS metadata');}
 const projected=structuredClone(plugin);
 const presentation=projected.extensions['com.openai'].interface;
 for(const field of fields.slice(2))presentation[field]=configuration[field];
 if(configuration.review!==undefined)projected.extensions['com.openai'].review=reviewMetadata(configuration.review);
 presentation.longDescription='Discover and invoke remotely registered Kujo Abilities with canonical authority and evidence. Available workflows depend on the authenticated catalog and its certified execution profiles.';
 presentation.defaultPrompt=['Show me the Kujo capabilities available to my account.','Show me the evidence behind this Kujo result.'];
 return {plugin:projected,mcp:{$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{kujo:{type:'streamable-http',url:configuration.resource}}}};
}

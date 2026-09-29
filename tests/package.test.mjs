import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
test('portable plugin and MCP manifests validate against official versioned schemas',async()=>{
 const ajv=new Ajv({strict:false,validateFormats:false});
 for(const name of ['plugin','mcp']) {
 const schema=JSON.parse(await readFile(`schemas/${name}.schema.json`));const data=JSON.parse(await readFile(`${name}.json`));const validate=ajv.compile(schema);assert.equal(validate(data),true,JSON.stringify(validate.errors));
 }
 const plugin=JSON.parse(await readFile('plugin.json')),pkg=JSON.parse(await readFile('package.json'));assert.equal(plugin.version,pkg.version);
 assert.equal((await readdir('skills')).length,3);
 for(const name of await readdir('skills')) {const text=await readFile(`skills/${name}/SKILL.md`,'utf8');assert.ok(text.startsWith(`---\nname: ${name}\n`));assert.ok(text.includes('description:'));assert.ok(text.length<12000);assert.equal(text.includes('/Users/'),false);}
 assert.equal(JSON.stringify(plugin).includes('ai-plugin'),false);
});
test('Codex compatibility metadata matches portable package',async()=>{
 const portable=JSON.parse(await readFile('plugin.json')),compat=JSON.parse(await readFile('.codex-plugin/plugin.json'));
 assert.equal(compat.name,portable.name);assert.equal(compat.version,portable.version);assert.deepEqual(compat.interface,portable.extensions['com.openai'].interface);
 const mcp=JSON.parse(await readFile('mcp.json')),legacy=JSON.parse(await readFile('.mcp.json'));
 assert.deepEqual(legacy.mcpServers.kujo.args,mcp.mcpServers.kujo.args);assert.equal(legacy.mcpServers.kujo.command,mcp.mcpServers.kujo.command);
});

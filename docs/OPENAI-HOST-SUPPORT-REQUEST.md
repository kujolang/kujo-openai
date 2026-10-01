# Draft: Kujo local MCP distribution support

Status: prepared for the publisher to send; not sent to OpenAI.
Sources checked: 2026-09-30.

**Subject:** Confirm public local-MCP installation support for Kujo

We are building [Kujo OpenAI](https://github.com/kujolang/kujo-openai), a generic
MCP adapter for Kujo Ability. Our intended experience is: install Kujo in ChatGPT,
select a local repository with explicit host authorization, and immediately use
registered Kujo tools. Users should not need a developer tunnel, API key, terminal
commands, or a separately configured Kujo runtime.

The adapter projects canonical Ability definitions, enforces Kujo authority, and
preserves execution receipts. It has a lifecycle-script-free npm package with a
platform-selected native runtime dependency and works through local stdio MCP.
Linux/macOS clean-package execution is verified; Windows integration and a new
runtime artifact cohort are still being validated. Private-tunnel ChatGPT calls
have verified three canonical review tools and their receipts. These tests do
not establish public local installation support.

The [packaging guide](https://developers.openai.com/plugins/build/plugins)
directs publishers with local MCP requirements to an OpenAI contact. Please
confirm the supported route for these requirements:

1. Which public directory clients can install and start local stdio MCP servers
   on macOS, Windows and Linux? Does ChatGPT web have a supported authenticated
   connection to that local execution environment?
2. Does installation from an npm source install exact transitive and optional
   native dependencies, or extract only the top-level package? How are Node and
   Git prerequisites supplied? We do not rely on install/postinstall scripts.
3. What host mechanism provides the explicitly selected repository, persists
   the user's authorization and handles updates/uninstall? Model-generated
   paths or approval claims cannot grant filesystem authority.
4. What signing, platform testing and submission evidence is required for a
   local plugin? Is this available to public publishers now, or partner-gated?

Separately, our private ChatGPT plugin accepts package updates and shows the
updated skills/version, but its listing and starter prompts still display a
compass placeholder. Both portable and Codex manifests reference the included
Kujo PNG through logo/composerIcon and their dark variants. The image is square,
256 by 256 pixels and 7,020 bytes. These match the documented
[branding requirements](https://developers.openai.com/plugins/deploy/submission).
The current app management UI exposes no icon editor. Which supported flow
updates branding for an existing private MCP-backed plugin without deleting its
connection? We can provide the package and plugin identifier through your
preferred support channel.

We are not requesting silent machine-wide privileges. Repository authorization
and consequential execution approval must remain explicit. Our existing public
MCP domain serves a read-only catalog and is not a remote code execution service.
If the requested local experience is unsupported, please identify the supported
client/deployment boundary so we can accurately describe the product.

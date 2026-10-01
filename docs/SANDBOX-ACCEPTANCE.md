# Clean sandbox installation acceptance

Evidence: [sandbox-installation.json](evidence/sandbox-installation.json).

Tested on 2026-10-01 using Docker Desktop, Linux x64, Node 22 and Codex CLI
0.144.4. Run `npm run test:sandbox`; see tests/sandbox/README.md. The test uses
an unprivileged container with all capabilities dropped and no-new-privileges.
No host repository, credentials, configuration or Docker socket is mounted.
Node and Git are supplied by the image, not installed by the plugin.

## What the test establishes

1. Install the actual adapter npm tarball with lifecycle scripts disabled.
   npm resolves the published platform-specific Kujo 1.7.0 runtime.
2. Before setup, the server refuses to start and asks for repository setup.
   Installation does not authorize an arbitrary filesystem location.
3. Explicit setup against a disposable repository passes fresh/repeat setup,
   nested discovery, three real canonical tool calls and exact receipt lookups.
4. Install the unbundled package through the actual Codex local marketplace in
   an isolated profile. Its cached copy cannot resolve the external npm
   dependencies. A copy of a bare npm package directory is not self-contained.
5. Bundle locked dependencies, reinstall through the same host, and run the
   same real tools and receipt checks from the installed cache. This passes.
   Repository setup remains required.

These are package and local-host tests, not an actual ChatGPT public-directory
installation. The unbundled-copy result is not a test of the host's npm-source
resolver. The adapter package name currently returns a public registry 404, so
that resolver was not tested against a published adapter version. No registry
publication or real user-profile installation occurred during this test.

## Remaining acceptance boundary

The current local bundle can run after explicit configuration. We have not
verified a public host flow that supplies Node/Git, installs the correct native
dependencies, requests repository authorization and configures that repository
without terminal commands. Do not describe this as zero-setup or one-click
public installation. Do not remove the setup boundary to manufacture that result.

The official [packaging guide](https://developers.openai.com/plugins/build/plugins)
(accessed 2026-10-01) documents npm-backed local marketplaces separately from
public directory distribution. It directs local-MCP publishers to an OpenAI
contact when they cannot deploy a public HTTPS server. Installing on the web
does not deploy lifecycle hook scripts, and hooks require user trust.

Next host acceptance must use that supported installation route. Then verify
workflow selection, displayed K branding, reconnects and negative cases in
ChatGPT itself. This container test cannot certify those UI behaviors.

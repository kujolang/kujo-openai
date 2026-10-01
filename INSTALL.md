# Install and use

**Requires Kujo installed locally. The native-only plugin is not yet available.**
Do not upload the current Node development ZIP expecting this flow to work.

## 1. Install Kujo independently

Follow the [official ecosystem installation guide](https://github.com/kujolang/kujo/blob/main/docs/ECOSYSTEM_INSTALL.md). Its shell installer is:

```sh
curl -fsSL https://kujolang.ai/install.sh | bash
```

Review the script before running it. This is a user-initiated installation, never a plugin hook. The script can install ecosystem packages with additional dependencies; it does not prove a Git-free plugin workflow. For Windows, follow the platform-specific official instructions rather than assuming a POSIX shell. Release checksum verification detects corruption; it is not a publisher signature or independent proof of authenticity.

Alternatively, give an installation-capable agent this adapted prompt:

> Install Kujo using https://github.com/kujolang/kujo/blob/main/docs/ECOSYSTEM_INSTALL.md. Determine OS and architecture first. Inspect the official installer and choose the native runtime installation; explain additional dependencies before installing ecosystem packages. Verify official release checksums where supplied, and state whether publisher signatures were available. Use user-owned locations, no sudo, and do not change unrelated system configuration. Run `kujo --version`, then inspect `kujo mcp --help`. Report the exact MCP commands present: `mcp make` alone is not a stdio server. Do not invent `mcp serve`, install this plugin's Node adapter as a substitute, or claim plugin readiness. Report the installed version and remaining native-MCP gap.

This adapts Kujo's existing agent-onboarding workflow; it is not a promise that an ordinary ChatGPT session has installation privileges.

## 2–5. Intended plugin flow — pending implementation and host approval

Install the approved native-only plugin in a supported local client, select/authorize one project using the host, then invoke its discovered capabilities. Host folder isolation must be verified first. No public package currently satisfies these steps. ChatGPT web/mobile access to local folders is not established.

Once an actual catalog is connected, useful requests include:

- Show the Kujo capabilities available for this project.
- Review current changes using the registered change-review tools.
- Explain ChangeBucket's footprint evidence for these changes.
- Summarize PatchBrief's proposed tests without claiming they ran.
- Explain the release signals from the registered ShipCheck scan.
- Show the receipt and evidence behind the last Kujo result.

These prompts describe existing development-pack capabilities, not native-only acceptance evidence. Do not promise Scout/Scent/Eval or arbitrary repository architecture analysis unless that catalog actually registers them.

## Diagnose a preinstalled runtime (maintainers)

From this repository, with the pinned Go 1.26.8 installed for building:

```sh
cd native
go build -trimpath -o ../dist/kujo-preflight ./preflight
cd ..
./dist/kujo-preflight --project /absolute/project
```

An optional `--kujo /absolute/trusted/kujo` is operator configuration, never model input. Known install paths are checked before absolute PATH entries to handle GUI PATH differences. No shell profile is sourced. The diagnostic exits zero only for `provider_runtime_ready`; that does not certify MCP or submission readiness. See [runtime contract](docs/PREINSTALLED-RUNTIME.md) for all errors. It does not restart itself or install anything.

An experimental native server is now available for maintainers with an existing trusted provider. See [native setup](native/README.md). It does not yet replace the default manifest or provide ordinary end-user onboarding.

## Native source-build preview

With a preinstalled compatible Kujo 1.7 runtime and a locally built adapter, run:

```sh
./dist/kujo-openai-native --serve --project /absolute/project
```

This is an MCP stdio command for a supported local client, not a terminal chat interface. It bundles canonical read-only repository profiling and MCP manifest validation; no Git checkout or package installation is required. See [native instructions](native/README.md) for the build, trusted runtime discovery, private evidence location and limitations. Public Plugin Directory installation is still unconfirmed.

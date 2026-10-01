# Native selected-project bundle — 2026-10-01

`kujo-openai-native --serve --project ABSOLUTE` now composes the canonical read-only MCP core pack with the generic native host. No source checkout, Git repository, Node, npm, credentials or network fetch is required at runtime. The default public plugin manifest has not yet migrated and remains submission-blocked.

## Necessary canonical change

Kujo MCP previously used one root both to load definitions and inspect files. Commit `ab949b6` adds a backward-compatible separate-project constructor; its existing handlers and Ability contracts remain canonical. Review: https://github.com/kujolang/mcp/pull/11 (draft, not merged). The adapter pins the immutable revision in `native/mcp-source.json`; hashes verify vendored and embedded source bytes. No unrelated repository behavior was changed.

## Runtime boundaries

The adapter embeds reviewed source at build time. It validates installed-runtime location, uses explicit project selection, rejects project-local or symlinked/writable state locations, creates private per-project audit/receipt state, and materializes bundled source into a private per-launch directory. Normal shutdown removes that source directory. A crash may leave source directories in private state; automatic retention cleanup is not implemented. No executable installer or package manager runs. Custom canonical providers remain available through `--serve-config`.

The default profile exposes repository summary and contained MCP manifest validation only; it does not claim the whole Kujo ecosystem is bundled. New registered compatible Abilities still use generic projection. The source pack applies its existing bounded read/path checks. Explicit project selection and these checks do not constitute an OS sandbox; host-enforced folder grants remain a separate acceptance requirement.

## Executed verification

macOS x64, preinstalled Kujo 1.7.0:

- `python3 scripts/native-assets.py --verify`: 31 embedded source/provenance files match canonical inputs.
- `go build -trimpath -o ../dist/kujo-openai-native ./preflight`: passed.
- `KUJO_NATIVE_TEST_BIN=<1.7.0> KUJO_NATIVE_HOST_BIN=<compiled-host> go test -race -count=1 -json ./...`: 50 top-level tests +16 subtests passed, zero failures/skips.
- `go vet ./...`: passed.
- `npm run check`: 49 tests passed, zero failures/skips; existing Ability vendor verification passed.
- Canonical MCP repository: `KUJO_BIN=<1.7.0> bash tests/run_all_tests.sh`: all checks passed, including security, endpoint, generator, Ability and host/package checks.

The new compiled-executable test starts from `/` with empty PATH, profiles a plain Python project without Git metadata, rejects a project-local replacement pack, rejects traversal/absolute manifest input and unsafe state selection, closes/restarts the executable and retrieves the canonical receipt. Test source: `native/integration/stdio_test.go`. Local logs: `.local/native-bundle-tests.json`, `.local/native-bundle-node-check.log`; MCP full-suite log `/tmp/kujo-mcp-project-root-tests.log`.

Windows trust/storage parity, native artifact distribution, actual host folder grants, full reviewer materials and public OpenAI local-MCP approval are still incomplete. No public submission, release or OpenAI contact occurred.

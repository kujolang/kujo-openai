# Preinstalled product audit — 2026-10-01

Status: **BLOCKED**, not submission-ready. Scope: `kujolang/kujo-openai`, branch `codex/windows-install-acceptance`; baseline `3fd684bb39c8b17ef0b0cdcd901c55e95c91f6cc`. No other repository changed. No publication, submission, OpenAI contact, installer execution, tunnel or hosted deployment.

## What changed and why

- `native/go.mod`, `native/preflight/{main.go,main_test.go,permissions_unix.go,permissions_other.go}`: standard-library-only native preflight, secure deterministic discovery and bounded version probe. It is diagnosis, not an MCP replacement. Commit `3d8b36e`.
- `.github/workflows/ci.yml`: Linux/macOS native diagnostic tests and vet. Windows permission verification remains fail-closed, not falsely certified.
- `lib/submission-readiness.mjs`, `scripts/check-submission.mjs`, `scripts/package.mjs`, `tests/submission-readiness.test.mjs`, `package.json`: explicit fail-closed submission gate, no archive on rejection, brand checks, package documentation.
- `plugin.json`, `.codex-plugin/plugin.json`, all three `skills/*/SKILL.md`: honest prerequisites, missing-runtime response, selected-project and local-client limits; original K artwork retained.
- `README.md`, `INSTALL.md`, `SECURITY.md`, `PRIVACY.md`, `SUPPORT.md`, `TESTING.md`, `OPENAI_LOCAL_MCP_APPROVAL.md`: current user/developer contract, privacy, installation, errors and unsent approval question.
- `docs/PREINSTALLED-RUNTIME.md`, `docs/PREINSTALLED-SUBMISSION.md`, `docs/LEGACY-DEVELOPMENT.md`: implementation facts, current checklist and separated legacy instructions.
- `docs/{ARCHITECTURE,COMPLETION,HOSTED-EXECUTION-DESIGN,OPENAI-HOST-SUPPORT-REQUEST,PUBLIC-DISTRIBUTION-REVIEW,SETUP,SUBMISSION,USER-VERIFICATION}.md`: mark earlier plans/evidence as historical, retain provenance.

## Executed verification

| Command / check | Exact result |
|---|---|
| `(cd native && go test -race -count=1 -v ./...)` | 17 top-level tests plus 7 subtests passed, 0 skipped; darwin/amd64 |
| `(cd native && go vet ./...)` | Exit 0 |
| `GOOS=… GOARCH=… CGO_ENABLED=0 go build -trimpath … ./preflight` | All 6 targets built: darwin/linux/windows × amd64/arm64; cross-build only |
| Native diagnostic against actual user-installed Kujo | Version 1.5.0, `runtime_version_unsupported`, exit 1; installation untouched |
| Native diagnostic against actual 1.7.0 executable copied to private temporary trusted directory | `native_mcp_unavailable`, version 1.7.0, exit 1, empty stderr; temporary copy removed |
| Actual 1.7.0 `kujo mcp --help` | Only `make` and `help`; no native stdio server |
| `npm run check` | 49 passed, 0 failed, 0 skipped; vendor integrity verified |
| `KUJO_REVIEW_RELEASE=1 npm run test:review` with reviewed 1.7.0 `KUJO_BIN` | 9 real release-review cases passed; canonical receipts preserved |
| `npm run test:integration` against default sibling source | Correctly refused revision mismatch; no source modified |
| Same integration with `KUJO_MCP_SOURCE` pointing to isolated clean checkout at a7ec0dd8e6bcae303ab1431b4586dfe3e91f3a5a | 5 canonical MCP core cases passed; schemas/receipts preserved |
| `node scripts/check-submission.mjs` | Expected exit 1: native entrypoint, native acceptance, public host confirmation missing |
| `node scripts/package.mjs --submission` | Expected exit 1; rejection before ZIP creation, independently tested in empty temporary output tree |
| `npm run package` | Development archive only, 3,746 files at time of check, exit 0; not a native-only submission |
| Public links | Official guide, repository/support and OpenAI docs returned 200; installer returned 200 via curl (Python HEAD was refused) |
| `git diff --check` | Passed |

A first oversized-output unit test exposed Go's embedded `bytes.Buffer.ReadFrom` bypassing a custom `Write` bound. Replaced embedding with composition and reran all native tests successfully. A first isolated packaging test exposed an unrelated eager remote import; made that import conditional and reran the suite. Neither failure is hidden as a pass.

## Security and remaining acceptance

Verified rejection of repository shadows, unsafe executable/parent permissions, relative PATH entries, symlink targets, invalid projects, unexpected versions, inherited secrets, oversized output and unbounded probes. No shell interpolation, downloads or model-supplied authority. Trust in the local owner/admin remains explicit; POSIX ACL auditing and Windows ACL/reparse safety are not complete production guarantees. The new diagnostic reads project metadata only to exclude executable paths; it neither authorizes nor inspects project contents.

Existing MCP protocol/receipt tests still exercise the Node adapter. Native-only handshake, tools/call, receipt persistence, cancellation/reconnect, Windows containment and host-enforced folder grants are **not executed** because the corresponding native implementation does not exist. Cross-platform compilation and old five-platform npm tests do not fill that gap. Actual ChatGPT rendering, walkthrough, publisher policies/terms and public local-MCP approval remain open.

## Architectural decision

Keep Ability canonical and the tested adapter intact. Do not change `mcp.json` to `kujo mcp serve`, disguise Node as a native capability, replace local execution with hosting, or claim host roots notifications confer authority. A native transport and Git-independent capability onboarding require substantive implementation before the remaining OpenAI question can be the only blocker. See current runtime contract and submission checklist for the exact boundaries.

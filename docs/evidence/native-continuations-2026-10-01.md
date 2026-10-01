# Native continuation acceptance — 2026-10-01

The experimental Go host now supports the canonical `invocation-v1` recovery contract. The default plugin distribution remains unchanged and is not submission ready.

References are written durably before invocation, separately from receipts, without original inputs or approval evidence. The resume tool accepts only a content-addressed reference. The current catalog must match the saved Ability identity, version and definition digest. The application receives only the original invocation ID and continues to enforce its own principal, approval and retry semantics. Provider boundary failures preserve the recovery reference. No automatic retry or grant is introduced.

Verification on macOS x64 with Kujo 1.7.0:

- `go build -trimpath -o ../dist/kujo-openai-native ./preflight` passed.
- `KUJO_NATIVE_TEST_BIN=<installed-1.7.0> KUJO_NATIVE_HOST_BIN=<compiled-host> go test -race -count=1 -json ./...`: **49 top-level tests plus 16 subtests passed; zero failures/skips**.
- `go vet ./...` passed.
- Actual canonical SQLite approval fixture: initial call and unapproved resume remain approval-required; operator-issued grant enables resume; reopening the reference store preserves recovery; replay returns the same canonical receipt URI.
- Official MCP SDK lists and invokes the resume tool; extra host-supplied approval arguments are rejected. Forged references, traversal and changed definition digests are rejected. Persistence failure prevents invocation. A timed-out execution retains its reference and uncertain status.

Evidence source: `native/internal/adapter/continuations_test.go`; local JSON run log `.local/native-continuation-tests.json` (ignored). Isolated boundary tests use a fake provider; approval/replay tests use the real canonical Ability provider in `tests/continuation-provider.kujo`.

Remaining work: ordinary-project onboarding without Git, Windows trust/storage parity, native packaging, real host folder permissions, public local-MCP approval and final reviewer/live-host acceptance. No publication, submission or OpenAI contact occurred.

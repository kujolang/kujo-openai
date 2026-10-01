# Native artifact packaging — 2026-10-01

The native adapter now has a separate maintainer packaging path, `scripts/package-native.py`. These archives are not public plugin submission packages and do not modify the legacy plugin manifest. No runtime installer, Node/npm dependency, hosted endpoint, tunnel or automatic provisioning is included.

Each ZIP has the compiled executable, official K SVG/PNG, project and embedded canonical source licenses, Go license/patent notices, notices for all nine linked Go modules, and `provenance.json`. Provenance includes module versions/checksums, source digests, canonical Ability/MCP revisions and the binary hash. SHA-256 sidecars cover the whole archive. ZIP order, timestamps/modes and storage encoding are deterministic. CGO is disabled; architecture baselines and experimental compiler flags are fixed. Go toolchain version is recorded.

Executed with Go 1.25.3 on macOS x64:

- All six artifacts built: darwin/linux/windows × amd64/arm64, 21 archive members each.
- `KUJO_NATIVE_TEST_BIN=<installed Kujo 1.7.0> python3 scripts/test-native-package.py` passed: two identical macOS x64 archives, valid license/branding/path/mode metadata, two real MCP integration tests run through the extracted executable, and a tampered binary rejected.
- Calling that acceptance script without the runtime prerequisite exits nonzero and explicitly reports acceptance did not run.
- `python3 scripts/native-assets.py --verify` passed (31 embedded files); Go module integrity verified during packaging.
- macOS x64 ZIP SHA-256: `d34bee9cf641f5291c8501da41d34244b1b4faa5ff571f944fbeb75b4d158fa5`.

Commands for all targets:

```sh
python3 scripts/package-native.py --target darwin/amd64 --target darwin/arm64 --target linux/amd64 --target linux/arm64 --target windows/amd64 --target windows/arm64
```

Local evidence: `.local/native-artifacts.jsonl`, `.local/native-package-test.log`; artifacts in ignored `dist/native`. Native CI now runs the reproducible archive and extracted-executable test on its Unix matrix. Execution on other platforms is not claimed from cross-compilation. The Windows launcher still rejects execution pending native trust/storage implementation. Artifacts are not publisher-signed or notarized; hashes are integrity evidence, not publisher authentication. No artifacts were published, plugin submitted or OpenAI contacted.

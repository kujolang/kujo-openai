# Clean-container installation acceptance

This checks Linux package installation and the Codex local-marketplace cache.
It does not simulate or certify the public ChatGPT directory installation flow.
The base image supplies Node and Git; neither is claimed to be installed by the
plugin. No host credentials, repository, Docker socket or Kujo configuration is
mounted into the test container. Docker Desktop itself is an operator prerequisite.

Run `npm run test:sandbox` with a working Docker engine. The runner creates and
cleans up its own container/image, and saves `.local/sandbox-acceptance.json`.
The resulting report is a local test artifact, not directory certification.

For manual execution, build a temporary context containing only:

- `package.tgz`: output of `npm pack --ignore-scripts` for this repository
- `Dockerfile` and `acceptance.mjs` from this directory
- `setup-integration.mjs` from the parent tests directory
- `adapter-lock.json`: the repository package-lock.json

Build and run with Docker (Podman can use the same Dockerfile):

```sh
docker build -t kujo-openai-acceptance:local /absolute/temporary/context
docker run --name kujo-openai-acceptance --cap-drop=ALL \
  --security-opt=no-new-privileges kujo-openai-acceptance:local
docker cp kujo-openai-acceptance:/tmp/kujo-sandbox-result.json ./result.json
docker rm kujo-openai-acceptance
```

The image runs as the unprivileged `node` user. The assertions verify real
canonical executions and exact receipt retrieval after explicit setup. The
report separately records a bare launch before setup and launch from the actual
host-installed local plugin cache. A successful npm install must not conceal
missing cache dependencies or a repository setup prerequisite. It then installs
the locked dependencies into the plugin bundle, reinstalls it through the host,
and verifies the same canonical tools and receipts from the cache. Codex plugin
installation uses an isolated profile and does not log into a model account.

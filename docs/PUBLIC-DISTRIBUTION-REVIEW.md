> Historical development evidence/design. Superseded for the product plan by [preinstalled runtime](PREINSTALLED-RUNTIME.md) and [current submission checklist](PREINSTALLED-SUBMISSION.md). Do not use bootstrap, tunnel or hosted instructions as the selected install flow.

# Public local installation fact-check

Verified against official OpenAI documentation on **2026-10-01**.
This review separates documented host support from our own installation evidence.

| Question | Official position | Kujo evidence / consequence |
| --- | --- | --- |
| Can we submit the local stdio package through the normal public flow? | Public MCP submission uses a remote HTTPS endpoint; publishers unable to deploy one should contact OpenAI about local MCP support. [Packaging](https://developers.openai.com/plugins/build/plugins) | Public local installation remains unconfirmed. Do not label the ZIP directory-ready. |
| Does npm marketplace support prove public availability? | Local marketplaces serve authoring, testing and private distribution separately from the public directory. npm sources skip lifecycle scripts and require npm. [Packaging](https://developers.openai.com/plugins/build/plugins) | The sandbox verifies npm installation and a bundled local marketplace cache, not the host's npm source resolver or public ChatGPT installation. |
| Can installation run install.sh automatically? | Web installation does not deploy hook scripts; hook trust is separate. [Packaging](https://developers.openai.com/plugins/build/plugins) | Do not rely on hooks or postinstall to bootstrap user machines. |
| Can our tunnel be the public endpoint? | Secure MCP Tunnel is development-only for this submission path; a stable public HTTPS endpoint is required. [MCP deployment](https://developers.openai.com/plugins/build/mcp-server) | The private tunnel is acceptance evidence only. |
| Is a DNS name enough for hosted review? | The endpoint needs reachable services, enforced authorization and reliable operation; OAuth applies where user authentication is required. [MCP deployment](https://developers.openai.com/plugins/build/mcp-server) | A repository execution service needs identity, repository access, isolation and operations. That is a separate architecture decision, not a packaging fix. |

## What is already verified

See [sandbox acceptance](SANDBOX-ACCEPTANCE.md) and its machine-readable report.
Three real canonical Abilities and matching receipts passed in a disposable,
unprivileged Linux container. The base image supplied Node and Git. A bundled
Codex local marketplace cache worked; an unbundled copy lacked dependencies.
Explicit trusted repository setup was still required. The local ZIP carries
the build platform's runtime, not every platform's runtime. These facts do not
establish one-click installation for public ChatGPT users.

The canonical K icon is referenced by the package's logo/composer fields. Its
256×256 PNG is 7020 bytes, within the current submission image limits.
An installed private app's placeholder icon remains a separate host-side
acceptance issue. The package alone cannot certify the visible listing.

## Small corrections from this review

The [submission reference](https://developers.openai.com/plugins/deploy/submission)
requires each of the four public listing URLs to fit 1024 characters. Positive
review descriptions must fit 4000 characters and name the expected tools.
The remote package validator now enforces those boundaries, with rejection and
exact-limit tests. Negative cases can still expect no tools. Five positive and
three negative cases and a walkthrough URL remain required by this profile.
Fixture cases are not production review evidence.

## Decision before further implementation

Preserve the intended local product while asking OpenAI to confirm a supported
public local route, prerequisites, dependency installation, repository consent,
and platform review requirements. The prepared
[host-support request](OPENAI-HOST-SUPPORT-REQUEST.md) has not been sent.

Alternatively, explicitly choose a hosted product architecture. A public
gateway/executor, user authentication, repository-provider access, credential
isolation and operational ownership require review before implementation.
The existing public catalog service does not execute repository reviews.
No hosted deployment or change of trust boundary is authorized by this
fact-check. Publishing an npm package alone would not resolve that decision.

## Subsequent design authorization

On 2026-10-01 the owner authorized designing hosted execution, authentication and
repository access. [The resulting design](HOSTED-EXECUTION-DESIGN.md) reuses the
existing Ability Gateway while preserving the public catalog boundary. This
supersedes the recommendation to wait for a local-route answer before design;
production provisioning, spending and public onboarding remain separate.

## Current owner decision: automatic local installation

After reviewing the hosted alternative, the owner selected automatic local
installation on 2026-10-01. Target: install the plugin, have the host provision
the correct Kujo runtime, select local files through explicit host consent, and
use Kujo. No GitHub account, user-managed hosting, API key or terminal setup is
a product prerequisite. Hosted execution is archived as an alternative.

This is a product requirement, not a verified public host capability. The
official packaging guide was rechecked on 2026-10-01 and still directs public
local-MCP publishers to an OpenAI contact. The existing support draft asks for
the concrete installation, prerequisite and filesystem-authorization contracts.
It has not been sent. Do not substitute hosted execution, trusted installer
hooks, or a custom companion installer without a new owner decision.

Next gate: obtain an authoritative supported local distribution route, then
implement/test that exact host flow on a clean machine without Node, npm, Git
or Kujo preinstalled. Existing five-platform/runtime and local cache tests
remain useful but do not satisfy this gate.

# Constrained Test Runner

## Context

CAMS runs its CI on USTP self-hosted "Standard D4s v3" runners (4 vCPU / 16 GiB). The backend unit suite occasionally times out on those runners but passes comfortably on developer laptops and GitHub-hosted runners. The cause is environmental rather than logical: the test framework sizes its worker pool from the visible core count, so a 4-vCPU box runs far fewer workers in parallel, and under that contention the slower tests cross the default per-test timeout. A failure that only reproduces on the constrained runner is expensive to diagnose — the feedback loop runs through CI rather than locally.

We needed a way to reproduce the runner's resource envelope on demand — both on a developer machine and in CI — so that marginal tests can be found and addressed by priority before they flake on the real runner, without making every developer or PR pay the cost of a constrained run.

Alternatives considered:

- **Tune timeouts or worker counts in the committed test config.** Rejected — this masks the symptom globally and changes how the suite runs for everyone, rather than measuring which tests are actually at risk.
- **Match the runner CPU architecture (amd64) under emulation on developer machines.** Rejected — emulating a foreign architecture distorts timing far more than the architecture difference itself, which would ruin the relative ranking that is the tool's whole purpose. Running natively for the host architecture preserves the ranking; the resource constraint, not the instruction set, is what surfaces the timeouts.
- **Add the constrained run to PR validation as a gate.** Rejected — a faithful run is several times slower than a normal suite run, and treating an environmental signal as a hard gate would block unrelated work. The signal is advisory, not pass/fail.

## Decision

We will reproduce a CI runner's resource envelope by running a workload inside a container with the runner's core count and memory limits applied, rather than relying on the host's full resources. The container reports the constrained core count to the workload so framework behavior (worker-pool sizing, contention) matches the real runner, and the run remains native to the host architecture so timing rankings stay meaningful.

The first and currently only application of this approach is the **backend unit test suite**: a developer-invoked tool produces a priority report (slowest tests, per-file totals, setup/teardown overhead, and margin-to-timeout) and a periodic, informational CI workflow publishes the same report on a schedule. The run is deliberately not a PR gate; a slow or failing test under constraint is the signal we want to surface, not a reason to turn CI red.

Fundamentally this is an environment-emulation approach, not a test-specific one. The same containerized, resource-constrained execution model can emulate any portion of the deployment pipeline whose behavior depends on the runner's resources — other workspaces' suites, build or packaging steps, or data-processing jobs. We are scoping the current implementation to the backend suite because that is where timeouts are actually observed; the approach generalizes to other portions of the pipeline if and when comparable problems appear there.

## Status

Accepted

## Consequences

### Positive

- The runner-only failure mode is now reproducible locally and in CI, turning a CI-round-trip diagnosis into an on-demand one.
- The priority report orders work by risk (margin-to-timeout), so effort goes to the tests most likely to cross the timeout on the real runner.
- Because the model is environment emulation rather than a test harness, extending it to another portion of the pipeline is an incremental change, not a new tool.
- Keeping the run advisory (never a gate) means the signal is available without blocking unrelated work or coupling release flow to an environmental measurement.

### Negative / Trade-offs

- A faithful constrained run is substantially slower than an unconstrained suite run, so it is an investigation tool, not part of the normal inner loop.
- Memory-limit fidelity depends on the host's container backing: a developer machine whose container VM is provisioned with less RAM than the limit cannot faithfully emulate the memory dimension, only the core-count dimension. The tool warns when emulation is inexact rather than failing silently.
- Timing is relative, not absolute: rankings are comparable within a run, but the numbers should not be read as the real runner's wall-clock, both because of the architecture difference and because the host's per-core throughput differs.
- Coverage is currently limited to the backend suite. Other portions of the pipeline are not emulated yet; if they begin to exhibit environment-specific problems, extending coverage is a deliberate follow-on rather than something the current setup provides automatically.

## Related Documentation

- `ops/scripts/utility/constrained-test.sh` — the constrained test runner
- `.github/docker/Dockerfile.build-and-test` — the container image the runner builds on
- `.github/workflows/constrained-test-report.yml` — the periodic, informational report workflow
- `dev-tools/constrained-test/` — the priority-report module

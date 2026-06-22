#!/usr/bin/env bash
#
# constrained-test.sh — run the CAMS unit suite under USTP runner resource
# limits to surface environment-specific test timeouts, and report the slowest
# tests.
#
# WHY THIS EXISTS
#   The USTP deployment runs CI on self-hosted "Standard D4s v3" runners
#   (4 vCPU / 16 GiB). Tests that pass comfortably on a developer laptop or on
#   GitHub-hosted runners can time out there. Two factors compound:
#     1. Vitest sizes its worker pool from os.availableParallelism(). On a
#        4-vCPU box it spawns ~3-4 workers vs ~9 on a 10-core laptop, so more
#        tests contend for fewer workers.
#     2. The default per-test timeout is 5s; slower wall-clock under contention
#        tips marginal tests over the edge.
#
#   To reproduce faithfully we must make the container REPORT 4 cores (so the
#   pool sizes correctly), not merely cap total CPU time. We pin a core COUNT
#   (--cores, default 4) and translate it to --cpuset-cpus=0-(n-1); Node 22
#   respects the cpuset cgroup in availableParallelism().
#
#   This is intentionally NOT part of pr-validation / the normal GHA workflow:
#   the constrained run is much slower. It's a tool you reach for when
#   investigating timeouts.
#
# USAGE
#   ops/scripts/utility/constrained-test.sh [options]
#
# OPTIONS
#   -w, --workspace <name>   Workspace to test: backend | common | user-interface
#                            (default: backend)
#   -c, --cpus <float>       Add a CPU-time quota ON TOP of the core pin to
#                            also approximate the runner's slower per-core
#                            throughput (e.g. 2.0). Default: unset (pin only).
#       --cores <int>        Number of cores to pin (default: 4 => D4s v3).
#                            Pinned to cpuset 0-(n-1) internally.
#   -m, --memory <size>      Memory cap (default: 16g). Swap is disabled.
#   -n, --top <int>          Number of slowest tests to report (default: 25).
#       --unconstrained      FAST inner-loop mode. Drop ALL resource limits
#                            (no --cpuset-cpus / --cpus / --memory / --memory-swap)
#                            and let the container use whatever the VM has. Also
#                            skips the core-count and memory-fidelity preflights.
#                            The report from this mode is NOT a faithful D4s v3
#                            emulation — never compare it to a constrained run.
#       --no-build           Skip rebuilding the Docker image (reuse existing).
#       --engine <name>      Container engine to use: podman | docker. Overrides
#                            auto-detection. Default precedence:
#                            --engine flag > $CONTAINER_ENGINE > podman > docker.
#   -h, --help               Show this help.
#
# EXAMPLES
#   # Faithful core-count emulation (default): finds parallelism/timeout issues.
#   ops/scripts/utility/constrained-test.sh
#
#   # Also throttle per-core speed to ~2 cores' worth of CPU time for a closer
#   # wall-clock match when timeouts are marginal.
#   ops/scripts/utility/constrained-test.sh --cpus 2.0
#
#   # Investigate the common library's suite, show the 50 slowest.
#   ops/scripts/utility/constrained-test.sh -w common -n 50
#
# NOTES
#   * Resource allocation: --cpuset-cpus / --memory are relative to whatever the
#     container engine can actually back. On a dev MacBook (or Windows) the
#     engine runs inside a podman/Docker "machine" VM, so that VM must be given
#     >= --cores cores and >= --memory RAM or the pin/cap won't reflect a real
#     D4s v3. On a Linux CI runner there is no VM — the limits are relative to
#     the host's physical / cgroup-available cores and RAM, which must likewise
#     be >= the requested values. The preflights below check both cases.
#   * Architecture: this runs the image natively for the host arch (e.g. arm64
#     on Apple Silicon, amd64 on a typical Linux runner). That is correct for
#     RANKING the slowest tests. Do NOT add --platform linux/amd64 to match the
#     runner arch on a non-amd64 host: QEMU emulation skews timing far more than
#     the arch difference and ruins the ranking. The constraint profile reports
#     both the host and container arch so a cross-arch run is visible at a glance,
#     and reminds you the rankings are RELATIVE, not absolute wall-clock.

set -euo pipefail

# --- locate repo root ---------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# --- defaults -----------------------------------------------------------------
WORKSPACE="backend"
CPUS=""             # empty => no quota, pin only
CORES=4             # number of cores to pin (=> cpuset 0-(CORES-1))
MEMORY="16g"
TOP=25
UNCONSTRAINED=0      # 1 => fast mode: drop all resource limits, skip preflights
DO_BUILD=1
IMAGE="cams-build:latest"
# Host arch via uname -m (cheap, no container). The container arch is probed by
# the core-count preflight one-shot (Goal 2) and recorded here; it stays "not
# probed" when that preflight is skipped (--unconstrained), since we deliberately
# do NOT add a second always-on container run just to read it.
HOST_ARCH="$(uname -m)"
CONTAINER_ARCH="<not probed>"
DOCKERFILE=".github/docker/Dockerfile.build-and-test"
# Container engine. Precedence: --engine flag > $CONTAINER_ENGINE > podman >
# docker (resolved by detect_engine() after arg parsing). Seed from the env var
# here so an explicit --engine can still override it below.
ENGINE="${CONTAINER_ENGINE:-}"

# --- arg parsing --------------------------------------------------------------
usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//; s/^#$//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -w|--workspace) WORKSPACE="$2"; shift 2 ;;
    -c|--cpus)      CPUS="$2"; shift 2 ;;
    --cores)        CORES="$2"; shift 2 ;;
    -m|--memory)    MEMORY="$2"; shift 2 ;;
    -n|--top)       TOP="$2"; shift 2 ;;
    --unconstrained) UNCONSTRAINED=1; shift ;;
    --no-build)     DO_BUILD=0; shift ;;
    --engine)       ENGINE="$2"; shift 2 ;;
    -h|--help)      usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; echo "Run with --help for usage." >&2; exit 2 ;;
  esac
done

case "${WORKSPACE}" in
  backend|common|user-interface) ;;
  *) echo "Invalid --workspace '${WORKSPACE}'. Use backend | common | user-interface." >&2; exit 2 ;;
esac

# --cores must be a positive integer; it becomes the cpuset 0-(CORES-1).
if ! [[ "${CORES}" =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid --cores '${CORES}'. Must be a positive integer." >&2
  exit 2
fi
CPUSET="0-$((CORES - 1))"

# --- resolve container engine -------------------------------------------------
# Podman is CLI-compatible with Docker for build/run/--cpuset-cpus/--memory/
# --memory-swap/-v, so the binary name is the only thing that varies. If ENGINE
# is already set (via --engine or $CONTAINER_ENGINE) we honor it; otherwise we
# prefer podman (CAMS local dev + CI) and fall back to docker.
detect_engine() {
  if [[ -n "${ENGINE}" ]]; then
    return
  fi
  if command -v podman >/dev/null 2>&1; then
    ENGINE="podman"
  elif command -v docker >/dev/null 2>&1; then
    ENGINE="docker"
  else
    echo "No container engine found. Install podman (preferred for CAMS local dev;" >&2
    echo "'brew install podman' then 'podman machine init && podman machine start')" >&2
    echo "or docker, or set --engine / \$CONTAINER_ENGINE." >&2
    exit 1
  fi
}
detect_engine

# Validate the resolved engine is actually on PATH. This also catches a bad
# --engine value or a stale $CONTAINER_ENGINE.
command -v "${ENGINE}" >/dev/null 2>&1 || {
  echo "Container engine '${ENGINE}' not found on PATH. Set --engine / \$CONTAINER_ENGINE" >&2
  echo "to an installed engine (podman or docker)." >&2
  exit 127
}

# --- build image --------------------------------------------------------------
if [[ "${DO_BUILD}" -eq 1 ]]; then
  echo "==> Building ${IMAGE} from ${DOCKERFILE}"
  "${ENGINE}" build -f "${REPO_ROOT}/${DOCKERFILE}" -t "${IMAGE}" "${REPO_ROOT}"
else
  echo "==> Reusing existing image ${IMAGE} (--no-build)"
fi

# --- assemble docker resource flags ------------------------------------------
# Anonymous volumes (-v with no host side) layer OVER the read-write repo bind
# mount for the subpaths the container writes during `npm ci` / build. Without
# these, the container's Linux-platform native bindings (esbuild/rollup/rolldown)
# and rebuilt dist would write back through the mount and clobber the developer's
# macOS/arm64 install (the whole team is on MacBooks). The bind mount is still
# needed so the JSON report lands in temp/ on the host; only these write paths
# are isolated:
#   /workspace/node_modules            — root hoisted deps (most native bindings)
#   /workspace/common/dist             — common build output
#   /workspace/common/node_modules     — per-workspace deps that don't hoist
#   /workspace/${WORKSPACE}/node_modules
ISOLATE_VOLUMES=(
  -v /workspace/node_modules
  -v /workspace/common/dist
  -v /workspace/common/node_modules
  -v "/workspace/${WORKSPACE}/node_modules"
)
# In faithful (default) mode we pin the core COUNT, cap memory, and disable swap
# so the run reproduces the D4s v3 pool sizing and OOM behavior. In --unconstrained
# (fast) mode we add NONE of these so the container uses the whole VM — this is a
# quick inner-loop run and is explicitly NOT a faithful emulation.
RUN_FLAGS=(--rm)
if [[ "${UNCONSTRAINED}" -eq 0 ]]; then
  RUN_FLAGS+=(--cpuset-cpus="${CPUSET}"
    --memory="${MEMORY}"
    --memory-swap="${MEMORY}")   # equal mem/mem-swap => swap disabled, OOM surfaces like the real box
  if [[ -n "${CPUS}" ]]; then
    RUN_FLAGS+=(--cpus="${CPUS}")
  fi
fi

# --- preflight fidelity self-checks (faithful mode only) ----------------------
# These run BEFORE the multi-minute suite so the user isn't surprised, AFTER a
# long wait, that the run didn't faithfully emulate the D4s v3 pool. Both WARN
# loudly to stderr but never block — a non-faithful run can still be useful.
# In --unconstrained mode there is nothing to verify, so both are skipped.

# Part A: does the container actually SEE the requested core count? Vitest sizes
# its worker pool from os.availableParallelism(); if the host/VM has fewer cores
# than requested (or the engine didn't honor the cpuset) the pool — and therefore
# the whole point of the run — is wrong. Cheap one-shot using the SAME cpu/memory
# RUN_FLAGS and the base image's node (no mounts, no npm ci).
preflight_core_count() {
  echo "==> Preflight: verifying the container reports ${CORES} cores" >&2
  local out reported
  # Capture stdout only; if the host/VM is too small the cpuset is out of range
  # (or --memory exceeds available RAM) and the engine errors out (empty/non-
  # numeric output) — that is itself a fidelity failure we want to surface, so
  # don't let `set -e` abort here.
  #
  # ONE one-shot, TWO values: this same node run also emits process.arch on a
  # second line so the profile block can report the CONTAINER arch without a
  # second container invocation (folding the Goal-3 arch probe into this Goal-2
  # preflight). Line 1 = core count, line 2 = arch.
  set +e
  out="$("${ENGINE}" run "${RUN_FLAGS[@]}" "${IMAGE}" \
    node -e 'console.log(require("os").availableParallelism()); console.log(process.arch)' 2>/dev/null)"
  set -e
  reported="$(printf '%s\n' "${out}" | sed -n '1p')"
  reported="${reported//[$'\t\r\n ']/}"

  # Parse the arch line (best-effort; arch is OUTPUT-ONLY, so a missing/odd value
  # must never abort the script). Only overwrite the default when it looks sane.
  local arch
  arch="$(printf '%s\n' "${out}" | sed -n '2p')"
  arch="${arch//[$'\t\r\n ']/}"
  if [[ "${arch}" =~ ^[A-Za-z0-9_]+$ ]]; then
    CONTAINER_ARCH="${arch}"
  fi

  if [[ "${reported}" =~ ^[0-9]+$ ]] && [[ "${reported}" -eq "${CORES}" ]]; then
    echo "    OK: container reports ${reported} cores (matches --cores ${CORES})." >&2
    return
  fi

  # Mismatch (or the one-shot failed). WARN loudly; continue to the run.
  echo >&2
  echo "  ############################################################" >&2
  echo "  ## WARN: CORE-COUNT FIDELITY CHECK FAILED" >&2
  echo "  ##" >&2
  if [[ "${reported}" =~ ^[0-9]+$ ]]; then
    echo "  ## Requested --cores ${CORES} but the container reports ${reported}." >&2
  else
    echo "  ## Requested --cores ${CORES} but the container could not start / report" >&2
    echo "  ## a core count. In faithful mode the preflight one-shot applies the full" >&2
    echo "  ## run flags, so this is likely the cpuset (${CPUSET}) OR the --memory limit" >&2
    echo "  ## being rejected by the engine (the suite run below will surface the raw" >&2
    echo "  ## engine error if the limits are the cause)." >&2
  fi
  echo "  ## This run will NOT faithfully emulate the D4s v3 4-vCPU pool sizing;" >&2
  echo "  ## Vitest will size its worker pool from the wrong core count." >&2
  echo "  ##" >&2
  echo "  ## The environment could not provide the requested core count. Ensure the" >&2
  echo "  ## host/VM has at least ${CORES} cores available to the container engine:" >&2
  echo "  ##   * On macOS/Windows that's the podman/Docker machine's CPU allocation." >&2
  echo "  ##   * On a Linux runner it's the host's physical / cgroup-available cores." >&2
  echo "  ## Also confirm the cpuset (${CPUSET}) is actually honored by the engine." >&2
  echo "  ##" >&2
  echo "  ## Continuing anyway (the slowest-test ranking is still informative)." >&2
  echo "  ############################################################" >&2
  echo >&2
}

# Part B: is --memory ${MEMORY} actually enforceable? A --memory cap larger than
# the total RAM the engine can back is silently a no-op (e.g. a small dev podman
# machine VM of ~3.7 GiB makes --memory 16g a no-op; a Linux runner with less RAM
# than requested behaves the same). We read the engine's REAL total RAM (NOT a
# cgroup cap) and WARN if it's below the requested cap. Degrade gracefully if we
# can't read it on this engine, rather than emit a false warning.
#
# Returns the engine's total RAM in bytes on stdout, or empty if undeterminable.
vm_total_ram_bytes() {
  local bytes=""
  case "${ENGINE}" in
    podman) bytes="$("${ENGINE}" info --format '{{.Host.MemTotal}}' 2>/dev/null)" ;;
    docker) bytes="$("${ENGINE}" info --format '{{.MemTotal}}' 2>/dev/null)" ;;
  esac
  # Fallback for either engine: a one-shot container WITHOUT --memory reading
  # /proc/meminfo MemTotal (kB) reflects the VM/host total, not a cgroup cap.
  if ! [[ "${bytes}" =~ ^[0-9]+$ ]]; then
    local kb
    kb="$("${ENGINE}" run --rm "${IMAGE}" \
      sh -c "awk '/^MemTotal:/ {print \$2}' /proc/meminfo" 2>/dev/null)"
    kb="${kb//[$'\t\r\n ']/}"
    if [[ "${kb}" =~ ^[0-9]+$ ]]; then
      bytes=$((kb * 1024))
    else
      bytes=""
    fi
  fi
  printf '%s' "${bytes}"
}

# Parse a docker/podman memory size (e.g. "16g", "512m", "2048k", "1073741824")
# to bytes on stdout. Empty on unparseable input.
mem_to_bytes() {
  local raw num unit
  raw="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  if [[ "${raw}" =~ ^([0-9]+)([bkmg])?$ ]]; then
    num="${BASH_REMATCH[1]}"
    unit="${BASH_REMATCH[2]}"
    case "${unit}" in
      ""|b) printf '%s' "${num}" ;;
      k)    printf '%s' "$((num * 1024))" ;;
      m)    printf '%s' "$((num * 1024 * 1024))" ;;
      g)    printf '%s' "$((num * 1024 * 1024 * 1024))" ;;
    esac
  fi
}

preflight_memory_fidelity() {
  echo "==> Preflight: verifying --memory ${MEMORY} is enforceable by the VM" >&2
  local vm_bytes req_bytes
  vm_bytes="$(vm_total_ram_bytes)"
  req_bytes="$(mem_to_bytes "${MEMORY}")"

  if ! [[ "${vm_bytes}" =~ ^[0-9]+$ ]]; then
    echo "    Skipping: could not determine the VM's total RAM on engine '${ENGINE}'." >&2
    return
  fi
  if ! [[ "${req_bytes}" =~ ^[0-9]+$ ]]; then
    echo "    Skipping: could not parse requested --memory '${MEMORY}'." >&2
    return
  fi

  local vm_mib=$((vm_bytes / 1024 / 1024))
  local req_mib=$((req_bytes / 1024 / 1024))
  if [[ "${req_bytes}" -le "${vm_bytes}" ]]; then
    echo "    OK: VM total RAM (~${vm_mib} MiB) >= requested --memory ${MEMORY}." >&2
    return
  fi

  echo >&2
  echo "  ############################################################" >&2
  echo "  ## WARN: MEMORY FIDELITY CHECK FAILED" >&2
  echo "  ##" >&2
  echo "  ## Requested --memory ${MEMORY} (~${req_mib} MiB) exceeds the total RAM the" >&2
  echo "  ## engine can back (~${vm_mib} MiB), so the cap is SILENTLY A NO-OP — the" >&2
  echo "  ## container can use only what the engine has. This run will NOT reproduce" >&2
  echo "  ## the D4s v3 16 GiB OOM behavior." >&2
  echo "  ##" >&2
  echo "  ## Give the engine at least ${req_mib} MiB of RAM, or pass a smaller --memory:" >&2
  echo "  ##   * On macOS/Windows: increase the podman/Docker machine's memory allocation." >&2
  echo "  ##   * On a Linux runner: the host/cgroup must have at least that much RAM." >&2
  echo "  ##" >&2
  echo "  ## Continuing anyway." >&2
  echo "  ############################################################" >&2
  echo >&2
}

# Output dir on the host so the JSON report survives the container.
# temp/ is gitignored by convention in this repo.
OUT_DIR="${REPO_ROOT}/temp/constrained-test"
mkdir -p "${OUT_DIR}"
REPORT_JSON_HOST="${OUT_DIR}/${WORKSPACE}-results.json"
rm -f "${REPORT_JSON_HOST}"

# Run the fidelity preflights now (faithful mode only): surface a too-small VM
# or an unhonored constraint BEFORE the multi-minute suite, not after. We run
# these BEFORE printing the profile so the core-count one-shot can record the
# container arch (CONTAINER_ARCH) for the profile block below. In --unconstrained
# mode the preflights are skipped, so the container arch stays "<not probed>" —
# we deliberately do NOT add a second always-on container run just to fill it in.
if [[ "${UNCONSTRAINED}" -eq 0 ]]; then
  preflight_core_count
  preflight_memory_fidelity
else
  echo "==> Skipping core-count and memory-fidelity preflights (--unconstrained)." >&2
fi

echo "==> Constraint profile"
echo "      engine         : ${ENGINE}"
echo "      workspace      : ${WORKSPACE}"
echo "      host arch      : ${HOST_ARCH}"
echo "      container arch : ${CONTAINER_ARCH}"
if [[ "${UNCONSTRAINED}" -eq 1 ]]; then
  echo "      mode           : UNCONSTRAINED (fast — NOT a faithful D4s v3 emulation)"
  echo "      pinned cores   : <none — container uses the whole VM>"
  echo "      cpu quota      : <none>"
  echo "      memory         : <none — no cap>"
else
  echo "      mode           : faithful (constrained)"
  echo "      pinned cores   : ${CORES} (cpuset ${CPUSET}; emulates D4s v3 4-vCPU pool sizing)"
  echo "      cpu quota      : ${CPUS:-<none — pin only>}"
  echo "      memory         : ${MEMORY} (swap disabled)"
fi
# WHY this note: the image runs NATIVELY for the host arch (no --platform, no
# QEMU) on purpose — QEMU emulation skews timing far more than the arch
# difference would, which would ruin the ranking. So the slowest-test numbers
# below are RELATIVE (compare tests to each other within this run), not absolute
# wall-clock you can quote against the real D4s v3. A host/container arch
# mismatch above is expected and fine for ranking.
echo "      note           : rankings are RELATIVE (not absolute wall-clock); the run is"
echo "                       native for the host arch by design (no --platform / no QEMU)."
echo

# --- build the in-container command -------------------------------------------
# Each workspace installs from the lockfile, builds common as needed, then runs
# vitest with dual reporters: default (live console + inline slow markers) and
# json (machine-readable per-test durations written to a host-mounted path).
#
# slowTestThreshold=300 flags slow tests inline; the json reporter gives exact
# per-test durations for the ranked report below. With multiple reporters,
# Vitest requires dot-notation to target one reporter's output file.
CONTAINER_REPORT="/workspace/temp/constrained-test/${WORKSPACE}-results.json"

read -r -d '' IN_CONTAINER <<EOF || true
set -euo pipefail
mkdir -p /workspace/temp/constrained-test

echo "--- node sees availableParallelism() = \$(node -e 'console.log(require("os").availableParallelism())') cores ---"

# Mirror CI (.github/workflows/reusable-unit-test.yml): a single root \`npm ci\`
# installs ALL workspaces (this is an npm-workspaces monorepo), then build common
# unless it IS the target workspace. CI does not separately install the backend
# function-apps nested lockfiles for unit tests, so neither do we.
cd /workspace && npm ci
if [ "${WORKSPACE}" != "common" ]; then
  npm run build:common
fi

cd /workspace/${WORKSPACE}

export CAMS_LOGIN_PROVIDER_CONFIG='{"issuer": "http://localhost:7071/api/oauth2/default", "clientId": ""}'

# Use the workspace's own test env (CAMS_LOGIN_PROVIDER=mock, DATABASE_MOCK, etc.
# come from its "test" script). Append reporters + slow threshold.
npm test -- \
  --reporter=default \
  --reporter=json --outputFile.json="${CONTAINER_REPORT}" \
  --slowTestThreshold=300
EOF

echo "==> Running suite under constraints (this is intentionally slow)"
set +e
"${ENGINE}" run "${RUN_FLAGS[@]}" \
  -v "${REPO_ROOT}:/workspace" \
  "${ISOLATE_VOLUMES[@]}" \
  "${IMAGE}" \
  bash -c "${IN_CONTAINER}"
TEST_EXIT=$?
set -e

echo
echo "============================================================"
echo " Slowest ${TOP} tests (workspace: ${WORKSPACE})"
echo "============================================================"

if [[ -f "${REPORT_JSON_HOST}" ]]; then
  # Vitest JSON: assertionResults[].duration (ms) per test, with file in name.
  # The report is best-effort: never let it abort the script before the final
  # `exit "${TEST_EXIT}"`, so a reporter hiccup can't mask the suite's real
  # exit code. `|| true` neutralizes `set -e` for this step.
  # NOTE on argv indices: `node -e '<script>' A B` puts A at argv[1] and B at
  # argv[2] (Node does NOT consume an argv slot for the inline script). So top
  # is argv[1] and the JSON path is argv[2].
  # shellcheck disable=SC2016  # this is a Node script; shell must NOT expand it.
  node -e '
    const fs = require("fs");
    const top = parseInt(process.argv[1], 10);
    const path = process.argv[2];
    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    const rows = [];
    for (const suite of data.testResults || []) {
      const file = (suite.name || "").replace(/^\/workspace\//, "");
      for (const t of suite.assertionResults || []) {
        rows.push({ ms: t.duration ?? 0, title: t.fullName || t.title, file });
      }
    }
    rows.sort((a, b) => b.ms - a.ms);
    const pad = (s, n) => String(s).padStart(n);
    for (const r of rows.slice(0, top)) {
      console.log(`${pad(r.ms.toFixed(0), 7)} ms  ${r.file}  ›  ${r.title}`);
    }
    const total = rows.reduce((s, r) => s + r.ms, 0);
    console.log(`\n  ${rows.length} tests, ${(total / 1000).toFixed(1)}s of test time total`);
  ' "${TOP}" "${REPORT_JSON_HOST}" || true
  echo
  echo "  Full JSON: ${REPORT_JSON_HOST}"
else
  echo "  No results JSON produced at ${REPORT_JSON_HOST}."
  echo "  The suite likely failed before writing results (see output above)."
fi

echo
if [[ "${TEST_EXIT}" -ne 0 ]]; then
  if [[ -f "${REPORT_JSON_HOST}" ]]; then
    # Results were written => the suite actually ran; non-zero means tests failed.
    echo "==> Suite exited non-zero (${TEST_EXIT}) — failures or timeouts under constraint."
  else
    # No results file => the suite never ran (e.g. the engine rejected the cpuset
    # or --memory limit, exit 125/126), so don't attribute this to test failures.
    echo "==> Run did not complete (${TEST_EXIT}) — the suite never ran; the engine"
    echo "    likely could not start the container under these limits (see the error above)."
  fi
else
  echo "==> Suite passed under constraint."
fi
exit "${TEST_EXIT}"

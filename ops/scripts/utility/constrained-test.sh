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
#   pool sizes correctly), not merely cap total CPU time. We pin with
#   --cpuset-cpus; Node 22 respects the cpuset cgroup in availableParallelism().
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
#   -c, --cpus <float>       Add a CPU-time quota ON TOP of the 4-core pin to
#                            also approximate the runner's slower per-core
#                            throughput (e.g. 2.0). Default: unset (pin only).
#       --cpuset <range>     Cores to pin to (default: 0-3 => 4 cores).
#   -m, --memory <size>      Memory cap (default: 16g). Swap is disabled.
#   -n, --top <int>          Number of slowest tests to report (default: 25).
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
#   * Apple Silicon: Docker Desktop runs a Linux VM. --cpuset-cpus is relative
#     to the VM's CPU allocation, so give the VM >= 4 cores / >= 16 GiB in
#     Docker Desktop settings, or the pin/cap won't reflect a real D4s v3.
#   * Architecture: this runs the image natively (arm64 on Apple Silicon). That
#     is correct for RANKING the slowest tests. Do NOT add --platform
#     linux/amd64 to match the runner arch: QEMU emulation skews timing far
#     more than the arch difference and ruins the ranking.

set -euo pipefail

# --- locate repo root ---------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# --- defaults -----------------------------------------------------------------
WORKSPACE="backend"
CPUS=""             # empty => no quota, pin only
CPUSET="0-3"        # 4 cores
MEMORY="16g"
TOP=25
DO_BUILD=1
IMAGE="cams-build:latest"
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
    --cpuset)       CPUSET="$2"; shift 2 ;;
    -m|--memory)    MEMORY="$2"; shift 2 ;;
    -n|--top)       TOP="$2"; shift 2 ;;
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

# --- count pinned cores (for reporting) --------------------------------------
count_cpuset() {
  local total=0 part lo hi
  IFS=',' read -ra parts <<< "$1"
  for part in "${parts[@]}"; do
    if [[ "$part" == *-* ]]; then
      lo="${part%-*}"; hi="${part#*-}"
      total=$(( total + hi - lo + 1 ))
    else
      total=$(( total + 1 ))
    fi
  done
  echo "$total"
}
CORE_COUNT="$(count_cpuset "${CPUSET}")"

# --- build image --------------------------------------------------------------
if [[ "${DO_BUILD}" -eq 1 ]]; then
  echo "==> Building ${IMAGE} from ${DOCKERFILE}"
  "${ENGINE}" build -f "${REPO_ROOT}/${DOCKERFILE}" -t "${IMAGE}" "${REPO_ROOT}"
else
  echo "==> Reusing existing image ${IMAGE} (--no-build)"
fi

# --- assemble docker resource flags ------------------------------------------
RUN_FLAGS=(--rm
  --cpuset-cpus="${CPUSET}"
  --memory="${MEMORY}"
  --memory-swap="${MEMORY}")   # equal mem/mem-swap => swap disabled, OOM surfaces like the real box
if [[ -n "${CPUS}" ]]; then
  RUN_FLAGS+=(--cpus="${CPUS}")
fi

# Output dir on the host so the JSON report survives the container.
# temp/ is gitignored by convention in this repo.
OUT_DIR="${REPO_ROOT}/temp/constrained-test"
mkdir -p "${OUT_DIR}"
REPORT_JSON_HOST="${OUT_DIR}/${WORKSPACE}-results.json"
rm -f "${REPORT_JSON_HOST}"

echo "==> Constraint profile"
echo "      engine         : ${ENGINE}"
echo "      workspace      : ${WORKSPACE}"
echo "      pinned cores   : ${CPUSET} (${CORE_COUNT} cores; emulates D4s v3 4-vCPU pool sizing)"
echo "      cpu quota      : ${CPUS:-<none — pin only>}"
echo "      memory         : ${MEMORY} (swap disabled)"
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

cd /workspace/common && npm ci
if [ "${WORKSPACE}" != "common" ]; then
  npm run build
fi

cd /workspace/${WORKSPACE} && npm ci

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
  echo "==> Suite exited non-zero (${TEST_EXIT}) — failures or timeouts under constraint."
else
  echo "==> Suite passed under constraint."
fi
exit "${TEST_EXIT}"

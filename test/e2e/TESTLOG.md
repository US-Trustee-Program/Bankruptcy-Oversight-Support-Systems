# E2E Pipeline Experiment Log

Tracks failed approaches so we don't repeat them. Each entry documents what was tried, why it failed, and what the correct fix was.

---

## Current Status (run `23918424348`, 2026-04-02)

**SQL Server crash-looping under rootless Podman — two root-level directories need writable tmpfs.** Every other container starts and becomes healthy. Playwright runs auth-setup and completes the Okta login flow. The app loads but renders "Access Denied — 500 Error - Server Error — Failed to fetch".

**Confirmed working:**
- `e2e_deps`: installs `azure-functions-core-tools@4` + `azurite` together in one `npm install -g`, then pre-downloads the extension bundle via `func bundles download`
- `e2e_built`: standard build, no changes — source `local.settings.json` (with `AzureWebJobsStorage` + `Host.CORS`) baked in via `COPY backend/`
- `e2e_backend`: FROM `e2e_built`, no COPY, no extra installs — CMD starts azurite in background, waits for Table service ready, then `func start`
- `AzureWebJobsStorage`: explicit Azurite connection string (`devstoreaccount1` / well-known key / `http://127.0.0.1:10000`) passed via compose env var — overrides the value in `local.settings.json` at runtime
- **Experiment 1 confirmed**: `CAMS_SERVER_HOSTNAME=backend` eliminates CORS `OPTIONS /api/me` 404 — frontend proxies API calls server-side via bridge DNS, no preflight needed
- Backend: bridge network, `ports: 7071:7071`
- Frontend: bridge network, `CAMS_SERVER_HOSTNAME=backend`, `CAMS_SERVER_PORT=7071`, `ports: 3000:3000`
- Playwright: `network_mode: host`, `TARGET_HOST=http://localhost:3000`
- Host resources healthy: 11% memory (1613MB/15993MB), 4 cores, 78G disk free — not a resource exhaustion issue
- `FORCE_REBUILD_DEPS=true` hardcoded in `run-e2e-workflow.sh` (TODO: restore cache logic)

**Active failure**: SQL Server crash-loops on `/var/opt/mssql/secrets/` — cannot create secrets subdirectory inside the bind-mounted volume. The CI runner creates `./sqlserver-data` as root-owned; the `mssql` user (uid 10001) cannot write into it. `mode=1777` tmpfs mounts for `/.system` and `/log` are working (those errors are gone), but the bind mount ownership is still wrong. `podman stats` shows `0B / 0B` — container not running. Warmup step silently succeeds due to `|| true`.

**Next fix**: Replace bind mount `./sqlserver-data:/var/opt/mssql` with a named volume `sqlserver-data:/var/opt/mssql`. Podman initializes named volumes with the container's uid namespace mapping, so `mssql` can write into it. Add `volumes: sqlserver-data:` declaration at bottom of compose file.

---

## Proposed next experiments

### Experiment 2 — Fix SQL Server crash-loop: named volume + tmpfs mode=1777 (QUEUED)
Azure SQL Edge crash-loops through a sequence of permission failures on root-level directories and the bind-mounted volume. Fix involves two changes:
1. `tmpfs: - /.system:mode=1777` and `- /log:mode=1777` (confirmed working in run `23918424348` — those errors gone)
2. Replace bind mount `./sqlserver-data:/var/opt/mssql` with named volume `sqlserver-data:/var/opt/mssql` — Podman initializes named volumes with correct uid namespace ownership, allowing `mssql` to create `secrets/` and other subdirectories inside `/var/opt/mssql`.

### Experiment 3 — Verify Okta redirect URI (if above doesn't fix the 500)
After auth succeeds the app renders but cannot call the API. If fixing SQL Server still leaves a 500, the problem may be the Okta redirect URI or user/group mapping config. Confirm the Okta app in the integrator tenant has `http://localhost:3000/...` registered as an allowed callback. Check `auth-setup.ts` to see what URL Playwright is waiting for after the Okta redirect.

---

## `IServiceProvider` crash — missing extension bundle in fresh deps image

**Symptom**: `func start` prints version banner then immediately crashes: `Cannot access a disposed object. Object name: 'IServiceProvider'.` No further output — no `host.json` read, no storage connection attempt.

**Initially misdiagnosed as**: npm restructuring global `node_modules` when `azurite` was installed via `RUN npm install -g azurite` in `Dockerfile.backend`. This was wrong — the real cause was unrelated to npm ordering.

**Initially misdiagnosed as**: `UseDevelopmentStorage=true` triggering a synchronous DI validation failure. Also wrong — switching to an explicit connection string made no difference.

**Initially misdiagnosed as**: COPYing `local.settings.backend.json` (which lacked `AzureWebJobsStorage`) causing the DI host to fail validation. Also wrong — removing the COPY didn't fix it until the bundle was also fixed.

**Root cause**: The extension bundle (`Microsoft.Azure.Functions.ExtensionBundle` v4.x) was not present in the freshly built `e2e_deps` image. The old cached image had it because a prior run had downloaded it and it was persisted. Fresh builds had no bundle, and the bridge-networked backend container has no internet access at runtime, so `func start` failed immediately trying to load the bundle.

**What worked**: Add `func bundles download` to `Dockerfile.deps` (after installing `azure-functions-core-tools`) using a minimal `host.json` seed directory. The bundle is downloaded during image build when internet is available, and cached at `/root/.azure-functions-core-tools/Functions/ExtensionBundles/` for all subsequent container runs.

**Also required**: Remove the `COPY test/e2e/local.settings.backend.json ./local.settings.json` from `Dockerfile.backend`. The source `local.settings.json` (baked into `e2e_built` via `COPY backend/`) already contains both `AzureWebJobsStorage` and `Host.CORS: "*"`. The extra COPY was redundant and caused confusion during diagnosis.

---

## Azurite SharedKey `AuthorizationFailure`

**Symptom**: `AuthorizationFailure` from Azurite on every Azure Functions storage operation. Backend DI host stays alive but reports storage as `Unhealthy`.

**Tried**: `--loose --skipApiVersionCheck` flags on Azurite — did not fix auth.

**Root cause**: The well-known Azurite `devstoreaccount1` AccountKey was not being used. The best run `23820968253` used a different AccountKey (`tiqIkEl+pA==`) that didn't match Azurite's expected key.

**Note**: `UseDevelopmentStorage=true` was suspected to bypass SharedKey auth, but this was never the active issue — the IServiceProvider crash (missing extension bundle) prevented the host from ever reaching storage. `UseDevelopmentStorage=true` itself does not crash the host; it was a red herring.

**What worked**: Use the explicit well-known Azurite connection string with `AccountKey=<REDACTED>` and endpoints pointing to `127.0.0.1` (embedded Azurite). Set via `AzureWebJobsStorage` env var in compose, which overrides the value in `local.settings.json` at runtime.

---

## `localhost` not reachable from host-network containers on rootless Podman (GitHub Actions)

**Symptom**: `ESOCKET`/`ETIMEOUT` connecting to `localhost:1433`, `localhost:27017`, `localhost:7071` from within a `network_mode: host` container.

**Tried**: `network_mode: host` on backend — rootless Podman on the GitHub Actions Ubuntu runner does NOT expose bridge-container published ports via `localhost` to host-network containers.

**Tried**: Discover bridge gateway IP (`10.89.0.1`) and patch `.env` with it — `10.89.0.1` is the bridge interface on the host, not where published ports are bound. Result: `ETIMEOUT`.

**Tried**: Port-wait loop using `nc -z 127.0.0.1 $port` — `nc` not installed on runner, silently succeeded immediately.

**Tried**: Port-wait loop using `/dev/tcp/127.0.0.1/$port` — ports 1433 and 7071 timed out after 90s confirming they genuinely do not bind to localhost for host-network containers.

**Root cause**: Rootless Podman with `pasta`/`slirp4netns` on this runner does not make published bridge-container ports available at `127.0.0.1` from within other containers, even host-network ones.

**What worked**: Keep backend on bridge network. Use bridge DNS names (`mongodb`, `sqlserver`) for all backend connections. Publish port `7071:7071` so Playwright (host-network) and the browser can reach the API at `localhost:7071`.

---

## CORS OPTIONS preflight returns 404

**Symptom**: Browser sends `OPTIONS /api/me` preflight, Azure Functions returns 404.

**Tried**: `CORS=*` and `CORS_CREDENTIALS=true` as environment variables — Azure Functions host does not read CORS config from plain env vars.

**Tried**: COPY a `local.settings.backend.json` file (with `Host.CORS: "*"`) into the backend image as `local.settings.json` — this worked initially but was later identified as a contributor to diagnostic confusion around the `IServiceProvider` crash. The COPY has since been removed.

**What worked**: The source `backend/function-apps/api/local.settings.json` already contains `"Host": { "CORS": "*" }` and is baked into the `e2e_built` image via `COPY backend/` in `Dockerfile.built`. No extra COPY needed. The compose env var `AzureWebJobsStorage` overrides the storage value at runtime; CORS config is untouched.

---

## Split `podman-compose up` causes container name collisions

**Symptom**: `Error: creating container storage: the container name "cams-azurite-e2e" is already in use`.

**Tried**: Splitting `podman-compose up` into two calls — second call tries to recreate containers from the first.

**Tried**: Single `up` with `depends_on: service_healthy` — podman-compose 1.0.6 silently downgrades to `--requires` (existence only), not health.

**What worked**: Remove the external Azurite container entirely. Run Azurite inside the backend container (installed in `Dockerfile.deps`). CMD waits for `"Table service is successfully listening"` in the azurite log before launching `func start`. No external dependency, no split-up needed.

---

## Stale cached Azurite image — `nc` missing

**Symptom**: `cams-azurite-e2e` status cycles `starting` → `unhealthy`. Backend fails to start.

**Root cause**: The ghcr.io cached Azurite image had `nc` missing, so the healthcheck always failed.

**What worked**: Moot — external Azurite container removed entirely. Azurite now runs inside the backend container.

---

## Health wait loop never exits despite services running

**Symptom**: `⚠️ Services did not become healthy within 120s` even though `backend (7071): ok` and `frontend (3000): ok` in HTTP checks.

**Root cause**: Loop condition checked `podman ps --filter "name=..."` container status counts, which returned `"0"` indefinitely for bridge containers when backend was on host network.

**What worked**: Removed the `podman ps` container-status gate entirely. HTTP reachability on both ports is the sufficient and correct readiness signal.

---

## SQL Server crash-loop under rootless Podman — Permission Denied on root-level directories

**Symptom**: `cams-sqlserver-e2e` container crash-loops. `podman stats` shows `CPU: 0.00%, Mem: 0B / 0B` — container not actually running. TCP healthcheck on port 1433 passes anyway (port opens briefly during crash cycle). Backend gets `ENOTFOUND sqlserver`. Only the healthcheck curl reaches the backend; Playwright's `/api/me` never appears in backend logs.

**SQL Edge log (first run)**: `Error: The log directory [/log] could not be created. File: LinuxDirectory.cpp:420 [Status: 0xC0000022 Access Denied errno = 0xD(13) Permission denied]`

**SQL Edge log (retries after adding `tmpfs: - /.system`)**: `Error: Directory [/.system/system] could not be created. File: LinuxDirectory.cpp:420 [Status: 0xC0000022 Access Denied errno = 0xD(13) Permission denied]`

**Root cause**: Azure SQL Edge (running as `mssql` uid 10001) tries to create several directories at the container root filesystem during initialization — confirmed: `/log` and `/.system`. Rootless Podman mounts a fresh tmpfs at `/` owned by root, so the `mssql` user cannot create directories there.

**Tried**: `tmpfs: - /.system` alone — fixed `/.system` creation but `/log` still failed on first run. On retries `/log` was somehow skipped but `/.system/system` (a subdirectory) failed, indicating the default tmpfs mount ownership was `root:root 755` and the `mssql` user could not write inside it.

**Tried**: `tmpfs: - /.system:uid=10001,gid=0,mode=0755` and `/log:uid=10001,gid=0,mode=0755` — podman 4.9.3 on Ubuntu 24.04 does not support the `uid=` mount option for `--tmpfs`. Run failed immediately with `Error: unknown mount option "uid=10001": invalid mount option` before the container started. Cascaded — backend, frontend, playwright all dead on arrival.

**Tried**: `tmpfs: - /.system:mode=1777` and `/log:mode=1777` (run `23918424348`) — those two paths are no longer failing. But `/var/opt/mssql/secrets/` is now the new crash point, inside the bind-mounted volume.

**What worked**: (pending) Replace bind mount with a named volume — Podman manages ownership correctly for named volumes under rootless user namespace mapping.

# E2E Pipeline Experiment Log

Tracks failed approaches so we don't repeat them. Each entry documents what was tried, why it failed, and what the correct fix was.

---

## Current Status (2026-04-03)

**Vite proxy experiment in progress.** Infrastructure fully working through seed and backend healthcheck. Root cause of OPTIONS 404 identified: Azure Functions host routing rejects OPTIONS via `HttpMethodRouteConstraint` before CORS middleware runs — no fix exists at the `local.settings.json` level. In production Azure handles this at the platform layer (ARM `cors.allowedOrigins`), never reaching the runtime. Fix: eliminate cross-origin entirely via `vite preview` proxy.

**Changes applied (Experiment 4 — queued for next CI run):**
- `test/e2e/vite.config.e2e.mts` added: `preview.proxy` routes `/api` → `http://localhost:7071`
- `Dockerfile.frontend`: `COPY test/e2e/vite.config.e2e.mts /app/user-interface/vite.config.mts` overwrites the default vite config in the image at build time; `vite preview` runs with no `--config` flag and picks it up naturally
- `podman-compose.yml` + `.env`: `CAMS_SERVER_HOSTNAME=localhost`, `CAMS_SERVER_PORT=3000`, `CAMS_SERVER_PROTOCOL=http` — browser calls `localhost:3000/api/...` (same-origin), proxy forwards to backend
- `FORCE_REBUILD_DEPS=true` hardcoded in `run-e2e-workflow.sh` (TODO: restore cache logic)

**Confirmed working (carried forward):**
- `e2e_deps`: installs `azure-functions-core-tools@4` + `azurite` together in one `npm install -g`, then pre-downloads the extension bundle via `func bundles download`
- `e2e_built`: standard build, no changes — source `local.settings.json` (with `AzureWebJobsStorage` + `Host.CORS`) baked in via `COPY backend/`
- `e2e_backend`: FROM `e2e_built`, no COPY, no extra installs — CMD starts azurite in background, waits for Table service ready, then `func start`
- `AzureWebJobsStorage`: explicit Azurite connection string (`devstoreaccount1` / well-known key / `http://127.0.0.1:10000`) passed via compose env var
- Databases start, seed succeeds, backend connects to `CAMS_E2E` cleanly — healthcheck returns HTTP 200, all checks pass including SQL
- Backend: bridge network, `ports: 7071:7071`
- Frontend: bridge network, `ports: 3000:3000`
- Playwright: `network_mode: host`, `TARGET_HOST=http://localhost:3000`

---

## Proposed next experiments

### Experiment 4 — Eliminate CORS via vite preview proxy (QUEUED — changes applied 2026-04-03)

**Root cause confirmed**: Azure Functions v4 host routing rejects `OPTIONS` via `HttpMethodRouteConstraint` before CORS middleware runs. `Host.CORS: "*"` in `local.settings.json` is irrelevant — routing kills OPTIONS first. In Azure production this never occurs because the platform ARM layer handles `OPTIONS` preflights upstream of the runtime.

**Fix**: Eliminate cross-origin entirely. Browser calls `localhost:3000/api/...` (same-origin → no preflight). `vite preview` proxy rule forwards to `localhost:7071/api/...` server-side.

**Changes**:
1. `test/e2e/vite.config.e2e.mts` — new file, `preview.proxy: { '/api': { target: 'http://localhost:7071' } }`
2. `Dockerfile.frontend` — `COPY test/e2e/vite.config.e2e.mts /app/user-interface/vite.config.mts` overwrites the default config in the OCI image; `vite preview` picks it up without a `--config` flag
3. `podman-compose.yml` + `.env` — `CAMS_SERVER_HOSTNAME=localhost`, `CAMS_SERVER_PORT=3000`, `CAMS_SERVER_PROTOCOL=http`

**Expected outcome**: Browser constructs `http://localhost:3000/api/me`, same-origin, no preflight. Vite forwards to backend. `app-component-test-id` becomes visible.

---

### Experiment 3 — Fix ELOGIN (State 38): seed databases before starting backend (QUEUED)
Backend connects with `CAMS_E2E` as the initial catalog at startup. On a fresh named volume `CAMS_E2E` doesn't exist yet — SQL Server rejects the connection with State 38 (database not found), surfaced as `ELOGIN`. Fix: restructure `run-e2e-workflow.sh` to start databases only, wait for TCP readiness, seed unconditionally (creates `CAMS_E2E`), then start backend and frontend. This ensures `CAMS_E2E` exists before any backend connection is attempted.

### Experiment 2 — Fix SQL Server crash-loop: named volume + tmpfs mode=1777 (CONFIRMED WORKING, run `23918982613`)
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

## CORS preflight `OPTIONS /api/me` returns 404 — route constraint rejects OPTIONS

**Symptom**: Three `OPTIONS /api/me` preflights reach the backend (confirmed in log) and all return HTTP 404 within 1-9ms: `Route value '(null)' with key 'httpMethod' did not match the constraint 'Microsoft.AspNetCore.Routing.Constraints.HttpMethodRouteConstraint'`. Browser never sends the real `GET /api/me`. React app stays in error/loading state after Okta redirect. `app-component-test-id` never visible.

**Context**: Only occurs with `CAMS_SERVER_HOSTNAME=localhost` (cross-origin from the browser's perspective — browser is at `http://localhost:3000`, API is at `http://localhost:7071`). Same-origin would suppress the preflight. `Host.CORS: "*"` is set in `local.settings.json` baked into the image, but the Functions host routing layer rejects OPTIONS before CORS middleware runs.

**Tried**: `CAMS_SERVER_HOSTNAME=backend` (Experiment 1) — eliminated the CORS 404 by making browser requests fail entirely with `ERR_NAME_NOT_RESOLVED` instead. Not a fix.

**Tried**: `vite preview --config /app/test/e2e/vite.config.e2e.mts` — vite's rolldown bundler resolves the config path relative to `user-interface/`, treating `../test/e2e/vite.config.e2e.mts` as an entry module outside the project root. Fails immediately with `[UNRESOLVED_ENTRY] Cannot resolve entry module ../test/e2e/vite.config.e2e.mts`. Container exits before binding port 3000.

**What worked**: `COPY test/e2e/vite.config.e2e.mts /app/user-interface/vite.config.mts` in `Dockerfile.frontend`. The file lands inside the project root at build time; `vite preview` loads it as the default config with no `--config` flag needed.

**Root cause confirmed (2026-04-03)**: `Host.CORS` in `local.settings.json` cannot fix this. The Azure Functions routing layer applies `HttpMethodRouteConstraint` before any CORS middleware runs. In Azure production, CORS preflights are handled by the ARM platform layer (`cors.allowedOrigins` in `siteConfig`) — the runtime never sees OPTIONS. The e2e stack has no platform layer.

**What worked**: Vite preview proxy (see Experiment 4). Browser calls `localhost:3000/api/...` (same-origin, no preflight). Vite forwards to `localhost:7071` server-side. No OPTIONS request is ever generated.

---

## `CAMS_SERVER_HOSTNAME=backend` — browser cannot resolve compose DNS names

**Symptom**: App renders "Access Denied — 500 Error - Server Error / Failed to fetch". Browser network trace shows all `/api/me` requests failing with `net::ERR_NAME_NOT_RESOLVED` against `http://backend:7071`. Backend receives zero requests after the healthcheck curl.

**Initially misdiagnosed as**: Fixed by `CAMS_SERVER_HOSTNAME=backend` — this appeared to eliminate the CORS 404 issue. Wrong. The CORS 404 disappeared for a different reason (unrelated to the hostname), and `backend` was silently breaking the browser's ability to call the API at all.

**Root cause**: The frontend is a static Vite build (`vite preview`) with no server-side proxy. `envToConfig.js` writes `CAMS_SERVER_HOSTNAME` directly into `configuration.json` → `window.CAMS_CONFIGURATION`. The browser constructs `http://backend:7071/api` and calls it directly. `backend` is a compose bridge DNS name, only resolvable inside the compose network — not from the browser running inside the Playwright host-network container.

**What worked**: `CAMS_SERVER_HOSTNAME=localhost`. Port 7071 is published to the host. The browser (and Playwright, on host network) can reach the backend at `localhost:7071`. `Host.CORS: "*"` is baked into the backend image to handle CORS preflights.

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

**What worked**: Named volume `sqlserver-data:/var/opt/mssql` + `tmpfs: - /.system:mode=1777` + `- /log:mode=1777` (run `23918982613`). SQL Server starts successfully and accepts connections. Named volume with `volumes: sqlserver-data:` declaration at bottom of compose file — Podman initializes it with correct uid namespace ownership.

---

## Backend ELOGIN (State 38) — `CAMS_E2E` database not found at backend startup

**Symptom**: `[ERROR] [HEALTHCHECK-SQL-DB] Login failed for user 'sa'. {"code":"ELOGIN"}`. SQL Server log shows `Error: 18456, Severity: 14, State: 38. Login failed for user 'sa'. Reason: Failed to open the explicitly specified database 'CAMS_E2E'.` The SA password is correct — State 38 means the login succeeded but the requested initial catalog doesn't exist.

**Root cause**: The backend is started at the same time as the databases. On a fresh named volume `CAMS_E2E` doesn't exist yet — the seed script creates it in Step 2.5, but that runs after the health-wait loop which completes as soon as the backend HTTP port responds (even a 500 counts). So the backend starts, immediately tries to connect with `CAMS_E2E` as the initial catalog, and SQL Server rejects it.

**What worked**: Restructure `run-e2e-workflow.sh` to start databases first, wait for TCP readiness on ports 27017 and 1433, seed unconditionally, then start backend and frontend. `CAMS_E2E` is guaranteed to exist before the backend's first SQL connection.

---

## TCP probe passes before SQL Server login subsystem is ready

**Symptom**: `✅ Databases are accepting connections` printed ~20ms after `podman run` for sqlserver completes — before port 1433 has even opened. Seed script attempts connection ~3.6s into SQL Server's first-boot cold start and gets `ConnectionError: Failed to connect to sqlserver:1433 - Could not connect (sequence)`. `CAMS_E2E` never created; backend hits ELOGIN State 38.

**Root cause**: `bash -c '</dev/tcp/localhost/1433'` is a raw socket-open probe. It passes the instant the TCP listener exists, well before the SQL Server login subsystem is initialized and accepting authenticated connections.

**What worked**: (pending) Replace the TCP probe with `podman exec cams-sqlserver-e2e /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "${MSSQL_PASS}" -Q "SELECT 1"`. Only succeeds when `sa` can actually authenticate — a genuine readiness signal.

---

## `podman-compose run` bugs in 1.0.6 — env var `=` crash and `--no-deps` dependency leak

**Symptom 1 (MongoDB seed)**: `ValueError: dictionary update sequence element #0 has length 3; 2 is required` in `podman_compose.py`. Any `-e KEY=value` where `value` contains `=` (e.g. a connection string) causes the podman-compose 1.0.6 env-var parser to crash — it splits on `=` naively and gets 3+ parts instead of 2.

**Symptom 2 (SQL seed)**: `"cams-frontend-e2e" is not a valid container, cannot be used as a dependency` — `podman-compose run --no-deps` still evaluates the `depends_on` of the service being run (playwright depends on backend and frontend). At seed time those containers don't exist yet.

**What worked**: Replace all `podman-compose run` seed/warmup invocations with `podman run --net e2e_cams-e2e -w /app/test/e2e e2e_playwright:latest`. Direct `podman run` bypasses podman-compose entirely — no env-var parsing, no dependency resolution.

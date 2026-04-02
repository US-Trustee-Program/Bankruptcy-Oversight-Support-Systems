# E2E Pipeline Experiment Log

Tracks failed approaches so we don't repeat them. Each entry documents what was tried, why it failed, and what the correct fix was.

---

## Current Status (tag: `E2E_BEST_BRIAN_2`, run `23909519460`, 2026-04-02)

**All infrastructure is working.** Every container starts and becomes healthy. Playwright runs auth-setup and completes the Okta login flow. The app loads but renders "Access Denied — 500 Error - Server Error — Failed to fetch", causing `expect(page.getByTestId('app-component-test-id')).toBeVisible()` to fail.

**Working configuration summary:**
- `e2e_deps`: installs `azure-functions-core-tools@4` + `azurite` together in one `npm install -g`, then pre-downloads the extension bundle via `func bundles download`
- `e2e_built`: standard build, no changes — source `local.settings.json` (with `AzureWebJobsStorage` + `Host.CORS`) baked in via `COPY backend/`
- `e2e_backend`: FROM `e2e_built`, no COPY, no extra installs — CMD starts azurite in background, waits for Table service ready, then `func start`
- `AzureWebJobsStorage`: explicit Azurite connection string (`devstoreaccount1` / well-known key / `http://127.0.0.1:10000`) passed via compose env var — overrides the value in `local.settings.json` at runtime
- Backend: bridge network, `ports: 7071:7071`
- Frontend: bridge network, `CAMS_SERVER_HOSTNAME=backend` (Experiment 1 in progress), `CAMS_SERVER_PORT=7071`, `ports: 3000:3000`
- Playwright: `network_mode: host`, `TARGET_HOST=http://localhost:3000`
- `FORCE_REBUILD_DEPS=true` hardcoded in `run-e2e-workflow.sh` (TODO: restore cache logic)

**Remaining failure**: Frontend gets "Failed to fetch" on initial API call after auth. Root cause: `CAMS_SERVER_HOSTNAME=localhost` resolves to the frontend container itself, not the backend. Experiment 1 (switching to `CAMS_SERVER_HOSTNAME=backend`) is queued.

---

## Proposed next experiments

### Experiment 1 — Use bridge DNS for frontend → backend calls (IN PROGRESS)
Change `CAMS_SERVER_HOSTNAME=localhost` → `CAMS_SERVER_HOSTNAME=backend` in `pr-validation.yml`. The frontend container is on the bridge network and resolves `backend` via container DNS. The browser-side requests go through the frontend's Express proxy, so Playwright on host network reaches the API indirectly. This matches the best run `23820968253` which used `CAMS_API_BASE_URL=http://backend:7071`.

### Experiment 2 — Put backend on host network (MEDIUM RISK)
Add `network_mode: host` to the backend service. Makes backend reachable at `localhost:7071` from all contexts (browser, Playwright, frontend server-side). The embedded Azurite at `127.0.0.1` still works. Requires removing the `ports: 7071:7071` mapping (incompatible with host network mode). MongoDB and SQL Server connections switch from bridge DNS to `localhost` (published ports). May re-introduce issues seen in earlier host-network experiments.

### Experiment 3 — Verify Okta redirect URI (if Experiments 1-2 don't help)
After auth succeeds the app renders but cannot call the API. If the frontend proxy is not the issue, the problem may be the Okta redirect URI configuration. Confirm the Okta app in the integrator tenant has `http://localhost:3000/...` registered as an allowed callback. Check `auth-setup.ts` to see what URL Playwright is waiting for after the Okta redirect.

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

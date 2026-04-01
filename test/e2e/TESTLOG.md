# E2E Pipeline Experiment Log

Tracks failed approaches so we don't repeat them. Each entry documents what was tried, why it failed, and what the correct fix was.

---

## Azurite SharedKey HMAC auth failure

**Symptom**: `AuthorizationFailure` from Azurite on every Azure Functions storage operation.

**Tried**: `--loose --skipApiVersionCheck` flags on Azurite — did not fix auth.

**Tried**: COPY `local.settings.json` into backend image with correct connection string — Azure Functions `environment:` block overrides the file.

**Root cause**: Azure Functions extension bundle v4 storage SDK sends canonical headers that Azurite's SharedKey validator rejects.

**What worked**: `AzureWebJobsStorage=UseDevelopmentStorage=true` bypasses SharedKey entirely — but only works when Azurite is reachable at `127.0.0.1`.

**Current approach**: Full Azurite connection string using bridge DNS (`http://azurite:10000/...`). Backend is on bridge network so `azurite` resolves.

---

## `localhost` not reachable from host-network containers on rootless Podman (GitHub Actions)

**Symptom**: `ESOCKET`/`ETIMEOUT` connecting to `localhost:1433`, `localhost:27017`, `localhost:7071` from within a `network_mode: host` container.

**Tried**: `network_mode: host` on backend so `UseDevelopmentStorage=true` (requires `127.0.0.1`) would work — but rootless Podman on the GitHub Actions Ubuntu runner does NOT expose bridge-container published ports via `localhost` to host-network containers.

**Tried**: Discover bridge gateway IP (`10.89.0.1`) and patch `.env` with it — `10.89.0.1` is the bridge interface on the host, not where published ports are bound. Result: `ETIMEOUT`.

**Tried**: Port-wait loop using `nc -z 127.0.0.1 $port` — `nc` not installed on runner, silently succeeded immediately.

**Tried**: Port-wait loop using `/dev/tcp/127.0.0.1/$port` — ports 1433 and 7071 timed out after 90s confirming they genuinely do not bind to localhost for host-network containers.

**Root cause**: Rootless Podman with `pasta`/`slirp4netns` on this runner does not make published bridge-container ports available at `127.0.0.1` from within other containers, even host-network ones.

**What worked**: Move the backend onto the bridge network (`networks: cams-e2e`). Use bridge DNS names (`mongodb`, `sqlserver`, `azurite`) for all backend connections. Publish port `7071:7071` so Playwright (host-network) and the browser can reach the API at `localhost:7071`.

---

## CORS OPTIONS preflight returns 404

**Symptom**: Browser sends `OPTIONS /api/me` preflight, Azure Functions returns 404 with "Route value '(null)' with key 'httpMethod' did not match constraint".

**Tried**: `CORS=*` and `CORS_CREDENTIALS=true` as environment variables on the backend container — Azure Functions host does not read `CORS` config from plain env vars.

**Root cause**: Azure Functions reads CORS config from `local.settings.json` `Host.CORS` section, or from the Azure platform (Bicep `cors.allowedOrigins`). Neither applies in the containerized E2E environment by default.

**What worked**: COPY a `local.settings.backend.json` file (with `Host.CORS: "*"`) into the backend image as `local.settings.json`. This is the only way the local Functions CLI picks up CORS config.

---

## Split `podman-compose up` causes container name collisions

**Symptom**: `Error: creating container storage: the container name "cams-azurite-e2e" is already in use`.

**Tried**: Splitting `podman-compose up` into two calls — `up -d azurite mongodb sqlserver` then `up -d backend frontend` — so we could wait for DB ports before starting the backend. Podman-compose 1.0.6 treats the second `up` as a new invocation and tries to recreate containers from the first call.

**Tried**: Single `podman-compose up -d azurite mongodb sqlserver backend frontend`. `depends_on: service_healthy` is silently downgraded to `--requires` (existence only) by podman-compose 1.0.6 — the backend starts 5 seconds after Azurite, before Azurite's HTTP port is serving, causing an immediate `IServiceProvider` crash.

**What worked**: Two separate `up` calls — `up -d azurite mongodb sqlserver` then `up -d backend frontend` — with an explicit `curl` wait loop on `http://localhost:10000/devstoreaccount1?comp=list` between them. The second `up` call does not recreate the database containers because they are already running; podman-compose 1.0.6 only recreates stopped containers.

---

## Stale cached Azurite image — `nc` missing, SharedKey HMAC incompatible

**Symptom**: `cams-azurite-e2e` status cycles `starting` → `unhealthy`. Backend crashes immediately with `Cannot access a disposed object. Object name: 'IServiceProvider'`. The playwright `podman-compose run` then fails with "container depends on container not found in input list" because the backend container exited.

**Root cause**: The ghcr.io cached Azurite image (`e2e-base-azure-storage-azurite-latest`) has two problems: (1) `nc` (netcat) is not installed, so the `nc -z localhost 10000` healthcheck always fails, leaving Azurite `unhealthy`; (2) the cached image version has a SharedKey HMAC incompatibility with Azure Functions extension bundle v4, causing the Functions DI container to crash on storage initialization even when Azurite is reachable.

**What worked**: Switch to upstream `mcr.microsoft.com/azure-storage/azurite:latest` directly. The upstream image has `nc`, passes the healthcheck, and its current version is compatible with bundle v4's HMAC headers. Also switched healthcheck to `curl -sf http://localhost:10000/devstoreaccount1?comp=list` for robustness since `curl` is more universally available than `nc`.

---

## Health wait loop never exits despite services running

**Symptom**: `⚠️ Services did not become healthy within 120s` even though `backend (7071): ok` and `frontend (3000): ok` in HTTP checks.

**Root cause**: Loop condition checked `podman ps --filter "name=..."` container status counts. When backend was on host network, `podman ps` filter returned only `cams-azurite-e2e` — all other container status checks returned `"0"` indefinitely.

**What worked**: Removed the `podman ps` container-status gate entirely. HTTP reachability on both ports is the sufficient and correct readiness signal.

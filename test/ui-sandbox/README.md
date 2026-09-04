# UI Sandbox

A local environment for hands-on UI experimentation: click through screens, poke at layouts, and
reproduce/verify UI bugs against real data and real code paths - not a CI suite. Agents can use this
to run UI experiments freely without disrupting `test/e2e`'s pinned fixtures or its Okta-dependent
CI flow.

Unlike `test/e2e` (fixed fixtures, Okta login, torn down after every run) this sandbox gives full
control over:

- **Login and principals** - a real (if minimal) OIDC provider stands in for Okta, backed by a Mongo
  `okta.users` collection anyone can edit. Log in as any fixture user with any role/office
  combination, at will, with no Okta account needed.
- **Data** - fixtures live in the `cams-sandbox` Mongo database, seeded by `scripts/seed.ts`. It
  isn't scoped to any one screen or feature - add a new seeding function and call it for whatever
  collection/scenario you're chasing next (case detail, staff assignments, trustee profiles,
  trustee-match-verification mismatches, whatever). The trustee-match-verification mismatch fixture
  currently in there is just the first example, not the sandbox's scope.
- **Longevity** - services stay up across runs; re-seed and re-launch independently instead of a
  full build-seed-test-teardown cycle.

## Why not just use `test/e2e`'s mock login?

`test/e2e`'s `CAMS_LOGIN_PROVIDER=mock` path (`MockLogin.tsx`,
`backend/lib/testing/mock-gateways/mock-oauth2-gateway.ts`) swaps out the entire backend
authorization gateway - it never exercises the real `okta-gateway.ts`/`HumbleVerifier.ts` code path,
and its user list is a hardcoded array in `common/src/cams/test-utilities/mock-user.ts` that can't
be extended without editing source. The fake-okta server here speaks the actual OIDC surface
`@okta/jwt-verifier` (backend) and `@okta/okta-auth-js` (frontend) expect - full PKCE
authorization-code flow, real RS256-signed JWTs, real JWKS - so the real code path is exercised and
principals are controlled entirely through Mongo fixtures.

## One-time setup

```bash
cd test/ui-sandbox
./scripts/generate-cert.sh          # self-signed TLS cert + JWT signing keypair for fake-okta
```

`@okta/jwt-verifier` hard-rejects any non-`https://` issuer with no config hook available at the
backend's call site - so the fake-okta server must terminate real TLS even for local dev, hence the
self-signed cert. Your browser will show a security warning the first time it hits
`https://localhost:8443` during the login redirect; accept/continue past it (or launch a Playwright
browser with `ignoreHTTPSErrors: true`).

## Starting everything

```bash
./scripts/start-services.sh          # MongoDB + SQL Edge containers (standalone, no pod)
npm run seed:sql                     # one-time DXTR office/court schema + rows (needed even for
                                      # Mongo-only screens - courtName enrichment queries real
                                      # DXTR office/court tables via OfficesDxtrGateway)
npm run seed                         # cams-sandbox Mongo fixtures (scripts/seed.ts)
npx tsx fake-okta/seed-users.ts      # okta.users Mongo fixtures - edit fake-okta/seed-users.ts
                                      # directly to add/change fixture principals
./scripts/launch.sh                  # builds+runs the fake-okta container, starts the backend
                                      # (func start, built API) and frontend (Vite, hot reload)
```

Then open `http://localhost:3000` - click through the login flow, pick a fixture user from the
dropdown on the fake sign-in page, and you're in with that user's real role/office scoping.

Ctrl-C on `launch.sh` stops the backend/frontend/fake-okta container together. The databases
(`start-services.sh`) are separate and stay up across `launch.sh` runs -
`./scripts/stop-services.sh` tears those down when you're done for good.

## Architecture

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│  Vite dev server │◄────►│  func start (built)  │◄────►│  MongoDB         │
│  (hot reload)    │      │  Azure Functions host │      │  SQL Edge (DXTR) │
│  :3000           │      │  :7071               │      └─────────────────┘
└────────┬─────────┘      └──────────┬────────────┘
         │ full-page redirect        │ JWKS fetch, userinfo fetch
         ▼                           ▼
┌───────────────────────────────────────────────┐
│  fake-okta (Podman container)                  │
│  real OIDC: discovery doc, JWKS, PKCE authorize│
│  /token, userinfo - backed by okta.users Mongo │
│  :8443 (self-signed TLS)                       │
└───────────────────────────────────────────────┘
```

- **Frontend**: real Vite dev server, hot reload on every source save - this is what "ui-sandbox"
  hot-reloads. `frontend.env` sets `CAMS_LOGIN_PROVIDER=okta` pointed at the fake-okta issuer.
- **Backend**: the built Azure Functions API (`func start` against `backend/function-apps/api/dist`)
  - no hot reload; rebuild after backend changes with
    `npm run build:common && npm run build:api --workspace=backend` and restart `launch.sh`.
    `local.settings.json` (gitignored, swapped in/out of
    `backend/function-apps/api/local.settings.json` for the process's lifetime only - see
    `scripts/start-backend.sh`) points `CAMS_LOGIN_PROVIDER`/`CAMS_LOGIN_PROVIDER_CONFIG` at the
    fake-okta issuer and disables TLS verification for the backend's own outbound calls to it
    (`NODE_TLS_REJECT_UNAUTHORIZED=0` - the self-signed cert has no CA to trust).
- **fake-okta**: a standalone container (`fake-okta/Dockerfile`) with its own `package.json` (own
  `express`/`jose`/`mongodb` versions) - deliberately independent of the monorepo root
  `node_modules`/lockfile, so it isn't affected by unrelated root dependency issues. Reaches the
  sandbox's Mongo container via `host.containers.internal` (Podman's host-gateway DNS name), since
  the Mongo/SQL Edge containers publish to the host's `localhost` rather than sharing a pod network
  with fake-okta.

## Adding/editing fixture users

Edit `fake-okta/seed-users.ts`'s `FIXTURE_USERS` array directly and re-run
`npx tsx fake-okta/seed-users.ts` (upserts by `sub`, safe to re-run anytime, including while
`launch.sh` is running). Each user's `groups` array drives both:

- **Role** (`CamsRole`) via `idp_group_name` entries in
  `backend/lib/adapters/gateways/storage/local-storage-gateway.ts`'s role-mapping table (e.g.
  `"USTP CAMS Data Verifier"`, `"USTP CAMS Super User"`).
- **Office/region scoping** via the real DXTR-derived group name pattern
  `USTP CAMS Region {regionId} Office {officeName}` (see
  `backend/lib/use-cases/offices/offices.ts`'s `buildOfficeCode` - the office name must match
  `USTP_OFFICE_NAME_MAP` in `backend/lib/adapters/gateways/dxtr/dxtr.constants.ts` for a given
  `courtDivisionCode`, e.g. `'081'` → `Manhattan`).

A user with an empty `groups` array gets no role and no office - a valid "no permissions" fixture.

## Extending the seeded data

`scripts/seed.ts` is a minimal, standalone script, not scoped to any one screen or feature - add a
new seeding function and call it for whatever collection/scenario you need next; it isn't wired to
any other suite, so there's nothing else to keep in sync. For richer, more realistic fixtures across
more collections, consider harvesting from a real dev environment with
`test/e2e/scripts/harvest-fixtures.sh` (PII-scrubbed via `synthesize-fixtures.ts`) as a starting
point, then hand-editing.

## Privileged Identity Management support

`OktaUserGroupGateway` (`backend/lib/adapters/gateways/okta/okta-user-group-gateway.ts`) calls the
real Okta _management_ API (`@okta/okta-sdk-nodejs`) to look up groups and their members -
`PrivilegedIdentityUser`-gated admin screens depend on this, separately from the login/JWT flow.
fake-okta implements the slice of that API `OktaHumble` actually calls (`GET /api/v1/groups`,
`GET /api/v1/groups/{groupId}/users`, `GET /api/v1/users/{userId}`,
`GET /api/v1/users/{userId}/groups`), backed by the same `okta.users` Mongo fixtures - group
membership is just each fixture user's `groups` array, no separate groups collection to maintain.
Auth uses the simpler SSWS static-token mode (`local.settings.json`'s `OKTA_API_KEY`, checked
against fake-okta's `FAKE_OKTA_MANAGEMENT_TOKEN`) rather than the private-key JWT mode.

## Why seed SQL Edge too?

`npm run seed:sql` imitates the real DXTR/ACMS database dependencies that Mongo-backed screens still
reach through - it's not a limitation to work around. The trustee-match-verification screen's data
lives in Mongo, but the list endpoint's `courtName` enrichment calls `CourtsUseCase` →
`OfficesUseCase` → the real `OfficesDxtrGateway`, which queries DXTR office/court tables whenever
`DATABASE_MOCK=false` (which this sandbox always uses, to keep Mongo-backed repositories exercising
real code too).

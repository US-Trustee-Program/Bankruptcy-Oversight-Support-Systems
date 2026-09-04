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
- **Data** - trustee-match-verification fixtures live in the same `cams-e2e` Mongo database, own
  seed script (`scripts/seed.ts`), edit directly for whatever scenario you're chasing next.
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
npm run seed                         # trustee-match-verification Mongo fixtures
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

`scripts/seed.ts` is a minimal, standalone script - extend it directly for whatever
trustee-match-verification scenario (or add seeding for other collections) you need next; it isn't
wired to any other suite, so there's nothing else to keep in sync. For richer, more realistic
fixtures across more collections, consider harvesting from a real dev environment with
`test/e2e/scripts/harvest-fixtures.sh` (PII-scrubbed via `synthesize-fixtures.ts`) as a starting
point, then hand-editing.

## Known gaps / things to watch

- The root monorepo's `node_modules` currently has a broken `path-to-regexp` resolution (present in
  `package-lock.json` via a root `overrides` pin, but absent from the installed tree) that breaks
  any `express`-based process run directly against the root install (`backend/express/server.ts`,
  for instance). This is why fake-okta runs in its own container with its own `npm install` rather
  than as a bare `tsx` process - it sidesteps the issue entirely. Worth a real fix in the root
  lockfile at some point; out of scope for this sandbox.
- SQL Edge seeding (`npm run seed:sql`) is required even though the trustee-match-verification
  screen's data lives entirely in Mongo - the list endpoint's `courtName` enrichment calls
  `CourtsUseCase` → `OfficesUseCase` → the real `OfficesDxtrGateway`, which queries DXTR
  office/court tables whenever `DATABASE_MOCK=false` (which this sandbox always uses, to keep
  Mongo-backed repositories real too).
- **Privileged Identity Management screens don't work in this sandbox.** `OktaUserGroupGateway`
  (`backend/lib/adapters/gateways/okta/okta-user-group-gateway.ts`) calls the real Okta _management_
  API (`@okta/okta-sdk-nodejs`'s `listUserGroups`) to look up a user's groups by ID - a completely
  different, much larger surface than the login/JWT flow this sandbox's fake-okta server implements,
  and it requires either a real Okta API token or a real private-key JWT client credential
  (`CAMS_USER_GROUP_GATEWAY_CONFIG`'s `provider`/`clientId`/`keyId`/`privateKey` fields - this
  sandbox's config only sets `url`, so `validateConfiguration` will reject it). This only affects
  `PrivilegedIdentityUser`-gated admin screens (feature-flagged, not the
  trustee-mismatch/data-verification screens this sandbox exists for) - out of scope for now. Fixing
  it for real would mean either implementing fake Okta management/groups endpoints too, or swapping
  in a from-scratch local gateway that reads groups from the same `okta.users` Mongo fixtures
  instead of calling out to Okta at all.

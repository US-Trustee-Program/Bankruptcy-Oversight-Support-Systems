# Feature Flags

## Creating New Flags in Launch Darkly

### Front-end

When creating a new flag for the front end code, be sure to go to:

settings > Client-side SDK availability

and check the box labeled "SDKs using Client-side ID".

If you do not check this box, the flag will not be available to the front end.

## User Context

Both the backend (Node server SDK) and frontend (React client SDK) evaluate flags using a
LaunchDarkly ["user" context](https://docs.launchdarkly.com/sdk/features/user-context) built from
the authenticated user's `CamsUser`. The context shape is identical on both sides because both SDKs
consume the same mapping function, `buildLaunchDarklyContext(user: CamsUser)`, defined once in
`common/src/feature-flags.ts` (see the `LaunchDarklyContext` type there for the exact shape).

| Attribute                | Source                                                          | Notes                                                                                                                               |
| ------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                   | always `'user'`                                                 |                                                                                                                                     |
| `key`                    | `CamsUser.id`                                                   | Equals the Okta `sub` claim — this is what LaunchDarkly targeting rules and segments match against.                                 |
| `name`                   | `CamsUser.name`                                                 |                                                                                                                                     |
| `email`                  | `CamsUser.email`                                                | May be `undefined`.                                                                                                                 |
| `roles`                  | `CamsUser.roles`                                                | e.g. `TrialAttorney`, `TrusteeAdmin`, `SuperUser` — see `common/src/cams/roles.ts` for the full `CamsRole` set. May be `undefined`. |
| `officeGroupDesignators` | `getGroupDesignators(user)` (flattened from `CamsUser.offices`) | Always an array; empty if the user has no offices.                                                                                  |

**Backend:** `getFeatureFlags(config, user?)` in `backend/lib/adapters/utils/feature-flag.ts` sends
`buildLaunchDarklyContext(user)` when a resolved `CamsUser` is available (i.e. for authenticated API
requests, via `applicationContextCreator()`). Dataflow, healthcheck, and mock-oauth2 invocations
have no user session, so they call `getFeatureFlags(config)` with no user and get today's hardcoded
anonymous context (`{ kind: 'user', key: 'feature-flag-migration', anonymous: true }`) — this keeps
their behavior unchanged.

**Frontend:** `App.tsx` calls the LaunchDarkly client SDK's `identify()` once, on mount, with
`buildLaunchDarklyContext(session.user)`, once a session is available in `LocalStorage`.

### Adding a new targeting rule

Because `key` is the Okta `sub` claim, a targeting rule or segment can be built around specific
users by adding their `key` to a list-based segment. To target by role or office instead of by
individual user, write a targeting rule against the `roles` or `officeGroupDesignators` custom
attributes — no code changes are required to add a new rule for an attribute that's already part of
the context above. If you need a new attribute, add it to `LaunchDarklyContext` and
`buildLaunchDarklyContext()` in `common/src/feature-flags.ts` — that single change is picked up by
both the backend and frontend since they share the same mapping function.

### Detailees pilot: dashboard configuration

To pilot a flag with a manually-maintained list of users ahead of that feature's broader rollout,
set up a list-based segment and a targeting rule in the LaunchDarkly **GovCloud US** environment:

1. **Create the segment** — Dashboard > your project > GovCloud US environment > Segments > New
   Segment.
   - Name: `Detailees`
   - Type: **List** (a manually-maintained list of context keys, not a rule-based segment)
   - Add each pilot user's context `key` (their Okta `sub` claim — see the User Context table above)
     to the segment's list.
2. **Add a targeting rule to the pilot flag** (e.g. `trustee-management`) — Flag > Targeting tab >
   Add rule.
   - Condition: "context is in segment" > `Detailees`
   - Serve: the `true` (or "on") variation
   - **Ordering:** this rule must be placed _above_ the existing default/fallthrough rule, since
     LaunchDarkly evaluates targeting rules top-to-bottom and stops at the first match — a rule
     placed after the fallthrough would never be reached.
3. **Verify:** a user whose `key` is in the `Detailees` segment list sees the flag's "on" variation;
   a user not in the list falls through to the existing default behavior, unchanged.

Repeat this for any other flag that needs a pilot rollout ahead of its general availability.

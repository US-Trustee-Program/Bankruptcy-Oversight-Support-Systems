# Provisioning the First Super User

## Context

CAMS-940 (GitHub #3110) moved CAMS authorization into CAMS-managed role assignments, gated by the
`cams-role-assignments` feature flag. With the flag on, a session's roles come only from active role
assignments, and only a Super User can grant a role from the Permissions screen. A newly enabled
environment therefore has no way to create its first Super User from inside CAMS: every environment,
including USTP staging and production, needs that first permission written some other way.

Constraints that shaped the decision:

- It happens once per environment, plus the occasional re-grant. It is not a recurring workflow.
- USTP staging and production databases are reachable only from USTP-controlled machines. Operators
  reach them from the Privileged Access Workstation (PAW), which has MongoDB Compass and its
  built-in shell, not a full mongosh install or Node.
- Changes to the USTP Azure DevOps pipelines travel through a mirror repository and
  government-furnished equipment, and each pipeline run clones the CAMS `main` branch. A pipeline
  change and the CAMS change it depends on have to land in a coordinated order.
- The written documents must match what the Permissions screen writes: one active role assignment
  and one append-only audit entry, never a deletion.

Alternatives considered, in the order they were tried:

- **Seed data.** A dev-tools seed scenario wrote a fixed-id Super User assignment. Rejected: seeds
  don't run in USTP environments, and re-running the seed brought back a fixed-id record that had
  been deliberately removed from the shared Flexion dev database.
- **An HTTP trigger on the dataflows app.** Rejected before it was built: the team had removed HTTP
  triggers from dataflows in July 2026, and the trigger's shared admin key would have become a key
  that creates Super Users.
- **A queue-started dataflow.** Built, then reverted on 2026-11-12. Sending a message needed storage
  account keys, reporting the outcome needed log polling, and the dataflow had to be enabled per
  environment. Prem judged it too much machinery for a one-time action.
- **A dev-tools command run from an Azure DevOps step.** The command was built and a pipeline step
  designed: list the Cosmos keys, open the Cosmos firewall to the build agent for the run, run the
  command, close the firewall. Rejected by Brian Posey on 2026-11-23 as overengineered. It needed
  pipeline rights to read database keys and change the firewall, answers about the agent pool's
  network path, a cross-repository change through the mirror, and a pipeline that shared a manual
  run with an unrelated secrets step.

The `cams-role-assignments` flag must be global, with no LaunchDarkly targeting rules or percentage
rollouts. The session reads the anonymous evaluation and the Permissions endpoint reads the per-user
evaluation, so a targeted flag can make them disagree (see
[Feature Flags](../../contributing/feature-flags.md#flags-that-must-not-use-targeting)).

## Decision

We provision the first Super User in each environment with a self-contained script that an operator
pastes into the MongoDB Compass shell on the PAW, connected to that environment's database.

- The script only grants. It writes one unscoped Super User role assignment and its matching
  creation audit entry, in the same shape the Permissions screen writes, and changes nothing if the
  user already holds an active Super User permission.
- It writes nothing unless `user-role-assignments` already has its unique `{userId, activeKey}`
  index. Cosmos adds a unique index only to an empty collection, so the Bicep deploy that creates
  the collection with the index must run before the script. The application makes the same check
  before its first write.
- It runs in Compass's shell as-is: no module loading, no environment variables. The operator sets
  the target user and database at the top of the script before pasting.
- The audit entry records a fixed performer that identifies the provisioning script, not the
  operator.
- Revoking a Super User, and every grant after the first, belongs in the Permissions screen. Revoke
  is not built yet and is out of scope for CAMS-940.
- The dev-tools Super User command and the pipeline step are not kept.

## Status

Accepted (2026-11-23)

## Consequences

### Benefits

- No pipeline, no new secrets, and no network or firewall changes: the operator uses database access
  the PAW already has.
- One procedure works in every environment, from Flexion dev to USTP production.
- Running the script twice is harmless, and nothing is ever deleted.

### Trade-offs

- It is a manual step for each environment, and its only test is a real run in Compass. It was
  exercised through a Node stand-in before the first Compass run, not inside Compass itself.
- The audit trail shows that the provisioning script created the permission, not which person ran
  it. Who ran it has to come from PAW and database access records.
- Nothing alerts on a run. The script is meant to run once per environment, but an unexpected run
  (or a hand-written grant) is only visible in the audit collection, not raised to anyone.
- Nothing checks the user id against the Okta "USTP Cams Users" group, so a mistyped id writes a
  permission nobody can use.
- The script repeats the role-assignment and audit document shape instead of sharing the
  application's code, so a change to those documents must be made in the script too.
- Until revoke exists in the Permissions screen, removing a Super User means editing the database
  directly. The edit must deactivate the permission the way the application does (inactive and with
  its unique key released) and record the deactivation in the audit trail, never delete it; the
  test-data catalog gives the exact edit. The edit must also clear the user's cached sessions, which
  the Permissions screen does on every grant; otherwise a signed-in session keeps Super User until
  its token expires.

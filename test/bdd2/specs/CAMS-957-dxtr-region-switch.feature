# Ticket: CAMS-957 (GitHub #3191)
# Beads epic: cams-0pqfs
# Total Slices: 6
# Depends on: CAMS-955 (GitHub #3189, merged; admin page shipped read-only in PR #3285) and
#             CAMS-956 (GitHub #3190, open as of 2026-11-17)
# Implementation home: the syncTrusteeCaseAppointments dataflow and its TrusteeAppointmentSource
# abstraction (backend/lib/use-cases/dataflows/trustee-appointment-source.ts), and the Trustee Task
# Regions admin page (user-interface/src/admin/trustee-task-regions/).
Feature: Switch a region's trustee appointments to DXTR
  As a CAMS SuperUser
  I want a one-way switch per region from ACMS to DXTR that records who made it and when
  So that each region moves to DXTR, the long-term appointment source, one region at a time

  # Terms used below:
  # - "the sync" is the syncTrusteeCaseAppointments dataflow
  # - "the bookmark" is runtime-state field region.<regionId>.lastSyncDate
  # - "the source record" is runtime-state field region.<regionId>.source,
  #   { system: 'DXTR', updatedOn, updatedBy } built with createAuditRecord and written with setField.
  #   A region with no source record is on ACMS.
  # - "transaction date" is DXTR TX_DATE, the date each DXTR page is read by
  # - Trustee identification order and the trustee-match pipeline are the same as CAMS-955
  #   (test/bdd2/specs/CAMS-955-acms-case-appointment-sync.feature)

  Background:
    Given regions "01", "02" and "03" have offices in CAMS office data

  # SLICE 1: A SuperUser switches a region to DXTR on the Trustee Task Regions page
  # Dependencies: None (extends CAMS-955 Slice 4's read-only page)
  # User Value: A SuperUser can commit a region to DXTR without a deployment
  # Not included: the sync reading DXTR (Slice 2). Production switches wait for the Slice 4 backtest.
  # Mockups (Brian Posey, shared by Matt Stankey 2026-11-17, not in the repo): "IT Super User Default
  # View" (table of Region and Source, 21 regions, no pager, region shown unpadded), "Modal" (heading,
  # body, primary "Change to DXTR", unstyled "Cancel", close X), and two slim alerts without headings.

  Scenario: Each region still on ACMS offers an enabled switch
    Given I am logged in as a SuperUser
    And region "02" has no source record
    When I open Administration > Trustee Task Regions
    Then region "02" shows an enabled "Change to DXTR" button
    And the button's accessible name is "Change to DXTR for Region 2"

  Scenario: Confirming the switch
    Given I am logged in as a SuperUser
    And region "02" has no source record
    When I click "Change to DXTR for Region 2"
    Then a dialog opens with heading "Change Region 2 to DXTR?" and body "This action can't be undone. The change takes effect on the next sync."
    And the dialog has buttons "Change to DXTR" and "Cancel"
    When I click "Change to DXTR" in the dialog
    Then the dialog closes with no saving state shown
    And a success alert at the top of the screen reads "Region 2 will change to DXTR on the next sync."
    And region "02" shows "Using DXTR"
    And the source record for region "02" is { system: 'DXTR' } with updatedOn set to now and updatedBy set to me

  Scenario: Cancelling the switch
    Given I am logged in as a SuperUser
    And I opened the dialog for region "02"
    When I click "Cancel"
    Then the dialog closes
    And region "02" still shows an enabled "Change to DXTR" button
    And region "02" has no source record

  Scenario Outline: Closing the dialog without confirming
    Given I am logged in as a SuperUser
    And I opened the dialog for region "02"
    When I <close action>
    Then the dialog closes
    And region "02" has no source record

    Examples:
      | close action                     |
      | click the dialog's close button  |
      | press Escape                     |

  Scenario: The switch fails
    Given I am logged in as a SuperUser
    And the server cannot save the switch for region "02"
    When I confirm the switch for region "02"
    Then an error alert at the top of the screen reads "Unable to change to DXTR. Please try again."
    And region "02" still shows an enabled "Change to DXTR" button

  Scenario: Only a SuperUser can switch a region
    Given I am logged in without the SuperUser role
    When I request the API to switch region "02" to DXTR
    Then the server rejects the request as forbidden
    And region "02" has no source record

  Scenario: A region cannot be switched back to ACMS
    Given region "03" has a source record with system DXTR
    When a SuperUser requests the API to set region "03" to ACMS
    Then the server rejects the request
    And the source record for region "03" is unchanged

  Scenario: Switching a region already on DXTR writes nothing
    Given region "03" has a source record with system DXTR, updatedOn 2026-12-01 and updatedBy "Alex Admin"
    When a SuperUser requests the API to switch region "03" to DXTR
    Then the request succeeds and returns region "03" as DXTR
    And the source record for region "03" still has updatedOn 2026-12-01 and updatedBy "Alex Admin"

  Scenario: Switching a region not in CAMS office data
    Given region "99" has no offices in CAMS office data
    When a SuperUser requests the API to switch region "99" to DXTR
    Then the server responds not found
    And no source record is written for region "99"

  Scenario: The row's button is disabled while the switch is saving
    Given I am logged in as a SuperUser
    And I confirmed the switch for region "02"
    When the server has not responded yet
    Then region "02"'s "Change to DXTR" button is disabled
    And no saving indicator is shown

  Scenario: The page does not show who switched a region or when
    Given region "03" has a source record with system DXTR
    When I view the Trustee Task Regions admin page
    Then region "03" shows "Using DXTR"
    And no switched-by name or switched-on date is shown

  # SLICE 2: The sync reads switched regions from DXTR
  # Dependencies: Slice 1
  # User Value: Case appointments for a switched region come from DXTR on the next scheduled run,
  #             with no deployment and no manual dataflow run
  # Includes: a region-scoped DXTR source (group designator filter, paging, latest transaction date).
  # Not included: unknown trustees, placeholders and parking for DXTR records (Slice 3).
  #               An ACMS professional id built from DXTR's group designator + professional code:
  #               DXTR can carry an incorrect professional code (CAMS-882), so DXTR events do not
  #               link by professional id. Decided by Matt Stankey, 2026-11-17; follow-up on cams-0pqfs.2.3.

  Scenario: A switched region syncs from DXTR on the next scheduled run
    Given region "01" has a source record with system DXTR and a bookmark of 2026-09-14
    And region "02" has no source record and a bookmark of 2026-09-14
    When the scheduled sync runs
    Then region "01" is read from DXTR transactions dated after 2026-09-14
    And region "02" is read from ACMS changes dated after 2026-09-14
    And no deployment or manual start message was needed

  Scenario: A region switched before its first run starts at 2026-07-01
    Given region "01" has a source record with system DXTR and no bookmark
    When the scheduled sync runs
    Then region "01" reads DXTR transactions dated 2026-07-01 or later
    And no transaction dated before 2026-07-01 is read

  Scenario: DXTR reads are scoped to the region
    Given region "01" has a source record with system DXTR
    And DXTR has trustee-appointment transactions for group designators in regions "01" and "02"
    When the sync runs for region "01"
    Then only transactions whose group designator belongs to region "01" are read

  Scenario: The newest DXTR date is processed but not bookmarked
    Given region "01" has a source record with system DXTR and a bookmark of 2026-09-14
    And the latest DXTR transaction date for region "01" is 2026-09-16
    When the sync runs
    Then transactions dated 2026-09-15 and 2026-09-16 are processed
    And the bookmark for region "01" is 2026-09-15

  Scenario: A known trustee's DXTR appointment is written
    Given region "01" has a source record with system DXTR
    And a DXTR trustee-appointment transaction for case "081-26-12345" whose trustee name and details match a known trustee variation for exactly one CAMS trustee
    When the sync runs
    Then a case appointment for that trustee on case "081-26-12345" is written

  Scenario: A DXTR professional code does not link a trustee
    Given region "01" has a source record with system DXTR
    And a DXTR trustee-appointment transaction whose group designator and professional code match an ACMS professional id linked to a CAMS trustee
    When the sync runs
    Then the event carries no ACMS professional id
    And the trustee is not resolved by that professional-id link

  Scenario: Existing records are kept when a region switches
    Given region "01" has case appointments written from ACMS before the switch
    When region "01" is switched to DXTR and the sync runs
    Then every case appointment written from ACMS before the switch is unchanged

  Scenario: Regions not switched keep syncing from ACMS unchanged
    Given region "02" has no source record
    When the sync runs
    Then region "02" is processed exactly as CAMS-955 specifies

  Scenario: Resetting sync state keeps the switch
    Given region "01" has a source record with system DXTR and a bookmark of 2026-09-14
    When an operator resets region "01"'s sync state
    Then region "01" has no bookmark
    And the source record for region "01" is unchanged

  # SLICE 3: DXTR records go through the full identity pipeline
  # Dependencies: Slice 2
  # User Value: Unknown DXTR trustees reach data verifiers as identity tasks, the same as ACMS records
  # Includes: the ACMS/DXTR integration harness, extended in test/integration/sync-trustee-case-appointments
  #           (supersedes bead cams-rxb7a.1). No new filtering and no DXTR-specific name normalization:
  #           normalizeSourceName applies the same rules to both sources (Matt Stankey, 2026-11-18).

  Scenario Outline: A placeholder professional code with no identity is skipped
    Given region "01" has a source record with system DXTR
    And a DXTR transaction with professional code "<code>" and no usable name or contact details
    When the sync runs
    Then no case appointment or identity task is created for that transaction

    Examples:
      | code  |
      | 00000 |
      | 99999 |

  Scenario: A placeholder professional code on a named trustee is matched by name, never by code
    Given region "01" has a source record with system DXTR
    And a DXTR transaction with professional code "99999" whose trustee has a real name and contact details
    When the sync runs
    Then the trustee-match pipeline resolves the trustee by name and contact details
    And the professional code is not used to link the trustee

  Scenario: Administrative placeholders are skipped
    Given region "01" has a source record with system DXTR
    And a DXTR transaction whose trustee is an administrative placeholder (skipAdministrativePlaceholder)
    When the sync runs
    Then no case appointment or identity task is created for that trustee

  Scenario: A DXTR trustee resolved by the trustee-match pipeline is linked
    Given region "01" has a source record with system DXTR
    And a DXTR transaction for a trustee not yet linked, whose normalized name and details match one CAMS trustee
    When the sync runs
    Then the trustee-match pipeline links the trustee and a case appointment is written

  Scenario: An unresolved DXTR trustee becomes an identity task
    Given region "01" has a source record with system DXTR
    And a DXTR transaction for a trustee the pipeline cannot resolve
    When the sync runs
    Then a placeholder case appointment is written
    And a pending identity task with source DXTR is created for a data verifier

  Scenario: A DXTR appointment for a case not yet in CAMS is parked
    Given region "01" has a source record with system DXTR
    And a DXTR transaction for a case not yet in CAMS
    When the sync runs
    Then the record is parked with the case filing date from AO_CS
    And it heals once the case loads, the same as a parked ACMS record

  Scenario: The integration harness covers both sources
    Given the local integration harness with region "01" on DXTR and region "02" on ACMS
    When the harness runs the sync twice
    Then each region is read from its own source
    And no-match and ambiguous outcomes are pending identity tasks with the right source and reason
    And the second run writes no duplicates

  # SLICE 4: Deterministic backtest gates the first production switch
  # Dependencies: Slice 3
  # User Value: The team knows DXTR records match trustees well enough before any production region switches
  # Pass bar: each fixture declares its expected outcome; there are no manual thresholds
  # (Matt Stankey, 2026-11-18). Fixtures are synthetic, committed, and shaped like staging DXTR data.

  Scenario: The backtest passes only when every DXTR fixture gets its expected outcome
    Given synthetic DXTR trustee-appointment fixtures, each declaring its expected outcome
    When the deterministic backtest runs those fixtures through the sync and the trustee-match pipeline
    Then it reports expected and actual counts for each outcome: linked, identity task by reason, skipped, parked and dead-lettered
    And it passes only when every fixture gets its expected outcome
    And no LLM grading is used
    And running it twice on the same fixtures gives the same result

  Scenario: The staging switch test
    Given staging is purged
    And region "01" is switched to DXTR before the first run
    When every region syncs from 2026-07-01
    Then every other region syncs from ACMS
    And region "01" produces six or more Data Verification tasks to work by hand
    And switching region "01" back to ACMS is rejected

  # SLICE 5: Gap report and runbook
  # Dependencies: Slice 2 (a region must have had its first DXTR run)
  # User Value: The SuperUser and dev team can prove no DXTR appointment was lost at the switch point

  Scenario: The gap report lists uncovered DXTR transactions
    Given region "01" was switched to DXTR when its bookmark was 2026-09-14
    And region "01" has had its first DXTR run
    When the gap report runs for region "01"
    Then it lists each DXTR trustee-appointment transaction dated 2026-07-01 through 2026-09-14
      whose case has no CAMS case appointment, attached or parked, for any trustee with an
      assigned date on or after the transaction's appointment date
    And it reports the count and the case ids

  Scenario: A clean gap report
    Given every DXTR transaction in the window has a covering CAMS case appointment
    When the gap report runs for region "01"
    Then the count is 0

  Scenario: The runbook covers switching, reruns and the gap check
    Given the runbook in docs
    Then it explains how to switch a region
    And how to rerun a region from a date
    And how to run the gap report, rerun from the earliest listed date, and record a reason for
      each case still listed (for example, awaiting an identity task, or in the dead-letter queue)

  # SLICE 6: Retire the DXTR-only matcher and record the architecture decisions
  # Dependencies: Slice 4 (the backtest must pass first)
  # User Value: One trustee-matching path to maintain; future readers know why sources are chosen per region

  Scenario: The DXTR-only matcher stays retired
    Given the backtest passed the pass bar
    Then resolveNameCollisionByScoring, calculateCandidateScore, findInactivePerfectMatch and the
      district/division and chapter scoring are absent from trustee-match.helpers.ts
    And no integration harness still calls them
    And all trustee matching runs through the trustee-match pipeline

  Scenario: The ADRs are current
    Then ADR TrusteeMatchingPipeline.md reflects the retired matcher
    And a new ADR records per-region source selection

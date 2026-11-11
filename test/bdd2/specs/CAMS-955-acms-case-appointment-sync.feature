# Ticket: CAMS-955 (GitHub #3189)
# Beads epic: cams-fd8qd
# Total Slices: 4
# Depends on: CAMS-953 (GitHub #3187) and CAMS-954 (GitHub #3188), both merged to main by fd56f758a
# Follow-ups outside this feature: GitHub #3190 (jurisdiction tasks), #3191 (DXTR source), #3194 (post-rollout review)
# Implementation home: the existing syncTrusteeCaseAppointments dataflow gains an ACMS source; the one-time
# migrateCaseAppointments dataflow (July 2026) is harvested for its ACMS query and mapping, then deleted.
Feature: Daily ACMS trustee case appointment sync for all regions
  As a USTP staff member
  I want CAMS to load ACMS trustee case appointments daily for every region
  So that I see current trustee appointments on cases

  # Terms used below:
  # - "the sync" is the syncTrusteeCaseAppointments dataflow
  # - "change date" is CMMAP.CDB_UPDATE_DATE (date the row last changed in the ACMS central database)
  # - "the bookmark" is runtime-state field region.<regionId>.lastSyncDate, written with setField
  # - Trustee identification order:
  #     1. the ACMS professional id is linked to exactly one CAMS trustee (verified links only; a
  #        professional id that is unmatched or ambiguous is not used)
  #     2. the fingerprint matches a saved trustee variation
  #     3. a pending identity task exists for the same fingerprint
  #     4. the trustee-match pipeline
  #   A "known trustee" is one resolved by step 1 or 2.

  Background:
    Given region "02" has offices in CAMS office data
    And region "02" has no appointment source set, so its source is ACMS

  # SLICE 1: ACMS appointments sync through syncTrusteeCaseAppointments, per region
  # Dependencies: None
  # User Value: Case appointments for the regions an operator starts stay current after the July 2026 migration,
  #             and unknown trustees reach data verifiers as identity tasks with the case attached
  # An operator starts the sync for named regions; regions run one after another in a single chain.
  # Ships outside the default dataflows until SLICE 3 adds parking.

  Scenario: An operator starts the sync for named regions
    Given the sync is not in the default dataflows
    When an operator sends a start message naming regions "02" and "03"
    Then region "02" is processed, then region "03"
    And no other region is processed

  Scenario: A region's first run catches up from 2026-07-01
    Given region "02" has no bookmark
    And ACMS has CMMAP rows for region "02" with change dates 2026-06-30, 2026-07-01, 2026-07-02 and 2026-07-03
    And 2026-07-03 is the latest change date in the replica for region "02"
    When the sync runs on 2026-07-05
    Then the 2026-07-01, 2026-07-02 and 2026-07-03 rows are processed
    And the 2026-06-30 row is not read
    And the bookmark for region "02" is 2026-07-02

  Scenario: A date is complete only when the replica shows a later date
    Given the bookmark for region "02" is 2026-07-02
    And the replica's latest change date for region "02" is 2026-07-03
    When the sync runs
    Then the 2026-07-03 rows are processed
    And the bookmark for region "02" stays 2026-07-02

  Scenario: Rows changed on the run date are never read
    Given the bookmark for region "02" is 2026-07-02
    And ACMS has CMMAP rows for region "02" with change date 2026-07-05
    When the sync runs on 2026-07-05
    Then no 2026-07-05 row is processed

  Scenario: Known trustee with no active appointment on the case
    Given case "081-26-00001" exists in CAMS with no active trustee appointment
    And ACMS professional "NY-00063" is linked to exactly one CAMS trustee "T-1"
    And a CMMAP row appoints "NY-00063" to case "081-26-00001" on 2026-07-01
    When the sync processes the row
    Then case "081-26-00001" has an active appointment for "T-1" assigned on 2026-07-01
    And the appointment checks are matchedCase true, matchedTrustee true and matchedBy "professional-id" (a new matchedBy value)

  Scenario: Known trustee found by variation
    Given ACMS professional "NY-00070" has no professional-id link
    And the professional's fingerprint matches a saved variation of CAMS trustee "T-2"
    And a CMMAP row appoints "NY-00070" to case "081-26-00002"
    When the sync processes the row
    Then case "081-26-00002" has an active appointment for "T-2" with matchedBy "variation"

  Scenario: An ambiguous professional-id link is not used
    Given ACMS professional "NY-00064" is linked to two CAMS trustees
    And the professional's fingerprint matches no saved variation
    And a CMMAP row appoints "NY-00064" to case "081-26-00003"
    When the sync processes the row
    Then no appointment is written for "NY-00064" from the professional-id link

  Scenario: Same trustee already active writes nothing
    Given case "081-26-00001" has an active appointment for "T-1" assigned on 2026-07-01
    And a CMMAP row for "NY-00063" on case "081-26-00001" with no DISP_DATE is reprocessed
    When the sync processes the row
    Then case "081-26-00001" appointments are unchanged

  Scenario: A newer appointment for a different trustee closes the active one
    Given case "081-26-00001" has an active appointment for "T-1" assigned on 2026-07-01
    And a CMMAP row appoints known trustee "T-2" to case "081-26-00001" on 2026-08-10
    When the sync processes the row
    Then the "T-1" appointment has unassignedOn 2026-08-09
    And case "081-26-00001" has an active appointment for "T-2" assigned on 2026-08-10

  Scenario: A same-day replacement never closes before the active appointment starts
    Given case "081-26-00001" has an active appointment for "T-1" assigned on 2026-08-10
    And a CMMAP row appoints known trustee "T-2" to case "081-26-00001" on 2026-08-10
    When the sync processes the row
    Then the "T-1" appointment has unassignedOn 2026-08-10

  Scenario: An older appointment is written already closed
    Given case "081-26-00001" has an active appointment for "T-2" assigned on 2026-08-10
    And a CMMAP row appoints known trustee "T-3" to case "081-26-00001" on 2026-07-15
    When the sync processes the row
    Then a closed appointment for "T-3" assigned on 2026-07-15 is written
    And the "T-2" appointment is still active

  Scenario: DISP_DATE closes the matching appointment
    Given case "081-26-00001" has an active appointment for "T-1" assigned on 2026-07-01
    And the CMMAP row for "NY-00063" on case "081-26-00001" assigned 2026-07-01 now has DISP_DATE 2026-09-01
    When the sync processes the row
    Then the "T-1" appointment assigned on 2026-07-01 has unassignedOn 2026-09-01
    And no other trustee is required to follow it

  Scenario: Jurisdiction check fails but the appointment is still written
    Given known trustee "T-1" has no single active trustee appointment covering the case's court, division and chapter
    When the sync processes a CMMAP row appointing "T-1" to case "081-26-00004"
    Then the appointment is written with checks.matchedTrusteeAppointment false
    And no task is created

  Scenario: matchedTrusteeAppointment defaults to false
    When the sync writes any case appointment
    Then checks.matchedTrusteeAppointment is present and is false unless the jurisdiction check passed

  Scenario: Deleted ACMS rows are skipped
    Given a CMMAP row with DELETE_CODE "D"
    When the sync processes the date containing the row
    Then nothing is written for that row

  Scenario: A record that fails on every attempt goes to the dead-letter queue alone
    Given a CMMAP row with an invalid chapter on 2026-07-01
    When the sync processes 2026-07-01
    Then that record goes to the dead-letter queue with its error
    And the other records on the page are processed
    And 2026-07-01 still completes and the lane continues

  Scenario: A transient error retries in place
    Given the case appointment write fails once with a transient infrastructure error
    When the sync processes the row
    Then the write is retried in the same invocation
    And the row is not sent to the dead-letter queue

  Scenario: Replaying a date writes no duplicates
    Given region "02" was processed for 2026-07-01
    When 2026-07-01 is processed again for region "02"
    Then no duplicate case appointment records exist

  Scenario: A pending identity task for the same contact details is reused
    Given a pending identity task exists for fingerprint "fp-1"
    And a CMMAP row for an unknown trustee with fingerprint "fp-1" appoints them to case "081-26-00005"
    When the sync processes the row
    Then a placeholder appointment for "fp-1" is written on case "081-26-00005"
    And no new identity task is created
    And the pending task's case list includes "081-26-00005"

  Scenario: The trustee-match pipeline links an unknown trustee
    Given a CMMAP row for a professional that is neither linked nor a saved variation
    And the trustee-match pipeline links the professional to CAMS trustee "T-4"
    When the sync processes the row
    Then the appointment is written for "T-4" with matchedBy naming the pipeline RESOLVE stage that linked it

  Scenario: Unknown trustee with an open appointment gets a placeholder and an identity task
    Given a CMMAP row with no DISP_DATE for a professional the pipeline cannot resolve, with fingerprint "fp-2"
    And no pending identity task exists for "fp-2"
    When the sync processes the row for case "081-26-00006"
    Then a fingerprint placeholder appointment for "fp-2" is written on case "081-26-00006"
    And a pending identity task with source "ACMS" exists with case "081-26-00006"

  Scenario: Unknown trustee with a closed appointment closes the open placeholder
    Given case "081-26-00006" has an open placeholder for fingerprint "fp-2"
    And the CMMAP row for "fp-2" on case "081-26-00006" now has a DISP_DATE
    When the sync processes the row
    Then the open placeholder for case "081-26-00006" and "fp-2" is closed with the DISP_DATE, not deleted
    And no new placeholder or identity task is written

  Scenario: Replaying a date does not duplicate placeholders or tasks
    Given region "02" was processed for 2026-07-01 with unknown-trustee rows
    When 2026-07-01 is processed again for region "02"
    Then there is still one placeholder per court appointment
    And there is still one pending identity task per fingerprint

  Scenario: An appointment on a moved case is skipped
    Given case "081-26-00009" in CAMS has moved to case "081-26-00010"
    And a CMMAP row appoints known trustee "T-1" to case "081-26-00009"
    When the sync processes the row
    Then nothing is written for case "081-26-00009"
    And the row is counted as skipped

  Scenario: A long date continues in a fresh message
    Given region "02" has more rows on 2026-07-01 than one invocation can process in 56 minutes
    When the sync reaches 56 minutes
    Then it writes a continuation message carrying the date and the last processed CMMAP id
    And the continuation resumes after that id with no retry fields
    And the bookmark does not advance past 2026-07-01 until the date is complete

  # SLICE 2: Every region syncs across lanes
  # Dependencies: Slice 1
  # User Value: All regions catch up from 2026-07-01 and stay current without an operator naming regions
  Scenario: The start message covers every region in CAMS office data
    When the sync starts without a region list
    Then every region in CAMS office data is scheduled

  Scenario: Regions are spread across lanes and every region is processed
    Given 21 regions in CAMS office data and 4 lanes
    When the sync starts
    Then each lane holds a fixed list of regions assigned round-robin
    And each lane processes its regions one after another
    And at most 4 ACMS queries run at once

  Scenario: Overlapping lanes write no duplicates
    Given two lanes process region "02" for 2026-07-01 at the same time
    Then no duplicate case appointment records exist

  # SLICE 3: Cases not yet in CAMS are parked and healed; the sync joins the default dataflows
  # Dependencies: Slice 2
  # User Value: Appointments for newly filed cases arrive once the case loads, and every region syncs with no admin action
  Scenario: An appointment for a case not yet in CAMS is parked
    Given case "081-26-00007" is not in CAMS
    And a CMMAP row appoints known trustee "T-1" to case "081-26-00007", filed 2026-07-01
    When the sync processes the row
    Then a CASE_APPOINTMENT_UNATTACHED record is written with dateFiled 2026-07-01
    And the date's progress does not wait on it

  Scenario: An unknown trustee on a case not yet in CAMS is parked as a placeholder
    Given case "081-26-00008" is not in CAMS
    And a CMMAP row for an unknown trustee with fingerprint "fp-3" appoints them to case "081-26-00008"
    When the sync processes the row
    Then a parked placeholder for "fp-3" is written
    And the pending identity task for "fp-3" lists case "081-26-00008"

  Scenario: Heal attaches parked records once the case loads
    Given a parked record for case "081-26-00007" filed within the last 14 days
    And case "081-26-00007" now exists in CAMS
    When the heal runs at 18:30 UTC
    Then the record becomes a CASE_APPOINTMENT under the active-trustee rule

  Scenario: Records filed more than 14 days ago stay parked
    Given a parked record filed 15 days before the heal run
    When the heal runs
    Then the record stays parked and is counted as abandoned

  Scenario: Approving an identity task whose cases include parked placeholders
    Given the pending identity task for "fp-3" lists a placed case and a parked case
    When a data verifier approves the task, linking "fp-3" to CAMS trustee "T-5"
    Then the placed placeholder becomes an appointment for "T-5"
    And the parked placeholder stays parked with its trustee changed to "T-5"

  Scenario: Each run records parked, healed and abandoned counts
    When the sync and the heal complete
    Then the run records how many records it parked, healed and abandoned

  Scenario: heal-sentinel-case-appointments cannot overwrite a sync-written row
    Given the sync wrote an appointment for case "081-26-00001"
    When heal-sentinel-case-appointments runs
    Then that appointment is unchanged

  Scenario: Deploying the sync starts every region with no admin action
    Given the sync is deployed with the default dataflows
    When 12:30 UTC arrives
    Then every region in CAMS office data starts syncing
    And a region with no bookmark reads changes dated 2026-07-01 or later

  # SLICE 4: Read-only admin page shows each region's appointment source
  # Dependencies: Slice 1 (reads the same runtime-state document)
  # User Value: A SuperUser can see which source each region's case appointments come from
  Scenario: A SuperUser views the Case Appointments admin page
    Given I am logged in as a SuperUser
    When I open Administration > Case Appointments
    Then I see a table with columns "Region" and "Source"
    And every region from CAMS office data has a row

  Scenario: A region still on ACMS
    Given region "02" has no source set in runtime-state
    When I view the Case Appointments admin page
    Then region "02" shows a disabled "Change to DXTR" button
    And no "ACMS" label is shown

  Scenario: A region switched to DXTR
    Given region "03" has source "DXTR" in runtime-state
    When I view the Case Appointments admin page
    Then region "03" shows "Using DXTR"

  Scenario: Non-SuperUsers cannot read region sources
    Given I am logged in without the SuperUser role
    When I request the region source data from the API
    Then the server rejects the request as forbidden

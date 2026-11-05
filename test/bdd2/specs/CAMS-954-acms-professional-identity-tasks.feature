# Ticket: CAMS-954 (GitHub #3188)
# Beads epic: cams-ogq2k
# Total Slices: 4
# Depends on: CAMS-953 (GitHub #3187), including its Slice 6 (approval links the ACMS professional id)
Feature: Unresolved ACMS professionals become Data Verification identity tasks
  As a data verifier
  I want ACMS trustee professionals that CAMS can't match automatically to appear as identity tasks
  So that I can link them to the right CAMS trustee

  Background:
    Given the ACMS professional-id sync is enabled
    And the professional has an active ACMS appointment in CMMAP

  # SLICE 1: Ambiguous ACMS professionals become identity tasks
  # Dependencies: CAMS-953
  # User Value: The verifier can resolve ACMS professionals that match two or more CAMS trustees
  Scenario: An ambiguous professional becomes an identity task with no case
    Given ACMS professional "NY-00063" matches two CAMS trustees, each with genuine evidence (see the SLICE 4 note)
    When the ACMS professional-id sync processes "NY-00063"
    Then a pending identity task exists with source "ACMS" and mismatch reason "ambiguous"
    And the task has no case attached
    And the task stores the matching pipeline's serialized state as findings
    And the task carries ACMS professional id "NY-00063"

  # The sync pages each group by UST_PROF_CODE, so a professional is reprocessed only on a
  # page retry, a bookmark reset, or a purge run
  Scenario: Reprocessing a professional leaves the existing pending task untouched
    Given a pending ACMS identity task exists for "NY-00063"
    When the ACMS professional-id sync processes "NY-00063" again
    Then there is still exactly one identity task for "NY-00063"
    And the task is unchanged

  Scenario: The sync does not change a resolved task
    Given the identity task for "NY-00063" was approved
    When the ACMS professional-id sync processes "NY-00063" again
    Then the approved task is unchanged

  Scenario: A professional without an active appointment gets no task
    Given ACMS professional "NY-00064" matches two CAMS trustees
    And "NY-00064" has no active ACMS appointment
    When the ACMS professional-id sync processes "NY-00064"
    Then no identity task is created

  Scenario: Approving an ACMS identity task links the professional id to the chosen trustee only
    Given a pending ACMS identity task for "NY-00063" with candidates "Trustee A" and "Trustee B"
    When I approve the task with "Trustee A"
    Then "NY-00063" is linked to "Trustee A" with link method "manual"
    And "NY-00063" is not linked to "Trustee B"

  Scenario: Approving an ACMS identity task links every ACMS id with identical source data
    Given a pending ACMS identity task for "NY-00063" with candidates "Trustee A" and "Trustee B"
    And "UT-05321" has an unresolved record with the same source data as "NY-00063"
    When I approve the task with "Trustee A"
    Then "NY-00063" is linked to "Trustee A" with link method "manual"
    And "UT-05321" is linked to "Trustee A" with link method "manual"
    And "UT-05321" has no unresolved record left

  Scenario: Approving an ACMS identity task does not move a link another ACMS id already has
    Given a pending ACMS identity task for "NY-00063" with candidates "Trustee A" and "Trustee B"
    And "UT-05321" has an unresolved record with the same source data as "NY-00063"
    And "UT-05321" is already linked to "Trustee C"
    When I approve the task with "Trustee A"
    Then "UT-05321" is still linked to "Trustee C"

  Scenario: The sync never overwrites a manual link
    Given "NY-00063" is linked to "Trustee A" with link method "manual"
    When the ACMS professional-id sync processes "NY-00063" again
    Then "NY-00063" is still linked to "Trustee A" with link method "manual"

  Scenario: A pending task stays pending when the professional later links automatically
    Given a pending ACMS identity task exists for "NY-00063"
    And a reprocessing run (page retry or purge) links "NY-00063" to a CAMS trustee automatically
    Then the identity task is still pending

  Scenario: A failed bookmark read does not restart the group from the beginning
    Given the sync bookmark for group "NY" exists
    And reading the bookmark fails with an error other than not found
    When the ACMS professional-id sync runs for group "NY"
    Then the run fails without processing any professionals
    And the group's bookmark is not reset to 0

  # SLICE 2: No-match professionals with a name-matching candidate become identity tasks
  # Dependencies: Slice 1
  # User Value: The verifier can link professionals CAMS found plausible candidates for but couldn't confirm
  Scenario: A no-match professional with a name-matching candidate becomes a task
    Given ACMS professional "NY-00070" has no match and one candidate that passes the name check
    When the ACMS professional-id sync processes "NY-00070"
    Then a pending identity task exists with source "ACMS" and mismatch reason "no match"
    And the task has no case attached
    And the task stores the matching pipeline's serialized state as findings

  Scenario: A no-match professional whose candidates all fail the name check gets no task
    Given ACMS professional "NY-00071" has no match and two candidates that fail the name check
    When the ACMS professional-id sync processes "NY-00071"
    Then no identity task is created
    And the professional-id record for "NY-00071" is still written

  Scenario: A no-match professional with zero candidates gets no task
    Given ACMS professional "NY-00072" has no match and zero candidates
    When the ACMS professional-id sync processes "NY-00072"
    Then no identity task is created
    And the professional-id record for "NY-00072" is still written

  # SLICE 3: The sync saves a trustee variation when it links a professional
  # Dependencies: Slice 1
  # User Value: Once CAMS links a professional, later runs recognize the same record without re-matching
  Scenario: Linking a professional saves a new trustee variation
    Given ACMS professional "NY-00080" resolves to "Trustee C" through the matching pipeline
    And "Trustee C" has no variation for this ACMS record
    When the ACMS professional-id sync processes "NY-00080"
    Then a trustee variation for this ACMS record is saved under "Trustee C"

  Scenario: An existing variation is not duplicated
    Given "Trustee C" already has a variation for the ACMS record of "NY-00080"
    When the ACMS professional-id sync processes "NY-00080" again
    Then "Trustee C" still has exactly one variation for this ACMS record

  # SLICE 4: DXTR identity tasks use the same ambiguity rule as ACMS
  # Dependencies: Slice 1
  # User Value: "Ambiguous" means the same thing on every identity task, whatever its source
  # Note: Amends CAMS-953, where the DXTR sync labels a task ambiguous when the candidate pool has 2+ trustees
  # As built: a candidate has "genuine evidence" when its name is an exact match, or when its name
  # passes the name check and the source record has contact data (address, phone or email). A
  # task is "ambiguous" only when 2+ candidates have genuine evidence; otherwise it is "no match".
  # The candidate pool can hold a candidate that fails the name check (kept when its state does not
  # conflict with the source's), so a pool of 2+ is not by itself ambiguous.
  Scenario: A DXTR record with two candidates having genuine evidence is ambiguous
    Given a DXTR trustee appointment event whose trustee matches two CAMS trustees by name, each with genuine evidence
    When the DXTR trustee appointment sync processes the event
    Then a pending identity task exists with source "DXTR" and mismatch reason "ambiguous"

  Scenario: A DXTR record with fewer than two name-matching candidates is no match
    Given a DXTR trustee appointment event whose trustee has two candidates, only one of which passes the name check
    When the DXTR trustee appointment sync processes the event
    Then a pending identity task exists with source "DXTR" and mismatch reason "no match"

# Ticket: CAMS-953 (GitHub #3187, beads cams-c45pn)
# Total Slices: 7
Feature: Trustee identity verification on matching-pipeline findings
  As a data verifier
  I want to see where the source trustee record and each CAMS candidate agree or conflict,
  why CAMS couldn't decide, and what approving does
  So that I can choose the right CAMS trustee quickly and confidently

  Background:
    Given I am logged in with the DataVerifier role
    And the "trustee-verification-enabled" feature flag is on

  # SLICE 1: Queue labeling fixes
  # Dependencies: None
  # User Value: The verifier sees accurate queue labels instead of hard-coded or stale text
  Scenario: Data Verification queue shows accurate headings and task types
    When I open the Data Verification screen
    Then I see no "Region 02" heading
    And the first list column header is "Subject"
    And a trustee identity task row shows the source trustee's name in the Subject column
    And transfer and consolidation rows show the court name in the Subject column
    And the task type filter lists "Consolidation", "Transfer", "Trustee Identity" in alphabetical order
    And the filter no longer offers "Trustee Mismatch"
    # "Trustee Appointment" filter option is added by #3190 when that task type exists

  Scenario: A previously saved filter selection shows the new label
    Given my session saved the task type filter selection "Trustee Mismatch"
    When I open the Data Verification screen
    Then the selection shows as "Trustee Identity"

  Scenario: Search button uses the simplified label
    Given I expand a trustee identity task
    Then I see a "Search for a trustee" button

  # SLICE 2: Findings foundation (DXTR sync on the matching pipeline + comparison table)
  # Dependencies: Slice 1
  # User Value: The verifier sees where the source record and each candidate agree or conflict
  Scenario: DXTR sync resolves a trustee with the matching pipeline
    Given a DXTR trustee appointment event whose trustee the pipeline resolves to one CAMS trustee
    When the DXTR trustee appointment sync processes the event
    Then the case appointment is written for that CAMS trustee
    And no identity task is created

  Scenario Outline: DXTR sync creates an identity task from pipeline findings
    Given a DXTR trustee appointment event whose trustee the pipeline finds <outcome>
    When the DXTR trustee appointment sync processes the event
    Then an identity task is stored with source "DXTR" and mismatchReason "<reason>"
    And the task stores the pipeline's serialized state, unchanged, as "findings"
    And the task has no "matchCandidates"

    Examples:
      | outcome                         | reason    |
      | matching two or more trustees   | ambiguous |
      | matching no trustee             | no match  |

  Scenario: Re-syncing never clears a case link or changes a resolved task
    Given an identity task already exists for a trustee fingerprint and variant
    When the sync writes the same identity task again
    Then the write merges into the existing task
    And the existing case link is kept
    And a task that is not pending is not changed

  Scenario: Verifier sees the comparison table
    Given a pending ambiguous DXTR identity task with 2 candidates
    When I expand the task
    Then the title is the source trustee's name, never a court
    And the header shows the reason label, a "DXTR" source badge, and the case count
    And I see "Source record (DXTR)" in place of "Sent By Court"
    And I see a table with the source record first, then one column per candidate in pipeline ranking order
    And the table rows are Name, Phone, Street, City, State, Zip, Email, Found by
    And each candidate cell shows the CAMS value and one marker: Agrees (exact, strong or weak), Close, Differs, Conflicts, or Not comparable
    And each marker shows text and an icon, never color alone
    And only a State difference gets conflict styling

  Scenario: Every candidate is shown for no-match tasks
    Given a pending no-match identity task with 3 candidates
    When I expand the task
    Then all 3 candidates appear in the comparison table

  Scenario: Findings are restricted to data verifiers
    Given I do not have the DataVerifier role
    When I request a trustee identity task
    Then I do not receive its findings
    And findings never appear in logs or telemetry

  # SLICE 3: Explanations
  # Dependencies: Slice 2
  # User Value: The verifier understands why CAMS needed a human decision
  Scenario Outline: "Why CAMS needs you" sentence per evidence pattern
    Given a pending identity task whose findings show <pattern>
    When I expand the task
    Then I see "<sentence>"

    Examples:
      | pattern                               | sentence                                                                                                  |
      | no candidates                         | Trustee information sent to CAMS does not match any trustee in CAMS. Affects 2 cases:                     |
      | one candidate, fields differ/missing  | Trustee address and phone sent to CAMS do not exactly match a trustee in CAMS. Affects 2 cases:           |
      | one candidate, state differs          | Trustee state sent to CAMS does not match a trustee in CAMS. Affects 2 cases:                             |
      | several candidates                    | Trustee information sent to CAMS matches multiple trustees in CAMS. Affects 2 cases:                      |

  Scenario: Interpreted name shown only when it differs from the raw name
    Given a pending identity task whose normalized source name differs from the raw source name
    When I expand the task
    Then I see a "How CAMS read this name" section
    But a task whose normalized name equals the raw name shows no such section

  Scenario: Header shows the ACMS professional id and flags possible duplicates
    Given a pending identity task that carries ACMS professional id "NY-00063"
    And two of its candidates may be the same CAMS trustee
    When I expand the task
    Then the header shows "NY-00063"
    And the candidates are flagged as possible duplicates, with no merge link

  # SLICE 4: Case coverage and approval preview
  # Dependencies: Slice 3
  # User Value: The verifier sees what approving does before committing
  Scenario: Comparison table shows which cases each candidate covers
    Given a pending identity task with 3 cases
    When I expand the task
    Then the comparison table includes a "Covers these cases" row for each candidate

  Scenario: Approval preview for a candidate that covers every case
    Given a candidate whose active appointments cover all of the task's cases
    When I choose that candidate
    Then the "Confirm Trustee Match" modal asks "Is this the same trustee as the information sent to CAMS?"
    And it shows "Information Sent to CAMS" beside "Selected CAMS Trustee", with a warning icon on each differing field
    And "What Happens Next" says "3 cases will be assigned to Henry Green."
    And the submit button shows "Matching Trustee..." while the request is in flight

  Scenario: Approval preview blocks a candidate that covers only part of the cases (CAMS-905 gate A)
    Given a candidate whose active appointments cover 2 of the task's 3 cases
    When I choose that candidate
    Then the preview lists the uncovered case as blocking
    And "Match Trustee" and "Confirm Appointment" stay disabled for that candidate

  Scenario: Case not yet loaded in CAMS
    Given a task case that CAMS has not loaded yet
    When I expand the task
    Then the case shows as "{caseId} (Not yet in CAMS)" without a link

  # SLICE 5: Identity tasks with no case
  # Dependencies: Slice 4
  # User Value: The verifier can resolve identity tasks before any case is attached
  Scenario: Identity task with no case
    Given a pending identity task with no case
    When I expand the task
    Then the header shows "No cases yet"
    And I see "No cases yet. Cases attach as appointments sync."
    When I choose a candidate
    Then "What Happens Next" says "No cases are affected yet. Future cases sent with this information will be matched to Henry Green automatically."

  # SLICE 6: Approval links the ACMS professional id
  # Dependencies: Slice 5
  # User Value: The verifier's decision permanently links the ACMS professional id to one CAMS trustee
  Scenario: Approving a task that carries an ACMS professional id
    Given a pending identity task with ACMS professional id "NY-00063" and fingerprint "fp-1"
    When I approve the task with CAMS trustee "Henry Green"
    Then the trustee variation is saved
    And a TrusteeProfessionalId linking "NY-00063" to "Henry Green" is upserted with linkMethod "manual"
    And afterwards the trustee-professional-ids records keyed by "fp-1" are deleted

  Scenario: Partial failure never loses the link
    Given the manual link upsert succeeds
    When deleting the fingerprint-keyed records fails
    Then the manual link remains
    And a stale fingerprint-keyed record may remain, but no link is lost

  # SLICE 7: Many candidates and trustee search
  # Dependencies: Slice 6
  # User Value: The verifier can work through large candidate sets and search beyond coverage
  Scenario: Candidates beyond five paginate
    Given a pending identity task with 7 candidates
    When I expand the task
    Then the comparison table shows the first 5 candidates
    And I can page to candidates 6 and 7

  Scenario: Coverage filter is optional in trustee search
    Given I open "Search for a trustee" from an identity task
    Then the court, division and chapter coverage filter is optional

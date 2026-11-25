# Ticket: CAMS-977 (GitHub #3318)
# Beads epic: cams-f798g
# Total Slices: 5
Feature: Administrators can see where CAMS and TOD trustee data disagree
  As an administrator responsible for trustee data quality
  I want a report of every trustee profile and appointment where CAMS and TOD disagree
  So that I can confirm or rule out that trustee changes made in CAMS are not reaching TOD
  and the public Trustee Locator

  Background:
    Given I am signed in as an administrator
    And TOD trustees are in scope when they have at least one active appointment status
    And each CAMS trustee loaded from TOD keeps the TOD trustee ID(s) it was loaded from

  # SLICE 1: Run the report and see trustee profile differences
  # Dependencies: None
  # User Value: An administrator can start the report from CAMS and see which trustees
  #             exist in only one system and which profile fields disagree, with counts
  #             that can be shared without personal contact details.
  Scenario: Starting the report
    When I start the trustee data report
    Then I see that the report is running
    And when it finishes I see when it ran and summary counts by type of difference

  Scenario: Only one report runs at a time
    Given a trustee data report is already running
    When I try to start another trustee data report
    Then a second report does not start
    And I am told a report is already running

  Scenario: A TOD trustee with no CAMS trustee
    Given TOD has an in-scope trustee whose ID is not linked to any CAMS trustee
    When the trustee data report runs
    Then that trustee is listed as "in TOD only"

  Scenario: A CAMS trustee with no TOD record
    Given a CAMS trustee that is not linked to any TOD trustee ID
    When the trustee data report runs
    Then that trustee is listed as "in CAMS only"

  Scenario Outline: A profile field that differs is reported
    Given a CAMS trustee linked to a TOD trustee
    And the CAMS <field> is "<cams value>" and the TOD <field> is "<tod value>"
    When the trustee data report runs
    Then a difference is listed for that trustee's <field> showing both values

    Examples:
      | field            | cams value             | tod value              |
      | name             | Jane Q. Example        | Jane Example           |
      | company name     | Example Trustee LLC    | Example Trustees Inc   |
      | public address   | 100 Main St, Ste 200   | 400 Elm St             |
      | internal address | 12 Oak Ave             | 99 Pine Rd             |
      | phone            | 555-010-0100           | 555-010-0199           |
      | email            | trustee@example.com    | old@example.com        |

  Scenario Outline: Formatting-only differences are not reported
    Given a CAMS trustee linked to a TOD trustee
    And the CAMS <field> is "<cams value>" and the TOD <field> is "<tod value>"
    When the trustee data report runs
    Then no difference is listed for that trustee's <field>

    Examples:
      | field | cams value          | tod value           |
      | name  | Jane Example        | JANE  EXAMPLE       |
      | phone | 555-010-0100        | (555) 010-0100      |
      | email | trustee@example.com | Trustee@Example.com |

  Scenario: Differences produced by the original load's cleanup are not reported
    Given a TOD value that the original load into CAMS cleaned up
    And the CAMS value equals the cleaned-up TOD value
    When the trustee data report runs
    Then no difference is listed for that field

  Scenario: A CAMS trustee merged from several TOD records
    Given a CAMS trustee linked to several TOD trustee IDs
    When the trustee data report runs
    Then its profile fields are compared with the TOD record the original load treated as primary

  Scenario: The report changes no trustee data
    When the trustee data report runs
    Then no trustee or appointment data in CAMS or TOD is changed

  Scenario: A failed run keeps the previous results
    Given a completed trustee data report
    When a new trustee data report fails before finishing
    Then I see that the latest run failed
    And the previous report's results are still available

  Scenario: Only administrators can use the report
    Given I am signed in as a user who is not an administrator
    Then I cannot start the trustee data report
    And I cannot see its results

  # SLICE 2: Appointment differences
  # Dependencies: Slice 1
  # User Value: The administrator also sees appointments that are missing from one system
  #             or whose details disagree.
  Scenario: An appointment that exists only in TOD
    Given a CAMS trustee linked to a TOD trustee
    And TOD has an appointment for that trustee in a district, chapter and appointment type that CAMS does not
    When the trustee data report runs
    Then that appointment is listed as "in TOD only"

  Scenario: An appointment that exists only in CAMS
    Given a CAMS trustee linked to a TOD trustee
    And CAMS has an appointment for that trustee in a district, chapter and appointment type that TOD does not
    When the trustee data report runs
    Then that appointment is listed as "in CAMS only"

  Scenario: A changed appointment type is reported as two appointments
    Given a trustee appointment that is a chapter 7 panel appointment in TOD
    And CAMS has the same district and chapter as an off-panel appointment instead
    When the trustee data report runs
    Then the TOD panel appointment is listed as "in TOD only"
    And the CAMS off-panel appointment is listed as "in CAMS only"

  Scenario Outline: An appointment field that differs is reported
    Given a trustee appointment that exists in both CAMS and TOD
    And the CAMS <field> is "<cams value>" and the TOD <field>, translated the way the original load translated it, is "<tod value>"
    When the trustee data report runs
    Then a difference is listed for that appointment's <field> showing both values

    Examples:
      | field                 | cams value | tod value  |
      | status                | active     | resigned   |
      | appointed date        | 2021-03-01 | 2021-04-01 |
      | status effective date | 2024-06-30 | 2023-01-15 |

  Scenario: Appointments from all merged TOD records are compared
    Given a CAMS trustee linked to several TOD trustee IDs
    When the trustee data report runs
    Then appointments from every linked TOD record are compared with the CAMS trustee's appointments

  Scenario: Divisions narrowed in CAMS are noted but not counted as differences
    Given a trustee appointment that exists in both CAMS and TOD
    And the CAMS appointment covers only some of its district's divisions
    When the trustee data report runs
    Then no difference is listed for that appointment's divisions
    And the appointment is noted as "divisions narrowed in CAMS"

  Scenario: TOD appointments the original load did not translate are counted, not listed
    Given a TOD appointment that the original load skipped or could not map to a district
    When the trustee data report runs
    Then that appointment is not listed as "in TOD only"
    And the report counts it as a TOD appointment not translated

  # SLICE 3: Why each difference exists
  # Dependencies: Slice 2
  # User Value: The administrator can tell differences caused by CAMS edits apart from
  #             differences that have existed since the original load.
  Scenario: A difference caused by a CAMS user's change
    Given a CAMS user changed a trustee's phone after the original load
    And the TOD phone was not updated
    When the trustee data report runs
    Then the phone difference says it was changed in CAMS, by whom, and when

  Scenario: A difference that has existed since the load
    Given a trustee field that no CAMS user has changed since the original load
    And the CAMS and TOD values differ
    When the trustee data report runs
    Then the difference says it has differed since the load

  Scenario: Summary counts by cause
    When the trustee data report finishes
    Then the summary shows counts of differences by cause

  # SLICE 4: Whether the Office of Oversight was told
  # Dependencies: Slice 3
  # User Value: For each CAMS change that never reached TOD, the administrator can see
  #             whether the notification email to the Office of Oversight was sent.
  Scenario Outline: Notification email outcome for a CAMS change
    Given a difference caused by a CAMS user's change
    And <evidence>
    When the trustee data report runs
    Then the difference shows the notification email as "<outcome>"

    Examples:
      | evidence                                                                  | outcome                  |
      | records show the notification email was sent for that change             | sent                     |
      | records show the notification email failed to send for that change       | failed                   |
      | records cover the time of that change but show no notification email     | no record                |
      | the change was made before CAMS sent trustee change notification emails  | before emails existed    |
      | the change is older than the earliest available records                  | older than records       |

  Scenario: Summary counts by email outcome
    When the trustee data report finishes
    Then the summary shows counts of CAMS-caused differences by notification email outcome
    And the summary says how far back the email records go

  # SLICE 5: Review and share the details
  # Dependencies: Slice 1 (benefits from Slices 2-4)
  # User Value: The administrator can review every difference in CAMS and download the
  #             full list to work through with the Office of Oversight and the product owner.
  Scenario: Reviewing the differences
    Given a completed trustee data report
    When I review the report's differences
    Then I can narrow the list by type of difference, field, and cause

  Scenario: Downloading the differences
    Given a completed trustee data report
    When I download the report
    Then I get every difference with the trustee, field, CAMS value, TOD value, cause and email outcome

  Scenario: Sharing the summary without personal details
    Given a completed trustee data report
    When I share the summary with the product owner
    Then it contains counts only and no trustee contact details

# Ticket: CAMS-975 (GitHub #3276)
# Beads epic: cams-hw4bd
# Total Slices: 2
Feature: Trustee edits succeed for trustees with migrated data
  As a user who maintains trustee profiles
  I want to edit any section of a trustee profile without fixing data I did not touch
  So that I can keep trustee information current without being blocked by migration artifacts

  Background:
    Given I am signed in as a user who can edit trustees
    And Zoom phone numbers must be in the format "123-456-7890", optionally with a "1-" prefix and an extension

  # SLICE 1: Correct stored Zoom phone numbers
  # Dependencies: None
  # User Value: Editors can save a trustee's Zoom info without retyping a phone number
  #             that the Zoom Info Import stored in "(123) 456-7890" format.
  Scenario: Saving Zoom info for a trustee whose Zoom phone was corrected
    Given a trustee whose Zoom phone was imported as "(555) 010-0123"
    And the stored Zoom phone numbers have been corrected
    When I edit that trustee's Zoom info and save without changing the phone number
    Then the Zoom info is saved
    And the trustee's Zoom phone is "555-010-0123"

  Scenario Outline: Stored Zoom phone numbers are converted to the accepted format
    Given a trustee whose stored Zoom phone is "<stored>"
    When the stored Zoom phone numbers are corrected
    Then the trustee's Zoom phone is "<corrected>"
    And the trustee's other Zoom info is unchanged

    Examples:
      | stored                | corrected           |
      | (555) 010-0123        | 555-010-0123        |
      | (555)010-0123         | 555-010-0123        |
      | (555) 010-0123 x123   | 555-010-0123 x123   |
      | 555-010-0123          | 555-010-0123        |
      | 1-555-010-0123        | 1-555-010-0123      |

  Scenario: A stored Zoom phone that cannot be converted is flagged for review
    Given a trustee whose stored Zoom phone is "214-45"
    When the stored Zoom phone numbers are corrected
    Then the trustee's Zoom phone is still "214-45"
    And the trustee and the stored value appear in the flagged phones report

  Scenario: A trustee whose other Zoom info still fails validation is flagged, not changed
    Given a trustee whose stored Zoom phone is "(555) 010-0123"
    And the trustee's Zoom passcode is not 10 digits
    When the stored Zoom phone numbers are corrected
    Then the trustee's Zoom info is not changed
    And the trustee and the invalid Zoom field names appear in the flagged phones report

  Scenario: A throttled database does not lose or skip corrections
    Given the database is rate limiting the correction
    When the stored Zoom phone numbers are corrected
    Then the correction waits and retries instead of skipping the trustee
    And the correction resumes where it left off if it cannot finish in one run
    And the throttled trustees are not reported as failed

  Scenario: The correction reports what it did
    When the stored Zoom phone numbers are corrected in an environment
    Then the run reports how many Zoom phones were converted, already valid, and flagged for review

  Scenario: The Zoom Info Import does not store a non-conforming Zoom phone
    Given a Zoom import row whose phone is "(555) 010-0123"
    When the Zoom Info Import processes that row
    Then the matched trustee's Zoom info is not changed
    And the row is reported as an error

  # SLICE 2: Public contact edits succeed for trustees with migrated data
  # Dependencies: Slice 1
  # User Value: Editors can update a trustee's public contact information without an
  #             error caused by migrated data. Includes finding the root cause of the
  #             error a prod user (Ted) reported while updating a public email address.
  Scenario: Updating the public email of a trustee with migrated data
    Given a trustee whose profile data came from the migration
    When I change only that trustee's public email address and save
    Then the public email address is saved

  Scenario: Editing one section is not blocked by data in another section
    Given a trustee whose Zoom info contains a value that fails validation
    When I change only that trustee's public contact information and save
    Then the public contact information is saved

  Scenario: A rejected trustee edit explains what to fix
    Given a trustee edit that the system rejects because a field is invalid
    When I save the edit
    Then I am told which field is invalid and why
    And I am not shown a generic system error

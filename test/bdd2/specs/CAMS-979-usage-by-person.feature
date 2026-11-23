# Ticket: CAMS-979 (GitHub #3334)
# Beads epic: cams-ugsiq
# Total Slices: 4
Feature: Leadership can see who uses CAMS by person, region, office, and role
  As a USTP executive stakeholder
  I want CAMS visits and feature usage counted by real people and broken down by region, office, and role
  So that I understand CAMS adoption across regions, offices, and roles

  Background:
    Given signing in to CAMS counts as a visit
    And a person is identified by their work email address, and their name is not recorded
    And a person is active in a time range if they signed in at least once during it

  # SLICE 1: Per-person usage list on demand
  # Dependencies: None
  # User Value: An authorized CAMS team member can answer leadership's "who uses CAMS?"
  #             request the same day, with each person's roles, offices, and regions.
  Scenario: Producing the per-person list for a time range
    Given Pat signed in to CAMS on 2026-12-01 and 2026-12-03 as a trial attorney in the Manhattan office of Region 2
    And I am a CAMS team member the product owner has authorized to get the per-person list
    When I produce the per-person list for 2026-12-01 through 2026-12-07
    Then the list has one row for Pat
    And the row shows Pat's work email, role "Trial Attorney", office "Manhattan", region "Region 2", and last used date 2026-12-03
    And the row does not show Pat's name

  Scenario: A person with several roles, offices, or regions appears once in the list
    Given Lee signed in with roles "Trial Attorney" and "Data Verifier" in offices in Region 2 and Region 3
    When I produce the per-person list for a time range that includes that sign-in
    Then the list has one row for Lee
    And the row shows both roles, both offices, and both regions

  Scenario: Temporarily granted access is listed under the roles and offices held at the time
    Given Sam signed in on 2026-12-02 with temporarily granted access to the Buffalo office
    And that temporary access expired before 2026-12-05
    When I produce the per-person list for 2026-12-01 through 2026-12-07
    Then Sam's row includes the Buffalo office

  Scenario: People who never signed in are not listed
    Given Chris has CAMS access but did not sign in during the time range
    When I produce the per-person list for that time range
    Then the list has no row for Chris

  Scenario: The list only reaches back as far as usage records are kept
    Given usage records are kept for the hosting environment's standard retention period
    When I produce the per-person list for a time range that starts before the oldest kept record
    Then the list covers only the part of the time range that is still kept
    And I can tell the earliest date the list covers

  Scenario: People who are not authorized cannot get the per-person list
    Given I am not a CAMS team member the product owner has authorized
    When I try to produce the per-person list
    Then I cannot see any person's work email

  # SLICE 2: Executive dashboard counts people, not browsers
  # Dependencies: Slice 1
  # User Value: Leadership sees how many distinct people use CAMS, so someone on two
  #             computers is no longer counted twice.
  Scenario: Active people counts one person on two computers once
    Given Pat signed in to CAMS from two different computers on 2026-12-01
    When I view the executive dashboard for 2026-12-01
    Then Pat counts as one active person

  Scenario: The dashboard shows when person-based counting started
    When I view the executive dashboard
    Then I can see the date person-based counting started
    And periods before that date are not back-filled with person-based counts

  Scenario: Browser-based history stays visible beside person-based counts
    When I view the executive dashboard for a time range that includes dates before person-based counting started
    Then I see the earlier browser-based counts labeled as counting browsers, not people
    And I see person-based counts from the date person-based counting started

  Scenario: The dashboard never shows individual email addresses
    When I view any part of the executive dashboard
    Then I see totals only and no person's work email

  # SLICE 3: Active people by region, office, and role
  # Dependencies: Slice 1
  # User Value: Leadership sees which regions, offices, and roles are using CAMS.
  Scenario: Active people broken down by region, office, and role
    Given 3 people in Region 2 and 1 person in Region 3 signed in during the selected time range
    When I view the executive dashboard for that time range
    Then I see 3 active people for Region 2 and 1 for Region 3
    And I see active people by office and by role for the same time range

  Scenario: A person in more than one group counts once in each and once overall
    Given Lee signed in with roles "Trial Attorney" and "Data Verifier" in Region 2 and Region 3
    When I view the executive dashboard for a time range that includes that sign-in
    Then Lee counts once under "Trial Attorney" and once under "Data Verifier"
    And Lee counts once under Region 2 and once under Region 3
    And Lee counts once in the overall active-people total

  Scenario: Temporarily granted access counts under the roles and offices held at the time
    Given Sam signed in with temporarily granted access to the Buffalo office
    When I view the executive dashboard for a time range that includes that sign-in
    Then Sam counts under the Buffalo office

  # SLICE 4: Feature usage counted per unique person
  # Dependencies: Slice 1
  # User Value: Leadership sees how many distinct people use each feature, not how many
  #             browsers visited it.
  Scenario: Each feature shows how many unique people used it
    Given Pat opened Case Notes on two different computers during the selected time range
    And Lee opened Case Notes once during the selected time range
    When I view feature usage on the executive dashboard for that time range
    Then Case Notes shows 2 people

  Scenario: Feature usage share is measured against active people
    Given 10 people were active during the selected time range
    And 4 of them opened the Trustees list
    When I view feature usage on the executive dashboard for that time range
    Then the Trustees list shows 40% of active people

# Ticket: CAMS-956 (GitHub #3190)
# Beads epic: cams-0yr5n
# Total Slices: 5
# Depends on: CAMS-955 (GitHub #3189, the ACMS/DXTR sync that writes CASE_APPOINTMENT records with
#             checks.matchedTrusteeAppointment); team review of the verifier action (now resolved in this
#             issue's text as "refresh, then auto-resolve")
# Replaces: the CAMS-905 gates. Gate A (approveVerification rejects an uncovered case) and gate B
#           (remapSurrogateAppointment throws on an uncovered case) are removed/replaced in Slice 1.
#           Gates F/G (TrusteeMatchVerificationAccordion/TrusteeSearchModal disable Match Trustee and
#           Confirm Appointment for uncovered cases) are addressed in Slice 4.
# Backfill scope decision (2026-11-12, Fritz Madden): open case appointments only, not closed ones.
Feature: Trustee case appointment verification
  As a data verifier
  I want a task whenever a trustee's case appointment isn't supported by an active trustee appointment
    for that court, division and chapter
  So that I can confirm a trustee serves the cases CAMS assigned to them, instead of approval being blocked

  # Terms used below:
  # - "appointment task" is a document in the new trustee-appointment-verification collection
  #   (documentType TRUSTEE_APPOINTMENT_VERIFICATION, partition key trusteeId, unique on
  #   (trusteeId, courtId, divisionCode, chapter, documentType))
  # - "the predicate" is: documentType CASE_APPOINTMENT, checks.matchedCase true, checks.matchedTrustee true,
  #   checks.matchedTrusteeAppointment false. Placeholders (matchedTrustee false) and parked records
  #   (CASE_APPOINTMENT_UNATTACHED) never match it.
  # - "covering appointment" is an active trustee appointment for the same trustee, court, division and chapter
  # - task reason is "no appointment" (trustee has no appointment there at all) or "appointment inactive"
  #   (an appointment exists for that court/division/chapter but isn't active)

  Background:
    Given trustee "T-1" is a known CAMS trustee
    And case "081-26-00001" is assigned to trustee "T-1" in court "081", division "1", chapter "7"

  # SLICE 1: Appointment tasks replace the approval block
  # Dependencies: None (reads case appointments CAMS-955 already writes)
  # User Value: A data verifier is never blocked from approving an identity task; a case whose court,
  #             division and chapter aren't covered by an active trustee appointment becomes a visible
  #             appointment task instead of a rejected approval.

  Scenario: Approving an identity task with an uncovered case opens an appointment task
    Given a pending identity task has a case with checks.matchedCase true and checks.matchedTrustee true
    And that case's checks.matchedTrusteeAppointment is false because trustee "T-1" has no appointment in
      the case's court, division and chapter
    When a data verifier approves the identity task, linking it to trustee "T-1"
    Then the identity task is approved
    And an appointment task opens for trustee "T-1" in that court, division and chapter
    And the appointment task's reason is "no appointment"

  Scenario: Approving is never rejected for an uncovered case
    Given an identity task's cases include one that is uncovered for the linked trustee
    When a data verifier approves the identity task
    Then the approval succeeds
    And it is not rejected the way CAMS-905 gate A used to reject it

  Scenario: An appointment task covers exactly one (trustee, court, division, chapter)
    Given an open appointment task exists for trustee "T-1", court "081", division "1", chapter "7"
    And another open appointment task exists for trustee "T-1", court "081", division "1", chapter "13"
    When a second uncovered case for trustee "T-1" in court "081", division "1", chapter "7" is approved
    Then that case joins the chapter 7 task
    And the chapter 13 task's case list is unchanged

  Scenario: A case joins an existing open task instead of creating a duplicate
    Given an open appointment task exists for trustee "T-1", court "081", division "1", chapter "7"
    When another case matching the predicate for the same trustee, court, division and chapter is written
    Then the case joins the existing task
    And no second appointment task is created for that tuple

  Scenario: A covering appointment never opens a task
    Given trustee "T-1" has an active appointment covering court "081", division "1", chapter "7"
    When a case appointment is written for trustee "T-1" in that court, division and chapter with
      checks.matchedTrusteeAppointment true
    Then no appointment task is created

  Scenario: A placeholder never joins or opens an appointment task
    Given a case appointment is a placeholder with checks.matchedTrustee false
    Then it never joins or opens an appointment task

  Scenario: A parked record never joins or opens an appointment task
    Given a case appointment is a CASE_APPOINTMENT_UNATTACHED record
    Then it never joins or opens an appointment task

  Scenario: An existing but inactive appointment gives the other reason
    Given trustee "T-1" has an appointment for court "081", division "1", chapter "7" that is not active
    When a case appointment is written for trustee "T-1" in that court, division and chapter with
      checks.matchedTrusteeAppointment false
    Then the appointment task's reason is "appointment inactive"

  Scenario: The remap writes the real appointment and opens or joins a task instead of throwing
    Given the trustee-match verification remap is writing the real appointment for a trustee with no
      covering appointment in the case's court, division and chapter
    When the remap runs
    Then it does not throw the way CAMS-905 gate B used to throw
    And the appointment is written with checks.matchedTrusteeAppointment false
    And it keeps the fresh case-summary values and assertValidChapter
    And the case joins or opens the appointment task for that trustee, court, division and chapter

  Scenario: The Data Verification queue shows the new task type
    Given an open appointment task exists for trustee "T-1", court "081", division "1", chapter "7"
    When a data verifier opens the Data Verification queue
    Then the appointment task appears alongside the existing task types
    And it is titled by its court, division and chapter

  # SLICE 2: Verifier can investigate a task
  # Dependencies: Slice 1
  # User Value: A data verifier can see why a task exists, which cases it affects and the trustee's actual
  #             appointments, without asking engineering to look at the data.

  Scenario: Expanding a task shows a loading spinner, then its details
    Given an open appointment task exists for trustee "T-1", court "081", division "1", chapter "7"
    When a data verifier expands the task
    Then a spinner with "Loading task details..." is shown while it loads
    And the task's details are shown once loaded

  Scenario: A load failure shows a red alert
    Given an open appointment task exists
    And loading its details fails
    When a data verifier expands the task
    Then a red alert "Unable to load task details. Please try again." is shown

  Scenario: The task subject names the court, division and chapter
    Given an open appointment task exists for court "Eastern District of New York", division "Brooklyn",
      chapter "7"
    When a data verifier expands the task
    Then the subject reads "Eastern District of New York (Brooklyn): Chapter 7"
    And the task type label reads "Trustee Appointment"

  Scenario: The reason sentence for "no appointment"
    Given an open appointment task for trustee "Jane Smith" has reason "no appointment" and 3 affected cases
    When a data verifier expands the task
    Then the reason sentence reads "Trustee Jane Smith is not appointed in this court, division and chapter.
      Affects 3 cases:"
    And "Jane Smith" links to the trustee's profile

  Scenario: The reason sentence for "appointment inactive"
    Given an open appointment task for trustee "Jane Smith" has reason "appointment inactive" and 2
      affected cases
    When a data verifier expands the task
    Then the reason sentence reads "The appointment for Trustee Jane Smith in this court, division and
      chapter is not active. Affects 2 cases:"

  Scenario: Each affected case is linked
    Given an open appointment task lists cases "081-26-00001" and "081-26-00002"
    When a data verifier expands the task
    Then each case number is a link to that case

  Scenario: The Appointments table orders by how closely each appointment agrees
    Given trustee "Jane Smith" has appointments that agree with the task's court, division and chapter to
      varying degrees
    When a data verifier expands the task
    Then the Appointments table lists them ordered by agreement, closest first
    And the table is paginated the same way existing CAMS tables are
    And its columns are District, Division, Chapter, Type and Status

  Scenario: A warning icon marks a cell that differs from the task's cases
    Given trustee "Jane Smith" has an appointment whose chapter differs from the task's cases
    When a data verifier expands the task
    Then that appointment's Chapter cell shows a warning icon with text alternative
      "Different from these cases"
    And a key line above the table reads "A warning icon marks information that differs from the court,
      division, chapter or status of these cases."

  Scenario: A trustee with no appointments
    Given trustee "Jane Smith" has no appointments in CAMS
    When a data verifier expands the task
    Then the Appointments table is replaced with "This trustee has no appointments in CAMS."

  # SLICE 3: Verifier can resolve a task
  # Dependencies: Slice 2
  # User Value: Once a Trustee Admin fixes the appointment, the verifier closes the task from CAMS without
  #             any manual data fix.

  Scenario: Guidance tells the verifier how to fix it
    Given an open appointment task exists
    When a data verifier expands the task
    Then guidance text reads "To fix this, a Trustee Admin must add or reactivate the appointment on the
      trustee's profile. Then Refresh Trustee Appointments to check again."
    And "Refresh Trustee Appointments" is a button styled as a link

  Scenario: Refreshing shows a spinner
    Given an open appointment task is expanded
    When a data verifier presses "Refresh Trustee Appointments"
    Then a spinner with "Refreshing trustee appointments..." is shown while it runs

  Scenario: A successful refresh resolves the task
    Given an open appointment task for trustee "Jane Smith" lists 3 cases
    And a Trustee Admin has added a covering appointment since the task opened
    When a data verifier presses "Refresh Trustee Appointments"
    Then the refresh finds the active covering appointment
    And the task resolves
    And checks.matchedTrusteeAppointment is set true on the task's 3 cases
    And a success message "Trustee Jane Smith's appointment verified for 3 cases." is announced at the top
      of the screen

  Scenario: There is no separate Resolve action
    Given an open appointment task is expanded
    Then there is no Resolve button
    And the only way to close the task is a refresh that finds a covering appointment

  Scenario: A refresh that still finds no covering appointment
    Given an open appointment task for court "Eastern District of Missouri", division "St. Louis",
      chapter "7"
    And no covering appointment exists yet
    When a data verifier presses "Refresh Trustee Appointments"
    Then a warning alert reads "There's still no active Chapter 7 appointment in Eastern District of
      Missouri (St. Louis). Ask a Trustee Admin to add or reactivate it, then try again."
    And the alert is announced to screen readers
    And the task stays open

  Scenario: A refresh that fails
    Given an open appointment task is expanded
    And the refresh call fails
    When a data verifier presses "Refresh Trustee Appointments"
    Then an error alert reads "Unable to refresh trustee appointments. Try again later."
    And the alert is announced to screen readers
    And the task stays open

  Scenario: There is no reject action for an appointment task
    Given an open appointment task is expanded
    Then there is no reject action offered

  Scenario: A Trustee Admin's change triggers no automatic re-check
    Given an open appointment task exists for trustee "Jane Smith"
    When a Trustee Admin adds a covering appointment for "Jane Smith"
    Then the appointment task stays open until a data verifier presses "Refresh Trustee Appointments"

  # SLICE 4: Approval preview reflects the new outcome
  # Dependencies: Slice 1 (gate A is removed)
  # User Value: Before approving, the verifier sees what will actually happen to uncovered cases, and can
  #             act on them instead of finding Match Trustee and Confirm Appointment disabled.

  Scenario: The approval preview names the appointment tasks it will create
    Given an identity task's approval preview includes an uncovered case in court "Eastern District of
      Missouri", division "St. Louis", chapter "7"
    When a data verifier opens the approval preview
    Then it reads "1 case in Eastern District of Missouri (St. Louis), Chapter 7 will become a Trustee
      Appointment task."

  Scenario: Match Trustee and Confirm Appointment are enabled for uncovered cases
    Given an uncovered case appears in an identity task's approval preview
    When a data verifier views that case in the preview
    Then Match Trustee and Confirm Appointment are enabled
    And they are not disabled the way CAMS-905 gates F and G used to disable them

  # SLICE 5: Backfill
  # Dependencies: Slice 1 (the predicate and task-creation logic must exist)
  # User Value: Open cases CAMS-955 already synced before this ticket shipped get appointment-task
  #             coverage too, not only newly written ones.

  Scenario: Deploying runs a one-time backfill over existing open case appointments
    Given CASE_APPOINTMENT records already exist from before this ticket shipped, matching the predicate,
      on open cases
    When this ticket's backfill runs on deploy
    Then an appointment task opens or is joined for each one, exactly as if it had just been written

  Scenario: The backfill excludes placeholders and parked records
    Given existing placeholder appointments and existing CASE_APPOINTMENT_UNATTACHED records
    When the backfill runs
    Then neither joins or opens an appointment task

  Scenario: The backfill excludes closed case appointments
    Given a closed CASE_APPOINTMENT record that would otherwise match the predicate
    When the backfill runs
    Then no appointment task is opened or joined for it

  Scenario: Replaying the backfill writes no duplicates
    Given the backfill has already run once
    When the backfill runs again
    Then no duplicate appointment tasks are created
    And no case is listed twice on any appointment task

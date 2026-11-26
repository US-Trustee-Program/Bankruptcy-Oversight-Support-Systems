# Ticket: CAMS-941 (GitHub #3111), combined with CAMS-802 (GitHub #2655) for the Change History tab
# Beads epic: cams-x52wz
# Total Slices: 5, plus trunk tasks T1 and T2 (no scenarios; see below)
# Depends on: CAMS-940 (#3110), merged to main. Its spec is
#   .ustp-cams-fdp/ai/specs/CAMS-940_superuser-grants-role/superuser-grants-role.feature
# Figma: "Admin" file, page "Permissions", frame "Complete Permissions Flow" (node 108-65029).
#   Frames used: "Full Permissions List", "Scenario 1", "Remove Permissions",
#   "Success/Failure messages for Role Added, User Activated/ Deactivated", "Change History",
#   "Change History - FIltering", "Change History - Empty state".
#
# Feature flag: every scenario runs with `cams-role-assignments` ON. With it OFF the Permissions
# screen is not offered, as in CAMS-940.
#
# Vocabulary (from CAMS-940): a "permission" is one USER_ROLE_ASSIGNMENT, a role plus a scope.
# Scopes are written as in the Add Permission picker: "Region 2 - Manhattan", "Region 2 - All Offices",
# "All Regions". Super User has no scope.
#
# Tracks (planned 2026-11-26 with Kelly Diabagate):
#   Trunk T1  Audit contract and the change-row projection. Both tracks depend on it.
#   Trunk T2  Region and Offices multi-select filter (also needed by #3112). Slice 5 depends on it.
#   Track A   Removal (CAMS-941):            Slices 1-2
#   Track B   Change History (CAMS-941 + CAMS-802): Slices 3-5
#   Tracks A and B can be built concurrently once T1 merges.
#
# Audit contract (T1): a removal writes one ROLE_ASSIGNMENT_AUDIT with action DEACTIVATED and
# replacedByAssignmentId null. A replacement keeps writing DEACTIVATED with replacedByAssignmentId set
# to the permission that replaced it. Change History tells the two apart by that field.
# Change History shows one row per audit record (revised 2026-11-26, Trunk T1 design; bead cams-x52wz.1).
#
# Lines marked "(assumption)" are not in the Figma or #3111 and need UX confirmation.
Feature: Super User removes a permission and reviews permission change history
  As a Super User
  I want to remove a permission a user should no longer have, and see every permission change
  So that each user's access is correct and I can show how it got that way

  Background:
    Given "Maria Garcia" is a Super User
    And "Sarah Williams" is a member of the "USTP Cams Users" AD group
    And region "2" includes the "Manhattan" and "Buffalo" offices

  # ---------------------------------------------------------------------------
  # SLICE 1: A Super User removes another user's permission
  # Dependencies: Trunk T1 (audit contract)
  # User Value: A Super User can take away a mistaken or outdated permission, and it takes effect
  #             for the user right away.
  # Not included: self-removal and authorization rules (Slice 2); Change History (Slices 3-5).
  # ---------------------------------------------------------------------------

  Scenario: Each active permission on the CAMS Users table has its own Remove Permission action
    Given Sarah has active Trial Attorney permissions for "Region 1 - All Offices" and "Region 2 - Manhattan"
    When Maria views Sarah's row on the CAMS Users tab
    Then each of Sarah's permissions has a "Remove Permission" action beside it
    And the row still has one "Add Permission" action
    And a user with no permissions has no "Remove Permission" action

  Scenario: Super User removes an office permission
    Given Sarah has an active Trial Attorney permission for "Region 2 - Manhattan"
    When Maria chooses "Remove Permission" beside Sarah's Trial Attorney "Region 2 - Manhattan" permission
    Then a "Remove Permission for Sarah Williams" modal opens
    And it reads "This will remove Sarah Williams's Trial Attorney permissions for Region 2 - Manhattan."
    When Maria chooses "Remove Permission" in the modal
    Then the modal closes
    And Maria sees the alert "Permission successfully removed from Sarah Williams."
    And Sarah's row no longer shows Trial Attorney, Region 2, Office Manhattan
    And the USER_ROLE_ASSIGNMENT is kept and marked inactive
    And a ROLE_ASSIGNMENT_AUDIT exists for it with action "DEACTIVATED", performed by Maria, a timestamp, and no replacing permission
    And an audit event for the removal is sent to Log Analytics

  Scenario Outline: The confirmation names the permission's scope
    Given Sarah has an active <role> permission <scope>
    When Maria chooses "Remove Permission" beside it
    Then the modal reads "<message>"

    Examples:
      | role           | scope                       | message                                                                              |
      | Trial Attorney | for "Region 2 - All Offices" | This will remove Sarah Williams's Trial Attorney permissions for Region 2 - All Offices. |
      | Trial Attorney | for "All Regions"            | This will remove Sarah Williams's Trial Attorney permissions for All Regions.            |
      | Super User     | with no scope                | This will remove Sarah Williams's Super User permissions. (assumption)                   |

  Scenario: The user loses the removed access without signing in again
    Given Sarah is signed in with an active Trial Attorney permission for "Region 2 - Manhattan"
    When Maria removes that permission
    Then Sarah's cached sessions are cleared
    And Sarah's next request builds a session without "TrialAttorney" or the Manhattan office

  Scenario: Backing out of the confirmation removes nothing
    Given the "Remove Permission for Sarah Williams" modal is open
    When Maria chooses Cancel, the close button, or presses Escape
    Then the modal closes
    And Sarah's permission is still active
    And no ROLE_ASSIGNMENT_AUDIT is written

  Scenario: Removing shows progress (assumption)
    When Maria confirms a removal
    Then the modal's "Remove Permission" button is disabled until the request finishes

  Scenario: A failed removal is explained
    Given the removal request fails
    When Maria confirms the removal
    Then the modal closes
    And Maria sees the error alert "Unable to remove permission from Sarah Williams."
    And Sarah's row is unchanged

  Scenario: Removing a permission that is no longer active changes nothing (assumption)
    # Mirrors CAMS-940 Revision 5: grants converge, so removals do too.
    Given Sarah's Trial Attorney "Region 2 - Manhattan" permission was removed by another Super User after Maria's table loaded
    When Maria removes it
    Then Maria sees the alert "Permission successfully removed from Sarah Williams."
    And no ROLE_ASSIGNMENT_AUDIT is written

  Scenario: A failed audit write does not undo the removal but is recorded for follow-up
    Given the ROLE_ASSIGNMENT_AUDIT write fails after the USER_ROLE_ASSIGNMENT is deactivated
    When Maria removes Sarah's permission
    Then the permission stays inactive
    And an error is logged with the same searchable message grants use, containing the audit details

  # ---------------------------------------------------------------------------
  # SLICE 2: Removal rules
  # Dependencies: Slice 1
  # User Value: CAMS can't be left without a Super User, and only Super Users can remove access,
  #             whether from the screen or the API.
  # Not included: Office Manager removal (#2654).
  # ---------------------------------------------------------------------------

  Scenario: A Super User is not offered removal of their own permissions
    Given Maria has an active Super User permission and an active Trial Attorney permission for "Region 2 - Manhattan"
    When Maria views her own row on the CAMS Users tab
    Then none of her permissions has a "Remove Permission" action
    And her row still has an "Add Permission" action

  Scenario: The API refuses a Super User's attempt to remove their own permission
    When Maria sends a removal request for one of her own permissions
    Then the API rejects it with an explanation
    And nothing is written

  Scenario: Only Super Users can remove permissions
    Given "John Davis" is signed in without the Super User role
    When John sends a removal request for one of Sarah's permissions
    Then the API rejects it with 403
    And nothing is written

  Scenario: The API rejects a malformed removal
    When a removal request names an unknown role, an unknown region or office, an office outside the given region, or a Super User permission with a region or office
    Then the API rejects it with an explanation
    And nothing is written

  # ---------------------------------------------------------------------------
  # SLICE 3: Change History tab lists every permission change
  # Dependencies: Trunk T1
  # User Value: A Super User can see every grant, replacement and removal, newest first, with who
  #             made it and when (CAMS-941 history; CAMS-802 system-wide log).
  # Not included: filters (Slices 4-5).
  # ---------------------------------------------------------------------------

  Scenario: The Change History tab lists every change, newest first
    Given these permission changes were made:
      | date       | by           | user           | change                                                                 |
      | 11/02/2026 | Maria Garcia | Sarah Williams | granted Trial Attorney, Region 2 - Manhattan                           |
      | 11/20/2026 | Maria Garcia | Sarah Williams | granted Trial Attorney, Region 2 - All Offices, replacing Manhattan    |
      | 11/25/2026 | Maria Garcia | Sarah Williams | removed Trial Attorney, Region 2 - All Offices                         |
    When Maria opens Administration > Permissions > Change History
    Then she sees a "Change History" table with the columns Change, User, Previous, New, Changed by and Date
    And the rows are, newest first (one row per audit record; a replacing grant adds a row for the
      grant and a row for each permission it replaced, with the same date):
      | Change     | User           | Previous                               | New                                    | Changed by   | Date       |
      | Permission | Sarah Williams | Trial Attorney, Region 2 - All Offices | (none)                                 | Maria Garcia | 11/25/2026 |
      | Permission | Sarah Williams | Trial Attorney, Region 2 - Manhattan   | Trial Attorney, Region 2 - All Offices | Maria Garcia | 11/20/2026 |
      | Permission | Sarah Williams | (none)                                 | Trial Attorney, Region 2 - All Offices | Maria Garcia | 11/20/2026 |
      | Permission | Sarah Williams | (none)                                 | Trial Attorney, Region 2 - Manhattan   | Maria Garcia | 11/02/2026 |

  Scenario: A grant that replaces several permissions has a row for each replaced permission
    Given Maria granted Sarah Trial Attorney for "All Regions", replacing "Region 1 - All Offices" and "Region 2 - Manhattan"
    Then Change History has three rows for that grant, with the same date:
      | Previous                               | New                         |
      | (none)                                 | Trial Attorney, All Regions |
      | Trial Attorney, Region 1 - All Offices | Trial Attorney, All Regions |
      | Trial Attorney, Region 2 - Manhattan   | Trial Attorney, All Regions |

  Scenario: A grant that finished an earlier partial grant shows only the replacement
    Given Sarah's "Region 2 - All Offices" grant was saved but "Region 2 - Manhattan" was only deactivated when Maria granted it again
    Then the repeat grant adds one row: Previous "Trial Attorney, Region 2 - Manhattan", New "Trial Attorney, Region 2 - All Offices"
    And no second "(none)" row is added for "Region 2 - All Offices"

  Scenario: Super User changes have no scope (assumption)
    Given Maria granted Sarah the Super User role
    Then the row's New reads "Super User"

  Scenario: A change appears right away
    Given Maria is on the CAMS Users tab
    When Maria removes one of Sarah's permissions
    And Maria opens the Change History tab
    Then the removal is the first row

  Scenario: Change History is paginated (assumption)
    Given more than 20 permission changes exist
    Then the table shows 20 changes per page with pagination, as on the CAMS Users tab

  Scenario: No changes yet (assumption)
    Given no permission has ever been granted or removed
    Then Change History reads "No permission changes yet."

  Scenario: Only Super Users can see Change History
    Given "John Davis" is signed in without the Super User role
    Then the Permissions screen is not offered to John
    And any request John makes to the change history API is rejected with 403

  # ---------------------------------------------------------------------------
  # SLICE 4: Filter Change History by CAMS User Name
  # Dependencies: Slice 3
  # User Value: A Super User can see one user's complete permission history (CAMS-941; CAMS-802
  #             FR-3.2).
  # ---------------------------------------------------------------------------

  # Matching follows the CAMS Users name filter (CAMS-940 Slice 2), which follows other CAMS filters.
  Scenario: Filter by CAMS User Name as you type
    Given Maria is on the Change History tab
    When Maria types "Sarah" in "CAMS User Name"
    Then only changes to users whose name matches are shown
    And the User column makes clear whose history is shown

  Scenario: The filter matches the affected user, not the Super User who made the change
    When Maria types "Maria" in "CAMS User Name"
    Then changes Maria made to Sarah are not shown

  Scenario: Empty state caused by filtering
    When Maria's filters match no changes
    Then she sees "No CAMS users match your search criteria."
    # Copy taken from the Figma frame "Change History - Empty state".

  # ---------------------------------------------------------------------------
  # SLICE 5: Filter Change History by Region and Offices
  # Dependencies: Slice 4, Trunk T2 (Region and Offices multi-select)
  # User Value: A Super User can review the changes for the offices or regions they care about.
  # Not included: defaulting the filter to an Office Manager's offices (#2652, #2653).
  # ---------------------------------------------------------------------------

  Scenario: Filter by Region and Offices
    Given Maria is on the Change History tab
    When Maria selects "Region 1 - All Offices" in "Region and Offices"
    Then a "Region 1 - All Offices" pill appears below the filters
    And only changes whose Previous or New scope is in region 1 are shown (assumption)

  Scenario: Several regions and offices can be selected
    When Maria selects "Region 1 - All Offices" and "Region 2 - Manhattan"
    Then changes in either are shown

  Scenario: Removing a pill or choosing Clear removes the filter
    Given "Region 1 - All Offices" is selected
    When Maria removes its pill, or chooses "Clear"
    Then every change is shown again

  Scenario: Name and Region and Offices filters combine
    When Maria types "Sarah" and selects "Region 2 - Manhattan"
    Then only Sarah's changes in Manhattan are shown

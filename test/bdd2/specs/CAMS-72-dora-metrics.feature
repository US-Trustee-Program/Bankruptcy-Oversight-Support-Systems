# Ticket: CAMS-72
# Total Slices: 8
Feature: DORA Metrics Capture
  As a CAMS engineering/release team member
  I want the four DORA metrics computed from data already in this repo
  So that the team can gauge and improve software delivery performance over time

  # SLICE 1: Deployment Frequency
  # Dependencies: None
  # User Value: Team can see how often CAMS deploys to production over a reporting period
  # Data source: continuous-deployment.yml workflow-run history on the main branch
  Scenario: Compute deployment frequency for a reporting period
    Given the continuous-deployment.yml workflow has completed successfully on the main branch multiple times within a reporting period
    When the deployment frequency report is generated for that period
    Then the report shows the count of successful main-branch deployment runs in the period
    And the report shows deployment frequency expressed as deployments per day

  # SLICE 2: Lead Time for Changes
  # Dependencies: Slice 1 (reuses the same main-branch deployment-run history)
  # User Value: Team can see how long it takes a completed unit of work to reach production
  # Data source: GitHub issues (closedAt) correlated to the next successful main-branch deployment
  Scenario: Compute lead time for a closed issue
    Given a GitHub issue tagged with a CAMS ticket label was closed
    And a successful main-branch deployment occurred after that issue's closed timestamp
    When the lead time report is generated
    Then the report shows lead time for that issue as the duration between its closed timestamp and the next successful main-branch deployment after it

  Scenario: Closed issue awaiting its first post-close deployment
    Given a GitHub issue tagged with a CAMS ticket label was closed
    And no successful main-branch deployment has occurred since that issue closed
    When the lead time report is generated
    Then that issue is excluded from the report until a qualifying deployment occurs

  # SLICE 3: Change Failure Rate
  # Dependencies: Slice 1 (reuses the same main-branch deployment-run history)
  # User Value: Team can see what percentage of deployments caused a genuine production incident
  # Data source: bug issues labeled severity:high, opened within 24 hours of a deployment
  # Out of scope: bug issues opened before severity labeling began (~Aug 2026) are excluded entirely, not treated as unknown-severity
  Scenario: Deployment attributed a production incident
    Given a successful main-branch deployment occurred
    And a bug issue labeled severity:high was opened within 24 hours after that deployment
    When the change failure rate report is generated for the period containing that deployment
    Then that deployment is counted as a change failure
    And the report shows change failure rate as failed deployments divided by total deployments for the period

  Scenario: Deployment with no qualifying incident
    Given a successful main-branch deployment occurred
    And no severity:high bug issue was opened within 24 hours after that deployment
    When the change failure rate report is generated
    Then that deployment is not counted as a change failure

  # SLICE 4: Mean Time to Restore (MTTR)
  # Dependencies: Slice 3 (reuses its deployment-to-incident attribution)
  # User Value: Team can see how long it takes to resolve the incidents caused by failed deployments
  # Data source: createdAt/closedAt of the severity:high bug issues attributed in Slice 3
  Scenario: Compute MTTR from attributed incidents
    Given one or more deployments have been attributed a severity:high bug issue per Slice 3
    And each attributed bug issue has since been closed
    When the MTTR report is generated for the period
    Then the report shows the mean duration between each attributed bug issue's created and closed timestamps

  Scenario: Attributed incident still open
    Given a deployment has been attributed a severity:high bug issue per Slice 3
    And that bug issue has not yet been closed
    When the MTTR report is generated for the period
    Then that incident is excluded from the MTTR calculation until it is closed

  # ---------------------------------------------------------------------------
  # Display (added 2026-11-10). Built for the CAMS team; public like the rest of
  # the repo (docs site + Slack); USTP gets screenshots shared by hand. Reports are published weekly to Flexion-only storage under
  # runs/<run date>-<run id>/ (PR #3277). Dev-vs-production labeling of the
  # deployment signal is deliberately untouched here.
  # ---------------------------------------------------------------------------

  # SLICE 5: This Week at a Glance (docs site)
  # Dependencies: Slices 1-4 (the four reports)
  # User Value: The team finds a settled week's four DORA values on the team docs site without downloading or opening CSVs
  Scenario: Team sees the week before last's values
    Given the weekly DORA Metrics run on main has produced all four reports
    When a team member opens the DORA Metrics page on the team docs site
    Then they see the dates of the latest Monday-to-Sunday (UTC) week that ended at least a week before the run
    And on the weekly Tuesday run, that is the week before last, so changes closed late in it have had time to deploy and its incidents time to close
    And the deployment count and deployments per day for that week
    And the median lead time for changes, with the mean shown as secondary
    And the change failure rate as a percentage, with failed and total deployment counts
    And the median time to restore, with the mean shown as secondary
    And when the numbers were generated, with a link to the run that produced them

  Scenario: A week with nothing to measure
    Given the week shown had no deployed issues and no attributed incidents
    When a team member views that week's values
    Then change failure rate shows 0% if deployments happened, and "No data" if none did
    And lead time for changes shows "No data" rather than 0
    And time to restore shows "No incidents" rather than 0

  Scenario: A week whose incidents are all still open
    Given the week shown had attributed incidents and none of them has closed
    When a team member views that week's values
    Then time to restore shows how many incidents are still open, rather than 0 or "No incidents"

  Scenario: All four reports agree on the same weeks
    Given the weekly DORA Metrics run produced all four reports
    Then every report's weeks start on Monday 00:00 UTC
    And every report ends with the most recent complete week, with no partial week

  Scenario: The latest run failed
    Given the most recent weekly DORA Metrics run failed
    When a team member opens the DORA Metrics page
    Then they see the values from the most recent run that rendered the page, with its generation date

  # SLICE 6: Weekly Slack Headline (not yet built)
  # Dependencies: Slice 5
  # User Value: The team is told each week's numbers without having to go look
  Scenario: Team receives the weekly headline in Slack
    Given the weekly DORA Metrics run on main succeeded
    When the DORA Metrics page has been updated
    Then the team's Slack channel receives the week's four headline values and a link to the DORA Metrics page

  # SLICE 7: Recent Trend
  # Dependencies: Slice 5
  # User Value: The team can tell whether each metric is improving or worsening over roughly the last 12 settled weeks
  Scenario: Team sees each metric's weekly trend within the report window
    Given the weekly DORA Metrics run has produced all four reports covering 13 complete weeks
    When a team member opens the DORA Metrics page
    Then they see a chart of each metric's weekly value, oldest to newest
    And a table of every week's values, oldest to newest
    And the weeks shown are those that ended at least a week before the run, ending with the headline week
    And lead time and time to restore show the median, deployments the count, and change failure rate the percentage
    And every chart's scale starts at 0, so a week's size compares honestly with the others

  Scenario: Weeks with nothing to measure in the trend
    Given a week in the trend had no deployed issues (lead time), no closed incidents (time to restore), or no deployments (change failure rate)
    When a team member views the trend
    Then that week is left out of the affected metric's chart, never drawn as 0
    And the chart says why weeks are missing
    And the table shows "No data" for lead time or change failure rate in that week
    And the table shows "No incidents", or how many incidents are still open, for time to restore in that week
    And a metric with nothing to plot in any week says so instead of showing a chart

  # SLICE 8: Long-Term Trend (not yet built)
  # Dependencies: Slice 7
  # User Value: The team can see trends older than a single report's 13-week window
  Scenario: Team sees weeks older than the current report window
    Given reports from earlier weekly runs are kept in storage
    When a team member opens the DORA Metrics page
    Then they see each metric's weekly values from the first stored run through the latest complete week

  Scenario: Later runs restate a week
    Given two stored runs report different values for the same week
    When the long-term trend is shown
    Then that week shows the value from the most recent run

  Scenario: A week with no stored run
    Given no stored run covers a particular week
    When the long-term trend is shown
    Then that week appears as a "no data" gap, not as 0

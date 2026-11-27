# Workbook query checks

`check_executive_overview.py` checks the people and browser queries in the CAMS Executive Usage
Overview workbook (`../executive-overview.json`) against small fixture data sets with hand-worked
expected results. Run it after changing any of these queries:

- Hidden parameters `PeopleCountedFrom`, `PeopleRangeNote` and `PeopleCohortNote`
- Growth Summary, DAU / WAU / MAU, Engaged vs. Occasional, New vs. Returning and Weekly Cohort
  Retention, in both the people version and the _Browser-based history_ version (except the browser
  Engaged vs. Occasional pie, which is not covered yet)

## How it works

The script reads each query from the workbook JSON by item or parameter name, so it tests what
ships. It replaces the App Insights tables with inline `datatable` fixtures, and replaces the
portal's `{TimeRange:start}` / `{TimeRange:end}` tokens with the KQL expressions the portal
produces: `datetime(...)` for absolute ranges and `ago(30d)` / `now()` for relative ones. The cohort
queries look back from `now()`, so the script pins `now()` to a fixed date.

The queries run on the dev API App Insights only because `az monitor app-insights query` needs a
resource to run KQL. The fixtures are self-contained and the queries read no real data.

## Running it

Prerequisites: Python 3 and the Azure CLI, set to the Azure Government cloud
(`az cloud set --name AzureUSGovernment`) and signed in (`az login`) with read access to the App
Insights resource.

```sh
python3 -I check_executive_overview.py
```

It defaults to `appi-ustp-cams-node-api` in `rg-cams-app`. Pass `--resource-group` and `--app` to
use another App Insights resource. Each check prints `PASS` or `FAIL` with the expected and actual
rows. The script exits non-zero if any check fails. A full run takes about two minutes.

## Adding a check

Find the item's `name` in the workbook JSON, build a fixture with `ev([...])` (people) or a pair of
`pageViews` / `customEvents` datatables (browsers), and add a `check(...)` call. Work out the
expected rows by hand and write the reasoning in a comment next to the check, as the existing checks
do.

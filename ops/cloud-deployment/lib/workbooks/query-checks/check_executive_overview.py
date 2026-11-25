"""Check the people and browser queries in executive-overview.json against fixture data.

Each query is read straight from the workbook JSON by item or parameter name, so these checks
test what ships. The App Insights tables are swapped for inline `datatable` fixtures, and the
portal's time-range tokens are replaced with the KQL expressions the portal produces
(`datetime(...)`, or `ago(30d)` / `now()`). Queries run on the dev API App Insights only because
`az monitor app-insights query` needs a resource to run KQL; they read no real data.

Usage (Azure Government cloud, signed in with read access to the resource):
    python3 -I check_executive_overview.py [--resource-group RG] [--app APP_INSIGHTS_NAME]

Expected values are worked out by hand in the comments next to each check.
"""
import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

WORKBOOK = Path(__file__).resolve().parent.parent / "executive-overview.json"
PEOPLE_TABLE = "app('{NodeApiAppInsights:name}').customEvents"
BROWSER_TABLES = "union pageViews, customEvents"

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("--resource-group", default="rg-cams-app")
parser.add_argument("--app", default="appi-ustp-cams-node-api")
args = parser.parse_args()


def load_queries():
    queries = {}

    def walk(items):
        for item in items:
            content = item.get("content", {})
            for param in content.get("parameters", []):
                if "query" in param:
                    queries[param["name"]] = param["query"]
            if "query" in content:
                queries[item["name"]] = content["query"]
            walk(content.get("items", []))

    walk(json.loads(WORKBOOK.read_text())["items"])
    return queries


QUERIES = load_queries()
failures = []


def run(name, events, start="2026-12-01T00:00:00Z", end="2026-12-08T00:00:00Z", now=None):
    """Run the workbook query `name` with `events` in place of its tables.

    `events` is a datatable of CAMS Sign-In events for people queries, or a (pageViews,
    customEvents) pair of datatables for browser queries. `now` pins now() for the cohort queries.
    """
    text = QUERIES[name]
    if isinstance(events, tuple):
        assert BROWSER_TABLES in text, f"{name} does not read {BROWSER_TABLES}"
        text = text.replace(BROWSER_TABLES, f"union ({events[0]}), ({events[1]})")
    else:
        assert PEOPLE_TABLE in text, f"{name} does not read {PEOPLE_TABLE}"
        text = text.replace(PEOPLE_TABLE, f"({events})")
    kql = lambda v: v if "(" in v else f"datetime({v})"
    text = text.replace("{TimeRange:start}", kql(start)).replace("{TimeRange:end}", kql(end))
    if now:
        text = text.replace("now()", f"datetime({now})")
    out = subprocess.run(
        ["az", "monitor", "app-insights", "query", "-g", args.resource_group, "--app", args.app,
         "--analytics-query", text, "--offset", "1h", "-o", "json"],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise SystemExit(f"Query {name} failed:\n{text}\n{out.stderr}")
    table = json.loads(out.stdout)["tables"][0]
    cols = [c["name"] for c in table["columns"]]
    return [dict(zip(cols, row)) for row in table["rows"]]


def check(label, actual, expected):
    ok = actual == expected
    print(("PASS " if ok else "FAIL ") + label + ("" if ok else f"\n   expected {expected}\n   actual   {actual}"))
    if not ok:
        failures.append(label)


def ev(rows):
    body = ",\n".join(f'    datetime({t}), "{n}", dynamic({d})' for t, n, d in rows)
    return f"datatable(timestamp: datetime, name: string, customDimensions: dynamic) [{body and chr(10) + body + chr(10)}]"


S = "CAMS Sign-In"


def who(email):
    return '{"email": "%s"}' % email


def day(d):
    return f"2026-{d}T00:00:00Z"


# --- People fixtures --------------------------------------------------------------------------
# Counting starts 2026-11-01T10 (pat's first sign-in). pat signs in from two computers on 12-01
# (same email). Two sign-ins have no email (empty string, missing key); one event is not a sign-in.
TIMELINE = [
    ("2026-11-01T10:00:00Z", S, who("pat@example.gov")),
    ("2026-11-25T12:00:00Z", S, who("kim@example.gov")),
    ("2026-11-27T12:00:00Z", S, who("lee@example.gov")),
    ("2026-12-01T09:00:00Z", S, who("pat@example.gov")),
    ("2026-12-01T15:00:00Z", S, who("pat@example.gov")),
    ("2026-12-02T11:00:00Z", S, who("")),
    ("2026-12-02T12:00:00Z", S, "{}"),
    ("2026-12-02T13:00:00Z", "Other Event", who("zed@example.gov")),
    ("2026-12-03T08:00:00Z", S, who("sam@example.gov")),
    ("2026-12-05T08:00:00Z", S, who("kim@example.gov")),
    ("2026-12-08T00:00:00Z", S, who("late@example.gov")),
]
EVENTS = ev(TIMELINE)
EMPTY = ev([])

# --- PeopleCountedFrom --------------------------------------------------------------------------
check("counted-from", run("PeopleCountedFrom", EVENTS), [{"CountedFrom": "People counted from 2026-11-01."}])
check("counted-from, no data", run("PeopleCountedFrom", EMPTY),
      [{"CountedFrom": "No sign-ins have been recorded yet, so person-based counts are empty."}])

# --- Growth Summary (people) ----------------------------------------------------------------------
# Range 12-01..12-08: active = pat (two computers -> 1), sam, kim = 3; zed is not a sign-in;
# late@ is at the exclusive end. Prior 11-24..12-01: kim, lee = 2. Growth = (3-2)/2 = 50%.
# The two no-email sign-ins on 12-02 are noted on the Active tile.
# New = first sign-in in range: sam only = 1. Range start 12-01T00 < 11-01T10 + 30d, so New is overstated.
check("growth summary", run("people-growth-kpis", EVENTS), [
    {"Metric": "Active People (selected period)", "Value": 3.0, "Note": "2 sign-ins had no work email and are not counted"},
    {"Metric": "New People (selected period)", "Value": 1.0,
     "Note": "Overstated: anyone active before 2026-11-01 counts as new"},
    {"Metric": "Growth % (vs. prior period)", "Value": 50.0, "Note": ""},
])
# Range 12-05..12-12 starts after 12-01T10, so New is not overstated.
# Active: kim (12-05), late (12-08) = 2. Prior 11-28..12-05: pat, sam = 2. Growth 0%. New: late = 1.
check("growth, after the 30-day window", run("people-growth-kpis", EVENTS, "2026-12-05T00:00:00Z", "2026-12-12T00:00:00Z"), [
    {"Metric": "Active People (selected period)", "Value": 2.0, "Note": ""},
    {"Metric": "New People (selected period)", "Value": 1.0, "Note": ""},
    {"Metric": "Growth % (vs. prior period)", "Value": 0.0, "Note": ""},
])
# Range 10-25..11-08 starts before counting: prior period 10-11..10-25 is not covered -> no growth.
check("growth, range before counting started", run("people-growth-kpis", EVENTS, "2026-10-25T00:00:00Z", "2026-11-08T00:00:00Z"), [
    {"Metric": "Active People (selected period)", "Value": 1.0, "Note": ""},
    {"Metric": "New People (selected period)", "Value": 1.0,
     "Note": "Overstated: anyone active before 2026-11-01 counts as new"},
    {"Metric": "Growth % (vs. prior period)", "Value": None,
     "Note": "Not available: the prior period starts before people were counted"},
])
ONE_MISSING = ev([r for r in TIMELINE if r[2] != "{}"])
check("growth, one sign-in without email", run("people-growth-kpis", ONE_MISSING)[0],
      {"Metric": "Active People (selected period)", "Value": 3.0, "Note": "1 sign-in had no work email and is not counted"})
check("growth, no data", run("people-growth-kpis", EMPTY), [
    {"Metric": "Active People (selected period)", "Value": 0.0, "Note": ""},
    {"Metric": "New People (selected period)", "Value": 0.0, "Note": ""},
    {"Metric": "Growth % (vs. prior period)", "Value": None,
     "Note": "Not available: the prior period starts before people were counted"},
])

# --- DAU / WAU / MAU (people) ---------------------------------------------------------------------
# Active days: pat 11-01, kim 11-25, lee 11-27, pat 12-01, sam 12-03, kim 12-05.
# WAU(d) = people active d-6..d; MAU(d) = people active d-29..d.
#   12-01: DAU pat=1; WAU kim,lee,pat=3; MAU 11-02..12-01 kim,lee,pat=3 (pat 11-01 is outside)
#   12-02: 0; WAU 11-26..12-02 lee,pat=2; MAU 3     12-03: sam=1; WAU lee,pat,sam=3; MAU 4
#   12-04: 0; WAU pat,sam=2; MAU 4                  12-05: kim=1; WAU pat,sam,kim=3; MAU 4
#   12-06: 0; 3; 4                                  12-07: 0; WAU 12-01..12-07 pat,sam,kim=3; MAU 4
exp = [("12-01", 1, 3, 3), ("12-02", 0, 2, 3), ("12-03", 1, 3, 4), ("12-04", 0, 2, 4),
       ("12-05", 1, 3, 4), ("12-06", 0, 3, 4), ("12-07", 0, 3, 4)]
check("dau/wau/mau", run("people-dau-wau-mau-trend", EVENTS), [
    {"Day": day(d), "DAU": a, "WAU": w, "MAU": m, "Stickiness": round(100.0 * a / m, 1)} for d, a, w, m in exp
])
# Range 10-29..11-03: days before counting started (10-29..10-31) are not shown.
check("dau/wau/mau, no back-fill before counting started",
      run("people-dau-wau-mau-trend", EVENTS, "2026-10-29T00:00:00Z", "2026-11-03T00:00:00Z"), [
    {"Day": day("11-01"), "DAU": 1, "WAU": 1, "MAU": 1, "Stickiness": 100.0},
    {"Day": day("11-02"), "DAU": 0, "WAU": 1, "MAU": 1, "Stickiness": 0.0},
])
check("dau/wau/mau, no data", run("people-dau-wau-mau-trend", EMPTY), [])

# --- Engaged vs. Occasional (people; range 12-01..12-09, end exclusive) -------------------------
# eve: 12-01..12-08 = 8 distinct days (twice on 12-04, still 8) -> Engaged.
# edge: 12-02..12-08 = 7 days in range; 11-30 and 12-09T00 are outside -> Occasional.
# occ: 3 days -> Occasional. No-email sign-ins and the non-sign-in event never count.
eng = [(f"2026-12-0{d}T09:00:00Z", S, who("eve@example.gov")) for d in range(1, 9)]
eng += [("2026-12-04T17:00:00Z", S, who("eve@example.gov"))]
eng += [(f"2026-12-0{d}T09:00:00Z", S, who("edge@example.gov")) for d in range(2, 9)]
eng += [("2026-11-30T09:00:00Z", S, who("edge@example.gov")), ("2026-12-09T00:00:00Z", S, who("edge@example.gov"))]
eng += [(f"2026-12-0{d}T09:00:00Z", S, who("occ@example.gov")) for d in (1, 3, 5)]
eng += [(f"2026-12-0{d}T09:00:00Z", S, who("")) for d in range(1, 9)]
eng += [(f"2026-12-0{d}T09:00:00Z", "Other Event", who("zed@example.gov")) for d in range(1, 9)]
check("engaged vs occasional", run("people-engaged-occasional-pie", ev(eng), "2026-12-01T00:00:00Z", "2026-12-09T00:00:00Z"), [
    {"Segment": "Engaged (8+ active days)", "People": 1},
    {"Segment": "Occasional (1-7 active days)", "People": 2},
])
check("engaged vs occasional, no data", run("people-engaged-occasional-pie", EMPTY), [])

# --- New vs. Returning (people) -------------------------------------------------------------------
# Range 12-01..12-08: pat (first 11-01) and kim (first 11-25) -> Returning 2; sam -> New 1.
check("new vs returning", run("people-new-returning-pie", EVENTS), [
    {"Status": "New", "People": 1}, {"Status": "Returning", "People": 2},
])
# Range 10-25..11-08: only pat, first seen in range -> New 1, no Returning row.
check("new vs returning, range at cutover",
      run("people-new-returning-pie", EVENTS, "2026-10-25T00:00:00Z", "2026-11-08T00:00:00Z"), [{"Status": "New", "People": 1}])
check("new vs returning, no data", run("people-new-returning-pie", EMPTY), [])

# --- PeopleRangeNote: "yes" while the range starts before 12-01T10 (counting start + 30d) -------
check("range note, 10 days after counting started",
      run("PeopleRangeNote", EVENTS, "2026-11-11T00:00:00Z", "2026-12-11T00:00:00Z"), [{"Show": "yes"}])
check("range note, start 12-01T00 (just inside 30 days)", run("PeopleRangeNote", EVENTS), [{"Show": "yes"}])
check("range note, 40 days after counting started",
      run("PeopleRangeNote", EVENTS, "2026-12-11T00:00:00Z", "2027-01-10T00:00:00Z"), [{"Show": "no"}])
# The portal's relative form, ago(30d), uses the real clock. This proves the expression parses.
relative = "yes" if datetime.now(timezone.utc) - timedelta(days=30) < datetime(2026, 12, 1, 10, tzinfo=timezone.utc) else "no"
check("range note, relative range (portal form)", run("PeopleRangeNote", EVENTS, "ago(30d)", "now()"), [{"Show": relative}])
check("range note, no data", run("PeopleRangeNote", EMPTY), [{"Show": "no"}])

# --- Weekly Cohort Retention (people; now = 2026-12-20T12, cohorts must start after 10-11T12) --
# Weeks start Sunday: 11-01, 11-22, 11-29, 12-06.
#   pat: cohort 11-01; active weeks 11-01 (w0) and 11-29 (w4).
#   kim: cohort 11-22; active 11-22 (w0) and 11-29 (w1). lee: cohort 11-22, w0 only -> w1 is 50%.
#   sam: cohort 11-29, w0.  late: cohort 12-06, w0.
#   old: first 2026-09-01 -> cohort 08-30, outside the 70-day window, so not shown even though
#        old signs in again on 12-01.
NOW = "2026-12-20T12:00:00Z"
EVENTS_OLD = ev([("2026-09-01T10:00:00Z", S, who("old@example.gov")), ("2026-12-01T10:00:00Z", S, who("old@example.gov"))] + TIMELINE)
cohorts = [
    {"CohortWeek": "2026-11-01", "WeekNumber": 0, "RetentionPercent": 100.0},
    {"CohortWeek": "2026-11-01", "WeekNumber": 4, "RetentionPercent": 100.0},
    {"CohortWeek": "2026-11-22", "WeekNumber": 0, "RetentionPercent": 100.0},
    {"CohortWeek": "2026-11-22", "WeekNumber": 1, "RetentionPercent": 50.0},
    {"CohortWeek": "2026-11-29", "WeekNumber": 0, "RetentionPercent": 100.0},
    {"CohortWeek": "2026-12-06", "WeekNumber": 0, "RetentionPercent": 100.0},
]
check("cohort retention", run("people-retention-cohort-trend", EVENTS, now=NOW), cohorts)
check("cohort retention, older cohort not shown", run("people-retention-cohort-trend", EVENTS_OLD, now=NOW), cohorts)
check("cohort retention, no data", run("people-retention-cohort-trend", EMPTY, now=NOW), [])

# --- PeopleCohortNote: "yes" while the earliest cohort shown starts before counting start + 30d --
check("cohort note, early cohort", run("PeopleCohortNote", EVENTS, now=NOW), [{"Show": "yes"}])
# EVENTS_OLD: counting started 09-01; earliest cohort shown 11-01 >= 10-01T10 -> no note.
check("cohort note, cohorts 30+ days after counting started", run("PeopleCohortNote", EVENTS_OLD, now=NOW), [{"Show": "no"}])
# now 2027-02-20: window starts 12-12; no cohorts in window -> no note.
check("cohort note, no cohorts in window", run("PeopleCohortNote", EVENTS, now="2027-02-20T12:00:00Z"), [{"Show": "no"}])
check("cohort note, no data", run("PeopleCohortNote", EMPTY, now=NOW), [{"Show": "no"}])

# --- Browser versions (Browser-based history group) ----------------------------------------------
# Same timeline keyed by user_Id. pat used two browsers (b-pat-1, b-pat-2); the empty user_Id row
# is ignored; rows are split across pageViews and customEvents to prove the union.
PV = """datatable(timestamp: datetime, user_Id: string) [
    datetime(2026-11-01T10:00:00Z), "b-pat-1",
    datetime(2026-11-25T12:00:00Z), "b-kim",
    datetime(2026-12-01T09:00:00Z), "b-pat-1",
    datetime(2026-12-02T11:00:00Z), "",
    datetime(2026-12-05T08:00:00Z), "b-kim"
]"""
CE = """datatable(timestamp: datetime, user_Id: string) [
    datetime(2026-11-27T12:00:00Z), "b-lee",
    datetime(2026-12-01T15:00:00Z), "b-pat-2",
    datetime(2026-12-03T08:00:00Z), "b-sam",
    datetime(2026-12-08T00:00:00Z), "b-late"
]"""
BROWSERS = (PV, CE)
EMPTY_B = ("datatable(timestamp: datetime, user_Id: string) []",) * 2

# Range 12-01..12-08: active b-pat-1, b-pat-2, b-sam, b-kim = 4. Prior 11-24..12-01: b-kim, b-lee = 2.
# Growth (4-2)/2 = 100%. New: b-pat-2, b-sam = 2.
check("browser growth summary", run("growth-kpis", BROWSERS), [
    {"Metric": "Active Users (selected period)", "Value": 4.0, "Note": ""},
    {"Metric": "New Users (selected period)", "Value": 2.0,
     "Note": "Overstated: any browser active before 2026-11-01 counts as new"},
    {"Metric": "Growth % (vs. prior period)", "Value": 100.0, "Note": ""},
])
check("browser growth, range before oldest telemetry",
      run("growth-kpis", BROWSERS, "2026-10-25T00:00:00Z", "2026-11-08T00:00:00Z"), [
    {"Metric": "Active Users (selected period)", "Value": 1.0, "Note": ""},
    {"Metric": "New Users (selected period)", "Value": 1.0,
     "Note": "Overstated: any browser active before 2026-11-01 counts as new"},
    {"Metric": "Growth % (vs. prior period)", "Value": None,
     "Note": "Not available: the prior period starts before the oldest telemetry still kept"},
])
check("browser growth, no data", run("growth-kpis", EMPTY_B), [
    {"Metric": "Active Users (selected period)", "Value": 0.0, "Note": ""},
    {"Metric": "New Users (selected period)", "Value": 0.0, "Note": ""},
    {"Metric": "Growth % (vs. prior period)", "Value": None,
     "Note": "Not available: the prior period starts before the oldest telemetry still kept"},
])
# Browser active days: b-pat-1 11-01, b-kim 11-25, b-lee 11-27, b-pat-1 + b-pat-2 12-01, b-sam 12-03, b-kim 12-05.
#   12-01: DAU 2; WAU kim,lee,pat-1,pat-2 = 4; MAU 4    12-02: 0; WAU lee,pat-1,pat-2 = 3; MAU 4
#   12-03: 1; WAU 4; MAU 5    12-04: 0; 3; 5    12-05: 1; 4; 5    12-06: 0; 4; 5    12-07: 0; 4; 5
bexp = [("12-01", 2, 4, 4), ("12-02", 0, 3, 4), ("12-03", 1, 4, 5), ("12-04", 0, 3, 5),
        ("12-05", 1, 4, 5), ("12-06", 0, 4, 5), ("12-07", 0, 4, 5)]
check("browser dau/wau/mau", run("dau-wau-mau-trend", BROWSERS), [
    {"Day": day(d), "DAU": a, "WAU": w, "MAU": m, "Stickiness": round(100.0 * a / m, 1)} for d, a, w, m in bexp
])
# Range 12-01..12-08: b-pat-1 (first 11-01) and b-kim -> Returning 2; b-pat-2, b-sam -> New 2.
check("browser new vs returning", run("new-returning-pie", BROWSERS), [
    {"Status": "New", "Users": 2}, {"Status": "Returning", "Users": 2},
])
# Cohorts: 11-01 {b-pat-1}: w0, w4. 11-22 {b-kim, b-lee}: w0 100, w1 50. 11-29 {b-pat-2, b-sam}: w0. 12-06 {b-late}: w0.
check("browser cohort retention", run("retention-cohort-trend", BROWSERS, now=NOW), cohorts)

print("\nAll fixture checks passed." if not failures else f"\n{len(failures)} failed: {failures}")
sys.exit(1 if failures else 0)

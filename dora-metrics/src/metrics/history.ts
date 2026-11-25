import type { CsvRow } from '../output/read-csv.js';
import { MS_PER_DAY } from './period-window.js';
import {
  BY_PERIOD_REPORTS,
  type ByPeriodReports,
  type ReportKey,
  SETTLING_MS,
  summarizeWeek,
  type WeeklySummary,
} from './weekly-summary.js';

const WEEK_MS = 7 * MS_PER_DAY;
const MONDAY = 1;
const REPORT_KEYS = Object.keys(BY_PERIOD_REPORTS) as ReportKey[];

// One run stored under runs/<runDate>-<runId>/. A report is missing when its file was not stored.
export type StoredRun = { runDate: string; runId: number; reports: Partial<ByPeriodReports> };

// summary is null for a week inside the range that no run supplies: no data, never zero.
export type HistoryWeek = { periodStart: Date; summary: WeeklySummary | null };

type RunWeeks = { cutoffMs: number; reports: Partial<ByPeriodReports> };

// Runs from before the calendar-week change (PR #3315, merged 2026-11-20) used rolling windows.
function isCalendarWeek(row: CsvRow): boolean {
  const start = new Date(row.periodStart);
  const end = new Date(row.periodEnd);
  return (
    start.getUTCDay() === MONDAY &&
    start.getTime() % MS_PER_DAY === 0 &&
    end.getTime() - start.getTime() === WEEK_MS
  );
}

// The weeks a run supplies: settled calendar weeks present in all four of its reports.
function weeksSupplied({ cutoffMs, reports }: RunWeeks): Map<number, WeeklySummary> {
  const rowsByWeek = REPORT_KEYS.map((key) => {
    const byWeek = new Map<number, CsvRow>();
    for (const row of reports[key] ?? []) {
      if (isCalendarWeek(row) && new Date(row.periodEnd).getTime() <= cutoffMs) {
        byWeek.set(new Date(row.periodStart).getTime(), row);
      }
    }
    return byWeek;
  });

  const supplied = new Map<number, WeeklySummary>();
  for (const weekMs of rowsByWeek[0].keys()) {
    const rows = rowsByWeek.map((byWeek) => byWeek.get(weekMs));
    if (rows.every((row) => row !== undefined)) {
      const week = Object.fromEntries(REPORT_KEYS.map((key, i) => [key, rows[i]]));
      supplied.set(weekMs, summarizeWeek(week as Record<ReportKey, CsvRow>));
    }
  }
  return supplied;
}

function storedRunWeeks({ runDate, reports }: StoredRun): RunWeeks {
  const runDateMs = new Date(`${runDate}T00:00:00.000Z`).getTime();
  return { cutoffMs: runDateMs - SETTLING_MS, reports };
}

// Every calendar week from the first one any run supplies to the newest, oldest first. Each week comes
// from the newest run that supplies it (later folder date, then higher run id); the current run is newer
// than every stored run. A week counts only if it had settled at its run (ended at least SETTLING_MS before
// the folder date's 00:00 UTC, or before generatedAt for the current run).
export function combineHistory(
  storedRuns: StoredRun[],
  current: { reports: ByPeriodReports; generatedAt: Date },
): HistoryWeek[] {
  // Oldest first, so a newer run's week replaces an older run's.
  const oldestFirst: RunWeeks[] = [
    ...[...storedRuns]
      .sort((a, b) => a.runDate.localeCompare(b.runDate) || a.runId - b.runId)
      .map(storedRunWeeks),
    { cutoffMs: current.generatedAt.getTime() - SETTLING_MS, reports: current.reports },
  ];

  const summaries = new Map<number, WeeklySummary>();
  for (const run of oldestFirst) {
    for (const [weekMs, summary] of weeksSupplied(run)) {
      summaries.set(weekMs, summary);
    }
  }
  if (summaries.size === 0) {
    return [];
  }

  const firstMs = Math.min(...summaries.keys());
  const lastMs = Math.max(...summaries.keys());
  const weeks: HistoryWeek[] = [];
  for (let weekMs = firstMs; weekMs <= lastMs; weekMs += WEEK_MS) {
    weeks.push({ periodStart: new Date(weekMs), summary: summaries.get(weekMs) ?? null });
  }
  return weeks;
}

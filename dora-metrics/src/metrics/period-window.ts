export const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PeriodWindow = {
  startMs: number;
  endMs: number;
  periodStart: string;
  periodEnd: string;
};

export type ResolvedPeriodWindows = {
  startDate: Date;
  endDate: Date;
  periodDays: number;
  windows: PeriodWindow[];
};

// Shared by every DORA metric that buckets by period, so a bucket-boundary fix applies to all of them.
export function resolvePeriodWindows(
  startDate: Date,
  periodDays: number,
  endDateInput?: Date,
): ResolvedPeriodWindows {
  if (!Number.isFinite(periodDays) || periodDays <= 0) {
    throw new Error(`periodDays must be a positive finite number, got ${periodDays}`);
  }
  const endDate = endDateInput ?? new Date();
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    throw new Error('startDate and endDate must be valid dates');
  }
  if (startDate.getTime() > endDate.getTime()) {
    throw new Error('startDate must be on or before endDate');
  }
  const periodMs = periodDays * MS_PER_DAY;
  const totalMs = endDate.getTime() - startDate.getTime();
  const periodCount = Math.max(1, Math.ceil(totalMs / periodMs));
  if (!Number.isFinite(periodCount)) {
    throw new Error(
      'periodDays is too small relative to the date range (would produce an unbounded number of buckets)',
    );
  }

  const windows: PeriodWindow[] = [];
  for (let i = 0; i < periodCount; i++) {
    const startMs = startDate.getTime() + i * periodMs;
    const endMs = startMs + periodMs;
    windows.push({
      startMs,
      endMs,
      periodStart: new Date(startMs).toISOString(),
      periodEnd: new Date(endMs).toISOString(),
    });
  }

  return { startDate, endDate, periodDays, windows };
}

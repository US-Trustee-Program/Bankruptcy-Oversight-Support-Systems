// Global date constraints for date pickers
// October 1, 1979 - the inception of the USTP trustee program pilot for the U.S. Bankruptcy Code
export const DEFAULT_MIN_DATE = '1979-10-01';

// Sentinel used when a date picker has no effective upper bound (e.g. disableMax).
export const MAX_ISO_DATE = '9999-12-31';

function sortDates(dateA: Date | string, dateB: Date | string): number {
  //Sort DESC
  if (dateA > dateB) {
    return 1;
  } else if (dateA == dateB) {
    return 0;
  } else {
    return -1;
  }
}

function sortDatesReverse(dateA: Date | string, dateB: Date | string): number {
  //Sort ASC
  return sortDates(dateA, dateB) * -1;
}

function isValidDateString(dateString: string | null | undefined) {
  if (!dateString) return false;
  const evaluation = dateString.match(/^[\d]{4}-[\d]{2}-[\d]{2}/);
  return !!evaluation && evaluation.length === 1;
}

function getIsoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function getTodaysIsoDate() {
  return getIsoDate(new Date());
}

function getIsoTimestamp(date: Date) {
  return date.toISOString();
}

function getCurrentIsoTimestamp() {
  return getIsoTimestamp(new Date());
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function formatDate(isoDate: string): string {
  if (!isValidDateString(isoDate)) {
    return isoDate;
  }
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Adds `days` calendar days to `isoDate`, computed UTC end-to-end (Date.UTC + setUTCDate +
 * toISOString) so results are correct across the DST transition — a mixed UTC-parse/local-mutate
 * implementation silently returns the wrong date the day after DST ends (e.g. subtracting 1 day
 * from 2026-11-02 yields 2026-10-31, not 2026-11-01), since setDate/getDate operate in local time
 * while toISOString reformats in UTC. Accepts a leading `YYYY-MM-DD` with an optional time/offset
 * suffix (isValidDateString's own anchored prefix match already permits this), truncating the
 * suffix the same way getIsoDate does, so a full ISO timestamp behaves as if only its date portion
 * were given.
 */
function addDays(isoDate: string, days: number): string {
  if (!isValidDateString(isoDate)) {
    return isoDate;
  }
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return getIsoDate(date);
}

function subtractDays(isoDate: string, days: number): string {
  return addDays(isoDate, -days);
}

const DateHelper = {
  addDays,
  formatDate,
  getCurrentIsoTimestamp,
  getIsoDate,
  getIsoTimestamp,
  getTodaysIsoDate,
  isValidDateString,
  nowInSeconds,
  sortDates,
  sortDatesReverse,
  subtractDays,
};

export default DateHelper;

// Global date constraints for date pickers
// October 1, 1979 - the inception of the USTP trustee program pilot for the U.S. Bankruptcy Code
export const DEFAULT_MIN_DATE = '1979-10-01';

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
  const evaluation = dateString.match(/[\d]{4}-[\d]{2}-[\d]{2}/);
  return !!evaluation && evaluation.length === 1;
}

function getIsoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function getTodaysIsoDate() {
  return getIsoDate(new Date());
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

const DateHelper = {
  formatDate,
  getIsoDate,
  getTodaysIsoDate,
  isValidDateString,
  nowInSeconds,
  sortDates,
  sortDatesReverse,
};

export default DateHelper;

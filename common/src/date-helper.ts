export function sortDates(dateA: Date | string, dateB: Date | string): number {
  //Sort DESC
  if (dateA > dateB) {
    return 1;
  } else if (dateA == dateB) {
    return 0;
  } else {
    return -1;
  }
}

export function sortDatesReverse(dateA: Date | string, dateB: Date | string): number {
  //Sort ASC
  return sortDates(dateA, dateB) * -1;
}

export function isValidDateString(dateString: string | null | undefined) {
  if (!dateString) return false;
  const evaluation = dateString.match(/[\d]{4}-[\d]{2}-[\d]{2}/);
  return !!evaluation && evaluation.length === 1;
}

export function isInvalidDate(dateValue: unknown) {
  return dateValue instanceof Date && isNaN(dateValue.getTime());
}

export function getIsoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export function getTodaysIsoDate() {
  return getIsoDate(new Date());
}

export const DateHelper = {
  getIsoDate,
  getTodaysIsoDate,
  isValidDateString,
  sortDates,
  sortDatesReverse,
};

export default DateHelper;

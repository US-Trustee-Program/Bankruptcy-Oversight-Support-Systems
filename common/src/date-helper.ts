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

function isInvalidDate(dateValue: Date) {
  return dateValue instanceof Date && isNaN(dateValue.getTime());
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

const DateHelper = {
  getIsoDate,
  getTodaysIsoDate,
  isInvalidDate,
  isValidDateString,
  nowInSeconds,
  sortDates,
  sortDatesReverse,
};

export default DateHelper;

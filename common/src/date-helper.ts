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

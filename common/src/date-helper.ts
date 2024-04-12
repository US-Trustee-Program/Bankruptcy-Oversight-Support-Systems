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

export function checkDateStringFormat(value: string | undefined) {
  return value && value.match(/[\d]{,4}-[\d]{,2}-[\d]{,2}/);
}

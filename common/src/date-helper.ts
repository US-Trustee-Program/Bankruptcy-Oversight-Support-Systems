export function sortDates(dateA: Date | string, dateB: Date | string): number {
  if (dateA > dateB) {
    return 1;
  } else if (dateA == dateB) {
    return 0;
  } else {
    return -1;
  }
}

export function sortDatesReverse(dateA: Date | string, dateB: Date | string): number {
  return sortDates(dateA, dateB) * -1;
}

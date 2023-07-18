export function getDate(year: number, month: number, dayOfMonth: number): Date {
  if (month > 12 || dayOfMonth > 31) {
    throw new Error('Month cannot be greater than 12 and dayOfMonth cannot be greater than 31.');
  }
  return new Date(year, month - 1, dayOfMonth - 1);
}

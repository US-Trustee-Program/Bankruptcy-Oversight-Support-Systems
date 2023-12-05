const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatDate(dateOrString: Date | string): string {
  const date = dateOrString instanceof Date ? dateOrString : new Date(dateOrString);
  return formatter.format(date);
}

export type TirFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | '';

export type TirPeriodOption = {
  key: string;
  label: string;
  start: string;
  end: string;
  start2?: string;
  end2?: string;
};

export const ANNUAL_OPTIONS: TirPeriodOption[] = [
  { key: '01/01-12/31', label: '01/01-12/31', start: '1900-01-01', end: '1900-12-31' },
  { key: '04/01-03/31', label: '04/01-03/31', start: '1900-04-01', end: '1900-03-31' },
  { key: '07/01-06/30', label: '07/01-06/30', start: '1900-07-01', end: '1900-06-30' },
  { key: '10/01-09/30', label: '10/01-09/30', start: '1900-10-01', end: '1900-09-30' },
];

export const SEMI_ANNUAL_OPTIONS: TirPeriodOption[] = [
  {
    key: '01/01-06/30 & 07/01-12/31',
    label: '01/01-06/30 & 07/01-12/31',
    start: '1900-01-01',
    end: '1900-06-30',
    start2: '1900-07-01',
    end2: '1900-12-31',
  },
  {
    key: '04/01-09/30 & 10/01-03/31',
    label: '04/01-09/30 & 10/01-03/31',
    start: '1900-04-01',
    end: '1900-09-30',
    start2: '1900-10-01',
    end2: '1900-03-31',
  },
  {
    key: '07/01-12/31 & 01/01-06/30',
    label: '07/01-12/31 & 01/01-06/30',
    start: '1900-07-01',
    end: '1900-12-31',
    start2: '1900-01-01',
    end2: '1900-06-30',
  },
  {
    key: '10/01-03/31 & 04/01-09/30',
    label: '10/01-03/31 & 04/01-09/30',
    start: '1900-10-01',
    end: '1900-03-31',
    start2: '1900-04-01',
    end2: '1900-09-30',
  },
];

export function findPeriodKey(
  start: string | undefined,
  end: string | undefined,
  frequency: TirFrequency,
): string {
  if (!start || !end) return '';
  const options = frequency === 'ANNUAL' ? ANNUAL_OPTIONS : SEMI_ANNUAL_OPTIONS;
  return options.find((o) => o.start === start && o.end === end)?.key ?? '';
}

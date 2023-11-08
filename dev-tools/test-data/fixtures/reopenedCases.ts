import { BCase } from '../domain/bcase';
import { CreateCaseOptions, createCase } from './lib/common';

export function createReopenedCases(options: CreateCaseOptions) {
  const decorations: Array<Partial<BCase>> = [];

  // Add a number of cases where the case is simply closed.
  decorations.push({
    transactions: [
      { code: 'CBC', date: '2022-07-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-08-27', meta: '41 Order Granting' },
    ],
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-02-15',
    dateReopen: '2022-08-27',
    dateTerm: '2023-10-01',
  });

  decorations.push({
    transactions: [
      { code: 'CBC', date: '2022-04-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-06-14', meta: '41 Order Granting' },
    ],
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-02-15',
    dateReopen: '2022-06-14',
    dateTerm: '2023-10-01',
  });

  decorations.push({
    transactions: [
      { code: 'CBC', date: '2022-03-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-06-14', meta: '41 Order Granting' },
    ],
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-06-20',
    dateReopen: '2022-06-14',
    dateTerm: '2023-10-01',
  });

  decorations.push({
    transactions: [
      { code: 'CBC', date: '2022-09-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-11-03', meta: '41 Order Granting' },
    ],
    cfValue: 'MDisCs, CLOSED, Lead',
    dateFiled: '2022-10-04',
    dateReopen: '2022-11-03',
    dateTerm: '2023-10-01',
  });

  decorations.push({
    transactions: [
      { code: 'CBC', date: '2022-01-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-11-30', meta: '41 Order Granting' },
    ],
    cfValue: 'PENAP, CLOSED',
    dateFiled: '2022-10-11',
    dateReopen: '2022-11-30',
    dateTerm: '2023-10-01',
  });

  decorations.push({
    transactions: [
      { code: 'CBC', date: '2022-08-20', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-12-31', meta: '41 Order Granting' },
    ],
    cfValue: 'JtAdm, CGM1, CLOSED',
    dateFiled: '2022-10-18',
    dateReopen: '2022-12-31',
    dateTerm: '2023-10-01',
  });

  // Example of a case with multiple closure and reopen transactions ending with a DISMISSAL.
  decorations.push({
    transactions: [
      { code: 'CBC', date: '2022-03-14', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-03-13', meta: '41 Order Granting' },
      { code: 'CBC', date: '2022-03-14', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-03-13', meta: '41 Order Granting' },
      { code: 'CDC', date: '2023-11-01', meta: 'Case Dismissed' },
    ],
    cfValue: 'FeeDueAP, PENAP, Lead, Mediation',
    dateFiled: '2022-12-19',
    dateReopen: '2023-03-13',
    dateTerm: '2023-11-01',
    dateDismiss: '2023-11-01',
  });

  // Example of a reopened case followed by a CLOSURE.
  decorations.push({
    transactions: [
      { code: 'CBC', date: '2023-01-25', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-09-14', meta: '41 Order Granting' },
      { code: 'CBC', date: '2023-10-01', meta: 'Case Closed' },
    ],
    cfValue: 'CLOSED',
    dateFiled: '2023-04-06',
    dateReopen: '2023-09-14',
    dateTerm: '2023-10-01',
  });

  // Example of a case with multiple closures and reopen transactions ending with a REOPEN.
  decorations.push({
    transactions: [
      { code: 'CBC', date: '2023-07-08', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-08-15', meta: '41 Order Granting' },
      { code: 'CBC', date: '2023-09-09', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-10-04', meta: '41 Order Granting' },
    ],
    cfValue: 'CLOSED',
    dateFiled: '2023-06-28',
    dateReopen: '2023-10-04',
    dateTerm: '2023-10-01',
  });

  // Example of a reopened case followed by a DISMISSAL.
  decorations.push({
    transactions: [
      { code: 'CBC', date: '2023-06-01', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-10-23', meta: '41 Order Granting' },
      { code: 'CDC', date: '2023-11-01', meta: 'Case Dismissed' },
    ],
    cfValue: 'CLOSED',
    dateFiled: '2023-07-17',
    dateReopen: '2023-10-23',
    dateTerm: '2023-11-01',
    dateDismiss: '2023-11-01',
  });

  // Now create some cases and append/override properties with the decorations.
  const bCases: Array<BCase> = decorations.map((decoration) => {
    return { ...createCase(options), ...decoration };
  });

  return bCases;
}

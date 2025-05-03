import { BCase } from '../domain/bcase';
import { createCase, CreateCaseOptions } from './lib/common';

export function createReopenedCases(options: CreateCaseOptions) {
  const decorations: Array<Partial<BCase>> = [];

  // Add a number of cases where the case is simply closed.
  decorations.push({
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-02-15',
    dateReopen: '2022-08-27',
    dateTerm: '2023-10-01',
    transactions: [
      { code: 'CBC', date: '2022-07-27', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2022-08-27', meta: '41 Order Granting', txType: 'O' },
    ],
  });

  decorations.push({
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-02-15',
    dateReopen: '2022-06-14',
    dateTerm: '2023-10-01',
    transactions: [
      { code: 'CBC', date: '2022-04-27', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2022-06-14', meta: '41 Order Granting', txType: 'O' },
    ],
  });

  decorations.push({
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-06-20',
    dateReopen: '2022-06-14',
    dateTerm: '2023-10-01',
    transactions: [
      { code: 'CBC', date: '2022-03-27', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2022-06-14', meta: '41 Order Granting', txType: 'O' },
    ],
  });

  decorations.push({
    cfValue: 'MDisCs, CLOSED, Lead',
    dateFiled: '2022-10-04',
    dateReopen: '2022-11-03',
    dateTerm: '2023-10-01',
    transactions: [
      { code: 'CBC', date: '2022-09-27', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2022-11-03', meta: '41 Order Granting', txType: 'O' },
    ],
  });

  decorations.push({
    cfValue: 'PENAP, CLOSED',
    dateFiled: '2022-10-11',
    dateReopen: '2022-11-30',
    dateTerm: '2023-10-01',
    transactions: [
      { code: 'CBC', date: '2022-01-27', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2022-11-30', meta: '41 Order Granting', txType: 'O' },
    ],
  });

  decorations.push({
    cfValue: 'JtAdm, CGM1, CLOSED',
    dateFiled: '2022-10-18',
    dateReopen: '2022-12-31',
    dateTerm: '2023-10-01',
    transactions: [
      { code: 'CBC', date: '2022-08-20', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2022-12-31', meta: '41 Order Granting', txType: 'O' },
    ],
  });

  // Example of a case with multiple closure and reopen transactions ending with a DISMISSAL.
  decorations.push({
    cfValue: 'FeeDueAP, PENAP, Lead, Mediation',
    dateDismiss: '2023-11-01',
    dateFiled: '2022-12-19',
    dateReopen: '2023-03-13',
    dateTerm: '2023-11-01',
    transactions: [
      { code: 'CBC', date: '2022-03-14', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2023-03-13', meta: '41 Order Granting', txType: 'O' },
      { code: 'CBC', date: '2022-03-14', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2023-03-13', meta: '41 Order Granting', txType: 'O' },
      { code: 'CDC', date: '2023-11-01', meta: 'Case Dismissed', txType: 'O' },
    ],
  });

  // Example of a reopened case followed by a CLOSURE.
  decorations.push({
    cfValue: 'CLOSED',
    dateFiled: '2023-04-06',
    dateReopen: '2023-09-14',
    dateTerm: '2023-10-01',
    transactions: [
      { code: 'CBC', date: '2023-01-25', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2023-09-14', meta: '41 Order Granting', txType: 'O' },
      { code: 'CBC', date: '2023-10-01', meta: 'Case Closed', txType: 'O' },
    ],
  });

  // Example of a case with multiple closures and reopen transactions ending with a REOPEN.
  decorations.push({
    cfValue: 'CLOSED',
    dateFiled: '2023-06-28',
    dateReopen: '2023-10-04',
    dateTerm: '2023-10-01',
    transactions: [
      { code: 'CBC', date: '2023-07-08', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2023-08-15', meta: '41 Order Granting', txType: 'O' },
      { code: 'CBC', date: '2023-09-09', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2023-10-04', meta: '41 Order Granting', txType: 'O' },
    ],
  });

  // Example of a reopened case followed by a DISMISSAL.
  decorations.push({
    cfValue: 'CLOSED',
    dateDismiss: '2023-11-01',
    dateFiled: '2023-07-17',
    dateReopen: '2023-10-23',
    dateTerm: '2023-11-01',
    transactions: [
      { code: 'CBC', date: '2023-06-01', meta: 'Case Closed', txType: 'O' },
      { code: 'OCO', date: '2023-10-23', meta: '41 Order Granting', txType: 'O' },
      { code: 'CDC', date: '2023-11-01', meta: 'Case Dismissed', txType: 'O' },
    ],
  });

  // Now create some cases and append/override properties with the decorations.
  const bCases: Array<BCase> = decorations.map((decoration) => {
    return { ...createCase(options), ...decoration };
  });

  return bCases;
}

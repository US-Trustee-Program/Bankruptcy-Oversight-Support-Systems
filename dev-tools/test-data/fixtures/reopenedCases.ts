import { BCase, Judge, toDbRecords } from '../domain/bcase';

export function createReopenedCases() {
  const bCases: Array<BCase> = [];

  const chapter = '15';
  const county = 'NEW YORK-NY';
  const courtId = '0208';
  const group = 'NY';
  const div = '081';
  const reopenCode = '1';

  const judge: Judge = {
    firstName: 'Meyer',
    lastName: 'Steven',
  };

  bCases.push({
    csCaseId: '317344',
    caseId: '22-66227',
    shortTitle: 'Smith & Co',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2022-07-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-08-27', meta: '41 Order Granting' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Smith & Co',
        taxId: '12-1234567',
        address1: '',
      },
    ],
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-02-15',
    dateReopen: '2022-08-27',
    dateTerm: '2023-10-01',
  });

  bCases.push({
    csCaseId: '962282',
    caseId: '22-75228',
    shortTitle: 'Johnson Corporation',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2022-04-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-06-14', meta: '41 Order Granting' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Johnson Corporation',
        taxId: '00-1234567',
        address1: '123 Main St',
      },
    ],
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-02-15',
    dateReopen: '2022-06-14',
    dateTerm: '2023-10-01',
  });

  bCases.push({
    csCaseId: '639825',
    caseId: '22-29929',
    shortTitle: 'Brown Enterprises',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2022-03-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-06-14', meta: '41 Order Granting' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Brown Enterprises',
        taxId: '00-1134567',
        address1: '123 Main St',
      },
    ],
    cfValue: 'JtAdm, CLOSED',
    dateFiled: '2022-06-20',
    dateReopen: '2022-06-14',
    dateTerm: '2023-10-01',
  });

  bCases.push({
    csCaseId: '507386',
    caseId: '22-77102',
    shortTitle: 'Davis Ltd',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2022-09-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-11-03', meta: '41 Order Granting' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Davis Ltd',
        taxId: '45-9876543',
        address1: '123 Main St',
      },
    ],
    cfValue: 'MDisCs, CLOSED, Lead',
    dateFiled: '2022-10-04',
    dateReopen: '2022-11-03',
    dateTerm: '2023-10-01',
  });

  bCases.push({
    csCaseId: '182201',
    caseId: '22-82448',
    shortTitle: 'Wilson & Sons',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2022-01-27', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-11-30', meta: '41 Order Granting' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Wilson & Sons',
        taxId: '23-4567890',
        address1: '123 Main St',
      },
    ],
    cfValue: 'PENAP, CLOSED',
    dateFiled: '2022-10-11',
    dateReopen: '2022-11-30',
    dateTerm: '2023-10-01',
  });

  bCases.push({
    csCaseId: '146860',
    caseId: '22-06498',
    shortTitle: 'Emily Anderson',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2022-08-20', meta: 'Case Closed' },
      { code: 'OCO', date: '2022-12-31', meta: '41 Order Granting' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Anderson',
        firstName: 'Emily',
        ssn: '001-23-4567',
        address1: '123 Main St',
      },
    ],
    cfValue: 'JtAdm, CGM1, CLOSED',
    dateFiled: '2022-10-18',
    dateReopen: '2022-12-31',
    dateTerm: '2023-10-01',
  });

  // Example of a case with multiple closure and reopen transactions ending with a DISMISSAL.
  bCases.push({
    csCaseId: '506663',
    caseId: '22-86620',
    shortTitle: 'Benjamin Wilson',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2022-03-14', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-03-13', meta: '41 Order Granting' },
      { code: 'CBC', date: '2022-03-14', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-03-13', meta: '41 Order Granting' },
      { code: 'CDC', date: '2023-11-01', meta: 'Case Dismissed' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Wilson',
        firstName: 'Benjamin',
        ssn: '123-45-6789',
        address1: '123 Main St',
      },
    ],
    cfValue: 'FeeDueAP, PENAP, Lead, Mediation',
    dateFiled: '2022-12-19',
    dateReopen: '2023-03-13',
    dateTerm: '2023-11-01',
    dateDismiss: '2023-11-01',
  });

  // Example of a reopened case followed by a CLOSURE.
  bCases.push({
    csCaseId: '882356',
    caseId: '23-70851',
    shortTitle: 'Sophia Martin',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2023-01-25', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-09-14', meta: '41 Order Granting' },
      { code: 'CBC', date: '2023-10-01', meta: 'Case Closed' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Martin',
        firstName: 'Sophia',
        ssn: '987-65-4321',
        address1: '123 Main St',
      },
    ],
    cfValue: 'CLOSED',
    dateFiled: '2023-04-06',
    dateReopen: '2023-09-14',
    dateTerm: '2023-10-01',
  });

  // Example of a case with multiple closures and reopen transactions ending with a REOPEN.
  bCases.push({
    csCaseId: '449865',
    caseId: '23-07045',
    shortTitle: 'Ethan Johnson',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2023-07-08', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-08-15', meta: '41 Order Granting' },
      { code: 'CBC', date: '2023-09-09', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-10-04', meta: '41 Order Granting' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Johnson',
        firstName: 'Ethan',
        taxId: '00-1134567',
        address1: '123 Main St',
      },
    ],
    cfValue: 'CLOSED',
    dateFiled: '2023-06-28',
    dateReopen: '2023-10-04',
    dateTerm: '2023-10-01',
  });

  // Example of a reopened case followed by a DISMISSAL.
  bCases.push({
    csCaseId: '129204',
    caseId: '23-16111',
    shortTitle: 'Olivia Davis',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [
      { code: 'CBC', date: '2023-06-01', meta: 'Case Closed' },
      { code: 'OCO', date: '2023-10-23', meta: '41 Order Granting' },
      { code: 'CDC', date: '2023-11-01', meta: 'Case Dismissed' },
    ],
    parties: [
      {
        role: 'db',
        lastName: 'Davis',
        firstName: 'Olivia',
        address1: '123 Main St',
      },
    ],
    cfValue: 'CLOSED',
    dateFiled: '2023-07-17',
    dateReopen: '2023-10-23',
    dateTerm: '2023-11-01',
    dateDismiss: '2023-11-01',
  });

  return toDbRecords(bCases);
}

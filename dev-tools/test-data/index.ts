// Import fixtures to generate.
import { toAoAtInsertStatements } from './tables/AO_AT';
import { toAoCsInsertStatements } from './tables/AO_CS';
import { toAoPyInsertStatements } from './tables/AO_PY';
import { toAoTxInsertStatements } from './tables/AO_TX';
import {
  BCase,
  BCaseTransactionTypeOrder,
  DebtorAttorney,
  Judge,
  toDbRecords,
} from './domain/bcase';
import { CaseDetailInterface } from './cases';
import { concatenateCityStateZipCountry, concatenateName } from './utility';

import { createChapter15Cases } from './fixtures/chapter15Cases';
import { createNoJudgeAssignedCases } from './fixtures/noJudgeAssignedCases';
import { CreateCaseOptions, createAttorney } from './fixtures/lib/common';
import { createReopenedCases } from './fixtures/reopenedCases';
import { TxCode } from './types';

const validFormats = ['json', 'sql'];
const format = process.argv[2];

if (!format || !validFormats.includes(format.toLowerCase())) {
  console.error(`Format is required. Valid options are '${validFormats.join("', '")}'.`);
  process.exit(-1);
}

// Common set of judges and attorneys to assign to cases.
const judges: Array<Judge> = [
  {
    firstName: 'Meyer',
    lastName: 'Steven',
  },
];
const attorneys: Array<DebtorAttorney> = [createAttorney(), createAttorney(), createAttorney()];
const commonOptions: CreateCaseOptions = { judges, attorneys };

// Create a set of cases using the fixtures.
const bCases: Array<BCase> = [];
bCases.push(
  ...createChapter15Cases(20, commonOptions),
  ...createNoJudgeAssignedCases(commonOptions),
  ...createReopenedCases(commonOptions),
);

// Output the cases in the specified format.
if (format === 'json') {
  const mappedCases = bCases.map((bCase) => {
    const closedDate = pickTop(bCase.transactions, 'CBC');
    const dismissedDate = pickTop(bCase.transactions, 'CDC');
    const reopenedDate = pickTop(bCase.transactions, 'OCO');

    const mappedCase: CaseDetailInterface = {
      caseId: bCase.div + '-' + bCase.caseId,
      chapter: bCase.chapter,
      caseTitle: bCase.shortTitle,
      closedDate: closedDate?.date,
      reopenedDate: reopenedDate?.date,
      dismissedDate: dismissedDate?.date,
      dateFiled: bCase.dateFiled,
      judgeName: concatenateName(bCase.judge),
    };
    const debtor = bCase.debtor;
    mappedCase.debtor = {
      name: concatenateName(debtor) || '',
      address1: debtor.address1,
      address2: debtor.address2,
      address3: debtor.address3,
      cityStateZipCountry: concatenateCityStateZipCountry(debtor),
      ssn: debtor.ssn,
      taxId: debtor.taxId,
    };

    const attorney = bCase.debtorAttorney;
    mappedCase.debtorAttorney = {
      name: concatenateName(attorney) || '',
      address1: attorney.address1,
      address2: attorney.address2,
      address3: attorney.address3,
      cityStateZipCountry: concatenateCityStateZipCountry(attorney),
      phone: attorney.phone,
    };

    return mappedCase;
  });
  console.log(JSON.stringify(mappedCases, null, 2));
} else if (format === 'sql') {
  const dbRecordBundle = toDbRecords(bCases);

  // Output all the fixtures to SQL.
  console.log('\n-- AO_AT Attorneys');
  if (!dbRecordBundle.AO_AT.length) console.log('-- No AO_AT records.');
  toAoAtInsertStatements(dbRecordBundle.AO_AT).forEach((statement) => {
    console.log(statement.trim());
  });
  console.log('\n-- AO_CS Cases');
  if (!dbRecordBundle.AO_CS.length) console.log('-- No AO_CS records.');
  toAoCsInsertStatements(dbRecordBundle.AO_CS).forEach((statement) => {
    console.log(statement.trim());
  });
  console.log('\n-- AO_PY Parties');
  if (!dbRecordBundle.AO_PY.length) console.log('-- No AO_PY records.');
  toAoPyInsertStatements(dbRecordBundle.AO_PY).forEach((statement) => {
    console.log(statement.trim());
  });
  console.log('\n-- AO_TX Transactions');
  if (!dbRecordBundle.AO_TX.length) console.log('-- No AO_TX records.');
  toAoTxInsertStatements(dbRecordBundle.AO_TX).forEach((statement) => {
    console.log(statement.trim());
  });
}

function pickTop(list: Array<BCaseTransactionTypeOrder>, code: TxCode) {
  return list.filter((i) => i.code === code).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

// Import fixtures to generate.
import { AO_AT_Record, toAoAtInsertStatements } from './tables/AO_AT';
import { AO_CS_Record, toAoCsInsertStatements } from './tables/AO_CS';
import { AO_DE_Record, toAoDeInsertStatements } from './tables/AO_DE';
import { AO_GRP_DES_Record, toAoGrpDesInsertStatements } from './tables/AO_GRP_DES';
import { AO_PY_Record, toAoPyInsertStatements } from './tables/AO_PY';
import { AO_REGION_Record, toAoRegionInsertStatements } from './tables/AO_REGION';
import { AO_TX_Record, toAoTxInsertStatements } from './tables/AO_TX';
import {
  BCase,
  BCaseTransactionTypeOrder,
  DebtorAttorney,
  Judge,
  toDbRecords,
} from './domain/bcase';
import { CaseDetail } from './cases';
import { concatenateCityStateZipCountry, concatenateName } from './utility';
import { TxCode } from './types';

import { createChapter15Cases } from './fixtures/chapter15Cases';
import { createNoJudgeAssignedCases } from './fixtures/noJudgeAssignedCases';
import { CreateCaseOptions, createAttorney } from './fixtures/lib/common';
import { createReopenedCases } from './fixtures/reopenedCases';

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

    const mappedCase: CaseDetail = {
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
  generateSql<AO_AT_Record>('AO_AT Attorneys', toAoAtInsertStatements, dbRecordBundle.AO_AT);
  generateSql<AO_CS_Record>('AO_CS Cases', toAoCsInsertStatements, dbRecordBundle.AO_CS);
  generateSql<AO_GRP_DES_Record>(
    'AO_GRP_DES ',
    toAoGrpDesInsertStatements,
    dbRecordBundle.AO_GRP_DES,
  );
  generateSql<AO_DE_Record>('AO_DE Docket Entries', toAoDeInsertStatements, dbRecordBundle.AO_DE);
  generateSql<AO_PY_Record>('AO_AT Attorneys', toAoPyInsertStatements, dbRecordBundle.AO_PY);
  generateSql<AO_REGION_Record>(
    'AO_PY Parties',
    toAoRegionInsertStatements,
    dbRecordBundle.AO_REGION,
  );
  generateSql<AO_TX_Record>('AO_TX Transactions', toAoTxInsertStatements, dbRecordBundle.AO_TX);
}

function pickTop(list: Array<BCaseTransactionTypeOrder>, code: TxCode) {
  return list.filter((i) => i.code === code).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

function generateSql<T>(label: string, mapper: (n: Array<T>) => Array<string>, data: Array<T>) {
  console.log('\n-- ' + label);
  if (!data.length) console.log('-- No records.');
  mapper(data).forEach((statement) => {
    console.log(statement.trim());
  });
}

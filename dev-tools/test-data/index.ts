import { toAoTxInsertStatements } from './tables/AO_TX';
import { toAoCsInsertStatements } from './tables/AO_CS';

// Import fixtures to generate.
import { createReopenedCases } from './fixtures/reopenedCases';
import { DatabaseRecords } from './tables/common';
import { noJudgeAssignedCases } from './fixtures/noJudgeAssignedCases';
import { caseParties } from './fixtures/caseParties';
import { toAoPyInsertStatements } from './tables/AO_PY';

let csCaseIds: string[] = [];

// Add fixture functions to this list to include them in the generated SQL.
const fixturesToCreate = [createReopenedCases, noJudgeAssignedCases];

// Generate all the fixtures.
const dbRecordBundles: DatabaseRecords[] = [];
fixturesToCreate.forEach((fixtureFn) => {
  const data = fixtureFn();
  csCaseIds = csCaseIds.concat(data.csCaseIds);
  dbRecordBundles.push(data.caseRecords);
});

// Create Parties for cases
const parties = caseParties(csCaseIds);

// Output all the fixtures to SQL.
dbRecordBundles.forEach((dbRecordBundle) => {
  toAoCsInsertStatements(dbRecordBundle.AO_CS).forEach((statement) => {
    console.log(statement.trim());
  });
  toAoTxInsertStatements(dbRecordBundle.AO_TX).forEach((statement) => {
    console.log(statement.trim());
  });
});

toAoPyInsertStatements(parties).forEach((statement) => {
  console.log(statement.trim());
});

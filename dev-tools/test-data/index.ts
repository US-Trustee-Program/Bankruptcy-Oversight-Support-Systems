import { toAoTxInsertStatements } from './tables/AO_TX';
import { toAoCsInsertStatements } from './tables/AO_CS';

// Import fixtures to generate.
import { createReopenedCases } from './fixtures/reopenedCases';
import { DatabaseRecords } from './tables/common';
import { noJudgeAssignedCases } from './fixtures/noJudgeAssignedCases';

// Add fixture functions to this list to include them in the generated SQL.
const fixturesToCreate = [createReopenedCases, noJudgeAssignedCases];

// Generate all the fixtures.
const dbRecordBundles: DatabaseRecords[] = [];
fixturesToCreate.forEach((fixtureFn) => {
  dbRecordBundles.push(fixtureFn());
});

// Output all the fixtures to SQL.
dbRecordBundles.forEach((dbRecordBundle) => {
  toAoCsInsertStatements(dbRecordBundle.AO_CS).forEach((statement) => {
    console.log(statement.trim());
  });
  toAoTxInsertStatements(dbRecordBundle.AO_TX).forEach((statement) => {
    console.log(statement.trim());
  });
});

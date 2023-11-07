import { toAoTxInsertStatements } from '../tables/AO_TX';
import { toAoCsInsertStatements } from '../tables/AO_CS';
import { toAoPyInsertStatements } from '../tables/AO_PY';

// Import fixtures to generate.
import { noJudgeAssignedCases } from '../fixtures/noJudgeAssignedCases';
import { BCase, toDbRecords } from '../domain/bcase';
import { generateCases } from '../fixtures/chapter15Cases';
import { toAoAtInsertStatements } from '../tables/AO_AT';

const generate10Cases = () => {
  return generateCases(10);
};

// Add fixture functions to this list to include them in the generated SQL.
const fixturesToCreate = [generate10Cases, noJudgeAssignedCases];

// Generate all the fixtures.
const bCases: Array<BCase> = [];
fixturesToCreate.forEach((fixtureFn) => {
  const moreCases = fixtureFn();
  bCases.push(...moreCases);
});

const dbRecordBundle = toDbRecords(bCases);

// Output all the fixtures to SQL.

toAoAtInsertStatements(dbRecordBundle.AO_AT).forEach((statement) => {
  console.log(statement.trim());
});
toAoCsInsertStatements(dbRecordBundle.AO_CS).forEach((statement) => {
  console.log(statement.trim());
});
toAoPyInsertStatements(dbRecordBundle.AO_PY).forEach((statement) => {
  console.log(statement.trim());
});
toAoTxInsertStatements(dbRecordBundle.AO_TX).forEach((statement) => {
  console.log(statement.trim());
});

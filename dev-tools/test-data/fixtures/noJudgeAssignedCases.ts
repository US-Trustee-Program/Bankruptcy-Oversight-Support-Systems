import { BCase, toDbRecords } from '../domain/bcase';

export function noJudgeAssignedCases() {
  const bCases: Array<BCase> = [];

  const chapter = '15';
  const county = 'NEW YORK-NY';
  const courtId = '0208';
  const group = 'NY';
  const div = '081';
  const reopenCode = '1';

  bCases.push({
    csCaseId: '317345',
    caseId: '23-66228',
    shortTitle: 'John & Co',
    chapter,
    county,
    group,
    div,
    courtId,
    reopenCode,
    transactions: [],
    dateFiled: '2023-02-15',
  });

  return toDbRecords(bCases);
}

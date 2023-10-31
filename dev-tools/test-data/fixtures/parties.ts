import { AO_PY_Record } from '../tables/AO_PY';

interface CaseMeta {
  CS_CASEID: string;
  CS_SHORT_TITLE: string;
}

export function createParties() {
  // The caseIds array should contain the CS_CASEID and CS_SHORT_TITLE for the records
  // you are adding parties for.
  const caseIds: CaseMeta[] = [];
  // You can get a fake data generator to give you data to fill this tax id field
  const taxIds: string[] = [];

  // The role 'db' is debtor. For other parties, modify as appropriate.
  const role = 'db';
  const courtId = '0208';
  const pyRecords = caseIds.map((bCase, index) => {
    const taxId = taxIds[index] || undefined;
    return new AO_PY_Record({
      CS_CASEID: bCase.CS_CASEID,
      COURT_ID: courtId,
      PY_ROLE: role,
      PY_LAST_NAME: bCase.CS_SHORT_TITLE,
      PY_TAXID: taxId,
    });
  });

  return { AO_CS: [], AO_TX: [], AO_PY: pyRecords };
}

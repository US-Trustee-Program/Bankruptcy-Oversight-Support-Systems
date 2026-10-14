import { DxtrTransactionRecord } from '../../types/cases';
import { getDate } from '../../utils/date-helper';
import { CamsError } from '../../../common-errors/cams-error';

const MODULE_NAME = 'DXTR-GATEWAY-HELPER';

export function parseTransactionDate(record: DxtrTransactionRecord): Date {
  const dateStringStart = 19;
  const dateStringEnd = dateStringStart + 6;
  const dateStringChars = Array.from(record.txRecord.slice(dateStringStart, dateStringEnd));
  dateStringChars.forEach((char) => {
    if (isNaN(parseInt(char))) {
      throw new CamsError(MODULE_NAME, {
        status: 500,
        message: 'The transaction contains non-numeric characters in the date string.',
        data: record,
      });
    }
  });

  const transactionDateYear = dateStringChars[0] + dateStringChars[1];
  const transactionDateMonth = dateStringChars[2] + dateStringChars[3];
  const transactionDateDay = dateStringChars[4] + dateStringChars[5];

  // `new Date()` uses a base year of 1900, so we add 2000 to the 2-digit year
  const baseYear = 2000;
  return getDate(
    parseInt(transactionDateYear) + baseYear,
    parseInt(transactionDateMonth),
    parseInt(transactionDateDay),
  );
}

// Examples:
// 1081201013220-10132            15JC
// 1081231056523-10565            15IB00-0000000
export function parseDebtorType(record: DxtrTransactionRecord): string {
  const codeLength = 2;
  const codeIndex = 33;
  return record.txRecord.slice(codeIndex, codeIndex + codeLength);
}

// 1081231056523-10565            15IB00-0000000     000000000000000000230411999992304119999923041110308230411VP000000                                 NNNNN
export function parsePetitionType(record: DxtrTransactionRecord): string {
  const codeLength = 2;
  const codeIndex = 107;
  return record.txRecord.slice(codeIndex, codeIndex + codeLength);
}

export function decomposeCaseId(caseId: string) {
  const courtDiv = caseId.slice(0, 3);
  const dxtrCaseId = caseId.slice(4);
  return { courtDiv, dxtrCaseId };
}

// CAMS-936. `ustDivisionCode` is the division identity used to match a case to a trustee
// appointment, so it has to be unique within its court. DXTR's CS_DIV_ACMS — what CAMS stores as
// courtDivisionCode — is not: in the Eastern District of Tennessee (0649) Winchester and
// Chattanooga both carry ACMS 491, and Johnson City and Greeneville both carry 492. The bare
// CS_DIV does tell them apart, so that is the code we emit there.
//
// Everywhere else ustDivisionCode stays equal to courtDivisionCode. Emitting the bare code
// nationwide would give newly synced cases a code nothing else in CAMS speaks — caseId prefixes,
// stored TRUSTEE_APPOINTMENT documents and the office picker are all ACMS — and neither backfill
// migrates courts outside 0649, so those cases would silently stop matching. Eight other courts
// also collapse two or more divisions into one ACMS code; widening this list means migrating them
// in the same release — tracked as cams-06edp.
export const UST_DIVISION_CODE_COURT_IDS = ['0649'];

/**
 * Builds the SELECT expression for `ustDivisionCode`, given the alias a query uses for
 * AO_CS_DIV. Every DXTR query that emits ustDivisionCode must use this so the court scoping
 * lives in exactly one place.
 */
export function ustDivisionCodeSelect(divisionAlias: string): string {
  const courtIds = UST_DIVISION_CODE_COURT_IDS.map((courtId) => `'${courtId}'`).join(', ');
  return (
    `CASE WHEN ${divisionAlias}.COURT_ID IN (${courtIds}) ` +
    `THEN ${divisionAlias}.CS_DIV ELSE ${divisionAlias}.CS_DIV_ACMS END`
  );
}

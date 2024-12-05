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

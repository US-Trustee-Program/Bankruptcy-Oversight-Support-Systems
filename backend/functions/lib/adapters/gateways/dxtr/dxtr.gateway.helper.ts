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

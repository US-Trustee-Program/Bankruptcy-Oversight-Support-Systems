import { AO_CS_Record } from '../tables/AO_CS';
import { AO_TX_Record, buildRecFromTxRecord } from '../tables/AO_TX';
import { DatabaseRecords, emptyDatabaseRecords } from '../tables/common';
import { Chapter, TxCode } from '../types';

export interface BCase {
  csCaseId: string;
  caseId: string;
  chapter: Chapter;
  shortTitle: string;
  county: string;
  div: string;
  group: string;
  courtId: string;
  judge: Judge;
  reopenCode: string;
  transactions: Array<BCaseTransaction>;
  cfValue: string;
  dateFiled: string;
  dateConvert?: string;
  dateReopen?: string;
  dateTerm?: string;
  dateDischarge?: string;
  dateDismiss?: string;
  dateLastEnter?: string;
}

export interface BCaseTransaction {
  code: TxCode;
  date: string;
  meta: string;
}

export interface Judge {
  lastName: string;
  firstName: string;
  middleName?: string;
}

export function toDbRecords(bCase: BCase | Array<BCase>): DatabaseRecords {
  const dbRecords = emptyDatabaseRecords();
  const caseList = bCase instanceof Array ? bCase : [bCase];
  caseList.forEach((_case) => {
    dbRecords.AO_CS.push(
      new AO_CS_Record({
        CS_CASEID: _case.csCaseId,
        COURT_ID: _case.courtId,
        CS_CASE_NUMBER: _case.caseId.split('-')[1],
        CS_DIV: _case.div,
        GRP_DES: _case.group,
        CASE_ID: _case.caseId,
        CS_SHORT_TITLE: _case.shortTitle,
        CS_CHAPTER: _case.chapter,
        CS_JOINT: 'n',
        CS_TYPE: 'bk',
        CS_FEE_STATUS: 'p',
        CS_VOL_INVOL: 'v',
        CS_DATE_FILED: _case.dateFiled,
        CS_DATE_CONVERT: _case.dateConvert,
        CS_REOPEN_CODE: _case.reopenCode,
        CS_DATE_REOPEN: _case.dateReopen,
        CS_DATE_TERM: _case.dateReopen,
        CS_DATE_DISCHARGE: _case.dateDischarge,
        CS_DATE_DISMISS: _case.dateDismiss,
        CS_COUNTY: _case.county,
        CF_VALUE: _case.cfValue,
        CS_DISP_METHOD: 'Discharge Not Applicable',
        JD_LAST_NAME: _case.judge.lastName,
        JD_MIDDLE_NAME: _case.judge.middleName,
        JD_FIRST_NAME: _case.judge.firstName,
      }),
    );
    _case.transactions?.forEach((txn, idx) => {
      const record = new AO_TX_Record({
        CS_CASEID: _case.csCaseId,
        COURT_ID: _case.courtId,
        DE_SEQNO: idx,
        CASE_ID: _case.caseId,
        JOB_ID: idx,
        TX_TYPE: 'O',
        TX_CODE: txn.code,
        TX_DATE: txn.date,
      });
      record.REC = buildRecFromTxRecord(record, _case.div, _case.chapter, txn.meta);
      record.validate();
      dbRecords.AO_TX.push(record);
    });
  });
  return dbRecords;
}

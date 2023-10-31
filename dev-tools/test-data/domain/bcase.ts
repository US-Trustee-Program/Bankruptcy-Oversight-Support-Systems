import { AO_CS_Record } from '../tables/AO_CS';
import { AO_TX_Record, buildRecFromTxRecord } from '../tables/AO_TX';
import { DatabaseRecords, emptyDatabaseRecords } from '../tables/common';
import { Chapter, TxCode } from '../types';
import { AO_PY_Record } from '../tables/AO_PY';

export interface BCase {
  csCaseId: string;
  caseId: string;
  chapter: Chapter;
  shortTitle: string;
  county: string;
  div: string;
  group: string;
  courtId: string;
  judge?: Judge;
  reopenCode: string;
  transactions: Array<BCaseTransaction>;
  parties: Array<BCaseParty>;
  cfValue?: string;
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

export interface BCaseParty {
  role: string;
  lastName: string;
  middleName?: string;
  firstName?: string;
  generation?: string;
  taxId?: string;
  ssn?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  fax?: string;
  email?: string;
  prose?: string;
  endDate?: string;
  ssnEvent?: string;
  nameEvent?: string;
  addressEvent?: string;
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
        JD_LAST_NAME: _case.judge?.lastName,
        JD_MIDDLE_NAME: _case.judge?.middleName,
        JD_FIRST_NAME: _case.judge?.firstName,
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
    _case.parties?.forEach((party) => {
      const record = new AO_PY_Record({
        CS_CASEID: _case.csCaseId,
        COURT_ID: _case.courtId,
        PY_ROLE: party.role,
        PY_LAST_NAME: party.lastName,
        PY_MIDDLE_NAME: party.middleName,
        PY_FIRST_NAME: party.firstName,
        PY_GENERATION: party.generation,
        PY_TAXID: party.taxId,
        PY_SSN: party.ssn,
        PY_ADDRESS1: party.address1,
        PY_ADDRESS2: party.address2,
        PY_ADDRESS3: party.address3,
        PY_CITY: party.city,
        PY_STATE: party.state,
        PY_ZIP: party.zip,
        PY_COUNTRY: party.country,
        PY_PHONENO: party.phone,
        PY_FAX_PHONE: party.fax,
        PY_E_MAIL: party.email,
        PY_PROSE: party.prose,
        PY_END_DATE: party.endDate,
        SSN_EVENT: party.ssnEvent,
        NAME_EVENT: party.nameEvent,
        ADDRESS_EVENT: party.addressEvent,
      });
      dbRecords.AO_PY.push(record);
    });
  });
  return dbRecords;
}

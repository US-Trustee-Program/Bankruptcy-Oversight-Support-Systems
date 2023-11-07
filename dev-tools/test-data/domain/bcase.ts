import { AO_CS_Record } from '../tables/AO_CS';
import { AO_TX_Record, buildRecFromTxRecord } from '../tables/AO_TX';
import { DatabaseRecords, emptyDatabaseRecords } from '../tables/common';
import { Chapter, TxCode } from '../types';
import { AO_PY_Record } from '../tables/AO_PY';
import { AO_AT_Record } from '../tables/AO_AT';

export interface BCase {
  dxtrId: string;
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
  debtor: BCaseParty;
  debtorAttorney: DebtorAttorney;
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

export interface DebtorAttorney {
  lastName: string;
  middleName?: string;
  firstName?: string;
  generation?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
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
        CS_CASEID: _case.dxtrId,
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
        CS_CASEID: _case.dxtrId,
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

    const partyRecord = new AO_PY_Record({
      CS_CASEID: _case.dxtrId,
      COURT_ID: _case.courtId,
      PY_ROLE: _case.debtor.role,
      PY_LAST_NAME: _case.debtor.lastName,
      PY_MIDDLE_NAME: _case.debtor.middleName,
      PY_FIRST_NAME: _case.debtor.firstName,
      PY_GENERATION: _case.debtor.generation,
      PY_TAXID: _case.debtor.taxId,
      PY_SSN: _case.debtor.ssn,
      PY_ADDRESS1: _case.debtor.address1,
      PY_ADDRESS2: _case.debtor.address2,
      PY_ADDRESS3: _case.debtor.address3,
      PY_CITY: _case.debtor.city,
      PY_STATE: _case.debtor.state,
      PY_ZIP: _case.debtor.zip,
      PY_COUNTRY: _case.debtor.country,
      PY_PHONENO: _case.debtor.phone,
      PY_FAX_PHONE: _case.debtor.fax,
      PY_E_MAIL: _case.debtor.email,
      PY_PROSE: _case.debtor.prose,
      PY_END_DATE: _case.debtor.endDate,
      SSN_EVENT: _case.debtor.ssnEvent,
      NAME_EVENT: _case.debtor.nameEvent,
      ADDRESS_EVENT: _case.debtor.addressEvent,
    });
    partyRecord.validate();
    dbRecords.AO_PY.push(partyRecord);

    const debtorAttorneyRecord = new AO_AT_Record({
      CS_CASEID: _case.dxtrId,
      COURT_ID: _case.courtId,
      PY_ROLE: _case.debtor.role,
      AT_LAST_NAME: _case.debtorAttorney.lastName,
      AT_MIDDLE_NAME: _case.debtorAttorney.middleName,
      AT_FIRST_NAME: _case.debtorAttorney.firstName,
      AT_GENERATION: _case.debtorAttorney.generation,
      AT_ADDRESS1: _case.debtorAttorney.address1,
      AT_ADDRESS2: _case.debtorAttorney.address2,
      AT_ADDRESS3: _case.debtorAttorney.address3,
      AT_CITY: _case.debtorAttorney.city,
      AT_STATE: _case.debtorAttorney.state,
      AT_ZIP: _case.debtorAttorney.zip,
      AT_COUNTRY: _case.debtorAttorney.country,
      AT_PHONENO: _case.debtorAttorney.phone,
    });
    debtorAttorneyRecord.validate();
    dbRecords.AO_AT.push(debtorAttorneyRecord);
  });
  return dbRecords;
}

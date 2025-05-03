import { AO_AT_Record } from '../tables/AO_AT';
import { AO_CS_Record } from '../tables/AO_CS';
import { AO_PY_Record } from '../tables/AO_PY';
import { AO_TX_Record, buildRecFromTxRecord, buildRecType1 } from '../tables/AO_TX';
import { DatabaseRecords, emptyDatabaseRecords } from '../tables/common';
import { Chapter, DebtorType, TxCode } from '../types';

export interface BCase {
  caseId: string;
  cfValue?: string;
  chapter: Chapter;
  county: string;
  courtId: string;
  dateConvert?: string;
  dateDischarge?: string;
  dateDismiss?: string;
  dateFiled: string;
  dateLastEnter?: string;
  dateReopen?: string;
  dateTerm?: string;
  debtor: BCaseParty;
  debtorAttorney: DebtorAttorney;
  debtorType: DebtorType;
  div: string;
  dxtrId: string;
  group: string;
  judge?: Judge;
  reopenCode: string;
  shortTitle: string;
  transactions: Array<BCaseTransactionTypeOrder>;
}

export interface BCaseParty {
  address1?: string;
  address2?: string;
  address3?: string;
  addressEvent?: string;
  city?: string;
  country?: string;
  email?: string;
  endDate?: string;
  fax?: string;
  firstName?: string;
  generation?: string;
  lastName: string;
  middleName?: string;
  nameEvent?: string;
  phone?: string;
  prose?: string;
  role: string;
  ssn?: string;
  ssnEvent?: string;
  state?: string;
  taxId?: string;
  zip?: string;
}

export type BCaseTransaction = BCaseTransactionType1 | BCaseTransactionTypeOrder;

export type BCaseTransactionType1 = {
  code: '1';
  date: string;
  debtorType: DebtorType;
  txType: '1';
};

export type BCaseTransactionTypeOrder = {
  code: TxCode;
  date: string;
  meta: string;
  txType: 'O';
};

export interface DebtorAttorney {
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  country?: string;
  firstName?: string;
  generation?: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  state?: string;
  zip?: string;
}

export interface Judge {
  firstName: string;
  lastName: string;
  middleName?: string;
}

export function toDbRecords(bCase: Array<BCase> | BCase): DatabaseRecords {
  const dbRecords = emptyDatabaseRecords();
  const caseList = bCase instanceof Array ? bCase : [bCase];
  caseList.forEach((_case) => {
    dbRecords.AO_CS.push(
      new AO_CS_Record({
        CASE_ID: _case.caseId,
        CF_VALUE: _case.cfValue,
        COURT_ID: _case.courtId,
        CS_CASE_NUMBER: _case.caseId.split('-')[1],
        CS_CASEID: _case.dxtrId,
        CS_CHAPTER: _case.chapter,
        CS_COUNTY: _case.county,
        CS_DATE_CONVERT: _case.dateConvert,
        CS_DATE_DISCHARGE: _case.dateDischarge,
        CS_DATE_DISMISS: _case.dateDismiss,
        CS_DATE_FILED: _case.dateFiled,
        CS_DATE_REOPEN: _case.dateReopen,
        CS_DATE_TERM: _case.dateReopen,
        CS_DISP_METHOD: 'Discharge Not Applicable',
        CS_DIV: _case.div,
        CS_FEE_STATUS: 'p',
        CS_JOINT: 'n',
        CS_REOPEN_CODE: _case.reopenCode,
        CS_SHORT_TITLE: _case.shortTitle,
        CS_TYPE: 'bk',
        CS_VOL_INVOL: 'v',
        GRP_DES: _case.group,
        JD_FIRST_NAME: _case.judge?.firstName,
        JD_LAST_NAME: _case.judge?.lastName,
        JD_MIDDLE_NAME: _case.judge?.middleName,
      }),
    );
    const type1Transaction = new AO_TX_Record({
      CASE_ID: _case.caseId,
      COURT_ID: _case.courtId,
      CS_CASEID: _case.dxtrId,
      DE_SEQNO: 0,
      JOB_ID: 0,
      REC: buildRecType1(_case.chapter, _case.debtorType),
      TX_CODE: '1',
      TX_DATE: _case.dateFiled,
      TX_TYPE: '1',
    });
    dbRecords.AO_TX.push(type1Transaction);
    _case.transactions?.forEach((txn, idx) => {
      const sequence = idx + 1; // Add one because the 0 element is the debtor type.
      const record = new AO_TX_Record({
        CASE_ID: _case.caseId,
        COURT_ID: _case.courtId,
        CS_CASEID: _case.dxtrId,
        DE_SEQNO: sequence,
        JOB_ID: sequence,
        TX_CODE: txn.code,
        TX_DATE: txn.date,
        TX_TYPE: txn.txType,
      });
      if (txn.txType === 'O') {
        record.REC = buildRecFromTxRecord(record, _case.div, _case.chapter, txn.meta);
      }
      record.validate();
      dbRecords.AO_TX.push(record);
    });

    const partyRecord = new AO_PY_Record({
      ADDRESS_EVENT: _case.debtor.addressEvent,
      COURT_ID: _case.courtId,
      CS_CASEID: _case.dxtrId,
      NAME_EVENT: _case.debtor.nameEvent,
      PY_ADDRESS1: _case.debtor.address1,
      PY_ADDRESS2: _case.debtor.address2,
      PY_ADDRESS3: _case.debtor.address3,
      PY_CITY: _case.debtor.city,
      PY_COUNTRY: _case.debtor.country,
      PY_E_MAIL: _case.debtor.email,
      PY_END_DATE: _case.debtor.endDate,
      PY_FAX_PHONE: _case.debtor.fax,
      PY_FIRST_NAME: _case.debtor.firstName,
      PY_GENERATION: _case.debtor.generation,
      PY_LAST_NAME: _case.debtor.lastName,
      PY_MIDDLE_NAME: _case.debtor.middleName,
      PY_PHONENO: _case.debtor.phone,
      PY_PROSE: _case.debtor.prose,
      PY_ROLE: _case.debtor.role,
      PY_SSN: _case.debtor.ssn,
      PY_STATE: _case.debtor.state,
      PY_TAXID: _case.debtor.taxId,
      PY_ZIP: _case.debtor.zip,
      SSN_EVENT: _case.debtor.ssnEvent,
    });
    partyRecord.validate();
    dbRecords.AO_PY.push(partyRecord);

    const debtorAttorneyRecord = new AO_AT_Record({
      AT_ADDRESS1: _case.debtorAttorney.address1,
      AT_ADDRESS2: _case.debtorAttorney.address2,
      AT_ADDRESS3: _case.debtorAttorney.address3,
      AT_CITY: _case.debtorAttorney.city,
      AT_COUNTRY: _case.debtorAttorney.country,
      AT_FIRST_NAME: _case.debtorAttorney.firstName,
      AT_GENERATION: _case.debtorAttorney.generation,
      AT_LAST_NAME: _case.debtorAttorney.lastName,
      AT_MIDDLE_NAME: _case.debtorAttorney.middleName,
      AT_PHONENO: _case.debtorAttorney.phone,
      AT_STATE: _case.debtorAttorney.state,
      AT_ZIP: _case.debtorAttorney.zip,
      COURT_ID: _case.courtId,
      CS_CASEID: _case.dxtrId,
      PY_ROLE: _case.debtor.role,
    });
    debtorAttorneyRecord.validate();
    dbRecords.AO_AT.push(debtorAttorneyRecord);
  });
  return dbRecords;
}

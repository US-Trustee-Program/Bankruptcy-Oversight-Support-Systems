import { CasesInterface } from '../../../use-cases/cases.interface';
import { ApplicationContext } from '../../types/basic';
import {
  CaseDetailInterface,
  Party,
  DxtrTransactionRecord,
  TransactionDates,
  DebtorAttorney,
} from '../../types/cases';
import {
  getMonthDayYearStringFromDate,
  getYearMonthDayStringFromDate,
  sortDates,
} from '../../utils/date-helper';
import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import * as mssql from 'mssql';
import log from '../../services/logger.service';
import { handleQueryResult } from '../gateway-helper';
import { parseDebtorType, parsePetitionType, parseTransactionDate } from './dxtr.gateway.helper';
import { removeExtraSpaces } from '../../utils/string-helper';

const MODULENAME = 'CASES-DXTR-GATEWAY';

const MANHATTAN_GROUP_DESIGNATOR = 'NY';
const closedByCourtTxCode = 'CBC';
const dismissedByCourtTxCode = 'CDC';
const reopenedDate = 'OCO';

function sqlSelectList(top: string, chapter: string) {
  // THIS SETS US UP FOR SQL INJECTION IF WE EVER ACCEPT top OR chapter FROM USER INPUT.
  return `
    select TOP ${top}
    CS_DIV+'-'+CASE_ID as caseId,
    CS_SHORT_TITLE as caseTitle,
    CS_CHAPTER as chapter,
    FORMAT(CS_DATE_FILED, 'MM-dd-yyyy') as dateFiled
    FROM [dbo].[AO_CS]
    WHERE CS_CHAPTER = '${chapter}'
    AND GRP_DES = @groupDesignator
    AND CS_DATE_FILED >= Convert(datetime, @dateFiledFrom)
  `;
}
function sqlUnion(query1: string, query2: string) {
  return `${query1} UNION ALL ${query2}`;
}

export default class CasesDxtrGateway implements CasesInterface {
  async getCaseDetail(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailInterface> {
    const courtDiv = caseId.slice(0, 3);
    const dxtrCaseId = caseId.slice(4);

    const bCase = await this.queryCase(applicationContext, courtDiv, dxtrCaseId);

    const transactionDates = await this.queryTransactions(
      applicationContext,
      bCase.dxtrId,
      bCase.courtId,
    );
    if (transactionDates.closedDates.length > 0) {
      bCase.closedDate = getMonthDayYearStringFromDate(transactionDates.closedDates[0]);
    }

    if (transactionDates.dismissedDates.length > 0) {
      bCase.dismissedDate = getMonthDayYearStringFromDate(transactionDates.dismissedDates[0]);
    }

    if (transactionDates.reopenedDates.length > 0) {
      bCase.reopenedDate = getMonthDayYearStringFromDate(transactionDates.reopenedDates[0]);
    }

    bCase.debtor = await this.queryParties(applicationContext, bCase.dxtrId, bCase.courtId);
    bCase.debtorAttorney = await this.queryDebtorAttorney(
      applicationContext,
      bCase.dxtrId,
      bCase.courtId,
    );

    bCase.debtorTypeLabel = await this.queryDebtorTypeLabel(
      applicationContext,
      bCase.dxtrId,
      bCase.courtId,
    );

    bCase.petitionLabel = await this.queryPetitionLabel(
      applicationContext,
      bCase.dxtrId,
      bCase.courtId,
    );

    return bCase;
  }

  async getCases(
    applicationContext: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]> {
    const doChapter12Enable = applicationContext.featureFlags['chapter-twelve-enabled'];
    const rowsToReturn = doChapter12Enable ? '10' : '20';

    const input: DbTableFieldSpec[] = [];
    const date = new Date();
    date.setMonth(date.getMonth() + (options.startingMonth || -6));
    const dateFiledFrom = getYearMonthDayStringFromDate(date);
    input.push({
      name: 'top',
      type: mssql.Int,
      value: rowsToReturn,
    });
    input.push({
      name: 'dateFiledFrom',
      type: mssql.Date,
      value: dateFiledFrom,
    });
    input.push({
      name: 'groupDesignator',
      type: mssql.Char,
      value: MANHATTAN_GROUP_DESIGNATOR,
    });
    const query = doChapter12Enable
      ? sqlUnion(sqlSelectList(rowsToReturn, '15'), sqlSelectList(rowsToReturn, '12'))
      : sqlSelectList(rowsToReturn, '15');

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<CaseDetailInterface[]>(
        applicationContext,
        queryResult,
        MODULENAME,
        this.casesQueryCallback,
      ),
    );
  }

  private async queryCase(
    applicationContext: ApplicationContext,
    courtDiv: string,
    dxtrCaseId: string,
  ): Promise<CaseDetailInterface> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'courtDiv',
      type: mssql.VarChar,
      value: courtDiv,
    });

    input.push({
      name: 'dxtrCaseId',
      type: mssql.VarChar,
      value: dxtrCaseId,
    });

    const CASE_DETAIL_QUERY = `SELECT
        cs.CS_DIV as courtDivision,
        cs.CS_DIV+'-'+cs.CASE_ID as caseId,
        cs.CS_SHORT_TITLE as caseTitle,
        FORMAT(cs.CS_DATE_FILED, 'MM-dd-yyyy') as dateFiled,
        cs.CS_CASEID as dxtrId,
        cs.CS_CHAPTER as chapter,
        cs.COURT_ID as courtId,
        court.COURT_NAME as courtName,
        office.OFFICE_NAME as courtDivisionName,
        TRIM(CONCAT(cs.JD_FIRST_NAME, ' ', cs.JD_MIDDLE_NAME, ' ', cs.JD_LAST_NAME)) as judgeName,
        grp_des.REGION_ID as regionId
        FROM [dbo].[AO_CS] AS cs
        JOIN [dbo].[AO_GRP_DES] AS grp_des
          ON cs.GRP_DES = grp_des.GRP_DES
        JOIN [dbo].[AO_COURT] AS court
          ON cs.COURT_ID = court.COURT_ID
        JOIN [dbo].[AO_CS_DIV] AS cs_div
          ON cs.CS_DIV = cs_div.CS_DIV
        JOIN [dbo].[AO_OFFICE] AS office
          ON cs.COURT_ID = office.COURT_ID
          AND cs_div.OFFICE_CODE = office.OFFICE_CODE
        WHERE cs.CASE_ID = @dxtrCaseId
        AND cs.CS_DIV = @courtDiv`;

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      CASE_DETAIL_QUERY,
      input,
    );

    return Promise.resolve(
      handleQueryResult<CaseDetailInterface>(
        applicationContext,
        queryResult,
        MODULENAME,
        this.caseDetailsQueryCallback,
      ),
    );
  }

  private async queryTransactions(
    applicationContext: ApplicationContext,
    dxtrId: string,
    courtId: string,
  ): Promise<TransactionDates> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'dxtrId',
      type: mssql.VarChar,
      value: dxtrId,
    });

    input.push({
      name: 'courtId',
      type: mssql.VarChar,
      value: courtId,
    });

    input.push({
      name: 'closedByCourtTxCode',
      type: mssql.VarChar,
      value: closedByCourtTxCode,
    });

    input.push({
      name: 'dismissedByCourtTxCode',
      type: mssql.VarChar,
      value: dismissedByCourtTxCode,
    });

    input.push({
      name: 'reopenedDate',
      type: mssql.VarChar,
      value: reopenedDate,
    });

    const query = `select
      REC as txRecord,
      TX_CODE as txCode
      FROM [dbo].[AO_TX]
      WHERE CS_CASEID = @dxtrId
      AND COURT_ID = @courtId
      AND TX_TYPE = 'O'
      AND TX_CODE in (@closedByCourtTxCode, @dismissedByCourtTxCode, @reopenedDate)`;

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<TransactionDates>(
        applicationContext,
        queryResult,
        MODULENAME,
        this.transactionQueryCallback,
      ),
    );
  }

  private async queryDebtorTypeLabel(
    applicationContext: ApplicationContext,
    dxtrId: string,
    courtId: string,
  ): Promise<string> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'dxtrId',
      type: mssql.VarChar,
      value: dxtrId,
    });

    input.push({
      name: 'courtId',
      type: mssql.VarChar,
      value: courtId,
    });

    const query = `select
      REC as txRecord,
      TX_CODE as txCode
      FROM [dbo].[AO_TX]
      WHERE CS_CASEID = @dxtrId
      AND COURT_ID = @courtId
      AND TX_TYPE = '1'
    `;

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<string>(
        applicationContext,
        queryResult,
        MODULENAME,
        this.debtorTypeLabelCallback,
      ),
    );
  }

  private async queryPetitionLabel(
    applicationContext: ApplicationContext,
    dxtrId: string,
    courtId: string,
  ): Promise<string> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'dxtrId',
      type: mssql.VarChar,
      value: dxtrId,
    });

    input.push({
      name: 'courtId',
      type: mssql.VarChar,
      value: courtId,
    });

    const query = `select
      REC as txRecord,
      TX_CODE as txCode
      FROM [dbo].[AO_TX]
      WHERE CS_CASEID = @dxtrId
      AND COURT_ID = @courtId
      AND TX_TYPE = '1'
    `;

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<string>(
        applicationContext,
        queryResult,
        MODULENAME,
        this.petitionLabelCallback,
      ),
    );
  }

  private async queryParties(
    applicationContext: ApplicationContext,
    dxtrId: string,
    courtId: string,
  ): Promise<Party> {
    const debtorPartyCode = 'db';
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'dxtrId',
      type: mssql.VarChar,
      value: dxtrId,
    });

    input.push({
      name: 'courtId',
      type: mssql.VarChar,
      value: courtId,
    });

    input.push({
      name: 'debtorPartyCode',
      type: mssql.VarChar,
      value: debtorPartyCode,
    });

    const query = `SELECT
        TRIM(CONCAT(
          PY_FIRST_NAME,
          ' ',
          PY_MIDDLE_NAME,
          ' ',
          PY_LAST_NAME,
          ' ',
          PY_GENERATION
        )) as name,
        PY_ADDRESS1 as address1,
        PY_ADDRESS2 as address2,
        PY_ADDRESS3 as address3,
        TRIM(CONCAT(
          PY_CITY,
          ' ',
          PY_STATE,
          ' ',
          PY_ZIP,
          ' ',
          PY_COUNTRY
        )) as cityStateZipCountry,
        PY_TAXID as taxId,
        PY_SSN as ssn
      FROM [dbo].[AO_PY]
      WHERE
        CS_CASEID = @dxtrId AND
        COURT_ID = @courtId AND
        PY_ROLE = @debtorPartyCode
    `;

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<Party>(
        applicationContext,
        queryResult,
        MODULENAME,
        this.partyQueryCallback,
      ),
    );
  }
  private async queryDebtorAttorney(
    context: ApplicationContext,
    dxtrId: string,
    courtId: string,
  ): Promise<DebtorAttorney> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'dxtrId',
      type: mssql.VarChar,
      value: dxtrId,
    });

    input.push({
      name: 'courtId',
      type: mssql.VarChar,
      value: courtId,
    });

    const query = `SELECT
        TRIM(CONCAT(
          AT_FIRST_NAME,
          ' ',
          AT_MIDDLE_NAME,
          ' ',
          AT_LAST_NAME,
          ' ',
          AT_GENERATION
        )) as name,
        AT_ADDRESS1 as address1,
        AT_ADDRESS2 as address2,
        AT_ADDRESS3 as address3,
        TRIM(CONCAT(
          AT_CITY,
          ' ',
          AT_STATE,
          ' ',
          AT_ZIP,
          ' ',
          AT_COUNTRY
        )) as cityStateZipCountry,
        AT_PHONENO as phone,
        AT_E_MAIL as email
      FROM [dbo].[AO_AT]
      WHERE
        CS_CASEID = @dxtrId AND
        COURT_ID = @courtId AND
        PY_ROLE = 'db'
    `;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<DebtorAttorney>(
        context,
        queryResult,
        MODULENAME,
        this.debtorAttorneyQueryCallback,
      ),
    );
  }

  debtorAttorneyQueryCallback(context: ApplicationContext, queryResult: QueryResults) {
    let debtorAttorney: DebtorAttorney;

    (queryResult.results as mssql.IResult<DebtorAttorney>).recordset.forEach((record) => {
      debtorAttorney = { name: removeExtraSpaces(record.name) };
      debtorAttorney.address1 = record.address1;
      debtorAttorney.address2 = record.address2;
      debtorAttorney.address3 = record.address3;
      debtorAttorney.cityStateZipCountry = removeExtraSpaces(record.cityStateZipCountry);
      debtorAttorney.phone = record.phone;
      debtorAttorney.email = record.email;
    });
    return debtorAttorney || null;
  }

  partyQueryCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    let debtor: Party;
    log.debug(applicationContext, MODULENAME, `Party results received from DXTR:`, queryResult);

    (queryResult.results as mssql.IResult<Party>).recordset.forEach((record) => {
      debtor = { name: removeExtraSpaces(record.name) };
      debtor.address1 = record.address1;
      debtor.address2 = record.address2;
      debtor.address3 = record.address3;
      debtor.cityStateZipCountry = removeExtraSpaces(record.cityStateZipCountry);
      debtor.taxId = record.taxId;
      debtor.ssn = record.ssn;
    });
    return debtor || null;
  }

  transactionQueryCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    const closedDates: Date[] = [];
    const dismissedDates: Date[] = [];
    const reopenedDates: Date[] = [];
    log.debug(
      applicationContext,
      MODULENAME,
      `Transaction results received from DXTR:`,
      queryResult,
    );
    (queryResult.results as mssql.IResult<DxtrTransactionRecord>).recordset.forEach((record) => {
      const transactionDate = parseTransactionDate(record);

      if (record.txCode === closedByCourtTxCode) {
        closedDates.push(transactionDate);
      } else if (record.txCode === dismissedByCourtTxCode) {
        dismissedDates.push(transactionDate);
      } else {
        reopenedDates.push(transactionDate);
      }
    });

    sortDates(closedDates);
    sortDates(dismissedDates);
    sortDates(reopenedDates);

    return { closedDates, dismissedDates, reopenedDates } as TransactionDates;
  }

  debtorTypeLabelCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    log.debug(
      applicationContext,
      MODULENAME,
      `Transaction results received from DXTR:`,
      queryResult,
    );
    const debtorTypeRecord = (queryResult.results as mssql.IResult<DxtrTransactionRecord>)
      .recordset[0];
    return parseDebtorType(debtorTypeRecord);
  }

  petitionLabelCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    log.debug(
      applicationContext,
      MODULENAME,
      `Transaction results received from DXTR:`,
      queryResult,
    );
    const petitionTypeRecord = (queryResult.results as mssql.IResult<DxtrTransactionRecord>)
      .recordset[0];
    return parsePetitionType(petitionTypeRecord);
  }

  caseDetailsQueryCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    log.debug(applicationContext, MODULENAME, `Case results received from DXTR:`, queryResult);

    return (queryResult.results as mssql.IResult<CaseDetailInterface>).recordset[0];
  }

  casesQueryCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    log.debug(applicationContext, MODULENAME, `Results received from DXTR `, queryResult);

    return (queryResult.results as mssql.IResult<CaseDetailInterface[]>).recordset;
  }
}

import * as mssql from 'mssql';
import { CasesInterface } from '../../../use-cases/cases.interface';
import { ApplicationContext } from '../../types/basic';
import { DxtrTransactionRecord, TransactionDates } from '../../types/cases';
import { getMonthDayYearStringFromDate, sortListOfDates } from '../../utils/date-helper';
import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { handleQueryResult } from '../gateway-helper';
import { decomposeCaseId, parseTransactionDate } from './dxtr.gateway.helper';
import { removeExtraSpaces } from '../../utils/string-helper';
import { getDebtorTypeLabel } from '../debtor-type-gateway';
import { getPetitionInfo } from '../petition-gateway';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CamsError } from '../../../common-errors/cams-error';
import { CasesSearchPredicate, DEFAULT_SEARCH_LIMIT } from '../../../../../common/src/api/search';
import { CaseBasics, CaseDetail, CaseSummary } from '../../../../../common/src/cams/cases';
import { Party, DebtorAttorney } from '../../../../../common/src/cams/parties';

const MODULE_NAME = 'CASES-DXTR-GATEWAY';

const closedByCourtTxCode = 'CBC';
const dismissedByCourtTxCode = 'CDC';
const reopenedDateTxCode = 'OCO';

export function getCaseIdParts(caseId: string) {
  const parts = caseId.split('-');
  const divisionCode = parts[0];
  const caseNumber = `${parts[1]}-${parts[2]}`;
  return { divisionCode, caseNumber };
}
export default class CasesDxtrGateway implements CasesInterface {
  async getCaseDetail(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail> {
    const caseSummary = await this.getCaseSummary(applicationContext, caseId);
    const bCase: CaseDetail = {
      ...caseSummary,
    };

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

    bCase.debtorAttorney = await this.queryDebtorAttorney(
      applicationContext,
      bCase.dxtrId,
      bCase.courtId,
    );

    return bCase;
  }

  public async getSuggestedCases(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseSummary[]> {
    const input: DbTableFieldSpec[] = [];
    const bCase = await this.getCaseSummary(applicationContext, caseId);

    input.push({
      name: 'taxId',
      type: mssql.VarChar,
      value: bCase.debtor.taxId,
    });

    input.push({
      name: 'ssn',
      type: mssql.VarChar,
      value: bCase.debtor.ssn,
    });

    input.push({
      name: 'caseTitle',
      type: mssql.VarChar,
      value: bCase.caseTitle,
    });

    input.push({
      name: 'debtorName',
      type: mssql.VarChar,
      value: bCase.debtor.name,
    });

    input.push({
      name: 'chapter',
      type: mssql.VarChar,
      value: bCase.chapter,
    });

    input.push({
      name: 'dateFiled',
      type: mssql.Date,
      value: bCase.dateFiled,
    });

    input.push({
      name: 'originalCourt',
      type: mssql.VarChar,
      value: bCase.courtId,
    });

    input.push({
      name: 'originalDivision',
      type: mssql.VarChar,
      value: bCase.courtDivisionCode,
    });

    const CASE_SUGGESTION_QUERY = `SELECT
        cs_div.CS_DIV_ACMS as courtDivisionCode,
        cs_div.CS_DIV_ACMS+'-'+cs.CASE_ID as caseId,
        cs.CS_SHORT_TITLE as caseTitle,
        FORMAT(cs.CS_DATE_FILED, 'yyyy-MM-dd') as dateFiled,
        cs.CS_CASEID as dxtrId,
        cs.CS_CHAPTER as chapter,
        cs.COURT_ID as courtId,
        court.COURT_NAME as courtName,
        office.OFFICE_NAME_DISPLAY as courtDivisionName,
        TRIM(CONCAT(cs.JD_FIRST_NAME, ' ', cs.JD_MIDDLE_NAME, ' ', cs.JD_LAST_NAME)) as judgeName,
        TRIM(CONCAT(
          PY_FIRST_NAME,
          ' ',
          PY_MIDDLE_NAME,
          ' ',
          PY_LAST_NAME,
          ' ',
          PY_GENERATION
        )) as partyName,
        grp_des.REGION_ID as regionId,
        R.REGION_NAME AS regionName,
        TX.petitionCode,
        TX.debtorTypeCode
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
        JOIN [dbo].[AO_PY] AS party
          ON party.CS_CASEID = cs.CS_CASEID AND party.COURT_ID = cs.COURT_ID AND party.PY_ROLE = 'db'
        JOIN [dbo].[AO_REGION] AS R ON grp_des.REGION_ID = R.REGION_ID
        JOIN (
          SELECT DISTINCT
          T1.COURT_ID,
          T1.CS_CASEID,
          substring(REC,108,2) AS petitionCode,
          substring(REC,34,2) AS debtorTypeCode
          FROM [dbo].[AO_CS] AS C1
          JOIN [dbo].[AO_CS_DIV] AS C2 ON C1.CS_DIV = C2.CS_DIV
          JOIN [dbo].[AO_TX] AS T1 ON T1.CS_CASEID=C1.CS_CASEID AND T1.COURT_ID=C1.COURT_ID AND T1.TX_TYPE='1' AND T1.TX_CODE='1'
          JOIN [dbo].[AO_PY] AS P1
          ON P1.CS_CASEID = C1.CS_CASEID AND P1.COURT_ID = C1.COURT_ID AND P1.PY_ROLE = 'db'
          WHERE (
            P1.PY_TAXID = @taxId OR P1.PY_SSN = @ssn
            OR c1.CS_SHORT_TITLE = @caseTitle
            OR TRIM(CONCAT(
              PY_FIRST_NAME,
              ' ',
              PY_MIDDLE_NAME,
              ' ',
              PY_LAST_NAME,
              ' ',
              PY_GENERATION
            )) = @debtorName
          )
          AND C1.CS_CHAPTER = @chapter
          AND C1.CS_DATE_FILED >= @datefiled
          AND (C1.COURT_ID != @originalCourt
              OR C2.CS_DIV_ACMS != @originalDivision)
        ) AS TX ON TX.COURT_ID=CS.COURT_ID AND TX.CS_CASEID=CS.CS_CASEID
        ORDER BY
          cs.CS_DATE_FILED DESC`;

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      CASE_SUGGESTION_QUERY,
      input,
    );

    if (queryResult.success) {
      const transferPetitionCode = ['TI', 'TV'];
      const suggestedCases = this.casesQueryCallback(applicationContext, queryResult);
      for (const sCase of suggestedCases) {
        sCase.debtorTypeLabel = getDebtorTypeLabel(sCase.debtorTypeCode);
        sCase.petitionLabel = getPetitionInfo(sCase.petitionCode).petitionLabel;
        if (transferPetitionCode.includes(sCase.petitionCode)) {
          sCase.debtor = await this.queryParties(applicationContext, sCase.dxtrId, sCase.courtId);
        }
      }
      return suggestedCases.filter((sc) => transferPetitionCode.includes(sc.petitionCode));
    } else {
      throw new CamsError(MODULE_NAME, { message: queryResult.message });
    }
  }

  public async searchCases(
    context: ApplicationContext,
    predicate: CasesSearchPredicate,
  ): Promise<CaseBasics[]> {
    const CASE_SEARCH_SELECT = `
      SELECT
      cs_div.CS_DIV_ACMS as courtDivisionCode,
      cs_div.CS_DIV_ACMS+'-'+cs.CASE_ID as caseId,
      cs.CS_SHORT_TITLE as caseTitle,
      FORMAT(cs.CS_DATE_FILED, 'yyyy-MM-dd') as dateFiled,
      cs.CS_CASEID as dxtrId,
      cs.CS_CHAPTER as chapter,
      cs.COURT_ID as courtId,
      court.COURT_NAME as courtName,
      office.OFFICE_NAME_DISPLAY as courtDivisionName,
      TRIM(CONCAT(cs.JD_FIRST_NAME, ' ', cs.JD_MIDDLE_NAME, ' ', cs.JD_LAST_NAME)) as judgeName,
      TRIM(CONCAT(
        PY_FIRST_NAME,
        ' ',
        PY_MIDDLE_NAME,
        ' ',
        PY_LAST_NAME,
        ' ',
        PY_GENERATION
      )) as partyName,
      grp_des.REGION_ID as regionId,
      R.REGION_NAME AS regionName,
      substring(tx.REC,108,2) AS petitionCode,
      substring(tx.REC,34,2) AS debtorTypeCode
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
      JOIN [dbo].[AO_PY] AS party
        ON party.CS_CASEID = cs.CS_CASEID AND party.COURT_ID = cs.COURT_ID AND party.PY_ROLE = 'db'
      JOIN [dbo].[AO_REGION] AS R ON grp_des.REGION_ID = R.REGION_ID
      JOIN [dbo].[AO_TX] AS tx ON tx.CS_CASEID=cs.CS_CASEID AND tx.COURT_ID=cs.COURT_ID AND tx.TX_TYPE='1' AND tx.TX_CODE='1'`;

    const CASE_SEARCH_QUERY_ORDER =
      'ORDER BY cs.CS_DATE_FILED DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';

    const conditions: string[] = [];
    const params: DbTableFieldSpec[] = [];

    const recordCount = predicate.limit ? predicate.limit + 1 : DEFAULT_SEARCH_LIMIT + 1;
    params.push({
      name: `limit`,
      type: mssql.Int,
      value: recordCount,
    });
    params.push({
      name: `offset`,
      type: mssql.Int,
      value: predicate.offset ?? 0,
    });

    if (predicate.caseNumber) {
      params.push({
        name: 'caseNumber',
        type: mssql.VarChar,
        value: predicate.caseNumber,
      });
      conditions.push("cs.CASE_ID LIKE @caseNumber+'%' ");
    }
    if (!predicate.caseNumber && predicate.caseIds && predicate.caseIds.length > 0) {
      const divisionsAndCaseNumbers = predicate.caseIds.reduce((acc, caseId) => {
        const { divisionCode, caseNumber } = getCaseIdParts(caseId);
        let caseNumbers;
        if (acc.has(divisionCode)) {
          caseNumbers = acc.get(divisionCode);
        } else {
          caseNumbers = [];
        }
        caseNumbers.push(caseNumber);
        acc.set(divisionCode, caseNumbers);
        return acc;
      }, new Map<string, string[]>());
      const divisionAndCaseNumberParams = [];

      divisionsAndCaseNumbers.forEach((caseNumbers, divisionCode) => {
        divisionAndCaseNumberParams.push(
          `( cs_div.CS_DIV_ACMS = '${divisionCode}' AND cs.CASE_ID IN ('${caseNumbers.join("', '")}')) `,
        );
      });
      conditions.push(`(${divisionAndCaseNumberParams.join(' OR ')})`);
    }

    if (predicate.divisionCodes) {
      predicate.divisionCodes.forEach((divisionCode, idx) => {
        params.push({
          name: `divisionCode${idx}`,
          type: mssql.VarChar,
          value: divisionCode,
        });
      });
      const divisionCodeVars = predicate.divisionCodes
        .map((_, idx) => `@divisionCode${idx}`)
        .join(', ');
      if (divisionCodeVars.length) {
        conditions.push(`cs_div.CS_DIV_ACMS IN (${divisionCodeVars})`);
      }
    }
    const chapters: string[] = [];
    if (predicate.chapters) {
      for (const chapter of predicate.chapters) {
        chapters.push(chapter);
      }
    } else {
      chapters.push('15');
    }

    conditions.push(`cs.CS_CHAPTER IN ('${chapters.join("', '")}')`);

    const CASE_SEARCH_QUERY_PREDICATE =
      conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const CASE_SEARCH_QUERY = [
      CASE_SEARCH_SELECT,
      CASE_SEARCH_QUERY_PREDICATE,
      CASE_SEARCH_QUERY_ORDER,
    ].join(' ');

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      CASE_SEARCH_QUERY,
      params,
    );

    if (queryResult.success) {
      const foundCases = this.casesBasicQueryCallback(context, queryResult);
      for (const sCase of foundCases) {
        sCase.debtorTypeLabel = getDebtorTypeLabel(sCase.debtorTypeCode);
        sCase.petitionLabel = getPetitionInfo(sCase.petitionCode).petitionLabel;
      }
      return foundCases;
    } else {
      throw new CamsError(MODULE_NAME, { message: queryResult.message });
    }
  }

  async getCaseSummary(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseSummary> {
    const { courtDiv, dxtrCaseId } = decomposeCaseId(caseId);
    const bCase = await this.queryCase(applicationContext, courtDiv, dxtrCaseId);

    if (!bCase) {
      throw new NotFoundError(MODULE_NAME, {
        message: `Case summary not found for case ID: ${caseId}.`,
      });
    }
    bCase.debtor = await this.queryParties(applicationContext, bCase.dxtrId, bCase.courtId);
    bCase.debtorTypeLabel = getDebtorTypeLabel(bCase.debtorTypeCode);
    bCase.petitionLabel = getPetitionInfo(bCase.petitionCode).petitionLabel;
    return bCase;
  }

  private async queryCase(
    applicationContext: ApplicationContext,
    courtDiv: string,
    dxtrCaseId: string,
  ): Promise<CaseSummary> {
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
        cs_div.CS_DIV_ACMS as courtDivisionCode,
        cs_div.CS_DIV_ACMS+'-'+cs.CASE_ID as caseId,
        cs.CS_SHORT_TITLE as caseTitle,
        FORMAT(cs.CS_DATE_FILED, 'yyyy-MM-dd') as dateFiled,
        cs.CS_CASEID as dxtrId,
        cs.CS_CHAPTER as chapter,
        cs.COURT_ID as courtId,
        court.COURT_NAME as courtName,
        office.OFFICE_NAME_DISPLAY as courtDivisionName,
        TRIM(CONCAT(cs.JD_FIRST_NAME, ' ', cs.JD_MIDDLE_NAME, ' ', cs.JD_LAST_NAME)) as judgeName,
        grp_des.REGION_ID as regionId,
        R.REGION_NAME AS regionName,
        TX.petitionCode,
        TX.debtorTypeCode
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
        JOIN [dbo].[AO_REGION] AS R ON grp_des.REGION_ID = R.REGION_ID
        JOIN (
          SELECT DISTINCT
          T1.COURT_ID,
          T1.CS_CASEID,
          substring(REC,108,2) AS petitionCode,
          substring(REC,34,2) AS debtorTypeCode
          FROM [dbo].[AO_CS] AS C1
          JOIN [dbo].[AO_CS_DIV] AS C2 ON C1.CS_DIV = C2.CS_DIV
          JOIN [dbo].[AO_TX] AS T1 ON T1.CS_CASEID=C1.CS_CASEID AND T1.COURT_ID=C1.COURT_ID AND T1.TX_TYPE='1' AND T1.TX_CODE='1'
          WHERE C1.CASE_ID = @dxtrCaseId
          AND C2.CS_DIV_ACMS = @courtDiv
        ) AS TX ON TX.COURT_ID=CS.COURT_ID AND TX.CS_CASEID=CS.CS_CASEID
        ORDER BY
          cs.CS_DATE_FILED DESC`;

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      CASE_DETAIL_QUERY,
      input,
    );

    return Promise.resolve(
      handleQueryResult<CaseSummary>(
        applicationContext,
        queryResult,
        MODULE_NAME,
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
      value: reopenedDateTxCode,
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
        MODULE_NAME,
        this.transactionQueryCallback,
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
        MODULE_NAME,
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

    const query = `
      SELECT
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
        AT_E_MAIL as email,
        AT_OFFICE as office
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
        MODULE_NAME,
        this.debtorAttorneyQueryCallback,
      ),
    );
  }

  debtorAttorneyQueryCallback(_context: ApplicationContext, queryResult: QueryResults) {
    let debtorAttorney: DebtorAttorney;

    (queryResult.results as mssql.IResult<DebtorAttorney>).recordset.forEach((record) => {
      debtorAttorney = { name: removeExtraSpaces(record.name) };
      debtorAttorney.address1 = record.address1;
      debtorAttorney.address2 = record.address2;
      debtorAttorney.address3 = record.address3;
      debtorAttorney.cityStateZipCountry = removeExtraSpaces(record.cityStateZipCountry);
      debtorAttorney.phone = record.phone;
      debtorAttorney.email = record.email;
      debtorAttorney.office = record.office;
    });
    return debtorAttorney || null;
  }

  partyQueryCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    let debtor: Party;
    applicationContext.logger.debug(MODULE_NAME, `Party results received from DXTR:`, queryResult);

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
    applicationContext.logger.debug(
      MODULE_NAME,
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

    sortListOfDates(closedDates);
    sortListOfDates(dismissedDates);
    sortListOfDates(reopenedDates);

    return { closedDates, dismissedDates, reopenedDates } as TransactionDates;
  }

  caseDetailsQueryCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    applicationContext.logger.debug(MODULE_NAME, `Case results received from DXTR:`, queryResult);

    return (queryResult.results as mssql.IResult<CaseSummary>).recordset[0];
  }

  casesQueryCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    applicationContext.logger.debug(MODULE_NAME, `Results received from DXTR `, queryResult);

    return (queryResult.results as mssql.IResult<CaseSummary[]>).recordset;
  }

  casesBasicQueryCallback(applicationContext: ApplicationContext, queryResult: QueryResults) {
    applicationContext.logger.debug(MODULE_NAME, `Results received from DXTR `, queryResult);

    return (queryResult.results as mssql.IResult<CaseBasics>).recordset;
  }
}

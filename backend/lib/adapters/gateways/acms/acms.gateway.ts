import * as mssql from 'mssql';
import {
  AcmsConsolidation,
  AcmsConsolidationMemberCase,
  AcmsPredicate,
} from '../../../use-cases/dataflows/migrate-consolidations';
import {
  AcmsGateway,
  AcmsCaseAppointmentRecord,
  AcmsCaseAppointmentRawRecord,
} from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { getCamsError } from '../../../common-errors/error-utilities';
import { DbTableFieldSpec } from '../../types/database';

const MODULE_NAME = 'ACMS-GATEWAY';

function throwCamsError(originalError: unknown): never {
  const normalizedError =
    originalError instanceof Error ? originalError : new Error(String(originalError));
  throw getCamsError(normalizedError, MODULE_NAME);
}

export class AcmsGatewayImpl extends AbstractMssqlClient implements AcmsGateway {
  constructor(context: ApplicationContext) {
    // The context carries different database connection configurations.
    // We pick off the configuration specific to this ACMS gateway.
    const config = context.config.acmsDbConfig;
    super(config, MODULE_NAME);
  }

  async getLeadCaseIds(context: ApplicationContext, predicate: AcmsPredicate): Promise<string[]> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'divisionCode',
      type: mssql.Int,
      value: predicate.divisionCode,
    });

    let query = `
      SELECT ((CASE_DIV * 10000000) + (CASE_YEAR * 100000) + CASE_NUMBER) AS leadCaseId
      FROM [dbo].[CMMDB]
      WHERE CASE_DIV = @divisionCode
      AND (CLOSED_BY_COURT_DATE > 20180101 OR CLOSED_BY_UST_DATE > 20180101 OR (CLOSED_BY_COURT_DATE = 0 and CLOSED_BY_UST_DATE = 0))
      AND CONSOLIDATED_CASE_NUMBER = 0
      AND CONSOLIDATION_TYPE != ' '`;

    // Valid ACMS chapters: 09, 11, 12, 13, 15, 7A, 7N, AC
    // 'AC' is the predecessor to chapter 15. We are not importing these old cases into CAMS.
    // '7A' and '7N' are treated inclusively as chapter 7 cases when importing into CAMS.
    // Leading zero padding is added for chapter 9.

    if (predicate.chapter === '7') {
      query += ` AND CURR_CASE_CHAPT IN ('7A', '7N')`;
    } else {
      query += ` AND CURR_CASE_CHAPT = @chapter`;
      input.push({
        name: 'chapter',
        type: mssql.VarChar,
        value: ('00' + predicate.chapter).slice(-2),
      });
    }

    type ResultType = {
      leadCaseId: string;
    };

    context.logger.debug(MODULE_NAME, `Querying for parameters: ${JSON.stringify(input)}`);
    try {
      const { results } = await this.executeQuery<ResultType>(context, query, input);
      const leadCaseIdsResults = (results as mssql.IResult<ResultType>).recordset;
      return leadCaseIdsResults.map((record) => record.leadCaseId);
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  public async getConsolidationDetails(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsConsolidation> {
    const input: DbTableFieldSpec[] = [];
    input.push({
      name: `leadCaseId`,
      type: mssql.BigInt,
      value: leadCaseId,
    });

    const query = `
      SELECT
        CONCAT(
          RIGHT('000' + CAST(CASE_DIV AS VARCHAR), 3),
          '-',
          RIGHT('00' + CAST(CASE_YEAR AS VARCHAR), 2),
          '-',
          RIGHT('00000' + CAST(CASE_NUMBER AS VARCHAR), 5)
        ) AS caseId,
        CONSOLIDATION_DATE as consolidationDate,
        CONSOLIDATION_TYPE as consolidationType
      FROM [dbo].[CMMDB]
      WHERE CONSOLIDATED_CASE_NUMBER = @leadCaseId`;

    try {
      const results = await this.executeQuery<AcmsConsolidationMemberCase>(context, query, input);
      const rawResults = (results.results as mssql.IResult<AcmsConsolidationMemberCase>).recordset;

      const formattedLeadCaseId = this.formatCaseId(leadCaseId);
      const memberCases = rawResults
        .filter((bCase) => bCase.caseId !== formattedLeadCaseId)
        .map((bCase) => {
          const date = String(bCase.consolidationDate);
          return {
            ...bCase,
            consolidationType: bCase.consolidationType === 'S' ? 'substantive' : 'administrative',
            consolidationDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
          };
        });

      context.logger.debug(
        MODULE_NAME,
        `Member caseIds for lead case id ${formattedLeadCaseId}`,
        memberCases,
      );

      return {
        leadCaseId: this.formatCaseId(leadCaseId.toString()),
        memberCases,
      };
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  public async loadMigrationTable(context: ApplicationContext) {
    const selectIntoQuery = `
      INSERT INTO dbo.CAMS_MIGRATION_TEMP (caseId)
      SELECT CONCAT(
         RIGHT('000' + CAST(CASE_DIV AS VARCHAR), 3),
           '-',
         RIGHT('00' + CAST(CASE_YEAR AS VARCHAR), 2),
           '-',
         RIGHT('00000' + CAST(CASE_NUMBER AS VARCHAR), 5)
        ) AS caseId
      FROM [dbo].[CMMDB]
      WHERE (CLOSED_BY_COURT_DATE > 20180101
      OR CLOSED_BY_UST_DATE > 20180101
      OR (CLOSED_BY_COURT_DATE = 0 and CLOSED_BY_UST_DATE = 0))
      AND DELETE_CODE != 'D'`;

    try {
      await this.executeQuery(context, selectIntoQuery);
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  public async getMigrationCaseIds(context: ApplicationContext, start: number, end: number) {
    type ResultType = {
      caseId: string;
    };

    const query = `SELECT caseId FROM dbo.CAMS_MIGRATION_TEMP WHERE id BETWEEN ${start} AND ${end}`;
    try {
      const { results } = await this.executeQuery<ResultType>(context, query);
      const caseIdResults = (results as mssql.IResult<ResultType>).recordset;
      return caseIdResults.map((record) => record.caseId);
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  public async emptyMigrationTable(context: ApplicationContext) {
    const emptyTableQuery = 'TRUNCATE TABLE dbo.CAMS_MIGRATION_TEMP';

    try {
      await this.executeQuery(context, emptyTableQuery);
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  public async getMigrationCaseCount(context: ApplicationContext) {
    const countQuery = 'SELECT COUNT(*) AS total FROM dbo.CAMS_MIGRATION_TEMP';

    type ResultType = {
      total: number;
    };

    try {
      const { results } = await this.executeQuery<ResultType>(context, countQuery);
      const caseIdResults = (results as mssql.IResult<ResultType>).recordset;
      return caseIdResults[0].total;
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  public async getDeletedCaseIds(
    context: ApplicationContext,
    lastChangeDate: string,
  ): Promise<{ caseIds: string[]; latestDeletedCaseDate: string }> {
    const input: DbTableFieldSpec[] = [];

    const lastChangeDateInt = parseInt(lastChangeDate.replace(/-/g, ''));

    input.push({
      name: 'lastChangeDate',
      type: mssql.Int,
      value: lastChangeDateInt,
    });

    const query = `
      SELECT
        CONCAT(
          RIGHT('000' + CAST(CASE_DIV AS VARCHAR), 3),
          '-',
          RIGHT('00' + CAST(CASE_YEAR AS VARCHAR), 2),
          '-',
          RIGHT('00000' + CAST(CASE_NUMBER AS VARCHAR), 5)
        ) AS caseId,
        LAST_CHANGE_DATE AS lastChangeDate
      FROM [dbo].[CMMDB]
      WHERE DELETE_CODE = 'D'
      AND LAST_CHANGE_DATE > @lastChangeDate
      ORDER BY LAST_CHANGE_DATE DESC`;

    type ResultType = {
      caseId: string;
      lastChangeDate: number;
    };

    try {
      context.logger.debug(MODULE_NAME, `Querying for deleted cases since: ${lastChangeDate}`);
      const { results } = await this.executeQuery<ResultType>(context, query, input);
      const deletedCaseResults = (results as mssql.IResult<ResultType>).recordset;

      const caseIds = deletedCaseResults.map((r) => r.caseId);
      const latestDeletedCaseDate =
        deletedCaseResults.length > 0
          ? this.formatAcmsDateToString(deletedCaseResults[0].lastChangeDate)
          : lastChangeDate;

      return { caseIds, latestDeletedCaseDate };
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  async getTrusteeProfessionalIds(
    context: ApplicationContext,
    firstName: string,
    lastName: string,
    state: string,
  ): Promise<string[]> {
    const input: DbTableFieldSpec[] = [
      { name: 'firstName', type: mssql.VarChar, value: firstName },
      { name: 'lastName', type: mssql.VarChar, value: lastName },
      { name: 'state', type: mssql.VarChar, value: state },
    ];

    const query = `
      SELECT
        CONCAT(ACMS.GROUP_DESIGNATOR, '-', RIGHT(CONCAT('0000', ACMS.UST_PROF_CODE), 5)) AS acmsProfessionalId
      FROM [dbo].[CMMPR] AS ACMS
      WHERE ACMS.PROF_FIRST_NAME = @firstName
        AND ACMS.PROF_LAST_NAME = @lastName
        AND ACMS.PROF_STATE = @state
        AND (ACMS.PROF_TYPE = 'TR' OR ACMS.PROF_TYPE IS NULL)`;

    try {
      const { results } = await this.executeQuery<{ acmsProfessionalId: string }>(
        context,
        query,
        input,
      );
      return (results as mssql.IResult<{ acmsProfessionalId: string }>).recordset.map(
        (r) => r.acmsProfessionalId,
      );
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  async getCmmapAppointments(
    context: ApplicationContext,
    lastId: number,
    pageSize: number,
    cutoffDate: string | null,
  ): Promise<AcmsCaseAppointmentRecord[]> {
    const input: DbTableFieldSpec[] = [
      { name: 'lastId', type: mssql.BigInt, value: lastId },
      { name: 'pageSize', type: mssql.Int, value: pageSize },
    ];

    let cutoffClause = '';
    if (cutoffDate !== null) {
      const cutoffInt = parseInt(cutoffDate.replace(/-/g, ''), 10);

      if (!Number.isFinite(cutoffInt)) {
        throw new Error(`Invalid cutoffDate value: "${cutoffDate}"`);
      }

      input.push({ name: 'cutoffDate', type: mssql.Int, value: cutoffInt });
      cutoffClause = 'AND m.APPT_DATE >= @cutoffDate';
    }

    const query = `
      SELECT
        m.id AS id,
        CONCAT(
          RIGHT('000' + CAST(m.CASE_DIV AS VARCHAR), 3),
          '-',
          RIGHT('00' + CAST(m.CASE_YEAR AS VARCHAR), 2),
          '-',
          RIGHT('00000' + CAST(m.CASE_NUMBER AS VARCHAR), 5)
        ) AS caseId,
        CONCAT(m.GROUP_DESIGNATOR, '-', RIGHT('00000' + CAST(m.PROF_CODE AS VARCHAR), 5)) AS acmsProfessionalId,
        m.APPT_DATE AS assignDate,
        CASE WHEN m.APPT_DATE = 0 THEN NULL ELSE m.APPT_DATE END AS apptDate,
        CASE WHEN m.DISP_DATE = 0 THEN NULL ELSE m.DISP_DATE END AS unassignDate,
        CASE WHEN c.CASE_FILED_DATE = 0 THEN NULL ELSE c.CASE_FILED_DATE END AS caseFiledDate,
        c.CURR_CASE_CHAPT AS chapter,
        RIGHT('000' + CAST(m.CASE_DIV AS VARCHAR), 3) AS courtDivisionCode,
        CASE WHEN c.CLOSED_BY_COURT_DATE = 0 THEN NULL ELSE c.CLOSED_BY_COURT_DATE END AS closedByCourtDate,
        CASE WHEN c.CLOSED_BY_UST_DATE = 0 THEN NULL ELSE c.CLOSED_BY_UST_DATE END AS closedByUstDate,
        MAX(ke.ORIGINAL_OCC_DATE) AS reopenedDate
      FROM [dbo].[CMMAP] m
      INNER JOIN [dbo].[CMMDB] c
        ON m.CASE_DIV = c.CASE_DIV
        AND m.CASE_YEAR = c.CASE_YEAR
        AND m.CASE_NUMBER = c.CASE_NUMBER
      LEFT OUTER JOIN [dbo].[CMMKE] ke
        ON m.CASE_DIV = ke.CASE_DIV
        AND m.CASE_YEAR = ke.CASE_YEAR
        AND m.CASE_NUMBER = ke.CASE_NUMBER
        AND ke.EVENT_CODE_TYPE = 'O'
        AND ke.EVENT_CODE = 'OCO'
      WHERE m.id > @lastId
        AND m.DELETE_CODE != 'D'
        AND m.PROF_CODE > 0
        AND m.APPT_TYPE = 'TR'
        AND c.DELETE_CODE != 'D'
        AND (c.CLOSED_BY_COURT_DATE > 20180101 OR c.CLOSED_BY_UST_DATE > 20180101
          OR (c.CLOSED_BY_COURT_DATE = 0 AND c.CLOSED_BY_UST_DATE = 0))
        ${cutoffClause}
      GROUP BY
        m.id, m.CASE_DIV, m.CASE_YEAR, m.CASE_NUMBER,
        m.GROUP_DESIGNATOR, m.PROF_CODE, m.APPT_DATE, m.DISP_DATE,
        c.CASE_FILED_DATE, c.CURR_CASE_CHAPT,
        c.CLOSED_BY_COURT_DATE, c.CLOSED_BY_UST_DATE
      ORDER BY m.id
      OFFSET 0 ROWS FETCH NEXT @pageSize ROWS ONLY`;

    type RawRecord = {
      id: number;
      caseId: string;
      acmsProfessionalId: string;
      assignDate: number;
      apptDate: number | null;
      unassignDate: number | null;
    };

    try {
      const { results } = await this.executeQuery<RawRecord>(context, query, input);
      return (results as mssql.IResult<RawRecord>).recordset;
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  async getCmmapAppointmentsRaw(
    context: ApplicationContext,
    lastId: number,
    pageSize: number,
    cutoffDate: string | null,
  ): Promise<AcmsCaseAppointmentRawRecord[]> {
    const input: DbTableFieldSpec[] = [
      { name: 'lastId', type: mssql.BigInt, value: lastId },
      { name: 'pageSize', type: mssql.Int, value: pageSize },
    ];

    let cutoffClause = '';
    if (cutoffDate !== null) {
      const cutoffInt = parseInt(cutoffDate.replace(/-/g, ''), 10);
      if (!Number.isFinite(cutoffInt)) {
        throw new Error(`Invalid cutoffDate value: "${cutoffDate}"`);
      }
      input.push({ name: 'cutoffDate', type: mssql.Int, value: cutoffInt });
      cutoffClause = 'AND m.APPT_DATE >= @cutoffDate';
    }

    const query = `
      SELECT
        m.id,
        m.CASE_DIV,
        m.CASE_YEAR,
        m.CASE_NUMBER,
        m.GROUP_DESIGNATOR,
        m.PROF_CODE,
        m.APPT_DATE,
        CASE WHEN m.DISP_DATE = 0 THEN NULL ELSE m.DISP_DATE END AS DISP_DATE,
        CASE WHEN c.CASE_FILED_DATE = 0 THEN NULL ELSE c.CASE_FILED_DATE END AS CASE_FILED_DATE,
        c.CURR_CASE_CHAPT,
        CASE WHEN c.CLOSED_BY_COURT_DATE = 0 THEN NULL ELSE c.CLOSED_BY_COURT_DATE END AS CLOSED_BY_COURT_DATE,
        CASE WHEN c.CLOSED_BY_UST_DATE = 0 THEN NULL ELSE c.CLOSED_BY_UST_DATE END AS CLOSED_BY_UST_DATE,
        MAX(ke.ORIGINAL_OCC_DATE) AS REOPENED_DATE
      FROM [dbo].[CMMAP] m
      INNER JOIN [dbo].[CMMDB] c
        ON m.CASE_DIV = c.CASE_DIV
        AND m.CASE_YEAR = c.CASE_YEAR
        AND m.CASE_NUMBER = c.CASE_NUMBER
      LEFT OUTER JOIN [dbo].[CMMKE] ke
        ON m.CASE_DIV = ke.CASE_DIV
        AND m.CASE_YEAR = ke.CASE_YEAR
        AND m.CASE_NUMBER = ke.CASE_NUMBER
        AND ke.EVENT_CODE_TYPE = 'O'
        AND ke.EVENT_CODE = 'OCO'
      WHERE m.id > @lastId
        AND m.DELETE_CODE != 'D'
        AND m.PROF_CODE > 0
        AND m.APPT_TYPE = 'TR'
        AND c.DELETE_CODE != 'D'
        AND (c.CLOSED_BY_COURT_DATE > 20180101 OR c.CLOSED_BY_UST_DATE > 20180101
          OR (c.CLOSED_BY_COURT_DATE = 0 AND c.CLOSED_BY_UST_DATE = 0))
        ${cutoffClause}
      GROUP BY
        m.id, m.CASE_DIV, m.CASE_YEAR, m.CASE_NUMBER,
        m.GROUP_DESIGNATOR, m.PROF_CODE, m.APPT_DATE, m.DISP_DATE,
        c.CASE_FILED_DATE, c.CURR_CASE_CHAPT,
        c.CLOSED_BY_COURT_DATE, c.CLOSED_BY_UST_DATE
      ORDER BY m.id
      OFFSET 0 ROWS FETCH NEXT @pageSize ROWS ONLY`;

    // Large fetch: set per-request timeout to 90s to accommodate 10k-row raw fetches
    // without changing the global pool requestTimeout used by other queries.
    const LARGE_FETCH_TIMEOUT_MS = 90000;
    try {
      const { results } = await this.executeQuery<AcmsCaseAppointmentRawRecord>(
        context,
        query,
        input,
        LARGE_FETCH_TIMEOUT_MS,
      );
      return (results as mssql.IResult<AcmsCaseAppointmentRawRecord>).recordset;
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  private formatCaseId(caseId: string): string {
    const padded = caseId.padStart(10, '0');
    return `${padded.slice(0, 3)}-${padded.slice(3, 5)}-${padded.slice(5)}`;
  }

  private formatAcmsDateToString(acmsDate: number): string {
    const dateStr = acmsDate.toString();
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
}

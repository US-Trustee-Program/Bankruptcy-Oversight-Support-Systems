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
  AcmsTrusteeProfessionalRecord,
  AcmsProfessionalAppointmentRecord,
} from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { getCamsError } from '../../../common-errors/error-utilities';
import { DbTableFieldSpec } from '../../types/database';

const MODULE_NAME = 'ACMS-GATEWAY';

// ACMS read timeout in milliseconds. Defaults to 5 minutes.
const ACMS_REQUEST_TIMEOUT_MS = (() => {
  const raw = process.env.ACMS_REQUEST_TIMEOUT_MS;
  if (!raw) return 300000; // 5 minutes default
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[${MODULE_NAME}] Invalid ACMS_REQUEST_TIMEOUT_MS="${raw}", using default 300000ms (5 min)`,
    );
    return 300000;
  }
  return parsed;
})();

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

  async getAllTrusteeProfessionalRecords(
    context: ApplicationContext,
  ): Promise<AcmsTrusteeProfessionalRecord[]> {
    // Pull the full set of ACMS trustee professional records from CMMPR,
    // independent of ATS. Keyed on the compound (GROUP_DESIGNATOR, PROF_CODE)
    // professional ID — never PROF_CODE alone, since one CAMS trustee can hold
    // multiple ACMS professional IDs across groups. Filtered by PROF_TYPE = 'TR'.
    // PROF_ZIP (NUMERIC(9,0)) and PROF_COMMERCIAL_PHONE_NBR (NUMERIC(10,0)) are
    // fetched as raw numerics here and normalized to zero-padded strings below —
    // normalizing at the SQL layer would silently reintroduce leading-zero loss.
    const query = `
      SELECT
        CONCAT(ACMS.GROUP_DESIGNATOR, '-', RIGHT(CONCAT('0000', ACMS.UST_PROF_CODE), 5)) AS acmsProfessionalId,
        ACMS.PROF_FIRST_NAME AS firstName,
        ACMS.PROF_LAST_NAME AS lastName,
        ACMS.PROF_MI AS middleInitial,
        ACMS.PROF_ADDRESS1 AS address1,
        ACMS.PROF_ADDRESS2 AS address2,
        ACMS.PROF_CITY AS city,
        ACMS.PROF_STATE AS state,
        ACMS.PROF_ZIP AS zip,
        ACMS.PROF_COMMERCIAL_PHONE_NBR AS phone
      FROM [dbo].[CMMPR] AS ACMS
      WHERE ACMS.PROF_TYPE = 'TR'`;

    type RawRow = Omit<AcmsTrusteeProfessionalRecord, 'zip' | 'phone'> & {
      zip: number | string | null;
      phone: number | string | null;
    };

    try {
      const { results } = await this.executeQuery<RawRow>(
        context,
        query,
        [],
        ACMS_REQUEST_TIMEOUT_MS,
      );
      const recordset = (results as mssql.IResult<RawRow>).recordset;
      return recordset.map((row) => ({
        ...row,
        middleInitial: this.normalizeAcmsString(row.middleInitial),
        address1: this.normalizeAcmsString(row.address1),
        address2: this.normalizeAcmsString(row.address2),
        city: this.normalizeAcmsString(row.city),
        zip: this.normalizeAcmsZip(row.zip),
        phone: this.normalizeAcmsPhone(row.phone),
      }));
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  /**
   * Normalize an ACMS text field to `null` when empty, rather than leaking an
   * empty string across the gateway boundary.
   */
  private normalizeAcmsString(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value.trim() === '') {
      return null;
    }
    return value;
  }

  /**
   * Normalize ACMS's NUMERIC(9,0) PROF_ZIP to CAMS's 5-digit zip convention.
   * NUMERIC columns arrive stripped of leading zeros, so a short number is
   * left-padded to 5 digits before truncating to the first 5 — this preserves
   * a zip like "00501" (which SQL returns as the number 501) instead of
   * silently truncating it to "00000" or dropping significant digits.
   * A zero/empty value normalizes to null, never "00000".
   */
  private normalizeAcmsZip(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined || value === 0 || value === '') {
      return null;
    }
    const padded = String(value).padStart(5, '0');
    return padded.slice(0, 5);
  }

  /**
   * Normalize ACMS's NUMERIC(10,0) PROF_COMMERCIAL_PHONE_NBR to a zero-padded
   * 10-digit string. NUMERIC columns arrive stripped of leading zeros, so the
   * value is left-padded to 10 digits, not just stringified. A zero/empty
   * value normalizes to null, never "0000000000".
   */
  private normalizeAcmsPhone(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined || value === 0 || value === '') {
      return null;
    }
    return String(value).padStart(10, '0');
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

    // Paginate the CMMAP+CMMDB join first (inner query), then join CMMKE against
    // only the paged rows. Without this subquery pattern the LEFT OUTER JOIN on
    // CMMKE — a table with millions of rows — must be evaluated before pagination,
    // causing SQL timeouts at scale.
    const query = `
      SELECT
        x.id AS id,
        CONCAT(
          RIGHT('000' + CAST(x.CASE_DIV AS VARCHAR), 3),
          '-',
          RIGHT('00' + CAST(x.CASE_YEAR AS VARCHAR), 2),
          '-',
          RIGHT('00000' + CAST(x.CASE_NUMBER AS VARCHAR), 5)
        ) AS caseId,
        CONCAT(x.GROUP_DESIGNATOR, '-', RIGHT('00000' + CAST(x.PROF_CODE AS VARCHAR), 5)) AS acmsProfessionalId,
        x.APPT_DATE AS assignDate,
        CASE WHEN x.APPT_DATE = 0 THEN NULL ELSE x.APPT_DATE END AS apptDate,
        CASE WHEN x.DISP_DATE = 0 THEN NULL ELSE x.DISP_DATE END AS unassignDate,
        CASE WHEN x.CASE_FILED_DATE = 0 THEN NULL ELSE x.CASE_FILED_DATE END AS caseFiledDate,
        x.CURR_CASE_CHAPT AS chapter,
        RIGHT('000' + CAST(x.CASE_DIV AS VARCHAR), 3) AS courtDivisionCode,
        CASE WHEN x.CLOSED_BY_COURT_DATE = 0 THEN NULL ELSE x.CLOSED_BY_COURT_DATE END AS closedByCourtDate,
        CASE WHEN x.CLOSED_BY_UST_DATE = 0 THEN NULL ELSE x.CLOSED_BY_UST_DATE END AS closedByUstDate,
        MAX(ke.ORIGINAL_OCC_DATE) AS reopenedDate
      FROM (
        SELECT
          m.id,
          m.CASE_DIV, m.CASE_YEAR, m.CASE_NUMBER,
          m.GROUP_DESIGNATOR, m.PROF_CODE,
          m.APPT_DATE, m.DISP_DATE,
          c.CASE_FILED_DATE, c.CURR_CASE_CHAPT,
          c.CLOSED_BY_COURT_DATE, c.CLOSED_BY_UST_DATE
        FROM [dbo].[CMMAP] m
        INNER JOIN [dbo].[CMMDB] c
          ON m.CASE_DIV = c.CASE_DIV
          AND m.CASE_YEAR = c.CASE_YEAR
          AND m.CASE_NUMBER = c.CASE_NUMBER
        WHERE m.id > @lastId
          AND m.DELETE_CODE != 'D'
          AND m.PROF_CODE > 0
          AND m.APPT_TYPE = 'TR'
          AND c.DELETE_CODE != 'D'
          AND (c.CLOSED_BY_COURT_DATE > 20180101 OR c.CLOSED_BY_UST_DATE > 20180101
            OR (c.CLOSED_BY_COURT_DATE = 0 AND c.CLOSED_BY_UST_DATE = 0))
          ${cutoffClause}
        ORDER BY m.id
        OFFSET 0 ROWS FETCH NEXT @pageSize ROWS ONLY
      ) AS x
      LEFT OUTER JOIN [dbo].[CMMKE] ke
        ON x.CASE_DIV = ke.CASE_DIV
        AND x.CASE_YEAR = ke.CASE_YEAR
        AND x.CASE_NUMBER = ke.CASE_NUMBER
        AND ke.EVENT_CODE_TYPE = 'O'
        AND ke.EVENT_CODE = 'OCO'
      GROUP BY
        x.id, x.CASE_DIV, x.CASE_YEAR, x.CASE_NUMBER,
        x.GROUP_DESIGNATOR, x.PROF_CODE, x.APPT_DATE, x.DISP_DATE,
        x.CASE_FILED_DATE, x.CURR_CASE_CHAPT,
        x.CLOSED_BY_COURT_DATE, x.CLOSED_BY_UST_DATE
      ORDER BY x.id`;

    // Large fetch: set per-request timeout to ACMS_REQUEST_TIMEOUT_MS to accommodate
    // large fetches without changing the global pool requestTimeout used by other queries.
    try {
      const { results } = await this.executeQuery<AcmsCaseAppointmentRecord>(
        context,
        query,
        input,
        ACMS_REQUEST_TIMEOUT_MS,
      );
      return (results as mssql.IResult<AcmsCaseAppointmentRecord>).recordset;
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

    // Same subquery pattern as getCmmapAppointments — paginate before joining CMMKE.
    const query = `
      SELECT
        x.id,
        x.CASE_DIV,
        x.CASE_YEAR,
        x.CASE_NUMBER,
        x.GROUP_DESIGNATOR,
        x.PROF_CODE,
        x.APPT_DATE,
        CASE WHEN x.DISP_DATE = 0 THEN NULL ELSE x.DISP_DATE END AS DISP_DATE,
        CASE WHEN x.CASE_FILED_DATE = 0 THEN NULL ELSE x.CASE_FILED_DATE END AS CASE_FILED_DATE,
        x.CURR_CASE_CHAPT,
        CASE WHEN x.CLOSED_BY_COURT_DATE = 0 THEN NULL ELSE x.CLOSED_BY_COURT_DATE END AS CLOSED_BY_COURT_DATE,
        CASE WHEN x.CLOSED_BY_UST_DATE = 0 THEN NULL ELSE x.CLOSED_BY_UST_DATE END AS CLOSED_BY_UST_DATE,
        MAX(ke.ORIGINAL_OCC_DATE) AS REOPENED_DATE
      FROM (
        SELECT
          m.id,
          m.CASE_DIV, m.CASE_YEAR, m.CASE_NUMBER,
          m.GROUP_DESIGNATOR, m.PROF_CODE,
          m.APPT_DATE, m.DISP_DATE,
          c.CASE_FILED_DATE, c.CURR_CASE_CHAPT,
          c.CLOSED_BY_COURT_DATE, c.CLOSED_BY_UST_DATE
        FROM [dbo].[CMMAP] m
        INNER JOIN [dbo].[CMMDB] c
          ON m.CASE_DIV = c.CASE_DIV
          AND m.CASE_YEAR = c.CASE_YEAR
          AND m.CASE_NUMBER = c.CASE_NUMBER
        WHERE m.id > @lastId
          AND m.DELETE_CODE != 'D'
          AND m.PROF_CODE > 0
          AND m.APPT_TYPE = 'TR'
          AND c.DELETE_CODE != 'D'
          AND (c.CLOSED_BY_COURT_DATE > 20180101 OR c.CLOSED_BY_UST_DATE > 20180101
            OR (c.CLOSED_BY_COURT_DATE = 0 AND c.CLOSED_BY_UST_DATE = 0))
          ${cutoffClause}
        ORDER BY m.id
        OFFSET 0 ROWS FETCH NEXT @pageSize ROWS ONLY
      ) AS x
      LEFT OUTER JOIN [dbo].[CMMKE] ke
        ON x.CASE_DIV = ke.CASE_DIV
        AND x.CASE_YEAR = ke.CASE_YEAR
        AND x.CASE_NUMBER = ke.CASE_NUMBER
        AND ke.EVENT_CODE_TYPE = 'O'
        AND ke.EVENT_CODE = 'OCO'
      GROUP BY
        x.id, x.CASE_DIV, x.CASE_YEAR, x.CASE_NUMBER,
        x.GROUP_DESIGNATOR, x.PROF_CODE, x.APPT_DATE, x.DISP_DATE,
        x.CASE_FILED_DATE, x.CURR_CASE_CHAPT,
        x.CLOSED_BY_COURT_DATE, x.CLOSED_BY_UST_DATE
      ORDER BY x.id`;

    // Large fetch: set per-request timeout to ACMS_REQUEST_TIMEOUT_MS to accommodate
    // large raw fetches without changing the global pool requestTimeout used by other queries.
    try {
      const { results } = await this.executeQuery<AcmsCaseAppointmentRawRecord>(
        context,
        query,
        input,
        ACMS_REQUEST_TIMEOUT_MS,
      );
      return (results as mssql.IResult<AcmsCaseAppointmentRawRecord>).recordset;
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  async getCmmapAppointmentsForProfessionalIds(
    context: ApplicationContext,
    acmsProfessionalIds: string[],
  ): Promise<AcmsProfessionalAppointmentRecord[]> {
    if (acmsProfessionalIds.length === 0) {
      return [];
    }

    // Batched by a SET of professional IDs, not keyset-paginated — one SQL round
    // trip for the whole batch, unlike getCmmapAppointments'/getCmmapAppointmentsRaw's
    // global `WHERE m.id > @lastId ... FETCH NEXT @pageSize ROWS` sweep. Each
    // acmsProfessionalId ("{GROUP_DESIGNATOR}-{PROF_CODE:5}") is matched via the
    // same CONCAT-based expression used to produce it, parameterized per-id — the
    // same `CONCAT(...) IN (@p0, @p1, ...)` shape used by
    // getAppointmentDatesByCaseIds in dxtr/cases.dxtr.gateway.ts.
    const input: DbTableFieldSpec[] = acmsProfessionalIds.map((id, idx) => ({
      name: `profId${idx}`,
      type: mssql.VarChar,
      value: id,
    }));
    const profIdVars = acmsProfessionalIds.map((_, idx) => `@profId${idx}`).join(', ');

    // Reuses the CMMAP INNER JOIN CMMDB join pattern and CONCAT-based caseId/
    // acmsProfessionalId formatting from getCmmapAppointments verbatim, but
    // deliberately drops that method's open-case filter
    // (CLOSED_BY_COURT_DATE/CLOSED_BY_UST_DATE) and its CMMKE join — a closed
    // case is still valid identity evidence for this matching problem, unlike
    // the "still relevant to current oversight" question that filter answers
    // for the completed migrate-case-appointments migration. Only
    // DELETE_CODE != 'D' and APPT_TYPE = 'TR' are kept on CMMAP, and
    // DELETE_CODE != 'D' on CMMDB.
    const query = `
      SELECT
        CONCAT(m.GROUP_DESIGNATOR, '-', RIGHT('00000' + CAST(m.PROF_CODE AS VARCHAR), 5)) AS acmsProfessionalId,
        CONCAT(
          RIGHT('000' + CAST(m.CASE_DIV AS VARCHAR), 3),
          '-',
          RIGHT('00' + CAST(m.CASE_YEAR AS VARCHAR), 2),
          '-',
          RIGHT('00000' + CAST(m.CASE_NUMBER AS VARCHAR), 5)
        ) AS caseId,
        RIGHT('000' + CAST(m.CASE_DIV AS VARCHAR), 3) AS courtDivisionCode,
        c.CURR_CASE_CHAPT AS chapter
      FROM [dbo].[CMMAP] m
      INNER JOIN [dbo].[CMMDB] c
        ON m.CASE_DIV = c.CASE_DIV
        AND m.CASE_YEAR = c.CASE_YEAR
        AND m.CASE_NUMBER = c.CASE_NUMBER
      WHERE m.DELETE_CODE != 'D'
        AND m.APPT_TYPE = 'TR'
        AND c.DELETE_CODE != 'D'
        AND CONCAT(m.GROUP_DESIGNATOR, '-', RIGHT('00000' + CAST(m.PROF_CODE AS VARCHAR), 5)) IN (${profIdVars})`;

    try {
      const { results } = await this.executeQuery<AcmsProfessionalAppointmentRecord>(
        context,
        query,
        input,
        ACMS_REQUEST_TIMEOUT_MS,
      );
      return (results as mssql.IResult<AcmsProfessionalAppointmentRecord>).recordset;
    } catch (originalError) {
      throwCamsError(originalError);
    }
  }

  async getDivisionToCourtMap(context: ApplicationContext): Promise<Map<string, string>> {
    // Live join against CMMDO (Division/Office Master File, ~271 rows), fetched
    // once per dataflow run — deliberately NOT a hand-copied static TypeScript
    // table. CMMDO rarely changes, but a static table is a second source of
    // truth that can silently drift from the real schema over time; a live
    // query against an already-open connection cannot drift, at negligible
    // extra cost for a table this small. Excludes soft-deleted rows.
    const query = `
      SELECT
        CASE_DIV AS caseDiv,
        COURT_ID AS courtId
      FROM [dbo].[CMMDO]
      WHERE DELETE_CODE != 'D'`;

    type ResultType = {
      caseDiv: number;
      courtId: string;
    };

    try {
      const { results } = await this.executeQuery<ResultType>(context, query);
      const recordset = (results as mssql.IResult<ResultType>).recordset;
      const divisionToCourtMap = new Map<string, string>();
      for (const row of recordset) {
        divisionToCourtMap.set(String(row.caseDiv).padStart(3, '0'), row.courtId);
      }
      return divisionToCourtMap;
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

import * as mssql from 'mssql';
import { ApplicationContext } from '../types/basic';
import { CaseListDbResult, CaseListRecordSet, Chapter11CaseType } from '../types/cases';
import { Chapter11GatewayInterface } from '../../use-cases/chapter-11.gateway.interface';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database';
import { executeQuery } from '../utils/database';
import { getRecord } from './azure.sql.gateway';
import log from '../services/logger.service';
import { ReviewCodeDescription } from '../utils/review-code-description';

const table = 'cases';

const NAMESPACE = 'CASES-MSSQL-DB-GATEWAY';

class Chapter11ApiGateway implements Chapter11GatewayInterface {
  public async getCaseList(
    context: ApplicationContext,
    caseOptions: { chapter: string; professionalId: string } = { chapter: '', professionalId: '' },
  ): Promise<CaseListDbResult> {
    const input: DbTableFieldSpec[] = [];

    let query = `select TOP 20 a.CURR_CASE_CHAPT as currentCaseChapter
        , CONCAT(a.CASE_YEAR, '-', REPLICATE('0', 5-DATALENGTH(LTRIM(a.CASE_NUMBER))), a.CASE_NUMBER) as caseNumber
        , a.DEBTOR1_NAME as debtor1Name
        , a.CURRENT_CHAPTER_FILE_DATE as currentChapterFileDate
        , rTrim(b1.PROF_FIRST_NAME)  + ' ' + rTrim(b1.PROF_LAST_NAME) as staff1ProfName
        , c1.PROF_TYPE_DESC as staff1ProfTypeDescription
        , rTrim(b2.PROF_FIRST_NAME)   + ' ' + rTrim(b2.PROF_LAST_NAME) as staff2ProfName
        , c2.PROF_TYPE_DESC as staff2ProfTypeDescription
        , IsNull(h.HEARING_DATE, 0) as hearingDate
        , IsNull(h.HEARING_TIME, 0) as hearingTime
        , IsNull(h.HEARING_CODE, '') as hearingCode
        , IsNull(h.HEARING_DISP, '') as hearingDisposition
      from [dbo].[CMMDB] a
      left outer join [dbo].[CMMPR] b1 on a.GROUP_DESIGNATOR = b1.GROUP_DESIGNATOR and a.STAFF1_PROF_CODE = b1.UST_PROF_CODE
      left outer join [dbo].[CMMPR] b2 on a.GROUP_DESIGNATOR = b2.GROUP_DESIGNATOR and a.STAFF2_PROF_CODE = b2.UST_PROF_CODE
      inner join [dbo].[CMMPT] c1 on a.GROUP_DESIGNATOR = c1.GROUP_DESIGNATOR and b1.PROF_TYPE = c1.PROF_TYPE
      inner join [dbo].[CMMPT] c2 on a.GROUP_DESIGNATOR = c2.GROUP_DESIGNATOR and b2.PROF_TYPE = c2.PROF_TYPE
      left outer join [dbo].[CMHHR] h on a.CASE_DIV = h.CASE_DIV and a.CASE_YEAR = h.CASE_YEAR and a.CASE_NUMBER = h.CASE_NUMBER AND h.HEARING_CODE = 'IDI'
      AND h.RECORD_SEQ_NBR =  (select max(record_seq_nbr) as nbr
          from [dbo].[CMHHR]
          where hearing_code = 'IDI' and case_number = a.case_number
          group by case_div, case_year, case_number, HEARING_CODE)
      WHERE a.DELETE_CODE != 'D' and a.CLOSED_BY_COURT_DATE = 0 and a.CLOSED_BY_UST_DATE = 0 and a.TRANSFERRED_OUT_DATE = 0 and a.DISMISSED_DATE = 0
      `;

    log.info(context, NAMESPACE, `${caseOptions.chapter} ${caseOptions.professionalId}`);
    if (caseOptions.chapter.length > 0) {
      query += ` AND a.CURR_CASE_CHAPT = @chapt`;

      input.push({
        name: 'chapt',
        type: mssql.Char,
        value: caseOptions.chapter,
      });
    }
    if (caseOptions.professionalId.length > 0) {
      query += ` AND (a.STAFF1_PROF_CODE = @professionalId OR a.STAFF2_PROF_CODE = @professionalId)`;

      input.push({
        name: 'professionalId',
        type: mssql.Int,
        value: caseOptions.professionalId,
      });
    }

    const queryResult: QueryResults = await executeQuery(context, query, input);
    let results: CaseListDbResult;

    try {
      if (queryResult.success) {
        log.debug(context, NAMESPACE, 'About to call the updateReviewDescription');

        await this.updateReviewDescription(queryResult.results['recordset']);
        const body: CaseListRecordSet = { staff1Label: '', staff2Label: '', caseList: [] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body.caseList = (queryResult.results as mssql.IResult<any>).recordset;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowsAffected = (queryResult.results as mssql.IResult<any>).rowsAffected[0];
        results = {
          success: true,
          message: `${table} list`,
          count: rowsAffected,
          body,
        };
      } else {
        results = {
          success: false,
          message: queryResult.message,
          count: 0,
          body: {
            caseList: [],
          },
        };
      }
    } catch (e) {
      results = {
        success: false,
        message: e.message,
        count: 0,
        body: {
          caseList: [],
        },
      };
    }
    return results;
  }

  private async updateReviewDescription(results: void | object) {
    const reviewDescriptionMapper = new ReviewCodeDescription();
    const caseResults = results as Array<Chapter11CaseType>;

    caseResults.forEach(function (caseRecord) {
      caseRecord.hearingDisposition = reviewDescriptionMapper.getDescription(
        caseRecord.hearingDisposition,
      );
    });
  }

  public async getCase(context: ApplicationContext, id: number): Promise<DbResult> {
    return await getRecord(context, table, id);
  }
}

export { Chapter11ApiGateway };

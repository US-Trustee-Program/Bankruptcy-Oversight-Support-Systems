import * as mssql from 'mssql';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database';
import { executeQuery } from '../utils/database';
import { getRecord } from './azure.sql.gateway';
import { Context } from '../types/basic';
import log from '../services/logger.service';
import { ReviewCodeDescription } from "../utils/LookUps";
import { BankruptcyCase, caseTypeWithDescription } from "../types/cases";

const table = 'cases';

const NAMESPACE = 'CASES-MSSQL-DB-GATEWAY';

const getCaseList = async (context: Context, caseOptions: { chapter: string, professionalId: string } = { chapter: '', professionalId: '' }): Promise<BankruptcyCase[]> => {
  let input: DbTableFieldSpec[] = [];

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

    input.push(
      {
        name: 'chapt',
        type: mssql.Char,
        value: caseOptions.chapter,
      },
    );
  }
  if (caseOptions.professionalId.length > 0) {
    query += ` AND (a.STAFF1_PROF_CODE = @professionalId OR a.STAFF2_PROF_CODE = @professionalId)`;

    input.push(
      {
        name: 'professionalId',
        type: mssql.Int,
        value: caseOptions.professionalId
      },
    );
  }

  const queryResult: QueryResults = await executeQuery(context, table, query, input);

  try {
    if (queryResult.success) {
      log.debug(context, NAMESPACE, "About to call the updateReviewDescription");

      let rs = (queryResult.results as mssql.IResult<any>).recordset;

      await updateReviewDescription(rs);
      return rs;
    } else {
      throw Error(queryResult.message);
    }
  } catch (e) {
    throw Error(e.message);
  }
};

async function updateReviewDescription(results: void | Object) {
  let reviewDescriptionMapper = new ReviewCodeDescription();
  let caseResults = results as Array<BankruptcyCase>;

  caseResults.forEach(function (caseTy) {
    caseTy.hearingDisposition = reviewDescriptionMapper.getDescription(caseTy.hearingDisposition);
  });
}

const getCase = async (context: Context, id: number): Promise<DbResult> => {
  return await getRecord(context, table, id);
};

export { getCaseList, getCase };

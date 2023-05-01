import * as mssql from 'mssql';
import { RecordObj } from '../types/basic';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database';
import { runQuery } from '../utils/database';
import { getRecord, createRecord, updateRecord, deleteRecord } from './azure.sql.gateway';
import { Context } from '../types/basic';
import log from '../services/logger.service';

const table = 'cases';

const NAMESPACE = 'CASES-MSSQL-DB-GATEWAY';

const getCaseList = async (context: Context, caseOptions: {chapter: string, professionalId: number} = {chapter: '', professionalId: 0}): Promise<DbResult> => {
  let input: DbTableFieldSpec[] = [];

  let query = `select a.CURR_CASE_CHAPT as currentCaseChapter
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
  if (caseOptions.professionalId > 0) {
    query += ` AND (a.STAFF1_PROF_CODE = @professionalId OR a.STAFF2_PROF_CODE = @professionalId)`;

    input.push(
      {
        name: 'professionalId',
        type: mssql.Int,
        value: caseOptions.professionalId
      },
    );
  }

  const queryResult: QueryResults = await runQuery(context, table, query, input);
  let results: DbResult;

  log.info(context, NAMESPACE, `query result`, queryResult);
  if (queryResult.success) {
    const body = { staff1Label: '', staff2Label: '', caseList: {} }
    body.caseList = (queryResult.results as mssql.IResult<any>).recordset;
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
      body: {},
    };
  }

  return results;
};

const getCase = async (context: Context, id: number): Promise<DbResult> => {
  return await getRecord(context, table, id);
};

const createCase = async (context: Context, fieldArr: RecordObj[]): Promise<DbResult> => {
  return await createRecord(context, table, fieldArr);
};

const updateCase = async (context: Context, id: number, fieldArr: RecordObj[]): Promise<DbResult> => {
  return await updateRecord(context, table, id, fieldArr);
};

const deleteCase = async (context: Context, id: number): Promise<DbResult> => {
  return await deleteRecord(context, table, id);
};

export { getCaseList, getCase, createCase, updateCase, deleteCase };

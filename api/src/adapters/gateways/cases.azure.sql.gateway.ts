import mssql from 'mssql';
import { RecordObj } from '../types/basic.js';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database.js';
import { runQuery } from '../utils/database.js';
import { getRecord, createRecord, updateRecord, deleteRecord } from './azure.sql.gateway.js';

const table = 'cases';

const getCaseList = async (caseOptions: {chapter: string, professionalId: number} = {chapter: '', professionalId: 0}): Promise<DbResult> => {
  let input: DbTableFieldSpec[] = [];

  let query = `select a.CURR_CASE_CHAPT
      , CONCAT(a.CASE_YEAR, '-', a.CASE_NUMBER) as 'CASE_YEAR_AND_NUMBER'
      , a.DEBTOR1_NAME
      , a.CURRENT_CHAPTER_FILE_DATE
      , rTrim(b1.PROF_FIRST_NAME)  + ' ' + rTrim(b1.PROF_LAST_NAME) as 'STAFF1_PROF_NAME'
      , c1.PROF_TYPE_DESC as 'STAFF1_PROF_TYPE_DESC'
      , rTrim(b2.PROF_FIRST_NAME)   + ' ' + rTrim(b2.PROF_LAST_NAME) as 'STAFF2_PROF_NAME'
      , c2.PROF_TYPE_DESC as 'STAFF2_PROF_TYPE_DESC'
      , IsNull(h.HEARING_DATE, 0) as 'HEARING_DATE'
      , IsNull(h.HEARING_TIME, 0) as 'HEARING_TIME'
      , IsNull(h.HEARING_CODE, '') as 'HEARING_CODE'
      , IsNull(h.HEARING_DISP, '') as 'HEARING_DISP'
    from [dbo].[CMMDB] a
    left outer join [dbo].[CMMPR] b1 on a.GROUP_DESIGNATOR = b1.GROUP_DESIGNATOR and a.STAFF1_PROF_CODE = b1.UST_PROF_CODE
    left outer join [dbo].[CMMPR] b2 on a.GROUP_DESIGNATOR = b2.GROUP_DESIGNATOR and a.STAFF2_PROF_CODE = b2.UST_PROF_CODE
    inner join [dbo].[CMMPT] c1 on a.GROUP_DESIGNATOR = c1.GROUP_DESIGNATOR and b1.PROF_TYPE = c1.PROF_TYPE
    inner join [dbo].[CMMPT] c2 on a.GROUP_DESIGNATOR = c2.GROUP_DESIGNATOR and b2.PROF_TYPE = c2.PROF_TYPE
    left outer join [dbo].[CMHHR] h on a.CASE_DIV = h.CASE_DIV and a.CASE_YEAR = h.CASE_YEAR and a.CASE_NUMBER = h.CASE_NUMBER AND h.HEARING_CODE = 'IDI'
    WHERE a.DELETE_CODE != 'D' AND a.CLOSED_BY_COURT_DATE = 0 AND a.CLOSED_BY_UST_DATE = 0 AND a.TRANSFERRED_OUT_DATE = 0 AND a.DISMISSED_DATE = 0
    `;

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

  const queryResult: QueryResults = await runQuery(table, query, input);
  let results: DbResult;

  if (queryResult.success) {
    const records = (queryResult.results as mssql.IResult<any>).recordset;
    const rowsAffected = (queryResult.results as mssql.IResult<any>).rowsAffected[0];
    results = {
      success: true,
      message: `${table} list`,
      count: rowsAffected,
      body: records,
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

const getCase = async (id: number): Promise<DbResult> => {
  return await getRecord(table, id);
};

const createCase = async (fieldArr: RecordObj[]): Promise<DbResult> => {
  return await createRecord(table, fieldArr);
};

const updateCase = async (id: number, fieldArr: RecordObj[]): Promise<DbResult> => {
  return await updateRecord(table, id, fieldArr);
};

const deleteCase = async (id: number): Promise<DbResult> => {
  return await deleteRecord(table, id);
};

export { getCaseList, getCase, createCase, updateCase, deleteCase };

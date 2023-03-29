import mssql from 'mssql';
import { RecordObj } from '../types/basic.js';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database.js';
import { runQuery } from '../utils/database.js';
import { getRecord, createRecord, updateRecord, deleteRecord } from './azure.sql.gateway.js';

const table = 'cases';

const getCaseList = async (chapter: string = ''): Promise<DbResult> => {
  let input: DbTableFieldSpec[] = [];

  let query = `
    select a.CURR_CASE_CHAPT
      , a.CASE_DIV 
      , a.CASE_YEAR
      , a.CASE_NUMBER
      , a.GROUP_DESIGNATOR
      , a.STAFF1_PROF_CODE
      , b1.PROF_FIRST_NAME as 'STAFF1_PROF_FIRST_NAME'
      , b1.PROF_LAST_NAME as 'STAFF1_PROF_LAST_NAME'   
      , c1.PROF_TYPE as 'STAFF1_PROF_TYPE' 
      , c1.PROF_TYPE_DESC as 'STAFF1_PROF_TYPE_DESC'
      , a.STAFF2_PROF_CODE
      , b2.PROF_FIRST_NAME as 'STAFF2_PROF_FIRST_NAME'
      , b2.PROF_LAST_NAME as 'STAFF2_PROF_LAST_NAME'
      , c2.PROF_TYPE as 'STAFF2_PROF_TYPE' 
      , c2.PROF_TYPE_DESC as 'STAFF2_PROF_TYPE_DESC' 
      , h.HEARING_CODE
      , h.HEARING_DISP
    from [dbo].[CMMDB] a
    left outer join [dbo].[CMMPR] b1 on a.GROUP_DESIGNATOR = b1.GROUP_DESIGNATOR and a.STAFF1_PROF_CODE = b1.UST_PROF_CODE
    left outer join [dbo].[CMMPR] b2 on a.GROUP_DESIGNATOR = b2.GROUP_DESIGNATOR and a.STAFF2_PROF_CODE = b2.UST_PROF_CODE
    inner join [dbo].[CMMPT] c1 on a.GROUP_DESIGNATOR = c1.GROUP_DESIGNATOR and b1.PROF_TYPE = c1.PROF_TYPE
    inner join [dbo].[CMMPT] c2 on a.GROUP_DESIGNATOR = c2.GROUP_DESIGNATOR and b2.PROF_TYPE = c2.PROF_TYPE 
    left outer join [dbo].[CMHHR] h on a.CASE_DIV = h.CASE_DIV and a.CASE_YEAR = h.CASE_YEAR and a.CASE_NUMBER = h.CASE_NUMBER `;

  if (chapter.length > 0) {
    query += ` WHERE a.CURR_CASE_CHAPT = @chapt`;

    input = [
      {
        name: 'chapt',
        type: mssql.Char,
        value: chapter,
      },
    ];
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

import mssql from 'mssql';
import { RecordObj } from '../types/basic.js';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database.js';
import { runQuery } from '../utils/database.js';
import { getRecord, createRecord, updateRecord, deleteRecord } from './azure.sql.gateway.js';

const table = 'cases';

const getCaseList = async (): Promise<DbResult> => {
  const query = "SELECT " +
    " debtor.CASE_DIV" +
    ", debtor.CASE_YEAR" +
    ", debtor.CASE_NUMBER" +
    ", debtor.STAFF1_PROF_CODE" +
    ", debtor.STAFF2_PROF_CODE" +
    ", debtor.CURR_CASE_CHAPT " +
//        ", professional.PROF_FIRST_NAME" +
//        ", professional.UST_PROF_CODE" +
  " FROM " +
    " dbo.CMMDB debtor " +
//        "LEFT OUTER JOIN" +
//          "dbo.CMMPR professional" +
//          "ON" +
//            "debtor.STAFF1_PROF_CODE = professional.UST_PROF_CODE" +
//            "OR" +
//            "debtor.STAFF2_PROF_CODE = professional.UST_PROF_CODE" +
  " WHERE " +
    " 1 = 1 " +
    " AND debtor.CURR_CASE_CHAPT = '11' ";
    //" AND (debtor.STAFF1_PROF_CODE = ? " +
    //" OR debtor.STAFF2_PROF_CODE = ? )";

  const queryResult: QueryResults = await runQuery(table, query);
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

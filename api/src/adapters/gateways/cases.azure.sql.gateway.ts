import mssql from 'mssql';
import { RecordObj } from '../types/basic';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database';
import { runQuery } from '../utils/database';
import { createRecord, updateRecord, deleteRecord } from './azure.sql.gateway';

const table = 'cases';

const getCaseList = async (): Promise<DbResult> => {
  const query = `SELECT a.*, b.title AS chapter_title FROM cases AS a LEFT JOIN chapters AS b ON a.chapters_id = b.chapters_id`;
  const queryResult: QueryResults = await runQuery(table, query);
  console.log(queryResult.results);
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
  let query = `SELECT a.*, b.title AS chapter_title FROM ${table} AS a LEFT JOIN chapters AS b ON a.chapters_id = b.chapters_id WHERE a.${table}_id = @id`;
  let results: DbResult;
  const input: DbTableFieldSpec[] = [
    {
      name: 'id',
      type: mssql.Int,
      value: id,
    },
  ];
  const queryResult = await runQuery(table, query, input);

  if (Boolean(queryResult) && queryResult.success && typeof (queryResult as any).results.rowsAffected != 'undefined' && (queryResult as any).results.rowsAffected[0] === 1) {
    results = {
      message: '',
      count: 1,
      body: (queryResult.results as mssql.IResult<any>).recordset,
      success: true,
    };
  } else {
    results = {
      message: queryResult.message,
      count: 0,
      body: {},
      success: false,
    };
  }

  return results;
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

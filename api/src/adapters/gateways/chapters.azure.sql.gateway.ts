import { DbResult } from '../types/database.js';
import { getAll } from './azure.sql.gateway.js';

const getChaptersList = async (): Promise<DbResult> => {
  return await getAll('chapters');
};

export { getChaptersList };

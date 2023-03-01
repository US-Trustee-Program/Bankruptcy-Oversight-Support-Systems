import { DbResult } from '../types/database';
import { getAll } from './azure.sql.gateway';

const getChaptersList = async (): Promise<DbResult> => {
  return await getAll('chapters');
};

export { getChaptersList }
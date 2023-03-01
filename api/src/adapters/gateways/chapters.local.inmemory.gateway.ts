import { DbResult } from '../types/database';
import { getAll } from './local.inmemory.gateway';

const getChaptersList = async (): Promise<DbResult> => {
  return await getAll('chapters');
};

export { getChaptersList };

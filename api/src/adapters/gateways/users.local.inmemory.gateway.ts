import log from '../logging.service.js';
import { getProperty, mockData } from '../mock-data/index.js';
import { ObjectKeyVal, RecordObj } from '../types/basic.js';
import { DbResult } from '../types/database.js';

const NAMESPACE = 'USERS-LOCAL-INMEMORY-DATA-MODULE';

async function initializeCases(): Promise<ObjectKeyVal[]> {
  return [];
}

const login = async (userName: { firstName: string, lastName: string }): Promise<DbResult> => {
  const results = {
    success: true,
    message: `User record`,
    count: 0,
    body: [],
  };
  return results;
};

export { login };

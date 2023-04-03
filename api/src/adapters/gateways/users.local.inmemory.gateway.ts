import { DbResult } from '../types/database.js';

const NAMESPACE = 'USERS-LOCAL-INMEMORY-DATA-MODULE';

const login = async (userName: { firstName: string, lastName: string }): Promise<DbResult> => {
  const results = {
    success: true,
    message: `User record`,
    count: 1,
    body: [
      {
          "first_name": "Foo             ",
          "middle_initial": " ",
          "last_name": "Bar                        ",
          "professional_id": 123
      }
    ],
  };
  return results;
};

export { login };

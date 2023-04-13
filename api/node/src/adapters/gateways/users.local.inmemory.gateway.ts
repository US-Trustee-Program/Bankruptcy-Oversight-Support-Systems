import { DbResult } from '../types/database.js';

const NAMESPACE = 'USERS-LOCAL-INMEMORY-DATA-MODULE';

const login = async (userName: { firstName: string, lastName: string }): Promise<DbResult> => {
  const results = {
    success: true,
    message: `user record`,
    count: 1,
    body: [
      {
          "first_name": userName.firstName,
          "middle_initial": " ",
          "last_name": userName.lastName,
          "professional_id": 123
      }
    ],
  };
  return results;
};

export { login };

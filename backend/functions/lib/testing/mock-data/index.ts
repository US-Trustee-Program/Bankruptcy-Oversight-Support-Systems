import { ObjectKeyValArrayKeyVal } from '../../adapters/types/basic';

async function getProperty(table: string, item: string) {
  const obj = await import(`./${table}.mock`);
  return obj[item];
}

const mockData: ObjectKeyValArrayKeyVal = {};

const userMockData = {
  users: {
    userList: [{}],
    initialized: false,
  },
};

export { getProperty, mockData, userMockData };

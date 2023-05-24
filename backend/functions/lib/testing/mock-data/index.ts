import { ObjectKeyValArrayKeyVal } from '../../adapters/types/basic';

async function getProperty(table: string, item: string) {
  const obj = await import(`./${table}.mock`);
  return obj[item];
}

const mockData: ObjectKeyValArrayKeyVal = {};

const caseListMockData = {
  cases:  {
    staff1Label: '',
    staff2Label: '',
    caseList: [{}],
    initialized: false,
  }
};

const userMockData = {
  users: {
    userList: [{}],
    initialized: false,
  }
}

export { getProperty, mockData, caseListMockData, userMockData };

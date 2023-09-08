import { ObjectKeyValArrayKeyVal } from '../../adapters/types/basic';
import { Chapter11CaseListRecordSet } from '../../adapters/types/cases';

async function getProperty(table: string, item: string) {
  const obj = await import(`./${table}.mock`);
  return obj[item];
}

const mockData: ObjectKeyValArrayKeyVal = {};

const caseListRecord: Chapter11CaseListRecordSet = {
  staff1Label: '',
  staff2Label: '',
  caseList: [{}],
  initialized: false,
};

const caseListMockData = {
  cases: caseListRecord,
};

const userMockData = {
  users: {
    userList: [{}],
    initialized: false,
  },
};

export { getProperty, mockData, caseListMockData, userMockData };

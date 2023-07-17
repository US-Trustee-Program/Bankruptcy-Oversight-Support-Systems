import { ObjectKeyValArrayKeyVal } from '../../adapters/types/basic';
import { CaseListRecordSet } from '../../adapters/types/cases';
import { AttorneyListRecordSet } from '../../adapters/types/attorneys';

async function getProperty(table: string, item: string) {
  const obj = await import(`./${table}.mock`);
  return obj[item];
}

const mockData: ObjectKeyValArrayKeyVal = {};

const attorneyListRecord: AttorneyListRecordSet = {
  attorneyList: [{}],
  initialized: false,
};

const caseListRecord: CaseListRecordSet = {
  staff1Label: '',
  staff2Label: '',
  caseList: [{}],
  initialized: false,
};

const attorneyListMockData = {
  attorneys: attorneyListRecord,
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

export { getProperty, mockData, caseListMockData, userMockData, attorneyListMockData };

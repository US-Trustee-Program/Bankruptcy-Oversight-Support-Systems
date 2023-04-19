import { ObjectKeyValArrayKeyVal } from '../types/basic.js';
import { CaseListRecordSet } from '../types/cases.js';

async function getProperty(table: string, item: string) {
  const obj = await import(`./${table}.mock`);
  return obj[item];
}

const mockData: ObjectKeyValArrayKeyVal = {};
const caseListMockData = {
  cases:  {
    staff1Label: '',
    staff2Label: '',
    caseList: [{ }]
  }
};

// credit: Typescript documentation, src
// https://www.typescriptlang.org/docs/handbook/advanced-types.html#index-types
//function getProperty<T, K extends keyof T>(o: T, propertyName: K): T[K] {
//  return o[propertyName]; // o[propertyName] is of type T[K]
//}

export { getProperty, mockData, caseListMockData };

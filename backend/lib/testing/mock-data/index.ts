import { ObjectKeyValArrayKeyVal } from '../../use-cases/application.types';

async function getProperty(table: string, item: string) {
  const obj = await import(`./${table}.mock`);
  return obj[item];
}

const mockData: ObjectKeyValArrayKeyVal = {};

export { getProperty, mockData };

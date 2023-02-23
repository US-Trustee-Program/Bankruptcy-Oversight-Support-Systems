/*
import chapters from './chapters.mock';
import cases from './cases.mock';
*/

// credit: Typescript documentation, src
// https://www.typescriptlang.org/docs/handbook/advanced-types.html#index-types
//function getProperty<T, K extends keyof T>(o: T, propertyName: K): T[K] {
//  return o[propertyName]; // o[propertyName] is of type T[K]
//}
async function getProperty(table: string, item: string) {
  console.log(`importing ${table}`);
  const obj = await import(`./${table}.mock`);
  console.log(`returning ${table}[${item}]`);
  console.log(obj[item]);
  return obj[item];
}
/*
export default { chapters, cases };
*/
export { getProperty };

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
  const obj = await import(`./${table}.mock`);
  return obj[item];

}
/*
export default { chapters, cases };
*/
export { getProperty };

export type FilterOperation = {
  equals?: unknown;
  greaterThan?: unknown;
  greaterThanOrEqual?: unknown;
  contains?: unknown;
  lessThan?: unknown;
  lessThanOrEqual?: unknown;
  notEqual?: unknown;
  notContains?: unknown;
  not?: unknown;
  exists?: boolean;
};

export type Filter = FilterOperation & {
  [key: string]: unknown;
};

export type BooleanOperation = {
  and?: Filter[];
  or?: Filter[];
  all?: unknown[];
};

export type DocumentQuery = BooleanOperation & {
  [key: string]: Filter | Filter[] | BooleanOperation;
};

const keyMapping: { [key: string]: string } = {
  and: '$and',
  or: '$or',
  exists: '$exists',
  all: '$all',
  equals: '$eq',
  greaterThan: '$gt',
  greaterThanOrEqual: '$gte',
  contains: '$in',
  lessThan: '$lt',
  lessThanOrEqual: '$lte',
  notEqual: '$ne',
  notContains: '$nin',
  not: '$not',
  regex: '$regex',
};

export type DocumentCollection<T> = {
  upsert: (data: T) => T;
  get: (id: string) => T;
  query: (query: DocumentQuery) => T;
};

export function transformQuery(query: DocumentQuery | Filter[]) {
  if (Array.isArray(query)) {
    return query.map((item) => transformQuery(item));
  } else if (query !== null && typeof query === 'object') {
    return Object.keys(query).reduce((acc, key) => {
      const mappedKey = keyMapping[key] || key;
      acc[mappedKey] = transformQuery(query[key]);
      return acc;
    }, {} as DocumentQuery);
  }
  return query;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConditionOrConjunction } from '../../query/query-builder';

export interface DocumentCollectionAdapter<T> {
  find: (query: ConditionOrConjunction | null, sort?: any) => Promise<T[]>;
  findOne: (query: ConditionOrConjunction) => Promise<T>;
  replaceOne: (query: ConditionOrConjunction, item: unknown, upsert?: boolean) => Promise<string>;
  insertOne: (item: unknown) => Promise<string>;
  insertMany: (items: unknown[]) => Promise<string[]>;
  deleteOne: (query: ConditionOrConjunction) => Promise<number>;
  deleteMany: (query: ConditionOrConjunction) => Promise<number>;
  countDocuments: (query: ConditionOrConjunction | null) => Promise<number>;
}

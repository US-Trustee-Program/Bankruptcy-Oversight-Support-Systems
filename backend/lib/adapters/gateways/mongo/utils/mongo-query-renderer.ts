import { Sort as MongoSort } from 'mongodb';

import { DocumentQuery } from '../../../../humble-objects/mongo-humble';
import {
  Condition,
  Conjunction,
  isCondition,
  isConjunction,
  isField,
  Query,
  SortSpec,
} from '../../../../query/query-builder';

const { isArray } = Array;

const mapCondition: { [key: string]: string } = {
  CONTAINS: '$in',
  EQUALS: '$eq',
  EXISTS: '$exists',
  GREATER_THAN: '$gt',
  GREATER_THAN_OR_EQUAL: '$gte',
  LESS_THAN: '$lt',
  LESS_THAN_OR_EQUAL: '$lte',
  NOT_CONTAINS: '$nin',
  NOT_EQUALS: '$ne',
  REGEX: '$regex',
};

function translateCondition<T = unknown>(query: Condition<T>) {
  if (isField(query.rightOperand)) {
    return {
      $expr: {
        [mapCondition[query.condition]]: [
          `$${query.leftOperand.name.toString()}`,
          `$${query.rightOperand.name.toString()}`,
        ],
      },
    };
  } else {
    return { [query.leftOperand.name]: { [mapCondition[query.condition]]: query.rightOperand } };
  }
}

const mapConjunction: { [key: string]: string } = {
  AND: '$and',
  NOT: '$not',
  OR: '$or',
};

export function toMongoQuery<T = unknown>(query: Query<T>): DocumentQuery {
  return renderQuery(query);
}

export function toMongoSort<T = never>(sort: SortSpec<T>): MongoSort {
  return sort.fields.reduce(
    (acc, spec) => {
      acc[spec.field.name] = spec.direction === 'ASCENDING' ? 1 : -1;
      return acc;
    },
    {} as Record<keyof T, -1 | 1>,
  );
}

function renderQuery<T = unknown>(query: Query<T>) {
  if (isArray(query)) {
    return query.map((q) => renderQuery(q));
  } else if (isConjunction(query)) {
    return translateConjunction(query);
  } else if (isCondition(query)) {
    return translateCondition(query);
  }
}

function translateConjunction(query: Conjunction) {
  return { [mapConjunction[query.conjunction]]: renderQuery(query.values) };
}

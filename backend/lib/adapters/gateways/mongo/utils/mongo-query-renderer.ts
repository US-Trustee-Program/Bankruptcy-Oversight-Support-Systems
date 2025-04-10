import { Sort as MongoSort } from 'mongodb';
import {
  Condition,
  Conjunction,
  isCondition,
  isConjunction,
  Query,
  isField,
  SortSpec,
} from '../../../../query/query-builder';
import { DocumentQuery } from '../../../../humble-objects/mongo-humble';

const { isArray } = Array;

const mapCondition: { [key: string]: string } = {
  EXISTS: '$exists',
  EQUALS: '$eq',
  GREATER_THAN: '$gt',
  GREATER_THAN_OR_EQUAL: '$gte',
  CONTAINS: '$in',
  LESS_THAN: '$lt',
  LESS_THAN_OR_EQUAL: '$lte',
  NOT_EQUAL: '$ne',
  NOT_CONTAINS: '$nin',
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
  OR: '$or',
  NOT: '$not',
};

function translateConjunction(query: Conjunction) {
  return { [mapConjunction[query.conjunction]]: renderQuery(query.values) };
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

export function toMongoQuery<T = unknown>(query: Query<T>): DocumentQuery {
  return renderQuery(query);
}

export function toMongoSort<T = never>(sort: SortSpec<T>): MongoSort {
  return sort.fields.reduce(
    (acc, spec) => {
      acc[spec.field.name] = spec.direction === 'ASCENDING' ? 1 : -1;
      return acc;
    },
    {} as Record<keyof T, 1 | -1>,
  );
}

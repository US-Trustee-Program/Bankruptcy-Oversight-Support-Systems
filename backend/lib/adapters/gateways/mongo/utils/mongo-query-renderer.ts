import { ObjectId, Sort as MongoSort } from 'mongodb';
import {
  Condition,
  Conjunction,
  isCondition,
  isConjunction,
  Projection,
  Query,
  isField,
  SortSpec,
} from '../../../../query/query-builder';
import { DocumentQuery } from '../../../../humble-objects/mongo-humble';

const { isArray } = Array;

// ObjectId strings are 24 hex characters
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value);
}

/**
 * Converts string values to ObjectId when querying the _id field.
 * MongoDB stores _id as ObjectId, so string comparisons won't work correctly.
 */
function coerceObjectId(fieldName: string | number | symbol, value: unknown): unknown {
  if (fieldName === '_id' && isObjectIdString(value)) {
    return new ObjectId(value);
  }
  return value;
}

const mapCondition: { [key: string]: string } = {
  EXISTS: '$exists',
  EQUALS: '$eq',
  GREATER_THAN: '$gt',
  GREATER_THAN_OR_EQUAL: '$gte',
  CONTAINS: '$in',
  LESS_THAN: '$lt',
  LESS_THAN_OR_EQUAL: '$lte',
  NOT_EQUALS: '$ne',
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
    const fieldName = query.leftOperand.name;
    const value = coerceObjectId(fieldName, query.rightOperand);
    return { [fieldName]: { [mapCondition[query.condition]]: value } };
  }
}

const mapConjunction: { [key: string]: string } = {
  AND: '$and',
  OR: '$or',
  NOT: '$nor',
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

export function toMongoProjection<T = never>(projection: Projection<T>): Record<string, 0 | 1> {
  const value: 0 | 1 = projection.mode === 'INCLUDE' ? 1 : 0;
  const result: Record<string, 0 | 1> = {};
  projection.fields.forEach((field) => {
    result[field as string] = value;
  });
  if (projection.mode === 'INCLUDE' && !('_id' in result)) {
    result['_id'] = 0;
  }
  return result;
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

import { DocumentQuery } from '../adapters/gateways/document-db.repository';
import {
  Condition,
  ConditionOrConjunction,
  Conjunction,
  isCondition,
  isConjunction,
} from './query-builder';

const isArray = Array.isArray;

const matchCondition: { [key: string]: string } = {
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

function translateCondition(query: Condition) {
  return { [query.attributeName]: { [matchCondition[query.condition]]: query.value } };
}

const matchConjunction: { [key: string]: string } = {
  AND: '$and',
  OR: '$or',
  NOT: '$not',
};

function translateConjunction(query: Conjunction) {
  return { [matchConjunction[query.conjunction]]: renderQuery(query.values) };
}

function renderQuery(query: ConditionOrConjunction | ConditionOrConjunction[]) {
  if (isArray(query)) {
    return query.map((q) => renderQuery(q));
  } else if (isConjunction(query)) {
    return translateConjunction(query);
  } else if (isCondition(query)) {
    return translateCondition(query);
  }
}

export function toMongoQuery(query: ConditionOrConjunction): DocumentQuery {
  return renderQuery(query);
}

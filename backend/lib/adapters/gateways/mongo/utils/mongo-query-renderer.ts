import { Sort as MongoSort } from 'mongodb';
import {
  Condition,
  Conjunction,
  isCondition,
  isConjunction,
  Sort,
  Pagination,
  isPagination,
  Query,
} from '../../../../query/query-builder';
import { DocumentQuery } from '../../../../humble-objects/mongo-humble';

const isArray = Array.isArray;

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

// TODO: create new aggregate renderer
// https://www.mongodb.com/docs/manual/reference/operator/aggregation/#std-label-aggregation-expressions
function translateCondition(query: Condition) {
  if (query.compareFields) {
    return {
      $expr: {
        [mapCondition[query.condition]]: [`$${query.leftOperand}`, `$${query.rightOperand}`],
      },
    };
  } else {
    return { [query.leftOperand]: { [mapCondition[query.condition]]: query.rightOperand } };
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

function translatePagination(query: Pagination) {
  const match = renderQuery(query.values)[0];
  const result = [];

  result.push({
    $match: match,
  });

  if (Object.keys(query).includes('sort')) {
    result.push({
      $sort: toMongoSort(query.sort),
    });
  }

  result.push({
    $facet: {
      data: [
        { $skip: query.skip },
        {
          $limit: query.limit,
        },
      ],
    },
  });

  return result;
}

function renderQuery(query: Query) {
  if (isArray(query)) {
    return query.map((q) => renderQuery(q));
  } else if (isPagination(query)) {
    return translatePagination(query);
  } else if (isConjunction(query)) {
    return translateConjunction(query);
  } else if (isCondition(query)) {
    return translateCondition(query);
  }
}

export function toMongoQuery(query: Query): DocumentQuery {
  return renderQuery(query);
}

export function toMongoSort(sort: Sort): MongoSort {
  return sort.attributes.reduce((acc, direction) => {
    acc[direction[0]] = direction[1] === 'ASCENDING' ? 1 : -1;
    return acc;
  }, {});
}

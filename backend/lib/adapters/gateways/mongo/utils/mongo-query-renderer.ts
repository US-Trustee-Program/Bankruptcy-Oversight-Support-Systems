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
  isField,
} from '../../../../query/query-builder';
import { DocumentQuery } from '../../../../humble-objects/mongo-humble';
import { CamsError } from '../../../../common-errors/cams-error';

const MODULE_NAME = 'MONGO-QUERY-RENDERER';

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

// TODO: create new aggregate renderer
// https://www.mongodb.com/docs/manual/reference/operator/aggregation/#std-label-aggregation-expressions
function translateCondition<T = unknown>(query: Condition<T>) {
  const compareFields = isField(query.rightOperand);
  if (compareFields) {
    return {
      $expr: {
        [mapCondition[query.condition]]: [
          `$${query.leftOperand['field'].toString()}`,
          `$${query.rightOperand['field'].toString()}`,
        ],
      },
    };
  } else {
    // TODO: figure out how we know this is in need of special handling vis-a-vis aggregate pipeline filter
    // or do it in the aggregate renderer
    if (isField(query.leftOperand)) {
      return { [query.leftOperand.field]: { [mapCondition[query.condition]]: query.rightOperand } };
    } else {
      // TODO: handle the case where leftOperand is a Condition
      throw new CamsError(MODULE_NAME, {
        message: 'The base renderer currently cannot handle nested Conditions.',
      });
    }
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

function renderQuery<T = unknown>(query: Query<T>) {
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

export function toMongoQuery<T = unknown>(query: Query<T>): DocumentQuery {
  return renderQuery(query);
}

export function toMongoSort<T = unknown>(sort: Sort<T>): MongoSort {
  return sort.attributes.reduce(
    (acc, direction) => {
      acc[direction[0]] = direction[1] === 'ASCENDING' ? 1 : -1;
      return acc;
    },
    {} as Record<keyof T, 1 | -1>,
  );
}

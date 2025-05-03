import { CamsError } from '../../../../common-errors/cams-error';
import { AggregateQuery } from '../../../../humble-objects/mongo-humble';
import {
  Condition,
  ConditionOrConjunction,
  isCondition,
  isField,
} from '../../../../query/query-builder';
import {
  Accumulator,
  AddFields,
  ExcludeFields,
  Group,
  Join,
  Paginate,
  Pipeline,
  Sort,
} from '../../../../query/query-pipeline';
import { toMongoQuery } from './mongo-query-renderer';

const MODULE_NAME = 'MONGO-AGGREGATE-RENDERER';

export function toMongoAccumulatorOperator(spec: Accumulator) {
  if (spec.accumulator === 'FIRST') {
    return {
      $first: `$${spec.field.name.toString()}`,
    };
  } else if (spec.accumulator === 'COUNT') {
    return {
      $count: {},
    };
  }
}

export function toMongoAddFields(stage: AddFields) {
  const fields = stage.fields.reduce((acc, additional) => {
    acc[additional.fieldToAdd.name] = {
      $filter: {
        cond: toMongoFilterCondition(additional.query) ?? {},
        input: { $ifNull: [`$${additional.querySource.name.toString()}`, []] },
      },
    };
    return acc;
  }, {});
  return {
    $addFields: fields,
  };
}

export function toMongoAggregateSort(sort: Sort) {
  return {
    $sort: sort.fields.reduce(
      (acc, sortSpec) => {
        acc[sortSpec.field.name] = sortSpec.direction === 'ASCENDING' ? 1 : -1;
        return acc;
      },
      {} as Record<never, -1 | 1>,
    ),
  };
}

export function toMongoFilterCondition<T = unknown>(query: ConditionOrConjunction<T>) {
  if (isCondition(query)) {
    return translateCondition(query);
  }
}

export function toMongoGroup(stage: Group) {
  const group = {
    $group: {
      _id: stage.groupBy.map((field) => `$${field.name.toString()}`).join(''),
    },
  };

  return stage.accumulators.reduce((acc, spec) => {
    acc.$group[spec.as.name.toString()] = toMongoAccumulatorOperator(spec);
    return acc;
  }, group);
}

export function toMongoLookup(join: Join) {
  return {
    $lookup: {
      as: join.alias.name,
      foreignField: join.foreign.name,
      from: join.foreign.source,
      localField: join.local.name,
    },
  };
}

export function toMongoProject(stage: ExcludeFields) {
  // Note that we could extend this by letting stage be another type.
  // https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/#syntax
  const fields = stage.fields.reduce((acc, field) => {
    acc[field.name] = 0;
    return acc;
  }, {});
  return { $project: fields };
}

export function translateCondition<T = unknown>(query: Condition<T>) {
  if (!isField(query.leftOperand)) {
    throw new CamsError(MODULE_NAME, { message: 'leftOperand must be a field' });
  }
  const { name: field } = query.leftOperand;
  let left: unknown = `$$this.${field.toString()}`;
  let right = query.rightOperand;
  let condition = mapCondition[query.condition];
  if (query.condition === 'EXISTS') {
    left = { $ifNull: [`$$this.${field.toString()}`, null] };
    condition = right ? '$ne' : '$eq';
    right = null;
  }
  return {
    [condition]: [left, right],
  };
}

function toMongoPaginatedFacet(paginate: Paginate) {
  return {
    $facet: {
      data: [
        { $skip: paginate.skip },
        {
          $limit: paginate.limit,
        },
      ],
      metadata: [{ $count: 'total' }],
    },
  };
}

const mapCondition: { [key: string]: string } = {
  CONTAINS: '$in',
  EQUALS: '$eq',
  GREATER_THAN: '$gt',
  GREATER_THAN_OR_EQUAL: '$gte',
  IF_NULL: '$ifNull',
  LESS_THAN: '$lt',
  LESS_THAN_OR_EQUAL: '$lte',
  NOT_CONTAINS: '$nin',
  NOT_EQUALS: '$ne',
  REGEX: '$regex',
};

export function toMongoAggregate(pipeline: Pipeline): AggregateQuery {
  return pipeline.stages.map((stage) => {
    if (stage.stage === 'SORT') {
      return toMongoAggregateSort(stage);
    }
    if (stage.stage === 'PAGINATE') {
      return toMongoPaginatedFacet(stage);
    }
    if (stage.stage === 'MATCH') {
      return { $match: toMongoQuery(stage) };
    }
    if (stage.stage === 'JOIN') {
      return toMongoLookup(stage);
    }
    if (stage.stage === 'ADD_FIELDS') {
      return toMongoAddFields(stage);
    }
    if (stage.stage === 'EXCLUDE') {
      return toMongoProject(stage);
    }
    if (stage.stage === 'GROUP') {
      return toMongoGroup(stage);
    }
  });
}

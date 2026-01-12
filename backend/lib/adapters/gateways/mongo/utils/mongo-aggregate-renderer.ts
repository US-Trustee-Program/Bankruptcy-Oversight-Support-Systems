import {
  Accumulator,
  AddFields,
  ExcludeFields,
  Group,
  IncludeFields,
  Join,
  Paginate,
  Pipeline,
  Sort,
  VectorSearch,
} from '../../../../query/query-pipeline';
import { toMongoQuery } from './mongo-query-renderer';
import { AggregateQuery } from '../../../../humble-objects/mongo-humble';
import {
  Condition,
  ConditionOrConjunction,
  isCondition,
  isField,
} from '../../../../query/query-builder';
import { CamsError } from '../../../../common-errors/cams-error';

const MODULE_NAME = 'MONGO-AGGREGATE-RENDERER';

function toMongoAggregateSort(sort: Sort) {
  return {
    $sort: sort.fields.reduce(
      (acc, sortSpec) => {
        acc[sortSpec.field.name] = sortSpec.direction === 'ASCENDING' ? 1 : -1;
        return acc;
      },
      {} as Record<never, 1 | -1>,
    ),
  };
}

function toMongoVectorSearch(stage: VectorSearch) {
  return {
    $search: {
      cosmosSearch: {
        vector: stage.vector,
        path: stage.path,
        k: stage.k,
        ...(stage.similarity && { similarity: stage.similarity }),
      },
      returnStoredSource: true,
    },
  };
}

function toMongoPaginatedFacet(paginate: Paginate) {
  return {
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $skip: paginate.skip },
        {
          $limit: paginate.limit,
        },
      ],
    },
  };
}

function toMongoLookup(join: Join) {
  return {
    $lookup: {
      from: join.foreign.source,
      foreignField: join.foreign.name,
      localField: join.local.name,
      as: join.alias.name,
    },
  };
}

function toMongoAddFields(stage: AddFields) {
  const fields = stage.fields.reduce((acc, additional) => {
    acc[additional.fieldToAdd.name] = {
      $filter: {
        input: { $ifNull: [`$${additional.querySource.name.toString()}`, []] },
        cond: toMongoFilterCondition(additional.query) ?? {},
      },
    };
    return acc;
  }, {});
  return {
    $addFields: fields,
  };
}

function toMongoAccumulatorOperator(spec: Accumulator) {
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

function toMongoGroup(stage: Group) {
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

// TODO: Future contraction. We can provide a unified projection `toMongoProject` if we produce another stage that includes inclusive and exclusive field specifications.
// See: https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/#syntax

function toMongoProjectExclude(stage: ExcludeFields) {
  const fields = stage.fields.reduce((acc, field) => {
    acc[field.name] = 0;
    return acc;
  }, {});
  return { $project: fields };
}

function toMongoProjectInclude(stage: IncludeFields) {
  const fields = stage.fields.reduce((acc, field) => {
    acc[field.name] = 1;
    return acc;
  }, {});
  return { $project: fields };
}

function toMongoFilterCondition<T = unknown>(query: ConditionOrConjunction<T>) {
  if (isCondition(query)) {
    return translateCondition(query);
  }
}

function translateCondition<T = unknown>(query: Condition<T>) {
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

const mapCondition: { [key: string]: string } = {
  EQUALS: '$eq',
  GREATER_THAN: '$gt',
  GREATER_THAN_OR_EQUAL: '$gte',
  CONTAINS: '$in',
  LESS_THAN: '$lt',
  LESS_THAN_OR_EQUAL: '$lte',
  NOT_EQUALS: '$ne',
  NOT_CONTAINS: '$nin',
  REGEX: '$regex',
  IF_NULL: '$ifNull',
};

function toMongoAggregate(pipeline: Pipeline): AggregateQuery {
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
      return toMongoProjectExclude(stage);
    }
    if (stage.stage === 'INCLUDE') {
      return toMongoProjectInclude(stage);
    }
    if (stage.stage === 'GROUP') {
      return toMongoGroup(stage);
    }
    if (stage.stage === 'VECTOR_SEARCH') {
      return toMongoVectorSearch(stage);
    }
  });
}

const MongoAggregateRenderer = {
  toMongoAggregateSort,
  toMongoLookup,
  toMongoAddFields,
  toMongoAccumulatorOperator,
  toMongoGroup,
  toMongoProjectExclude,
  toMongoProjectInclude,
  toMongoFilterCondition,
  translateCondition,
  toMongoAggregate,
  toMongoVectorSearch,
};

export default MongoAggregateRenderer;

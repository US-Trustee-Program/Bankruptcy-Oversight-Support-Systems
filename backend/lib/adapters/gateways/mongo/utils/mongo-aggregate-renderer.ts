import {
  Paginate,
  Pipeline,
  Sort,
  Join,
  AddFields,
  ExcludeFields,
} from '../../../../query/query-pipeline';
import { toMongoQuery } from './mongo-query-renderer';
import { AggregateQuery } from '../../../../humble-objects/mongo-humble';

export function toMongoSort(sort: Sort) {
  return {
    $sort: sort.attributes.reduce(
      (acc, attribute) => {
        acc[attribute.field] = attribute.direction === 'ASCENDING' ? 1 : -1;
        return acc;
      },
      {} as Record<never, 1 | -1>,
    ),
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
    },
  };
}

export function toMongoLookup(join: Join) {
  return {
    $lookup: {
      from: join.foreign.source,
      foreignField: join.foreign.field,
      localField: join.local.field,
      as: join.alias,
    },
  };
}

export function toMongoAddFields(stage: AddFields) {
  const fields = stage.fields.reduce((acc, additional) => {
    acc[additional.field] = {
      $filter: {
        input: additional.source,
        cond: toMongoQuery(additional.query),
      },
    };
    return acc;
  }, {});
  return {
    $addFields: fields,
  };
}

export function toMongoProject(stage: ExcludeFields) {
  // Note that we could extend this by letting stage be another type.
  // https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/#syntax
  const fields = stage.fields.reduce((acc, field) => {
    acc[field] = 0;
    return acc;
  }, {});
  return { $project: fields };
}

export function toMongoAggregate(pipeline: Pipeline): AggregateQuery {
  return pipeline.stages.map((stage) => {
    if (stage.stage === 'SORT') {
      return toMongoSort(stage);
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
  });
}

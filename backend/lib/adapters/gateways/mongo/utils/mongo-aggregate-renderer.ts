import { Sort as MongoSort } from 'mongodb';
import { isPipeline, Paginate, Pipeline, Sort } from '../../../../query/query-pipeline';
import { toMongoQuery } from './mongo-query-renderer';
import { AggregateQuery } from '../../../../humble-objects/mongo-humble';

export function toMongoSort(sort: Sort): MongoSort {
  return sort.attributes.reduce(
    (acc, direction) => {
      acc[direction[0]] = direction[1] === 'ASCENDING' ? 1 : -1;
      return acc;
    },
    {} as Record<never, 1 | -1>,
  );
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

export function toMongoAggregate(pipeline: Pipeline): AggregateQuery {
  if (!isPipeline(pipeline)) {
    throw new Error('Invalid pipeline');
  }

  return pipeline.stages.map((stage) => {
    if (stage.stage === 'SORT') {
      return { $sort: toMongoSort(stage) };
    }
    if (stage.stage === 'PAGINATE') {
      return toMongoPaginatedFacet(stage);
    }
    if (stage.stage === 'MATCH') {
      return { $match: toMongoQuery(stage) };
    }
  });
}

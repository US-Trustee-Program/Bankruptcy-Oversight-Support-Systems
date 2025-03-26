import { Sort as MongoSort } from 'mongodb';
import { isPipeline, Paginate, Pipeline, Sort } from '../../../../query/query-pipeline';
import { toMongoQuery } from './mongo-query-renderer';

export function toMongoSort<T = unknown>(sort: Sort<T>): MongoSort {
  return sort.attributes.reduce(
    (acc, direction) => {
      acc[direction[0]] = direction[1] === 'ASCENDING' ? 1 : -1;
      return acc;
    },
    {} as Record<keyof T, 1 | -1>,
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

export function toMongoAggregate(pipeline: Pipeline) {
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

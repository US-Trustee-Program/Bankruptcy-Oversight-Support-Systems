import {
  Accumulator,
  AddFields,
  ExcludeFields,
  Group,
  IncludeFields,
  Join,
  Paginate,
  Pipeline,
  Score,
  Sort,
} from '../../../../query/query-pipeline';
import { isPhoneticToken } from '../../../utils/phonetic-helper';
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

/**
 * Renders a SCORE stage to MongoDB aggregation pipeline stages.
 *
 * Generates 3 MongoDB stages that compute a weighted match score:
 *
 * 1. $addFields - For each targetField, computes:
 *    - Bigram match count: number of lowercase tokens (e.g., "jo", "hn") found in document
 *    - Phonetic match count: number of uppercase tokens (e.g., "JN", "J500") found in document
 *    - Field score: (bigramMatches × bigramWeight) + (phoneticMatches × phoneticWeight)
 *
 * 2. $addFields - Computes:
 *    - outputField: max score across all target fields (handles both debtor and jointDebtor)
 *    - bigramMatchCount: max bigram matches across all target fields (for filtering)
 *
 * 3. $project - Removes temporary computation fields
 *
 * The bigramMatchCount field enables filtering to require at least one bigram match,
 * preventing phonetic-only matches (e.g., "John" → "Jane") while still allowing
 * nickname matches that share bigrams (e.g., "Mike" → "Michael" via shared "mi").
 *
 * @example
 * // Search query: "John" → searchTokens = ["jo", "oh", "hn", "J500", "JN"]
 * // Document has: { debtor: { phoneticTokens: ["jo", "oh", "hn", "J500", "JN", "S530", "SM0", "sm", "mi", "it", "th"] } }
 * //   (stored tokens include both bigrams and phonetic codes for "John Smith")
 * // Matching: 3 bigrams match (jo, oh, hn), 2 phonetics match (J500, JN)
 * // Result: matchScore = (3 × 3) + (2 × 10) = 29, bigramMatchCount = 3
 *
 * @example
 * // Search query: "John" → searchTokens = ["jo", "oh", "hn", "J500", "JN"]
 * // Document has: { debtor: { phoneticTokens: ["ja", "an", "ne", "J500", "JN"] } }
 * //   (stored tokens for "Jane" - shares phonetic codes but different bigrams)
 * // Matching: 0 bigrams match, 2 phonetics match (J500, JN)
 * // Result: matchScore = (0 × 3) + (2 × 10) = 20, bigramMatchCount = 0
 * // "Jane" is filtered out because bigramMatchCount = 0
 *
 * @param stage - The Score stage configuration
 * @returns Array of 3 MongoDB aggregation stage objects
 */
function toMongoScore(stage: Score): object[] {
  const { searchTokens, targetFields, outputField, bigramWeight, phoneticWeight } = stage;

  const queryBigrams = searchTokens.filter((t) => !isPhoneticToken(t));
  const queryPhonetics = searchTokens.filter((t) => isPhoneticToken(t));

  const fieldScoreExpressions: Record<string, object> = {};
  const tempFieldNames: string[] = [];

  targetFields.forEach((field, idx) => {
    const bigramField = `_bigramMatches_${idx}`;
    const phoneticField = `_phoneticMatches_${idx}`;
    const scoreField = `_score_${idx}`;
    tempFieldNames.push(bigramField, phoneticField, scoreField);

    fieldScoreExpressions[bigramField] = {
      $size: {
        $setIntersection: [queryBigrams, { $ifNull: [`$${field}`, []] }],
      },
    };

    fieldScoreExpressions[phoneticField] = {
      $size: {
        $setIntersection: [queryPhonetics, { $ifNull: [`$${field}`, []] }],
      },
    };

    fieldScoreExpressions[scoreField] = {
      $add: [
        { $multiply: [`$${bigramField}`, bigramWeight] },
        { $multiply: [`$${phoneticField}`, phoneticWeight] },
      ],
    };
  });

  const maxScoreExpression = {
    [outputField]: {
      $max: targetFields.map((_, idx) => `$_score_${idx}`),
    },
    bigramMatchCount: {
      $max: targetFields.map((_, idx) => `$_bigramMatches_${idx}`),
    },
  };

  const cleanupProjection = tempFieldNames.reduce(
    (acc, field) => {
      acc[field] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );

  return [
    { $addFields: fieldScoreExpressions },
    { $addFields: maxScoreExpression },
    { $project: cleanupProjection },
  ];
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
  return pipeline.stages.flatMap((stage) => {
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
    if (stage.stage === 'SCORE') {
      return toMongoScore(stage);
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
  toMongoScore,
  toMongoFilterCondition,
  translateCondition,
  toMongoAggregate,
};

export default MongoAggregateRenderer;

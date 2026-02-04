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
import { toMongoQuery } from './mongo-query-renderer';
import { AggregateQuery } from '../../../../humble-objects/mongo-humble';
import {
  Condition,
  ConditionOrConjunction,
  isCondition,
  isField,
} from '../../../../query/query-builder';
import { CamsError } from '../../../../common-errors/cams-error';

/**
 * Determines if a token is a phonetic token (Soundex or Metaphone).
 * Phonetic tokens are uppercase alphanumeric strings with length > 1.
 * Bigrams are lowercase, so this distinguishes between the two types.
 *
 * @param token - The token to check
 * @returns True if the token is a phonetic token
 */
function isPhoneticToken(token: string): boolean {
  return token.length > 1 && /^[A-Z0-9]+$/.test(token);
}

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

function partitionSearchTokens(searchTokens: string[]): {
  bigrams: string[];
  phonetics: string[];
} {
  return {
    bigrams: searchTokens.filter((t) => !isPhoneticToken(t)),
    phonetics: searchTokens.filter((t) => isPhoneticToken(t)),
  };
}

function buildMatchCountExpression(tokens: string[], documentField: string): object {
  return {
    $size: {
      $setIntersection: [tokens, { $ifNull: [`$${documentField}`, []] }],
    },
  };
}

/**
 * Builds a search token coverage bonus expression.
 * Rewards matches where a high percentage of search tokens are found.
 *
 * For example:
 * - "mike" (5 tokens) vs "michael" (5 matches) = 100% coverage = 20 points
 * - "mike" (5 tokens) vs "smith" (1 match) = 20% coverage = 4 points
 *
 * @param bigramField - Field containing bigram match count
 * @param phoneticField - Field containing phonetic match count
 * @param nicknameField - Field containing nickname match count
 * @param totalSearchTokens - Total number of tokens in the search query
 * @returns MongoDB expression computing coverage bonus
 */
function buildCoverageBonusExpression(
  bigramField: string,
  phoneticField: string,
  nicknameField: string,
  totalSearchTokens: number,
): object {
  if (totalSearchTokens === 0) {
    return 0;
  }

  // Total matched tokens = bigram + phonetic + nickname matches
  const totalMatches = {
    $add: [`$${bigramField}`, `$${phoneticField}`, `$${nicknameField}`],
  };

  // Coverage percentage (0.0 to 1.0)
  const coverage = {
    $divide: [totalMatches, totalSearchTokens],
  };

  // Convert to bonus points (max 20 points for 100% coverage)
  return {
    $multiply: [coverage, 20],
  };
}

function buildWeightedScoreExpression(
  bigramField: string,
  phoneticField: string,
  nicknameField: string,
  coverageBonusField: string,
  bigramWeight: number,
  phoneticWeight: number,
  nicknameWeight: number,
): object {
  return {
    $add: [
      { $multiply: [`$${bigramField}`, bigramWeight] },
      { $multiply: [`$${phoneticField}`, phoneticWeight] },
      { $multiply: [`$${nicknameField}`, nicknameWeight] },
      `$${coverageBonusField}`,
    ],
  };
}

interface FieldScoreResult {
  expressions: Record<string, object>;
  tempFieldNames: string[];
}

function buildFieldScoreExpressions(
  targetFields: string[],
  bigrams: string[],
  phonetics: string[],
  nicknameTokens: string[],
  totalSearchTokens: number,
  bigramWeight: number,
  phoneticWeight: number,
  nicknameWeight: number,
): FieldScoreResult {
  const expressions: Record<string, object> = {};
  const tempFieldNames: string[] = [];

  // Separate nickname tokens into bigrams and phonetics
  const { bigrams: _nicknameBigrams, phonetics: nicknamePhonetics } =
    partitionSearchTokens(nicknameTokens);

  targetFields.forEach((field, idx) => {
    const bigramField = `_bigramMatches_${idx}`;
    const phoneticField = `_phoneticMatches_${idx}`;
    const nicknameField = `_nicknameMatches_${idx}`;
    const nicknamePhoneticField = `_nicknamePhoneticMatches_${idx}`;
    const coverageBonusField = `_coverageBonus_${idx}`;
    const scoreField = `_score_${idx}`;
    tempFieldNames.push(
      bigramField,
      phoneticField,
      nicknameField,
      nicknamePhoneticField,
      coverageBonusField,
      scoreField,
    );

    expressions[bigramField] = buildMatchCountExpression(bigrams, field);
    expressions[phoneticField] = buildMatchCountExpression(phonetics, field);
    expressions[nicknameField] = buildMatchCountExpression(nicknameTokens, field);
    expressions[nicknamePhoneticField] = buildMatchCountExpression(nicknamePhonetics, field);
    expressions[coverageBonusField] = buildCoverageBonusExpression(
      bigramField,
      phoneticField,
      nicknameField,
      totalSearchTokens,
    );
    expressions[scoreField] = buildWeightedScoreExpression(
      bigramField,
      phoneticField,
      nicknameField,
      coverageBonusField,
      bigramWeight,
      phoneticWeight,
      nicknameWeight,
    );
  });

  return { expressions, tempFieldNames };
}

function buildMaxScoreExpression(
  outputField: string,
  targetFields: string[],
): Record<string, object> {
  return {
    [outputField]: {
      $max: targetFields.map((_, idx) => `$_score_${idx}`),
    },
    bigramMatchCount: {
      $max: targetFields.map((_, idx) => `$_bigramMatches_${idx}`),
    },
    phoneticMatchCount: {
      $max: targetFields.map((_, idx) => `$_phoneticMatches_${idx}`),
    },
    nicknameMatchCount: {
      $max: targetFields.map((_, idx) => `$_nicknameMatches_${idx}`),
    },
    nicknamePhoneticMatchCount: {
      $max: targetFields.map((_, idx) => `$_nicknamePhoneticMatches_${idx}`),
    },
  };
}

function buildCleanupProjection(tempFieldNames: string[]): Record<string, number> {
  return tempFieldNames.reduce(
    (acc, field) => {
      acc[field] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );
}

/**
 * Renders a SCORE stage to MongoDB aggregation pipeline stages.
 *
 * Generates 3 MongoDB stages that compute a weighted match score with quality metrics:
 *
 * 1. $addFields - For each targetField, computes:
 *    - Bigram match count: number of lowercase tokens (e.g., "jo", "hn") found in document
 *    - Phonetic match count: number of uppercase phonetic tokens from search term found in document
 *    - Nickname match count: number of all nickname tokens (bigrams + phonetics) found in document
 *    - Nickname phonetic match count: number of uppercase phonetic tokens from nicknames found in document
 *    - Coverage bonus: percentage of query tokens matched (rewards comprehensive matches)
 *    - Field score: weighted sum of all match types + coverage bonus
 *
 * 2. $addFields - Computes:
 *    - outputField: max score across all target fields (handles both debtor and jointDebtor)
 *    - bigramMatchCount: max bigram matches across all target fields (for filtering)
 *    - phoneticMatchCount: max phonetic matches across all target fields (for filtering)
 *    - nicknameMatchCount: max nickname matches across all target fields
 *    - nicknamePhoneticMatchCount: max nickname phonetic matches (for filtering)
 *
 * 3. $project - Removes temporary computation fields
 *
 * The bigramMatchCount, phoneticMatchCount, and nicknamePhoneticMatchCount fields enable two-layer filtering:
 * 1. Require phonetic match (phoneticMatchCount > 0 OR nicknamePhoneticMatchCount > 0)
 *    → Prevents bigram-only false positives (e.g., "mike" matching "Richard" via "Michael" bigrams)
 * 2. Require bigram match (bigramMatchCount >= 1)
 *    → Prevents phonetic-only false positives (e.g., "mike" matching "McKay" via identical Soundex M200/MK)
 *
 * Scoring weights (default):
 *   - Bigram matches: 3 points each (substring matching)
 *   - Phonetic matches: 11 points each (sound-alike matching)
 *   - Nickname matches: 10 points each (e.g., Mike → Michael)
 *   - Coverage bonus: up to 20 points (based on % of query tokens matched)
 *
 * @example
 * // Search query: "Mike" → searchTokens = ["mi", "ik", "ke", "M200", "MK"]
 * //                      → nicknameTokens = ["mi", "ic", "ch", "ha", "ae", "el", "M240", "MKSHL"] (from "Michael")
 * // Document "Michael": phoneticTokens = ["mi", "ic", "ch", "ha", "ae", "el", "M240", "MKSHL"]
 * // bigramMatchCount = 1 (mi), phoneticMatchCount = 0, nicknamePhoneticMatchCount = 2 (M240, MKSHL)
 * // PASSES: phonetic ✓ (nickname), bigram ✓ → High relevance match
 *
 * @example
 * // Search query: "Mike" → searchTokens = ["mi", "ik", "ke", "M200", "MK"]
 * // Document "McKay": phoneticTokens = ["mc", "ck", "ka", "ay", "M200", "MK"]
 * // bigramMatchCount = 0 (no overlap), phoneticMatchCount = 2 (M200, MK), nicknamePhoneticMatchCount = 0
 * // FILTERED OUT: phonetic ✓ but bigram ✗ → Soundex collision, not a real match
 *
 * @example
 * // Search query: "Mike" → searchTokens = ["mi", "ik", "ke", "M200", "MK"]
 * //                      → nicknameTokens = ["mi", "ic", "ch", "ha", "ae", "el", "M240", "MKSHL"]
 * // Document "Richard": phoneticTokens = ["ri", "ic", "ch", "ha", "ar", "rd", "R263", "RKSHRT"]
 * // bigramMatchCount = 3 (ic, ch, ha from nickname), phoneticMatchCount = 0, nicknamePhoneticMatchCount = 0
 * // FILTERED OUT: phonetic ✗ → Only shares bigrams with nickname, not phonetically similar
 *
 * @param stage - The Score stage configuration
 * @returns Array of 3 MongoDB aggregation stage objects
 */
function toMongoScore(stage: Score): object[] {
  const {
    searchTokens,
    nicknameTokens,
    targetFields,
    outputField,
    bigramWeight,
    phoneticWeight,
    nicknameWeight,
  } = stage;

  const { bigrams, phonetics } = partitionSearchTokens(searchTokens);
  const totalSearchTokens = searchTokens.length + nicknameTokens.length;

  const { expressions, tempFieldNames } = buildFieldScoreExpressions(
    targetFields,
    bigrams,
    phonetics,
    nicknameTokens,
    totalSearchTokens,
    bigramWeight,
    phoneticWeight,
    nicknameWeight,
  );

  return [
    { $addFields: expressions },
    { $addFields: buildMaxScoreExpression(outputField, targetFields) },
    { $project: buildCleanupProjection(tempFieldNames) },
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
  isPhoneticToken,
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

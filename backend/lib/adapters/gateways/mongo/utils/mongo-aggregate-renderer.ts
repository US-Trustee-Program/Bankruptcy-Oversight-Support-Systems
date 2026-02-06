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

/**
 * Builds a MongoDB expression to parse a name field into normalized word array.
 * Splits on both whitespace and hyphens, converts to lowercase.
 * This ensures "jean-pierre" is tokenized as ["jean", "pierre"] to match search queries.
 *
 * @param nameField - The document field containing a name (e.g., 'debtor.name')
 * @returns MongoDB expression that produces an array of lowercase words
 */
function buildParseWordsExpression(nameField: string): object {
  // Get lowercase string, defaulting to empty string for null/missing
  const lowerName = { $toLower: { $ifNull: [`$${nameField}`, ''] } };

  // Split on space first to get initial words
  const wordsFromSpaces = { $split: [lowerName, ' '] };

  // For each word, split on hyphen and flatten the results
  // This turns ["jean-pierre", "smith"] into ["jean", "pierre", "smith"]
  return {
    $reduce: {
      input: wordsFromSpaces,
      initialValue: [],
      in: {
        $concatArrays: [
          '$$value',
          {
            $filter: {
              input: { $split: ['$$this', '-'] },
              cond: { $gt: [{ $strLenCP: '$$this' }, 0] },
            },
          },
        ],
      },
    },
  };
}

/**
 * Builds a MongoDB expression to count exact word matches.
 *
 * @param searchWords - Array of search words to match
 * @param wordsField - Temp field containing parsed document words
 * @returns MongoDB expression computing count of exact matches
 */
function buildExactMatchCountExpression(searchWords: string[], wordsField: string): object {
  return {
    $size: {
      $setIntersection: [searchWords, { $ifNull: [`$${wordsField}`, []] }],
    },
  };
}

/**
 * Builds a MongoDB expression to count nickname word matches.
 *
 * @param nicknameWords - Array of nickname words to match
 * @param wordsField - Temp field containing parsed document words
 * @returns MongoDB expression computing count of nickname matches
 */
function buildNicknameMatchCountExpression(nicknameWords: string[], wordsField: string): object {
  return {
    $size: {
      $setIntersection: [nicknameWords, { $ifNull: [`$${wordsField}`, []] }],
    },
  };
}

/**
 * Builds a MongoDB expression to count Metaphone code matches.
 * Filters the document's phoneticTokens to uppercase-only tokens (Metaphone codes).
 *
 * @param metaphones - Array of Metaphone codes to match
 * @param tokenField - Document field containing phoneticTokens
 * @returns MongoDB expression computing count of phonetic matches
 */
function buildPhoneticMatchCountExpression(metaphones: string[], tokenField: string): object {
  return {
    $size: {
      $setIntersection: [
        metaphones,
        {
          $filter: {
            input: { $ifNull: [`$${tokenField}`, []] },
            cond: { $regexMatch: { input: '$$this', regex: '^[A-Z0-9]+$' } },
          },
        },
      ],
    },
  };
}

/**
 * Builds a MongoDB expression to detect character prefix matches.
 * Returns 1 if any document word starts with a search word (character prefix)
 * AND the document word is longer than the search word.
 * This enables matches like Jon → Johnson where "jon" is a prefix of "johnson".
 *
 * IMPORTANT: This requires BOTH character prefix AND longer document word.
 * This prevents false positives like Mike → Maxwell where "mike" is NOT
 * a character prefix of "maxwell".
 *
 * @param searchWords - Array of search words (lowercase)
 * @param wordsField - Temp field containing parsed document words
 * @returns MongoDB expression returning 1 if prefix match found, 0 otherwise
 */
function buildCharacterPrefixMatchExpression(searchWords: string[], wordsField: string): object {
  if (searchWords.length === 0) {
    return { $literal: 0 };
  }

  // Check if any document word starts with any search word (and is longer)
  return {
    $cond: {
      if: {
        $anyElementTrue: {
          $map: {
            input: { $ifNull: [`$${wordsField}`, []] },
            as: 'docWord',
            in: {
              $anyElementTrue: {
                $map: {
                  input: searchWords,
                  as: 'searchWord',
                  in: {
                    $and: [
                      // Document word starts with search word (character prefix)
                      { $eq: [{ $indexOfCP: ['$$docWord', '$$searchWord'] }, 0] },
                      // Document word is longer (it's a prefix, not exact match)
                      { $gt: [{ $strLenCP: '$$docWord' }, { $strLenCP: '$$searchWord' }] },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      then: 1,
      else: 0,
    },
  };
}

/**
 * Builds a MongoDB expression to detect similar-length word matches.
 * Returns 1 if any document word has a similar length to any search word.
 * Tolerance depends on whether both words are in the same "size class":
 * - Both words ≤4 chars OR both words >4 chars: allows ±1 character (tolerance 1)
 * - One word ≤4 and other >4 (mixed size classes): requires exact match (tolerance 0)
 *
 * This prevents false positives from phonetic matching across size boundaries where
 * collisions are common, while preserving legitimate matches within size classes.
 * Examples:
 * - "Jon" (3) ↔ "John" (4): similar length ✓ (both ≤4, so ±1 allowed)
 * - "Smyth" (5) ↔ "Smith" (5): similar length ✓ (both >4, so ±1 allowed)
 * - "Kris" (4) → "Cruz" (4): similar length ✓ (both ≤4, same length)
 * - "Kris" (4) → "Cross" (5): NOT similar length ✗ (mixed: 4≤4, 5>4, tolerance=0, diff=1)
 * - "Mike" (4) → "Mitchell" (8): NOT similar length ✗ (diff=4 exceeds any tolerance)
 *
 * @param searchWords - Array of search words (lowercase)
 * @param wordsField - Temp field containing parsed document words
 * @returns MongoDB expression returning 1 if similar length match found, 0 otherwise
 */
function buildSimilarLengthMatchExpression(searchWords: string[], wordsField: string): object {
  if (searchWords.length === 0) {
    return { $literal: 0 };
  }

  const searchWordLengths = searchWords.map((w) => w.length);

  return {
    $cond: {
      if: {
        $anyElementTrue: {
          $map: {
            input: { $ifNull: [`$${wordsField}`, []] },
            as: 'docWord',
            in: {
              $anyElementTrue: {
                $map: {
                  input: searchWordLengths,
                  as: 'searchLen',
                  in: {
                    $lte: [
                      { $abs: { $subtract: [{ $strLenCP: '$$docWord' }, '$$searchLen'] } },
                      {
                        $cond: {
                          if: {
                            $eq: [
                              { $lte: ['$$searchLen', 4] },
                              { $lte: [{ $strLenCP: '$$docWord' }, 4] },
                            ],
                          },
                          then: 1,
                          else: 0,
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      then: 1,
      else: 0,
    },
  };
}

/**
 * Builds a MongoDB expression for the final weighted score.
 * Phonetic matches only count if qualified by exact, nickname, char prefix, or similar length.
 *
 * @param idx - Index for field-specific temp field names
 * @param exactMatchWeight - Weight for exact matches
 * @param nicknameMatchWeight - Weight for nickname matches
 * @param phoneticMatchWeight - Weight for phonetic matches
 * @param charPrefixWeight - Weight for character prefix matches
 * @returns MongoDB expression computing the final score
 */
function buildFinalScoreExpression(
  idx: number,
  exactMatchWeight: number,
  nicknameMatchWeight: number,
  phoneticMatchWeight: number,
  charPrefixWeight: number,
): object {
  return {
    $add: [
      // Exact matches always score
      { $multiply: [`$_exactMatches_${idx}`, exactMatchWeight] },
      // Nickname matches always score
      { $multiply: [`$_nicknameMatches_${idx}`, nicknameMatchWeight] },
      // Phonetic matches only score if qualified (has exact, nickname, char prefix, or similar length)
      {
        $cond: {
          if: {
            $or: [
              { $gt: [`$_exactMatches_${idx}`, 0] },
              { $gt: [`$_nicknameMatches_${idx}`, 0] },
              { $gt: [`$_charPrefixMatch_${idx}`, 0] },
              { $gt: [`$_similarLengthMatch_${idx}`, 0] },
            ],
          },
          then: { $multiply: [`$_phoneticMatches_${idx}`, phoneticMatchWeight] },
          else: 0,
        },
      },
      // Character prefix matches score independently (e.g., "jon" → "johnson")
      { $multiply: [`$_charPrefixMatch_${idx}`, charPrefixWeight] },
    ],
  };
}

/**
 * Renders a SCORE stage to MongoDB aggregation pipeline stages.
 *
 * Implements word-level name matching with qualified phonetic scoring:
 *
 * **Match Types (in priority order):**
 * 1. Exact Match (10,000 pts): Document word equals search word
 * 2. Nickname Match (1,000 pts): Document word is in search term's nickname set
 * 3. Qualified Phonetic (100 pts): Metaphone match + (exact OR nickname OR char prefix OR similar length)
 * 4. Character Prefix (75 pts): Document word starts with search word (e.g., "jon" → "johnson")
 *
 * **Key insight**: Phonetic matches alone are too permissive. A phonetic match
 * is only valid when accompanied by an exact match, nickname relationship,
 * character prefix match, or similar word length. This prevents false positives like:
 * - Mike → Mitchell (phonetic overlap, different lengths: 4 vs 8)
 * - Mike → Maxwell (phonetic overlap, different lengths: 4 vs 7)
 * - Bill → Bella (phonetic overlap, no qualification)
 *
 * While allowing valid matches like:
 * - Mike → Michael (nickname relationship)
 * - Jon → John (phonetic match qualified by similar length: 3 vs 4)
 * - Jon → Johnson (character prefix: "jon" starts "johnson")
 * - Smyth → Smith (phonetic match qualified by same length: both 5 chars)
 *
 * @example
 * // Search "Mike" → searchWords: ["mike"], nicknameWords: ["michael", "mikey"]
 * // Document "Michael" → words: ["michael"]
 * // Result: nicknameMatch = 1 → score = 1000
 *
 * @example
 * // Search "Jon" → searchWords: ["jon"]
 * // Document "Johnson" → words: ["johnson"]
 * // Result: charPrefix = 1 ("jon" starts "johnson") → score = 75
 *
 * @param stage - The Score stage configuration
 * @returns Array of MongoDB aggregation stage objects
 * @throws CamsError if targetNameFields and targetTokenFields have different lengths
 */
function toMongoScore(stage: Score): object[] {
  const {
    searchWords,
    nicknameWords,
    searchMetaphones,
    nicknameMetaphones,
    targetNameFields,
    targetTokenFields,
    outputField,
    exactMatchWeight,
    nicknameMatchWeight,
    phoneticMatchWeight,
    charPrefixWeight,
  } = stage;

  if (targetNameFields.length !== targetTokenFields.length) {
    throw new CamsError(MODULE_NAME, {
      message: `targetNameFields and targetTokenFields must have the same length. Got ${targetNameFields.length} and ${targetTokenFields.length}.`,
    });
  }

  // Combine search and nickname metaphones for phonetic matching
  const allMetaphones = [...new Set([...searchMetaphones, ...nicknameMetaphones])];

  const tempFieldNames: string[] = [];
  const stages: object[] = [];

  // Stage 1: Parse document names into word arrays
  const parseWordsFields: Record<string, object> = {};
  targetNameFields.forEach((nameField, idx) => {
    const wordsField = `_words_${idx}`;
    tempFieldNames.push(wordsField);
    parseWordsFields[wordsField] = buildParseWordsExpression(nameField);
  });
  stages.push({ $addFields: parseWordsFields });

  // Stage 2: Calculate match counts for each target
  const matchCountFields: Record<string, object> = {};
  targetNameFields.forEach((_, idx) => {
    const wordsField = `_words_${idx}`;
    const tokenField = targetTokenFields[idx];

    const exactField = `_exactMatches_${idx}`;
    const nicknameField = `_nicknameMatches_${idx}`;
    const phoneticField = `_phoneticMatches_${idx}`;
    const charPrefixField = `_charPrefixMatch_${idx}`;
    const similarLengthField = `_similarLengthMatch_${idx}`;

    tempFieldNames.push(
      exactField,
      nicknameField,
      phoneticField,
      charPrefixField,
      similarLengthField,
    );

    matchCountFields[exactField] = buildExactMatchCountExpression(searchWords, wordsField);
    matchCountFields[nicknameField] = buildNicknameMatchCountExpression(nicknameWords, wordsField);
    matchCountFields[phoneticField] = buildPhoneticMatchCountExpression(allMetaphones, tokenField);
    matchCountFields[charPrefixField] = buildCharacterPrefixMatchExpression(
      searchWords,
      wordsField,
    );
    matchCountFields[similarLengthField] = buildSimilarLengthMatchExpression(
      searchWords,
      wordsField,
    );
  });
  stages.push({ $addFields: matchCountFields });

  // Stage 3: Calculate scores for each target
  const scoreFields: Record<string, object> = {};
  targetNameFields.forEach((_, idx) => {
    const scoreField = `_score_${idx}`;
    tempFieldNames.push(scoreField);
    scoreFields[scoreField] = buildFinalScoreExpression(
      idx,
      exactMatchWeight,
      nicknameMatchWeight,
      phoneticMatchWeight,
      charPrefixWeight,
    );
  });
  stages.push({ $addFields: scoreFields });

  // Stage 4: Take max score across all targets
  stages.push({
    $addFields: {
      [outputField]: {
        $max: targetNameFields.map((_, idx) => `$_score_${idx}`),
      },
    },
  });

  // Stage 5: Cleanup temporary fields
  const cleanupProjection = tempFieldNames.reduce(
    (acc, field) => {
      acc[field] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );
  stages.push({ $project: cleanupProjection });

  return stages;
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

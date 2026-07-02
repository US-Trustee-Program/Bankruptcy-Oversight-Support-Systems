import {
  ConditionFunctions,
  ConditionOrConjunction,
  Field,
  SortedField,
  SortSpec,
  using,
} from './query-builder';

export const DEFAULT_EXACT_MATCH_WEIGHT = 10000;
export const DEFAULT_NICKNAME_MATCH_WEIGHT = 1000;
export const DEFAULT_CHAR_PREFIX_WEIGHT = 100;
export const DEFAULT_PHONETIC_MATCH_WEIGHT = 75;

function source<T = unknown>(source?: string) {
  return {
    usingFields: (...names: (keyof T)[]) => {
      const q = using<T>();
      return names.reduce(
        (acc, name) => {
          acc[name] = { name, ...q(name) };
          if (source) {
            acc[name].source = source;
          }
          return acc;
        },
        {} as Record<keyof T, QueryFieldReference<T>>,
      );
    },
    fields: (...names: (keyof T)[]) => {
      const q = using<T>();
      return names.map((name) => {
        const reference: QueryFieldReference<T> = { name, ...q(name) };
        if (source) {
          reference.source = source;
        }
        return reference;
      });
    },
    field(name: keyof T): QueryFieldReference<T> {
      return this.fields(name)[0];
    },
    name: source,
  };
}

type First = {
  accumulator: 'FIRST';
  as: Field;
  field: Field;
};

type Count = {
  accumulator: 'COUNT';
  as: Field;
};

type Push = {
  accumulator: 'PUSH';
  as: Field;
  field: Field;
};

export type Accumulator = Count | First | Push;

type Match = ConditionOrConjunction<never> & {
  stage: 'MATCH';
};

export type Paginate = {
  stage: 'PAGINATE';
  limit: number;
  skip: number;
};

export function isPaginate(obj: unknown): obj is Paginate {
  return obj !== null && typeof obj === 'object' && 'limit' in obj && 'skip' in obj;
}

export type Pipeline = {
  stages: Stage[];
};

export type AddFields<T = never> = {
  stage: 'ADD_FIELDS';
  fields: AdditionalField<T>[];
};

export type ExcludeFields = {
  stage: 'EXCLUDE';
  fields: FieldReference<never>[];
};

export type IncludeFields = {
  stage: 'INCLUDE';
  fields: Field[];
};

export type Group = {
  stage: 'GROUP';
  groupBy: Field[];
  accumulators: Accumulator[];
};

export type FieldReference<T> = Field<T> & {
  source?: string;
};

type QueryFieldReference<T> = FieldReference<T> & ConditionFunctions<T>;

export type JoinType = 'INNER' | 'OUTER';

export type Join = {
  stage: 'JOIN';
  local: FieldReference<never>;
  foreign: FieldReference<never>;
  alias: FieldReference<never>;
  joinType: JoinType;
};

export type FieldMapping = {
  to: string;
  from?: string;
  exclude?: boolean;
};

export type Project = {
  stage: 'PROJECT';
  mappings: FieldMapping[];
};

type AdditionalField<T = never> = {
  fieldToAdd: FieldReference<never>;
  querySource: FieldReference<never>;
  query: ConditionOrConjunction<T>;
};

export type Sort = SortSpec & {
  stage: 'SORT';
};

export function isSort(obj: unknown): obj is Sort {
  return obj !== null && typeof obj === 'object' && 'stage' in obj && obj.stage === 'SORT';
}

export type Score = {
  stage: 'SCORE';
  searchWords: string[];
  nicknameWords: string[];
  searchMetaphones: string[];
  nicknameMetaphones: string[];
  targetNameFields: string[];
  targetTokenFields: string[];
  outputField: string;
  exactMatchWeight: number;
  nicknameMatchWeight: number;
  phoneticMatchWeight: number;
  charPrefixWeight: number;
};

export type Stage<T = never> =
  | Paginate
  | Sort
  | Match
  | Join
  | AddFields<T>
  | ExcludeFields
  | IncludeFields
  | Group
  | Score
  | Project;

export function isPipeline(obj: unknown): obj is Pipeline {
  return obj !== null && typeof obj === 'object' && 'stages' in obj;
}

function paginate(skip: number, limit: number): Paginate {
  return {
    stage: 'PAGINATE',
    skip,
    limit,
  };
}

function sort(...fields: SortedField[]): Sort {
  return {
    stage: 'SORT',
    fields,
  };
}

function ascending(field: FieldReference<never>): SortedField {
  return {
    field: { name: field.name },
    direction: 'ASCENDING',
  };
}

function descending(field: FieldReference<never>): SortedField {
  return {
    field: { name: field.name },
    direction: 'DESCENDING',
  };
}

type JoinBuilder = Join & {
  inner(): Join;
  outer(): Join;
};

function join<Foreign = never>(foreign: FieldReference<Foreign>) {
  return {
    onto: <Local = never>(local: FieldReference<Local>) => {
      return {
        as: <T = never>(alias: FieldReference<T>): JoinBuilder => {
          const base: Join = {
            stage: 'JOIN',
            local,
            foreign,
            alias,
            joinType: 'INNER',
          };
          return {
            ...base,
            inner(): Join {
              return { ...base, joinType: 'INNER' };
            },
            outer(): Join {
              return { ...base, joinType: 'OUTER' };
            },
          };
        },
      };
    },
  };
}

function pick(name: string): FieldMapping {
  return { to: name };
}

function omit(name: string): FieldMapping {
  return { to: name, exclude: true };
}

function alias(to: string, from: string): FieldMapping {
  return { to, from };
}

function project(...mappings: FieldMapping[]): Project {
  return { stage: 'PROJECT', mappings };
}

function match(query: ConditionOrConjunction<never>): Match {
  return {
    ...query,
    stage: 'MATCH',
  };
}

function additionalField<T = never>(
  fieldToAdd: FieldReference<never>,
  querySource: FieldReference<never>,
  query: ConditionOrConjunction<T>,
): AdditionalField {
  return {
    fieldToAdd,
    querySource,
    query,
  };
}

function addFields(...fields: AdditionalField[]): AddFields {
  return { stage: 'ADD_FIELDS', fields };
}

function exclude(...fields: FieldReference<never>[]): ExcludeFields {
  return { stage: 'EXCLUDE', fields };
}

function include(...fields: Field[]): IncludeFields {
  return { stage: 'INCLUDE', fields };
}

function pipeline(...stages: Stage[]): Pipeline {
  return { stages };
}

function group(groupBy: Field[], accumulators: Accumulator[]): Group {
  return { stage: 'GROUP', groupBy, accumulators };
}

function count(as: Field): Count {
  return { accumulator: 'COUNT', as: { name: as.name } };
}

function first(field: Field, as: Field): First {
  return { accumulator: 'FIRST', as: { name: as.name }, field: { name: field.name } };
}

function push(field: Field, as: Field): Push {
  return { accumulator: 'PUSH', as: { name: as.name }, field: { name: field.name } };
}

interface ScoreParams {
  searchWords: string[];
  nicknameWords: string[];
  searchMetaphones: string[];
  nicknameMetaphones: string[];
  targetNameFields: string[];
  targetTokenFields: string[];
  outputField: string;
  exactMatchWeight?: number;
  nicknameMatchWeight?: number;
  phoneticMatchWeight?: number;
  charPrefixWeight?: number;
}

interface PhoneticTokenSource {
  searchWords: string[];
  nicknameWords: string[];
  searchMetaphones: string[];
  nicknameMetaphones: string[];
}

export function buildPhoneticScore(
  structured: PhoneticTokenSource,
  targetNameFields: string[],
  targetTokenFields: string[],
  outputField = 'matchScore',
): Score {
  return score({
    searchWords: structured.searchWords,
    nicknameWords: structured.nicknameWords,
    searchMetaphones: structured.searchMetaphones,
    nicknameMetaphones: structured.nicknameMetaphones,
    targetNameFields,
    targetTokenFields,
    outputField,
  });
}

function score(params: ScoreParams): Score {
  return {
    stage: 'SCORE',
    searchWords: params.searchWords,
    nicknameWords: params.nicknameWords,
    searchMetaphones: params.searchMetaphones,
    nicknameMetaphones: params.nicknameMetaphones,
    targetNameFields: params.targetNameFields,
    targetTokenFields: params.targetTokenFields,
    outputField: params.outputField,
    exactMatchWeight: params.exactMatchWeight ?? DEFAULT_EXACT_MATCH_WEIGHT,
    nicknameMatchWeight: params.nicknameMatchWeight ?? DEFAULT_NICKNAME_MATCH_WEIGHT,
    phoneticMatchWeight: params.phoneticMatchWeight ?? DEFAULT_PHONETIC_MATCH_WEIGHT,
    charPrefixWeight: params.charPrefixWeight ?? DEFAULT_CHAR_PREFIX_WEIGHT,
  };
}

const QueryPipeline = {
  addFields,
  additionalField,
  alias,
  ascending,
  count,
  descending,
  exclude,
  first,
  group,
  include,
  join,
  match,
  omit,
  paginate,
  pick,
  pipeline,
  project,
  push,
  score,
  sort,
  source,
};

export default QueryPipeline;

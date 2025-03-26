import { ConditionOrConjunction, Query } from './query-builder';

export type Match = ConditionOrConjunction<never> & {
  stage: 'MATCH';
};

export type Paginate = {
  stage: 'PAGINATE';
  limit: number;
  skip: number;
};

export function isPaginate(obj: unknown): obj is Paginate {
  return typeof obj === 'object' && 'limit' in obj && 'skip' in obj;
}

export type SortedAttribute<T = unknown> = {
  field: keyof T;
  direction: 'ASCENDING' | 'DESCENDING';
};

export type Sort = {
  stage: 'SORT';
  attributes: SortedAttribute<never>[];
};

export function isSort(obj: unknown): obj is Sort {
  return typeof obj === 'object' && 'stage' in obj && obj.stage === 'SORT';
}

export type Pipeline = {
  stages: Stage[];
};

export type AddFields = {
  stage: 'ADD_FIELDS';
  fields: AdditionalField[];
};

export type FieldReference<T> = {
  field: keyof T;
  source?: string;
};

export type Join = {
  stage: 'JOIN';
  local: FieldReference<never>;
  foreign: FieldReference<never>;
  alias: string;
};

export type AdditionalField = {
  field: string;
  source: string;
  query: Query;
};

export type Stage = Paginate | Sort | Match | Join | AddFields;

export function isPipeline(obj: unknown): obj is Pipeline {
  return typeof obj === 'object' && 'stages' in obj;
}

function paginate(skip: number, limit: number): Paginate {
  return {
    stage: 'PAGINATE',
    skip,
    limit,
  };
}

function sort(...attributes: SortedAttribute<never>[]): Sort {
  return {
    stage: 'SORT',
    attributes,
  };
}

function ascending<T>(field: keyof T): SortedAttribute<T> {
  return {
    field,
    direction: 'ASCENDING',
  };
}

function descending<T>(field: keyof T): SortedAttribute<T> {
  return {
    field,
    direction: 'DESCENDING',
  };
}

function join<Foreign = unknown>(source: string, foreignField: keyof Foreign) {
  return {
    onto: <Local = unknown>(localField: keyof Local) => {
      return {
        as: (name: string): Join => {
          return {
            stage: 'JOIN',
            local: reference(localField, null),
            foreign: reference(foreignField, source),
            alias: name,
          };
        },
      };
    },
  };
}

function reference<T = unknown>(field: keyof T, source?: string): FieldReference<T> {
  return {
    field,
    source,
  };
}

function match(query: ConditionOrConjunction<never>): Match {
  return {
    ...query,
    stage: 'MATCH',
  };
}

function additionalField(field: string, source: string, query: Query): AdditionalField {
  return {
    field,
    source,
    query,
  };
}

function addFields(...fields: AdditionalField[]): AddFields {
  return { stage: 'ADD_FIELDS', fields };
}

function pipeline(...stages: Stage[]): Pipeline {
  return { stages };
}

const QueryPipeline = {
  addFields,
  additionalField,
  ascending,
  descending,
  join,
  match,
  paginate,
  pipeline,
  reference,
  sort,
};

export default QueryPipeline;

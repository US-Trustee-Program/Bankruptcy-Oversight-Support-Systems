import { ConditionFunctions, ConditionOrConjunction, Field, using } from './query-builder';

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

export type SortedField = {
  field: FieldReference<never>;
  direction: 'ASCENDING' | 'DESCENDING';
};

export type Sort = {
  stage: 'SORT';
  fields: SortedField[];
};

export function isSort(obj: unknown): obj is Sort {
  return typeof obj === 'object' && 'stage' in obj && obj.stage === 'SORT';
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

export type FieldReference<T> = Field<T> & {
  source?: string;
};

export type QueryFieldReference<T> = FieldReference<T> & ConditionFunctions<T>;

export type Join = {
  stage: 'JOIN';
  local: FieldReference<never>;
  foreign: FieldReference<never>;
  alias: FieldReference<never>;
};

export type AdditionalField<T = never> = {
  fieldToAdd: FieldReference<never>;
  querySource: FieldReference<never>;
  query: ConditionOrConjunction<T>;
};

export type Stage<T = never> = Paginate | Sort | Match | Join | AddFields<T> | ExcludeFields;

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

function sort(...fields: SortedField[]): Sort {
  return {
    stage: 'SORT',
    fields,
  };
}

function ascending(field: FieldReference<never>): SortedField {
  return {
    field,
    direction: 'ASCENDING',
  };
}

function descending(field: FieldReference<never>): SortedField {
  return {
    field,
    direction: 'DESCENDING',
  };
}

function join<Foreign = never>(foreign: FieldReference<Foreign>) {
  return {
    onto: <Local = never>(local: FieldReference<Local>) => {
      return {
        as: <T = never>(alias: FieldReference<T>): Join => {
          return {
            stage: 'JOIN',
            local,
            foreign,
            alias,
          };
        },
      };
    },
  };
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

function pipeline(...stages: Stage[]): Pipeline {
  return { stages };
}

const QueryPipeline = {
  addFields,
  additionalField,
  ascending,
  descending,
  exclude,
  join,
  match,
  paginate,
  pipeline,
  sort,
  source,
};

export default QueryPipeline;

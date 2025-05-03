import {
  ConditionFunctions,
  ConditionOrConjunction,
  Field,
  SortedField,
  SortSpec,
  using,
} from './query-builder';

export type Accumulator = Count | First;

export type AddFields<T = never> = {
  fields: AdditionalField<T>[];
  stage: 'ADD_FIELDS';
};

export type AdditionalField<T = never> = {
  fieldToAdd: FieldReference<never>;
  query: ConditionOrConjunction<T>;
  querySource: FieldReference<never>;
};

export type Count = {
  accumulator: 'COUNT';
  as: Field;
};

export type ExcludeFields = {
  fields: FieldReference<never>[];
  stage: 'EXCLUDE';
};

export type FieldReference<T> = Field<T> & {
  source?: string;
};

export type First = {
  accumulator: 'FIRST';
  as: Field;
  field: Field;
};

export type Group = {
  accumulators?: Accumulator[];
  groupBy: Field[];
  stage: 'GROUP';
};

export type Join = {
  alias: FieldReference<never>;
  foreign: FieldReference<never>;
  local: FieldReference<never>;
  stage: 'JOIN';
};

export type Match = ConditionOrConjunction<never> & {
  stage: 'MATCH';
};

export type Paginate = {
  limit: number;
  skip: number;
  stage: 'PAGINATE';
};

export type Pipeline = {
  stages: Stage[];
};

export type QueryFieldReference<T> = ConditionFunctions<T> & FieldReference<T>;

export type Sort = SortSpec & {
  stage: 'SORT';
};

export type Stage<T = never> =
  | AddFields<T>
  | ExcludeFields
  | Group
  | Join
  | Match
  | Paginate
  | Sort;

export function isPaginate(obj: unknown): obj is Paginate {
  return typeof obj === 'object' && 'limit' in obj && 'skip' in obj;
}

export function isPipeline(obj: unknown): obj is Pipeline {
  return typeof obj === 'object' && 'stages' in obj;
}

export function isSort(obj: unknown): obj is Sort {
  return typeof obj === 'object' && 'stage' in obj && obj.stage === 'SORT';
}

function addFields(...fields: AdditionalField[]): AddFields {
  return { fields, stage: 'ADD_FIELDS' };
}

function additionalField<T = never>(
  fieldToAdd: FieldReference<never>,
  querySource: FieldReference<never>,
  query: ConditionOrConjunction<T>,
): AdditionalField {
  return {
    fieldToAdd,
    query,
    querySource,
  };
}

function ascending(field: FieldReference<never>): SortedField {
  return {
    direction: 'ASCENDING',
    field: { name: field.name },
  };
}

function count(as: Field): Count {
  return { accumulator: 'COUNT', as: { name: as.name } };
}

function descending(field: FieldReference<never>): SortedField {
  return {
    direction: 'DESCENDING',
    field: { name: field.name },
  };
}

function exclude(...fields: FieldReference<never>[]): ExcludeFields {
  return { fields, stage: 'EXCLUDE' };
}

function first(field: Field, as: Field): First {
  return { accumulator: 'FIRST', as: { name: as.name }, field: { name: field.name } };
}

function group(groupBy: Field[], accumulators: Accumulator[]): Group {
  return { accumulators, groupBy, stage: 'GROUP' };
}

function join<Foreign = never>(foreign: FieldReference<Foreign>) {
  return {
    onto: <Local = never>(local: FieldReference<Local>) => {
      return {
        as: <T = never>(alias: FieldReference<T>): Join => {
          return {
            alias,
            foreign,
            local,
            stage: 'JOIN',
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

function paginate(skip: number, limit: number): Paginate {
  return {
    limit,
    skip,
    stage: 'PAGINATE',
  };
}

function pipeline(...stages: Stage[]): Pipeline {
  return { stages };
}

function sort(...fields: SortedField[]): Sort {
  return {
    fields,
    stage: 'SORT',
  };
}

function source<T = unknown>(source?: string) {
  return {
    field(name: keyof T): QueryFieldReference<T> {
      return this.fields(name)[0];
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
    name: source,
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
  };
}

const QueryPipeline = {
  addFields,
  additionalField,
  ascending,
  count,
  descending,
  exclude,
  first,
  group,
  join,
  match,
  paginate,
  pipeline,
  sort,
  source,
};

export default QueryPipeline;

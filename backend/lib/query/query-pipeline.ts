import { ConditionOrConjunction } from './query-builder';

function source<T = unknown>(source?: string) {
  return {
    field(name: keyof T): FieldReference<T> {
      const reference: FieldReference<T> = {
        name: name,
      };
      if (source) {
        reference.source = source;
      }
      return reference;
    },
  };
}

// TODO: this is hopefully temporary as part of expand and contract
export type FilterCondition = {
  condition:
    | 'EQUALS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUAL'
    | 'IF_NULL'
    | 'CONTAINS'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUAL'
    | 'NOT_EQUAL'
    | 'NOT_CONTAINS'
    | 'REGEX';
  leftOperand: unknown;
  rightOperand: unknown;
};

// TODO: this is hopefully temporary as part of expand and contract
export type FilterConjunction = {
  conjunction: 'AND' | 'OR' | 'NOT';
  values: FilterConditionOrConjunction[];
};

// TODO: this is hopefully temporary as part of expand and contract
export type FilterConditionOrConjunction = FilterCondition | FilterConjunction;

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

export type AddFields = {
  stage: 'ADD_FIELDS';
  fields: AdditionalField[];
};

export type ExcludeFields = {
  stage: 'EXCLUDE';
  fields: FieldReference<never>[];
};

export type FieldReference<T> = {
  name: keyof T;
  source?: string;
};

export type Join = {
  stage: 'JOIN';
  local: FieldReference<never>;
  foreign: FieldReference<never>;
  alias: FieldReference<never>;
};

// TODO: Field and source properties are ambiguous
export type AdditionalField = {
  newField: FieldReference<never>;
  source: FieldReference<never>;
  query: FilterConditionOrConjunction;
};

export type Stage = Paginate | Sort | Match | Join | AddFields | ExcludeFields;

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

function additionalField(
  field: FieldReference<never>,
  source: FieldReference<never>,
  query: FilterConditionOrConjunction,
): AdditionalField {
  return {
    newField: field,
    source,
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

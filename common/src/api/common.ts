import { UUID } from 'crypto';

export type Key = string | number | UUID;
export type UriString = string;

export type NullableOptionalFields<T> = {
  [K in keyof T]: T[K] extends undefined | infer U ? U | null : T[K];
};

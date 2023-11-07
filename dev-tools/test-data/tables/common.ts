import { AO_CS_Record } from './AO_CS';
import { AO_TX_Record } from './AO_TX';
import { AO_PY_Record } from './AO_PY';
import { AO_AT_Record } from './AO_AT';

export type DatabaseRecords = {
  AO_AT: Array<AO_AT_Record>;
  AO_CS: Array<AO_CS_Record>;
  AO_TX: Array<AO_TX_Record>;
  AO_PY: Array<AO_PY_Record>;
};

export function emptyDatabaseRecords(): DatabaseRecords {
  return {
    AO_AT: [],
    AO_CS: [],
    AO_TX: [],
    AO_PY: [],
  };
}

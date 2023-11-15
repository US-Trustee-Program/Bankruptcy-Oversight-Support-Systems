import { AO_AT_Record } from './AO_AT';
import { AO_CS_Record } from './AO_CS';
import { AO_DE_Record } from './AO_DE';
import { AO_GRP_DES_Record } from './AO_GRP_DES';
import { AO_PY_Record } from './AO_PY';
import { AO_REGION_Record } from './AO_REGION';
import { AO_TX_Record } from './AO_TX';

export type DatabaseRecords = {
  AO_AT: Array<AO_AT_Record>;
  AO_CS: Array<AO_CS_Record>;
  AO_DE: Array<AO_DE_Record>;
  AO_GRP_DES: Array<AO_GRP_DES_Record>;
  AO_TX: Array<AO_TX_Record>;
  AO_PY: Array<AO_PY_Record>;
  AO_REGION: Array<AO_REGION_Record>;
};

export function emptyDatabaseRecords(): DatabaseRecords {
  return {
    AO_AT: [],
    AO_CS: [],
    AO_DE: [],
    AO_GRP_DES: [],
    AO_PY: [],
    AO_REGION: [],
    AO_TX: [],
  };
}

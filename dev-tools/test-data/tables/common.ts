import { AO_CS_Record } from './AO_CS';
import { AO_TX_Record } from './AO_TX';

export type DatabaseRecords = {
  AO_CS: Array<AO_CS_Record>;
  AO_TX: Array<AO_TX_Record>;
};

export function emptyDatabaseRecords(): DatabaseRecords {
  return {
    AO_CS: [],
    AO_TX: [],
  };
}

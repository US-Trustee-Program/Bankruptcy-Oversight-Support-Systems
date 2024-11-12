import { CamsRole } from '../../../../../common/src/cams/roles';
import { UstpDivisionTag, UstpOfficeDetails } from '../../../../../common/src/cams/offices';

export type StorageGateway = {
  get(key: string): string | null;
  getUstpOffices(): UstpOfficeDetails[];
  getRoleMapping(): Map<string, CamsRole>;
  getUstpDivisionTags(): Map<string, UstpDivisionTag[]>;
};

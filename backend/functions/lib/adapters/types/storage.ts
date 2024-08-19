import { CamsRole } from '../../../../../common/src/cams/roles';

export type StorageGateway = {
  get(key: string): string | null;
  getOfficeMapping(): Map<string, string[]>;
  getRoleMapping(): Map<string, CamsRole>;
};

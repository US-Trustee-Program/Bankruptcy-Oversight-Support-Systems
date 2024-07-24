import { CamsRole } from '../../../../../common/src/cams/session';
import { DxtrOfficeKeys } from '../gateways/storage/local-storage-gateway';

export type StorageGateway = {
  get(key: string): string | null;
  getOfficeMapping(): Map<string, DxtrOfficeKeys>;
  getRoleMapping(): Map<string, CamsRole>;
};

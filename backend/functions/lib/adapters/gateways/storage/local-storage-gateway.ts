import { StorageGateway } from '../../types/storage';

export const GROUP_MAPPING_PATH = '/groupmapping.csv';
const GROUP_MAPPING =
  'ad_group_name,idp_group_name,cams_group_name \
';

const storage = new Map<string, string>();
storage.set(GROUP_MAPPING_PATH, GROUP_MAPPING);

function get(path: string): string | null {
  if (!storage.has(path)) {
    return null;
  }
  return storage.get(path);
}

export const LocalStorageGateway: StorageGateway = {
  get,
};

export default LocalStorageGateway;

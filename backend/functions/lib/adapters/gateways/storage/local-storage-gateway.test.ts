import LocalStorageGateway, { OFFICE_MAPPING_PATH } from './local-storage-gateway';

describe('map get', () => {
  test('should return appropriate string for valid path', () => {
    expect(LocalStorageGateway.get(OFFICE_MAPPING_PATH)).toEqual(expect.any(String));
  });

  test('should return null for invalid path', () => {
    expect(LocalStorageGateway.get('INVALID_PATH')).toBeNull();
  });
});

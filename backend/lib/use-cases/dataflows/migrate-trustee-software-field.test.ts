import { vi } from 'vitest';
import { migrateTrusteeSoftwareField } from './migrate-trustee-software-field';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { ApplicationContext } from '../../adapters/types/basic';
import MockData from '@common/cams/test-utilities/mock-data';

describe('migrateTrusteeSoftwareField', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should migrate trustee with matching software name to softwareId', async () => {
    const trustee = MockData.getTrustee();
    Object.assign(trustee, { software: 'Axos', softwareId: undefined });

    vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
    vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockResolvedValue([
      {
        id: 'sw-axos',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ]);
    const updateSpy = vi
      .spyOn(MockMongoRepository.prototype, 'updateTrustee')
      .mockResolvedValue(trustee);

    const result = await migrateTrusteeSoftwareField(context);

    expect(result.migrated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.notFound).toBe(0);
    expect(result.errors).toBe(0);
    expect(updateSpy).toHaveBeenCalledWith(
      trustee.trusteeId,
      expect.objectContaining({ softwareId: 'sw-axos' }),
      expect.objectContaining({ id: 'system-migration' }),
    );
  });

  test('should skip trustees that already have softwareId', async () => {
    const trustee = MockData.getTrustee({ softwareId: 'sw-existing' });

    vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
    vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockResolvedValue([]);
    const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateTrustee');

    const result = await migrateTrusteeSoftwareField(context);

    expect(result.skipped).toBe(1);
    expect(result.migrated).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  test('should skip trustees with no software field', async () => {
    const trustee = MockData.getTrustee();

    vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
    vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockResolvedValue([]);
    const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateTrustee');

    const result = await migrateTrusteeSoftwareField(context);

    expect(result.skipped).toBe(1);
    expect(result.migrated).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  test('should log warning when software name does not match any vendor', async () => {
    const trustee = MockData.getTrustee();
    Object.assign(trustee, { software: 'UnknownSoftware', softwareId: undefined });

    vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
    vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockResolvedValue([
      {
        id: 'sw-axos',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ]);

    const result = await migrateTrusteeSoftwareField(context);

    expect(result.notFound).toBe(1);
    expect(result.migrated).toBe(0);
    expect(result.details[0]).toContain('UnknownSoftware');
  });

  test('should match software names case-insensitively', async () => {
    const trustee = MockData.getTrustee();
    Object.assign(trustee, { software: 'axos', softwareId: undefined });

    vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
    vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockResolvedValue([
      {
        id: 'sw-axos',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ]);
    const updateSpy = vi
      .spyOn(MockMongoRepository.prototype, 'updateTrustee')
      .mockResolvedValue(trustee);

    const result = await migrateTrusteeSoftwareField(context);

    expect(result.migrated).toBe(1);
    expect(updateSpy).toHaveBeenCalled();
  });

  test('should handle errors for individual trustees without stopping', async () => {
    const trustee1 = MockData.getTrustee();
    Object.assign(trustee1, { software: 'Axos', softwareId: undefined });
    const trustee2 = MockData.getTrustee();
    Object.assign(trustee2, { software: 'Axos', softwareId: undefined });

    vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee1, trustee2]);
    vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockResolvedValue([
      {
        id: 'sw-axos',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ]);
    vi.spyOn(MockMongoRepository.prototype, 'updateTrustee')
      .mockRejectedValueOnce(new Error('DB write failed'))
      .mockResolvedValueOnce(trustee2);

    const result = await migrateTrusteeSoftwareField(context);

    expect(result.errors).toBe(1);
    expect(result.migrated).toBe(1);
  });
});

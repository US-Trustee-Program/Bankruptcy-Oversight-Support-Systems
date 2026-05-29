import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankruptcySoftwareUseCase } from './bankruptcy-software';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
} from '@common/cams/bankruptcy-software';
import { TrusteeSummary } from '@common/cams/trustees';
import { CamsPaginationResponse } from '../gateways.types';

describe('BankruptcySoftwareUseCase', () => {
  let context: ApplicationContext;
  let useCase: BankruptcySoftwareUseCase;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    useCase = new BankruptcySoftwareUseCase(context);
  });

  describe('getSoftwareList', () => {
    test('should throw CamsError when repository fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.getSoftwareList()).rejects.toMatchObject({
        message: 'Unable to retrieve bankruptcy software.',
      });
    });

    test('should return software from repository', async () => {
      const mockSoftware: BankruptcySoftwareProfile[] = [
        {
          id: 'sw-1',
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'Axos',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        },
      ];
      vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockResolvedValue(mockSoftware);

      const result = await useCase.getSoftwareList();

      expect(result).toEqual(mockSoftware);
    });
  });

  describe('getSoftware', () => {
    test('should throw CamsError when repository fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockRejectedValue(
        new Error('not found'),
      );

      await expect(useCase.getSoftware('sw-missing')).rejects.toMatchObject({
        message: 'Unable to retrieve bankruptcy software.',
      });
    });

    test('should return software by id from repository', async () => {
      const software: BankruptcySoftwareProfile = {
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(software);

      const result = await useCase.getSoftware('sw-1');

      expect(result).toEqual(software);
    });
  });

  describe('updateSoftware', () => {
    test('should throw CamsError when repository fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.updateSoftware('sw-1', { name: 'New Name' })).rejects.toMatchObject({
        message: 'Unable to update bankruptcy software.',
      });
    });

    test('should return updated software after merging changes', async () => {
      const current: BankruptcySoftwareProfile = {
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      const updated: BankruptcySoftwareProfile = {
        ...current,
        name: 'Axos Renamed',
        status: 'inactive',
      };

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(current);
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue(updated);
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      const result = await useCase.updateSoftware('sw-1', {
        name: 'Axos Renamed',
        status: 'inactive',
      });

      expect(result).toEqual(updated);
    });
  });

  describe('addBank', () => {
    const baseSoftware: BankruptcySoftwareProfile = {
      id: 'sw-1',
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'Axos',
      status: 'active',
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
    };

    test('should append bank to empty associatedBanks and return updated software', async () => {
      const expectedResult: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue(expectedResult);
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      const result = await useCase.updateSoftware('sw-1', {
        addBank: { bankId: 'bank-1', bankName: 'Chase' },
      });

      expect(result.associatedBanks).toEqual([
        { bankId: 'bank-1', bankName: 'Chase', status: 'active' },
      ]);
    });

    test('should append bank to existing associatedBanks array and return updated software', async () => {
      const softwareWithBanks: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
      };
      const expectedResult: BankruptcySoftwareProfile = {
        ...softwareWithBanks,
        associatedBanks: [
          { bankId: 'bank-1', bankName: 'Chase', status: 'active' },
          { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
        ],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(
        softwareWithBanks,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue(expectedResult);
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      const result = await useCase.updateSoftware('sw-1', {
        addBank: { bankId: 'bank-2', bankName: 'Wells Fargo' },
      });

      expect(result.associatedBanks).toEqual([
        { bankId: 'bank-1', bankName: 'Chase', status: 'active' },
        { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
      ]);
    });

    test('should reject duplicate bankId', async () => {
      const softwareWithBanks: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(
        softwareWithBanks,
      );

      const error = await useCase
        .updateSoftware('sw-1', { addBank: { bankId: 'bank-1', bankName: 'Chase' } })
        .catch((e) => e);

      expect(error).toMatchObject({ status: 400 });
      expect(error.message).not.toContain('bank-1');
    });

    test('should throw distinguishable error when audit write fails after data write succeeds', async () => {
      const updated: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue(updated);
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockRejectedValue(
        new Error('audit write failed'),
      );

      const error = await useCase
        .updateSoftware('sw-1', { addBank: { bankId: 'bank-1', bankName: 'Chase' } })
        .catch((e) => e);

      expect(error.message).toContain('Audit record creation failed');
    });
  });

  describe('updateBankAssociation', () => {
    const baseSoftware: BankruptcySoftwareProfile = {
      id: 'sw-1',
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'Axos',
      status: 'active',
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
      associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
    };

    test('should update status of existing association and return updated software', async () => {
      const expectedResult: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'inactive' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue(expectedResult);
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      const result = await useCase.updateSoftware('sw-1', {
        updateBankAssociation: { bankId: 'bank-1', status: 'inactive' },
      });

      expect(result.associatedBanks).toEqual([
        { bankId: 'bank-1', bankName: 'Chase', status: 'inactive' },
      ]);
    });

    test('should reject unknown bankId without leaking the id in the error', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);

      const error = await useCase
        .updateSoftware('sw-1', {
          updateBankAssociation: { bankId: 'bank-unknown', status: 'inactive' },
        })
        .catch((e) => e);

      expect(error).toMatchObject({ status: 400 });
      expect(error.message).not.toContain('bank-unknown');
    });
  });

  describe('createSoftware', () => {
    test('should throw CamsError when repository fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'createSoftware').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.createSoftware({ name: 'TrustBooks' })).rejects.toMatchObject({
        message: 'Unable to create bankruptcy software.',
      });
    });

    test('should create software with status active and write audit record with before:null', async () => {
      const createdSoftware: BankruptcySoftwareProfile = {
        id: 'sw-new',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'TrustBooks',
        status: 'active',
        updatedOn: expect.any(String) as unknown as string,
        updatedBy: { id: context.session.user.id, name: context.session.user.name },
        createdOn: expect.any(String) as unknown as string,
        createdBy: { id: context.session.user.id, name: context.session.user.name },
      };

      const createSoftwareSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createSoftware')
        .mockResolvedValue(createdSoftware);
      const auditSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord')
        .mockResolvedValue();

      const result = await useCase.createSoftware({ name: 'TrustBooks' });

      expect(createSoftwareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'TrustBooks',
          status: 'active',
        }),
      );

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BankruptcySoftwareAuditHistory>>({
          documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
          softwareId: createdSoftware.id,
          before: null,
          after: createdSoftware,
        }),
      );

      expect(result).toEqual(createdSoftware);
    });
  });

  describe('getTrusteesBySoftware', () => {
    test('should return paginated trustees from repository', async () => {
      const mockPage: CamsPaginationResponse<TrusteeSummary> = {
        meta: { self: 'http://localhost/trustees?softwareId=sw-1&limit=10&offset=0' },
        pagination: { count: 1, limit: 10, offset: 0 },
        data: [{ id: 'trustee-1', name: 'Jane Doe', offices: [] }] as unknown as TrusteeSummary[],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesBySoftware').mockResolvedValue(mockPage);

      const result = await useCase.getTrusteesBySoftware('sw-1', 10, 0);

      expect(result).toEqual(mockPage);
    });

    test('should wrap repository errors in CamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesBySoftware').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.getTrusteesBySoftware('sw-1', 10, 0)).rejects.toMatchObject({
        message: 'Unable to retrieve trustees for software.',
      });
    });
  });

  describe('getSoftwareHistory', () => {
    test('should return history from repository', async () => {
      const mockHistory: BankruptcySoftwareAuditHistory[] = [
        {
          id: 'hist-1',
          documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
          softwareId: 'sw-1',
          before: { name: 'Old Name', status: 'active' },
          after: { name: 'New Name', status: 'active' },
          updatedOn: '2024-01-02T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        },
      ];
      vi.spyOn(MockMongoRepository.prototype, 'getSoftwareHistory').mockResolvedValue(mockHistory);

      const result = await useCase.getSoftwareHistory('sw-1');

      expect(result).toEqual(mockHistory);
    });

    test('should wrap repository errors in CamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getSoftwareHistory').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.getSoftwareHistory('sw-1')).rejects.toThrow(
        expect.objectContaining({ message: 'Unable to retrieve software history.', status: 500 }),
      );
    });
  });
});

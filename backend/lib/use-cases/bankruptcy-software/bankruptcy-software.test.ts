import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankruptcySoftwareUseCase } from './bankruptcy-software';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
} from '@common/cams/bankruptcy-software';

describe('BankruptcySoftwareUseCase', () => {
  let context: ApplicationContext;
  let useCase: BankruptcySoftwareUseCase;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    useCase = new BankruptcySoftwareUseCase(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    test('should return empty array when no software exists', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getSoftwareList').mockResolvedValue([]);

      const result = await useCase.getSoftwareList();

      expect(result).toEqual([]);
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

    test('should fetch current, merge update, save, write audit record, and return updated', async () => {
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
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateSoftware')
        .mockResolvedValue(updated);
      const auditSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord')
        .mockResolvedValue();

      const result = await useCase.updateSoftware('sw-1', {
        name: 'Axos Renamed',
        status: 'inactive',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        'sw-1',
        expect.objectContaining({ name: 'Axos Renamed', status: 'inactive' }),
      );
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BankruptcySoftwareAuditHistory>>({
          documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
          softwareId: 'sw-1',
          before: current,
          after: updated,
        }),
      );
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

    test('should append bank to empty associatedBanks', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateSoftware')
        .mockResolvedValue({
          ...baseSoftware,
          associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
        });
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      await useCase.updateSoftware('sw-1', { addBank: { bankId: 'bank-1', bankName: 'Chase' } });

      expect(updateSpy).toHaveBeenCalledWith(
        'sw-1',
        expect.objectContaining({
          associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
        }),
      );
    });

    test('should append bank to existing associatedBanks array', async () => {
      const softwareWithBanks: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(
        softwareWithBanks,
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateSoftware')
        .mockResolvedValue({
          ...softwareWithBanks,
          associatedBanks: [
            { bankId: 'bank-1', bankName: 'Chase', status: 'active' },
            { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
          ],
        });
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      await useCase.updateSoftware('sw-1', {
        addBank: { bankId: 'bank-2', bankName: 'Wells Fargo' },
      });

      expect(updateSpy).toHaveBeenCalledWith(
        'sw-1',
        expect.objectContaining({
          associatedBanks: [
            { bankId: 'bank-1', bankName: 'Chase', status: 'active' },
            { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
          ],
        }),
      );
    });

    test('should reject duplicate bankId', async () => {
      const softwareWithBanks: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(
        softwareWithBanks,
      );

      await expect(
        useCase.updateSoftware('sw-1', { addBank: { bankId: 'bank-1', bankName: 'Chase' } }),
      ).rejects.toMatchObject({ status: 400 });
    });

    test('should write audit record with before/after', async () => {
      const updated: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue(updated);
      const auditSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord')
        .mockResolvedValue();

      await useCase.updateSoftware('sw-1', { addBank: { bankId: 'bank-1', bankName: 'Chase' } });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BankruptcySoftwareAuditHistory>>({
          documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
          softwareId: 'sw-1',
          before: baseSoftware,
          after: updated,
        }),
      );
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

    test('should update status of existing association', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateSoftware')
        .mockResolvedValue({
          ...baseSoftware,
          associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'inactive' }],
        });
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      await useCase.updateSoftware('sw-1', {
        updateBankAssociation: { bankId: 'bank-1', status: 'inactive' },
      });

      expect(updateSpy).toHaveBeenCalledWith(
        'sw-1',
        expect.objectContaining({
          associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'inactive' }],
        }),
      );
    });

    test('should reject unknown bankId', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);

      await expect(
        useCase.updateSoftware('sw-1', {
          updateBankAssociation: { bankId: 'bank-unknown', status: 'inactive' },
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    test('should write audit record with before/after', async () => {
      const updated: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'inactive' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue(updated);
      const auditSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord')
        .mockResolvedValue();

      await useCase.updateSoftware('sw-1', {
        updateBankAssociation: { bankId: 'bank-1', status: 'inactive' },
      });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BankruptcySoftwareAuditHistory>>({
          documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
          softwareId: 'sw-1',
          before: baseSoftware,
          after: updated,
        }),
      );
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

    test('should set createdBy and updatedBy from context user', async () => {
      const createdSoftware: BankruptcySoftwareProfile = {
        id: 'sw-new',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Test Software',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: context.session.user.id, name: context.session.user.name },
        createdOn: '2024-01-01T00:00:00.000Z',
        createdBy: { id: context.session.user.id, name: context.session.user.name },
      };

      const createSoftwareSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createSoftware')
        .mockResolvedValue(createdSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      await useCase.createSoftware({ name: 'Test Software' });

      expect(createSoftwareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: expect.objectContaining({ id: context.session.user.id }),
          updatedBy: expect.objectContaining({ id: context.session.user.id }),
        }),
      );
    });
  });
});

import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankruptcySoftwareUseCase } from './bankruptcy-software';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
} from '@common/cams/bankruptcy-software';
import { BankProfile } from '@common/cams/banks';
import { BadRequestError } from '../../common-errors/bad-request';

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

    test('should apply updates and return the persisted result', async () => {
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

    test('should set updatedBy and updatedOn from context user on field updates', async () => {
      const current: BankruptcySoftwareProfile = {
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(current);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateSoftware')
        .mockImplementation((_id, profile) => Promise.resolve(profile));
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      await useCase.updateSoftware('sw-1', { name: 'Renamed' });

      const passedProfile = updateSpy.mock.calls[0][1];
      expect(passedProfile.updatedBy).toEqual(
        expect.objectContaining({ id: context.session.user.id }),
      );
      expect(passedProfile.updatedOn).not.toEqual(current.updatedOn);
    });

    test('should throw CamsError when updateSoftware repository call fails', async () => {
      const current: BankruptcySoftwareProfile = {
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(current);
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockRejectedValue(
        new Error('write conflict'),
      );

      await expect(useCase.updateSoftware('sw-1', { name: 'New Name' })).rejects.toMatchObject({
        message: 'Unable to update bankruptcy software.',
      });
    });
  });

  describe('updateSoftware adding a bank association', () => {
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

      const error = await useCase
        .updateSoftware('sw-1', { addBank: { bankId: 'bank-1', bankName: 'Chase' } })
        .catch((e) => e);

      expect(error).toMatchObject({ status: 400 });
      expect(error.message).toEqual('This bank is already associated with this software.');
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

  describe('updateSoftware changing bank association status', () => {
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

    test('should reject unknown bankId with a generic error message', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);

      const error = await useCase
        .updateSoftware('sw-1', {
          updateBankAssociation: { bankId: 'bank-unknown', status: 'inactive' },
        })
        .catch((e) => e);

      expect(error).toMatchObject({ status: 400 });
      expect(error.message).toEqual('The specified bank is not associated with this software.');
    });

    const activeBank: BankProfile = {
      id: 'bank-1',
      documentType: 'BANK_PROFILE',
      name: 'Chase',
      status: 'active',
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
    };

    const inactiveBank: BankProfile = { ...activeBank, status: 'inactive' };

    test('should throw BadRequestError when attempting to reactivate association for an inactive bank', async () => {
      const softwareWithInactiveBank: BankruptcySoftwareProfile = {
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'inactive' }],
      };
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(
        softwareWithInactiveBank,
      );
      vi.spyOn(MockMongoRepository.prototype, 'getBank').mockResolvedValue(inactiveBank);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateSoftware');

      const error = await useCase
        .updateSoftware('sw-1', { updateBankAssociation: { bankId: 'bank-1', status: 'active' } })
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('Cannot reactivate association: the bank profile is inactive.');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should allow reactivating association when bank profile is active', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'inactive' }],
      });
      vi.spyOn(MockMongoRepository.prototype, 'getBank').mockResolvedValue(activeBank);
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue(baseSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      await expect(
        useCase.updateSoftware('sw-1', {
          updateBankAssociation: { bankId: 'bank-1', status: 'active' },
        }),
      ).resolves.toBeDefined();
    });

    test('should allow setting association to inactive regardless of bank profile status', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue(baseSoftware);
      const getBankSpy = vi.spyOn(MockMongoRepository.prototype, 'getBank');
      vi.spyOn(MockMongoRepository.prototype, 'updateSoftware').mockResolvedValue({
        ...baseSoftware,
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'inactive' }],
      });
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockResolvedValue();

      await useCase.updateSoftware('sw-1', {
        updateBankAssociation: { bankId: 'bank-1', status: 'inactive' },
      });

      expect(getBankSpy).not.toHaveBeenCalled();
    });

    test('should release banksRepo even if getBank throws', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getBank').mockRejectedValue(new Error('db error'));
      const releaseSpy = vi.spyOn(MockMongoRepository.prototype, 'release');

      await expect(
        useCase.updateSoftware('sw-1', {
          updateBankAssociation: { bankId: 'bank-1', status: 'active' },
        }),
      ).rejects.toThrow();

      expect(releaseSpy).toHaveBeenCalled();
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

    test('should throw when audit record write fails after successful create', async () => {
      const createdSoftware: BankruptcySoftwareProfile = {
        id: 'sw-new',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'TrustBooks',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };

      vi.spyOn(MockMongoRepository.prototype, 'createSoftware').mockResolvedValue(createdSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'createSoftwareAuditRecord').mockRejectedValue(
        new Error('audit write failed'),
      );

      await expect(useCase.createSoftware({ name: 'TrustBooks' })).rejects.toMatchObject({
        message: 'Unable to create bankruptcy software.',
      });
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

  describe('getTrusteesBySoftware', () => {
    test('should return trustees from repository', async () => {
      const mockResult = {
        data: [{ id: 'doc-1', trusteeId: 't-1', name: 'Adams' }],
        metadata: { total: 1 },
      };
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findTrusteesBySoftware')
        .mockResolvedValue(mockResult);

      const result = await useCase.getTrusteesBySoftware('sw-1', 25, 0);

      expect(findSpy).toHaveBeenCalledWith('sw-1', 25, 0);
      expect(result).toEqual(mockResult);
    });

    test('should throw CamsError when repository fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesBySoftware').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.getTrusteesBySoftware('sw-1', 25, 0)).rejects.toMatchObject({
        message: 'Unable to retrieve trustees for software.',
      });
    });

    test('should release repository after successful call', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesBySoftware').mockResolvedValue({
        data: [],
        metadata: { total: 0 },
      });
      const releaseSpy = vi.spyOn(MockMongoRepository.prototype, 'release');

      await useCase.getTrusteesBySoftware('sw-1', 25, 0);

      expect(releaseSpy).toHaveBeenCalled();
    });

    test('should release repository even when call fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesBySoftware').mockRejectedValue(
        new Error('db error'),
      );
      const releaseSpy = vi.spyOn(MockMongoRepository.prototype, 'release');

      await useCase.getTrusteesBySoftware('sw-1', 25, 0).catch(() => {});

      expect(releaseSpy).toHaveBeenCalled();
    });
  });

  describe('getTrusteeCountsBySoftware', () => {
    test('should return counts for each associated bank', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Test Software',
        status: 'active',
        associatedBanks: [
          { bankId: 'bank-1', bankName: 'Chase', status: 'active' },
          { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
        ],
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      });
      const countsByBank: Record<string, number> = { 'bank-1': 5, 'bank-2': 3 };
      vi.spyOn(MockMongoRepository.prototype, 'countTrusteesByBankAndSoftware').mockImplementation(
        (_softwareId: string, bankId: string) => Promise.resolve(countsByBank[bankId] ?? 0),
      );

      const result = await useCase.getTrusteeCountsBySoftware('sw-1');

      expect(result).toEqual({ 'bank-1': 5, 'bank-2': 3 });
    });

    test('should return empty object when software has no associated banks', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Test Software',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      });

      const result = await useCase.getTrusteeCountsBySoftware('sw-1');

      expect(result).toEqual({});
    });

    test('should throw CamsError when repository fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.getTrusteeCountsBySoftware('sw-1')).rejects.toMatchObject({
        message: 'Unable to retrieve trustee counts for software.',
      });
    });

    test('should release trustees repository after successful call', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Test Software',
        status: 'active',
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      });
      vi.spyOn(MockMongoRepository.prototype, 'countTrusteesByBankAndSoftware').mockResolvedValue(
        5,
      );
      const releaseSpy = vi.spyOn(MockMongoRepository.prototype, 'release');

      await useCase.getTrusteeCountsBySoftware('sw-1');

      expect(releaseSpy).toHaveBeenCalled();
    });

    test('should release trustees repository even when count fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Test Software',
        status: 'active',
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase', status: 'active' }],
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      });
      vi.spyOn(MockMongoRepository.prototype, 'countTrusteesByBankAndSoftware').mockRejectedValue(
        new Error('timeout'),
      );
      const releaseSpy = vi.spyOn(MockMongoRepository.prototype, 'release');

      await useCase.getTrusteeCountsBySoftware('sw-1').catch(() => {});

      expect(releaseSpy).toHaveBeenCalled();
    });
  });

  describe('getTrusteesByBankAndSoftware', () => {
    test('should return trustees from repository', async () => {
      const mockResult = {
        data: [{ id: 'doc-1', trusteeId: 't-1', name: 'Adams' }],
        metadata: { total: 1 },
      };
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findTrusteesByBankAndSoftware')
        .mockResolvedValue(mockResult);

      const result = await useCase.getTrusteesByBankAndSoftware('sw-1', 'bank-1', 25, 0);

      expect(findSpy).toHaveBeenCalledWith('sw-1', 'bank-1', 25, 0);
      expect(result).toEqual(mockResult);
    });

    test('should throw CamsError when repository fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByBankAndSoftware').mockRejectedValue(
        new Error('db error'),
      );

      await expect(
        useCase.getTrusteesByBankAndSoftware('sw-1', 'bank-1', 25, 0),
      ).rejects.toMatchObject({
        message: 'Unable to retrieve trustees for bank and software.',
      });
    });

    test('should release repository after successful call', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByBankAndSoftware').mockResolvedValue({
        data: [],
        metadata: { total: 0 },
      });
      const releaseSpy = vi.spyOn(MockMongoRepository.prototype, 'release');

      await useCase.getTrusteesByBankAndSoftware('sw-1', 'bank-1', 25, 0);

      expect(releaseSpy).toHaveBeenCalled();
    });

    test('should release repository even when call fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByBankAndSoftware').mockRejectedValue(
        new Error('db error'),
      );
      const releaseSpy = vi.spyOn(MockMongoRepository.prototype, 'release');

      await useCase.getTrusteesByBankAndSoftware('sw-1', 'bank-1', 25, 0).catch(() => {});

      expect(releaseSpy).toHaveBeenCalled();
    });
  });
});

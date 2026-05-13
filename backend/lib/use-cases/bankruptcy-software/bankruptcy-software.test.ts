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

  describe('createSoftware', () => {
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

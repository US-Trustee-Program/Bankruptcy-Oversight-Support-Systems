import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankruptcySoftwareController } from './bankruptcy-software.controller';
import { BankruptcySoftwareUseCase } from '../../use-cases/bankruptcy-software/bankruptcy-software';
import { CamsRole } from '@common/cams/roles';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

describe('BankruptcySoftwareController', () => {
  let context: ApplicationContext;
  let controller: BankruptcySoftwareController;

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

  const createdSoftware: BankruptcySoftwareProfile = {
    id: 'sw-new',
    documentType: 'BANKRUPTCY_SOFTWARE',
    name: 'New Software',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
    createdOn: '2024-01-01T00:00:00.000Z',
    createdBy: { id: 'user-1', name: 'User One' },
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    controller = new BankruptcySoftwareController(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleRequest', () => {
    test('should route GET (no id) to handleGet', async () => {
      context.request.method = 'GET';
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftwareList').mockResolvedValue(
        mockSoftware,
      );

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should route GET with softwareId to handleGetOne', async () => {
      context.request.method = 'GET';
      context.request.params = { softwareId: 'sw-1' };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftware').mockResolvedValue(
        mockSoftware[0],
      );

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should route POST to handlePost', async () => {
      context.request.method = 'POST';
      context.request.body = { name: 'New Software' };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'createSoftware').mockResolvedValue(
        createdSoftware,
      );

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
    });

    test('should route PUT with softwareId to handlePut', async () => {
      context.request.method = 'PUT';
      context.request.params = { softwareId: 'sw-1' };
      context.request.body = { name: 'Updated Name' };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'updateSoftware').mockResolvedValue(
        createdSoftware,
      );

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should return 405 for unsupported method', async () => {
      context.request.method = 'DELETE';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(405);
    });
  });

  describe('handleGetOne', () => {
    test('should return 200 with full profile including contact for SuperUser', async () => {
      const softwareWithContact = {
        ...mockSoftware[0],
        contact: { contactNames: ['Jane Doe'], emails: ['jane@axos.com'] },
      };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftware').mockResolvedValue(
        softwareWithContact,
      );

      const result = await controller.handleGetOne(context, 'sw-1');

      expect(result.statusCode).toBe(200);
      expect(result.body.data).toHaveProperty('contact');
    });

    test('should strip contact field for non-SuperUser', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      const softwareWithContact = {
        ...mockSoftware[0],
        contact: { contactNames: ['Jane Doe'] },
      };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftware').mockResolvedValue(
        softwareWithContact,
      );

      const result = await controller.handleGetOne(context, 'sw-1');

      expect(result.statusCode).toBe(200);
      expect(result.body.data).not.toHaveProperty('contact');
    });
  });

  describe('handlePut', () => {
    test('should return 200 with updated software for SuperUser', async () => {
      context.request.params = { softwareId: 'sw-1' };
      context.request.body = { name: 'Updated Name', status: 'inactive' };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'updateSoftware').mockResolvedValue(
        createdSoftware,
      );

      const result = await controller.handlePut(context, 'sw-1');

      expect(result.statusCode).toBe(200);
      expect(result.body.data).toEqual(createdSoftware);
    });

    test('should throw ForbiddenError for non-SuperUser', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request.body = { name: 'Updated' };

      await expect(controller.handlePut(context, 'sw-1')).rejects.toThrow(
        expect.objectContaining({ status: 403 }),
      );
    });

    test('should throw BadRequestError when name is blank', async () => {
      context.request.body = { name: '   ' };

      await expect(controller.handlePut(context, 'sw-1')).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });

    test('should allow update with only contact field (no name validation)', async () => {
      context.request.body = { contact: { emails: ['test@test.com'] } };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'updateSoftware').mockResolvedValue(
        createdSoftware,
      );

      const result = await controller.handlePut(context, 'sw-1');

      expect(result.statusCode).toBe(200);
    });
  });

  describe('handlePut with addBank', () => {
    test('should return 200 when addBank body is valid', async () => {
      context.request.params = { softwareId: 'sw-1' };
      context.request.body = { addBank: { bankId: 'bank-1', bankName: 'Chase' } };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'updateSoftware').mockResolvedValue(
        createdSoftware,
      );

      const result = await controller.handlePut(context, 'sw-1');

      expect(result.statusCode).toBe(200);
    });

    test('should throw BadRequestError when bankId is missing', async () => {
      context.request.params = { softwareId: 'sw-1' };
      context.request.body = { addBank: { bankName: 'Chase' } };

      await expect(controller.handlePut(context, 'sw-1')).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });

    test('should throw BadRequestError when bankName is missing', async () => {
      context.request.params = { softwareId: 'sw-1' };
      context.request.body = { addBank: { bankId: 'bank-1' } };

      await expect(controller.handlePut(context, 'sw-1')).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });
  });

  describe('handlePut with updateBankAssociation', () => {
    test('should return 200 when updateBankAssociation body is valid', async () => {
      context.request.params = { softwareId: 'sw-1' };
      context.request.body = { updateBankAssociation: { bankId: 'bank-1', status: 'inactive' } };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'updateSoftware').mockResolvedValue(
        createdSoftware,
      );

      const result = await controller.handlePut(context, 'sw-1');

      expect(result.statusCode).toBe(200);
    });

    test('should throw BadRequestError when status is invalid', async () => {
      context.request.params = { softwareId: 'sw-1' };
      context.request.body = { updateBankAssociation: { bankId: 'bank-1', status: 'pending' } };

      await expect(controller.handlePut(context, 'sw-1')).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });

    test('should throw BadRequestError when bankId is missing', async () => {
      context.request.params = { softwareId: 'sw-1' };
      context.request.body = { updateBankAssociation: { status: 'active' } };

      await expect(controller.handlePut(context, 'sw-1')).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });
  });

  describe('handleGet', () => {
    test('should return 200 with software list for any authenticated user', async () => {
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftwareList').mockResolvedValue(
        mockSoftware,
      );

      const result = await controller.handleGet(context);

      expect(result.statusCode).toBe(200);
      expect(result.body.data).toEqual(mockSoftware);
    });

    test('should return 200 for non-SuperUser roles', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftwareList').mockResolvedValue(
        mockSoftware,
      );

      const result = await controller.handleGet(context);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('handlePost', () => {
    test('should return 201 with created software for SuperUser', async () => {
      context.request.body = { name: 'New Software' };
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'createSoftware').mockResolvedValue(
        createdSoftware,
      );

      const result = await controller.handlePost(context);

      expect(result.statusCode).toBe(201);
      expect(result.body.data).toEqual(createdSoftware);
    });

    test('should throw ForbiddenError when user lacks SuperUser role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request.body = { name: 'New Software' };

      await expect(controller.handlePost(context)).rejects.toThrow(
        expect.objectContaining({ status: 403 }),
      );
    });

    test('should throw BadRequestError when name is missing', async () => {
      context.request.body = {};

      await expect(controller.handlePost(context)).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });

    test('should throw BadRequestError when name is blank', async () => {
      context.request.body = { name: '   ' };

      await expect(controller.handlePost(context)).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });

    test('should throw BadRequestError when body is null', async () => {
      context.request.body = null;

      await expect(controller.handlePost(context)).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });
  });
});

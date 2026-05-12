import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankruptcySoftwareController } from './bankruptcy-software.controller';
import { BankruptcySoftwareUseCase } from '../../use-cases/bankruptcy-software/bankruptcy-software';
import { CamsRole } from '@common/cams/roles';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

vi.mock('../../use-cases/bankruptcy-software/bankruptcy-software');

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

  describe('handleGet', () => {
    test('should return 200 with software list for SuperUser', async () => {
      vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftwareList').mockResolvedValue(
        mockSoftware,
      );

      const result = await controller.handleGet(context);

      expect(result.statusCode).toBe(200);
      expect(result.body.data).toEqual(mockSoftware);
    });

    test('should throw ForbiddenError when user lacks SuperUser role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];

      await expect(controller.handleGet(context)).rejects.toThrow(
        expect.objectContaining({ status: 403 }),
      );
    });

    test('should throw ForbiddenError when user has no roles', async () => {
      context.session.user.roles = [];

      await expect(controller.handleGet(context)).rejects.toThrow(
        expect.objectContaining({ status: 403 }),
      );
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

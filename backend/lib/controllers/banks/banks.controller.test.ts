import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BanksController } from './banks.controller';
import { BanksUseCase } from '../../use-cases/banks/banks';
import { CamsRole } from '@common/cams/roles';
import { BankProfile } from '@common/cams/banks';

vi.mock('../../use-cases/banks/banks');

describe('BanksController', () => {
  let context: ApplicationContext;
  let controller: BanksController;

  const mockBanks: BankProfile[] = [
    {
      id: 'bank-1',
      documentType: 'BANK_PROFILE',
      name: 'Alpha Bank',
      status: 'active',
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
    },
  ];

  const createdBank: BankProfile = {
    id: 'bank-new',
    documentType: 'BANK_PROFILE',
    name: 'New Bank',
    status: 'active',
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'User One' },
    createdOn: '2024-01-01T00:00:00.000Z',
    createdBy: { id: 'user-1', name: 'User One' },
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    controller = new BanksController(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleRequest', () => {
    test('should route GET to handleGet', async () => {
      context.request.method = 'GET';
      vi.spyOn(BanksUseCase.prototype, 'getBanks').mockResolvedValue(mockBanks);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should route GET with bankId to handleGetOne', async () => {
      context.request.method = 'GET';
      context.request.params = { bankId: 'bank-1' };
      vi.spyOn(BanksUseCase.prototype, 'getBank').mockResolvedValue(mockBanks[0]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should route POST to handlePost', async () => {
      context.request.method = 'POST';
      context.request.body = { name: 'New Bank' };
      vi.spyOn(BanksUseCase.prototype, 'createBank').mockResolvedValue(createdBank);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
    });

    test('should route PUT with bankId to handlePut', async () => {
      context.request.method = 'PUT';
      context.request.params = { bankId: 'bank-1' };
      context.request.body = { name: 'Updated', status: 'inactive' };
      vi.spyOn(BanksUseCase.prototype, 'updateBank').mockResolvedValue(mockBanks[0]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should return 405 for unsupported method', async () => {
      context.request.method = 'DELETE';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(405);
    });
  });

  describe('handleGet', () => {
    test('should return 200 with bank list for SuperUser', async () => {
      vi.spyOn(BanksUseCase.prototype, 'getBanks').mockResolvedValue(mockBanks);

      const result = await controller.handleGet(context);

      expect(result.statusCode).toBe(200);
      expect(result.body.data).toEqual(mockBanks);
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

  describe('handleGetOne', () => {
    test('should return 200 with single bank for SuperUser', async () => {
      context.request.params = { bankId: 'bank-1' };
      vi.spyOn(BanksUseCase.prototype, 'getBank').mockResolvedValue(mockBanks[0]);

      const result = await controller.handleGetOne(context);

      expect(result.statusCode).toBe(200);
      expect(result.body.data).toEqual(mockBanks[0]);
    });

    test('should throw ForbiddenError when user lacks SuperUser role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request.params = { bankId: 'bank-1' };

      await expect(controller.handleGetOne(context)).rejects.toThrow(
        expect.objectContaining({ status: 403 }),
      );
    });
  });

  describe('handlePut', () => {
    test('should return 200 with updated bank for SuperUser', async () => {
      const updatedBank: BankProfile = { ...mockBanks[0], name: 'Updated', status: 'inactive' };
      context.request.params = { bankId: 'bank-1' };
      context.request.body = { name: 'Updated', status: 'inactive' };
      vi.spyOn(BanksUseCase.prototype, 'updateBank').mockResolvedValue(updatedBank);

      const result = await controller.handlePut(context);

      expect(result.statusCode).toBe(200);
      expect(result.body.data).toEqual(updatedBank);
    });

    test.each([
      {
        label: 'user lacks SuperUser role',
        roles: [CamsRole.TrialAttorney],
        body: { name: 'Updated', status: 'active' },
        status: 403,
      },
      { label: 'body is null', roles: [CamsRole.SuperUser], body: null, status: 400 },
      {
        label: 'name is missing',
        roles: [CamsRole.SuperUser],
        body: { status: 'active' },
        status: 400,
      },
      {
        label: 'status is invalid',
        roles: [CamsRole.SuperUser],
        body: { name: 'Bank', status: 'unknown' },
        status: 400,
      },
    ])('should throw when $label', async ({ roles, body, status }) => {
      context.session.user.roles = roles;
      context.request.params = { bankId: 'bank-1' };
      context.request.body = body;

      await expect(controller.handlePut(context)).rejects.toThrow(
        expect.objectContaining({ status }),
      );
    });
  });

  describe('handlePost', () => {
    test('should return 201 with created bank for SuperUser', async () => {
      context.request.body = { name: 'New Bank' };
      vi.spyOn(BanksUseCase.prototype, 'createBank').mockResolvedValue(createdBank);

      const result = await controller.handlePost(context);

      expect(result.statusCode).toBe(201);
      expect(result.body.data).toEqual(createdBank);
    });

    test.each([
      {
        label: 'user lacks SuperUser role',
        roles: [CamsRole.TrialAttorney],
        body: { name: 'New Bank' },
        status: 403,
      },
      { label: 'body is null', roles: [CamsRole.SuperUser], body: null, status: 400 },
      { label: 'name is missing', roles: [CamsRole.SuperUser], body: {}, status: 400 },
      { label: 'name is blank', roles: [CamsRole.SuperUser], body: { name: '   ' }, status: 400 },
    ])('should throw when $label', async ({ roles, body, status }) => {
      context.session.user.roles = roles;
      context.request.body = body;

      await expect(controller.handlePost(context)).rejects.toThrow(
        expect.objectContaining({ status }),
      );
    });
  });
});

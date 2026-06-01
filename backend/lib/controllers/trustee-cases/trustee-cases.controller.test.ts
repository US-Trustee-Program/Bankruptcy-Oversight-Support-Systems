import { vi, type Mocked, type MockedClass } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeCasesController } from './trustee-cases.controller';
import { TrusteeCasesUseCase } from '../../use-cases/trustee-cases/trustee-cases.use-case';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';

vi.mock('../../use-cases/trustee-cases/trustee-cases.use-case');

describe('TrusteeCasesController', () => {
  let context: ApplicationContext;
  let controller: TrusteeCasesController;
  let mockUseCase: Mocked<TrusteeCasesUseCase>;

  const sampleItems: TrusteeCaseListItem[] = [
    {
      caseId: '081-24-12345',
      caseNumber: '24-12345',
      chapter: '7',
      dateFiled: '2024-03-15',
      appointedDate: '2024-03-20',
    },
  ];

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = { id: 'user1', name: 'Test User', roles: [CamsRole.TrusteeAdmin] };
    context.featureFlags = {
      'trustee-management': true,
      'trustee-case-list': true,
    };
    context.request.method = 'GET';
    context.request.params = { trusteeId: 'trustee-123' };

    mockUseCase = {
      getCasesForTrustee: vi.fn(),
    } as unknown as Mocked<TrusteeCasesUseCase>;

    (TrusteeCasesUseCase as MockedClass<typeof TrusteeCasesUseCase>).mockImplementation(function (
      this: TrusteeCasesUseCase,
    ) {
      return mockUseCase;
    });

    controller = new TrusteeCasesController(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature flag protection', () => {
    test('returns 404 when trustee-management flag is off', async () => {
      context.featureFlags['trustee-management'] = false;
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(404);
    });

    // TODO: restore when trustee-case-list hardcoded flag bypasses are removed
    test.skip('returns 404 when trustee-case-list flag is off', async () => {
      context.featureFlags['trustee-case-list'] = false;
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(404);
    });
  });

  describe('Authorization', () => {
    test('throws UnauthorizedError when user lacks TrusteeAdmin role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to access trustee cases',
      );
    });
  });

  describe('GET /trustees/:trusteeId/cases', () => {
    test('returns 200 with case list items', async () => {
      mockUseCase.getCasesForTrustee.mockResolvedValue(sampleItems);
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(sampleItems);
    });

    test('returns 200 with empty array when no cases', async () => {
      mockUseCase.getCasesForTrustee.mockResolvedValue([]);
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([]);
    });

    test('calls use case with correct trusteeId', async () => {
      mockUseCase.getCasesForTrustee.mockResolvedValue([]);
      await controller.handleRequest(context);
      expect(mockUseCase.getCasesForTrustee).toHaveBeenCalledWith(context, 'trustee-123');
    });
  });
});

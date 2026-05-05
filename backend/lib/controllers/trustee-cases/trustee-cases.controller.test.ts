import { vi, type Mocked, type MockedClass } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeCasesController } from './trustee-cases.controller';
import { TrusteeCasesUseCase } from '../../use-cases/trustees/trustee-cases';
import { CamsUserReference } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeCaseListItem } from '@common/cams/trustee-cases';

vi.mock('../../use-cases/trustees/trustee-cases');

const mockCaseListItem: TrusteeCaseListItem = {
  caseId: '111-24-00001',
  caseTitle: 'Smith, John',
  chapter: '7',
  dateFiled: '2024-01-15',
};

describe('TrusteeCasesController', () => {
  let context: ApplicationContext;
  let controller: TrusteeCasesController;
  let mockUseCase: Mocked<TrusteeCasesUseCase>;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = { ...mockUser, roles: [CamsRole.TrusteeAdmin] };
    context.featureFlags['trustee-case-tab'] = true;
    context.request.params['trusteeId'] = 'trustee-123';
    context.request.query = { limit: '25', offset: '0' };
    context.request.url = 'http://localhost/api/trustees/trustee-123/cases';

    mockUseCase = {
      getCasesForTrustee: vi.fn(),
    } as unknown as Mocked<TrusteeCasesUseCase>;

    (TrusteeCasesUseCase as MockedClass<typeof TrusteeCasesUseCase>).mockImplementation(function (
      this: TrusteeCasesUseCase,
    ) {
      return mockUseCase;
    });

    controller = new TrusteeCasesController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns 404 when trustee-case-tab flag is disabled', async () => {
    context.featureFlags['trustee-case-tab'] = false;

    const result = await controller.handleRequest(context);

    expect(result.statusCode).toBe(404);
  });

  test('throws UnauthorizedError when user lacks TrusteeAdmin role', async () => {
    context.session.user.roles = [CamsRole.TrialAttorney];

    await expect(controller.handleRequest(context)).rejects.toThrow('Unauthorized');
  });

  test('throws BadRequestError when trusteeId param is missing', async () => {
    delete context.request.params['trusteeId'];

    await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
  });

  test('returns 200 with correct data, pagination, and meta on success', async () => {
    mockUseCase.getCasesForTrustee.mockResolvedValue({
      data: [mockCaseListItem],
      metadata: { total: 1 },
    });

    const result = await controller.handleRequest(context);

    expect(result.statusCode).toBe(200);
    expect(result.body?.data).toEqual([mockCaseListItem]);
    expect(result.body?.pagination).toMatchObject({
      count: 1,
      limit: 25,
      currentPage: 1,
      totalPages: 1,
      totalCount: 1,
    });
    expect(result.body?.meta).toEqual({ self: context.request.url });
  });

  test('pagination.next is present when more pages remain', async () => {
    context.request.query = { limit: '25', offset: '0' };
    mockUseCase.getCasesForTrustee.mockResolvedValue({
      data: Array(25).fill(mockCaseListItem),
      metadata: { total: 30 },
    });

    const result = await controller.handleRequest(context);

    expect(result.body?.pagination?.next).toBeDefined();
    expect(result.body?.pagination?.next).toContain('offset=25');
  });

  test('pagination.next is absent on the last page', async () => {
    context.request.query = { limit: '25', offset: '25' };
    mockUseCase.getCasesForTrustee.mockResolvedValue({
      data: Array(5).fill(mockCaseListItem),
      metadata: { total: 30 },
    });

    const result = await controller.handleRequest(context);

    expect(result.body?.pagination?.next).toBeUndefined();
  });

  test('pagination.previous is present when offset > 0', async () => {
    context.request.query = { limit: '25', offset: '25' };
    mockUseCase.getCasesForTrustee.mockResolvedValue({
      data: Array(5).fill(mockCaseListItem),
      metadata: { total: 30 },
    });

    const result = await controller.handleRequest(context);

    expect(result.body?.pagination?.previous).toBeDefined();
    expect(result.body?.pagination?.previous).toContain('offset=0');
  });

  test('pagination.previous is absent on the first page', async () => {
    context.request.query = { limit: '25', offset: '0' };
    mockUseCase.getCasesForTrustee.mockResolvedValue({
      data: [mockCaseListItem],
      metadata: { total: 1 },
    });

    const result = await controller.handleRequest(context);

    expect(result.body?.pagination?.previous).toBeUndefined();
  });

  test('returns 200 with empty data and currentPage=0 when no results', async () => {
    mockUseCase.getCasesForTrustee.mockResolvedValue({
      data: [],
      metadata: { total: 0 },
    });

    const result = await controller.handleRequest(context);

    expect(result.statusCode).toBe(200);
    expect(result.body?.data).toEqual([]);
    expect(result.body?.pagination?.currentPage).toBe(0);
    expect(result.body?.pagination?.totalCount).toBe(0);
  });
});

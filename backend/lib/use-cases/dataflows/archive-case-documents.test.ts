import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { archiveCaseAndRelatedDocuments } from './archive-case-documents';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import factory from '../../factory';

// archive-case-documents calls these six repos, each stubbed here as its own distinct fake
// object (not a shared MockMongoRepository prototype) so a test can tell which repo a call
// landed on — e.g. that the "cases" step's delete really goes through casesRepo.delete, not
// some other repo's. ordersRepo.findByCaseId is called once upfront (populates the "orders"
// step); every other repo's findByCaseId/getByCaseId is called once, by its own step.
function makeFakeRepo() {
  return {
    findByCaseId: vi.fn().mockResolvedValue([]),
    getByCaseId: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    archiveDocument: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
}

type FakeRepos = {
  archivedCasesRepo: ReturnType<typeof makeFakeRepo>;
  casesRepo: ReturnType<typeof makeFakeRepo>;
  assignmentsRepo: ReturnType<typeof makeFakeRepo>;
  ordersRepo: ReturnType<typeof makeFakeRepo>;
  consolidationsRepo: ReturnType<typeof makeFakeRepo>;
  appointmentsRepo: ReturnType<typeof makeFakeRepo>;
};

function wireFakeRepos(): FakeRepos {
  const repos: FakeRepos = {
    archivedCasesRepo: makeFakeRepo(),
    casesRepo: makeFakeRepo(),
    assignmentsRepo: makeFakeRepo(),
    ordersRepo: makeFakeRepo(),
    consolidationsRepo: makeFakeRepo(),
    appointmentsRepo: makeFakeRepo(),
  };

  vi.spyOn(factory, 'getArchivedCasesRepository').mockReturnValue(
    repos.archivedCasesRepo as unknown as ReturnType<typeof factory.getArchivedCasesRepository>,
  );
  vi.spyOn(factory, 'getCasesRepository').mockReturnValue(
    repos.casesRepo as unknown as ReturnType<typeof factory.getCasesRepository>,
  );
  vi.spyOn(factory, 'getAssignmentRepository').mockReturnValue(
    repos.assignmentsRepo as unknown as ReturnType<typeof factory.getAssignmentRepository>,
  );
  vi.spyOn(factory, 'getOrdersRepository').mockReturnValue(
    repos.ordersRepo as unknown as ReturnType<typeof factory.getOrdersRepository>,
  );
  vi.spyOn(factory, 'getConsolidationOrdersRepository').mockReturnValue(
    repos.consolidationsRepo as unknown as ReturnType<
      typeof factory.getConsolidationOrdersRepository
    >,
  );
  vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
    repos.appointmentsRepo as unknown as ReturnType<
      typeof factory.getTrusteeCaseAppointmentsRepository
    >,
  );

  return repos;
}

describe('ArchiveCaseDocuments use case', () => {
  let context: ApplicationContext;
  let repos: FakeRepos;
  const caseId = '001-25-00001';

  beforeEach(async () => {
    context = await createMockApplicationContext();
    vi.restoreAllMocks();
    repos = wireFakeRepos();
  });

  test('archives and deletes case-scoped documents through casesRepo specifically', async () => {
    const syncedCase = { id: '1', caseId, documentType: 'SYNCED_CASE' };
    repos.casesRepo.findByCaseId.mockResolvedValue([syncedCase]);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(repos.archivedCasesRepo.archiveDocument).toHaveBeenCalledWith(
      syncedCase,
      'cases',
      caseId,
    );
    expect(repos.casesRepo.delete).toHaveBeenCalledWith('1');
    // Proves the deleteFunc mapping routes 'cases' to casesRepo, not some other repo.
    expect(repos.assignmentsRepo.delete).not.toHaveBeenCalled();
    expect(repos.ordersRepo.delete).not.toHaveBeenCalled();
  });

  test('archives and deletes multiple documents through assignmentsRepo specifically', async () => {
    const assignments = [
      { id: 'a1', caseId },
      { id: 'a2', caseId },
    ];
    repos.assignmentsRepo.findByCaseId.mockResolvedValue(assignments);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(repos.assignmentsRepo.delete).toHaveBeenCalledTimes(2);
    expect(repos.assignmentsRepo.delete).toHaveBeenCalledWith('a1');
    expect(repos.assignmentsRepo.delete).toHaveBeenCalledWith('a2');
    expect(repos.casesRepo.delete).not.toHaveBeenCalled();
  });

  test('archives and deletes orders (upfront ordersRepo.findByCaseId) through ordersRepo specifically', async () => {
    const transferOrder = { id: 'o1', caseId, taskType: 'transfer' };
    const consolidationOrder = { id: 'o2', caseId, taskType: 'consolidation' };
    repos.ordersRepo.findByCaseId.mockResolvedValue([transferOrder, consolidationOrder]);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(repos.ordersRepo.delete).toHaveBeenCalledTimes(2);
    expect(repos.ordersRepo.delete).toHaveBeenCalledWith('o1');
    expect(repos.ordersRepo.delete).toHaveBeenCalledWith('o2');
    expect(repos.casesRepo.delete).not.toHaveBeenCalled();
  });

  test('archives and deletes consolidation details through consolidationsRepo specifically', async () => {
    const consolidation = { id: 'cons1', caseId, documentType: 'ConsolidationOrder' };
    repos.consolidationsRepo.findByCaseId.mockResolvedValue([consolidation]);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(repos.consolidationsRepo.delete).toHaveBeenCalledWith('cons1');
    expect(repos.casesRepo.delete).not.toHaveBeenCalled();
  });

  test('archives and deletes trustee appointments through appointmentsRepo.getByCaseId specifically', async () => {
    const appointment = {
      id: 'apt1',
      caseId,
      documentType: 'CaseAppointment',
      trusteeId: 'trustee-001',
      assignedOn: '2020-01-01',
      updatedOn: '2020-01-01T00:00:00.000Z',
      updatedBy: { id: 'system', name: 'System' },
    };
    repos.appointmentsRepo.getByCaseId.mockResolvedValue([appointment]);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(repos.appointmentsRepo.delete).toHaveBeenCalledWith('apt1');
    expect(repos.casesRepo.delete).not.toHaveBeenCalled();
  });

  test('should continue on error and log failures', async () => {
    repos.casesRepo.findByCaseId.mockRejectedValueOnce(new Error('Query error'));

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe('case-documents');
  });

  test.each([
    { label: 'TooManyRequestsError', build: () => new TooManyRequestsError('TEST') },
    { label: 'GatewayTimeoutError', build: () => new GatewayTimeoutError('TEST') },
  ])('rethrows a $label from a step instead of capturing it', async ({ build }) => {
    const transientError = build();
    repos.casesRepo.findByCaseId.mockRejectedValueOnce(transientError);

    await expect(archiveCaseAndRelatedDocuments(context, caseId)).rejects.toThrow(transientError);
    // The finally block's repo.release() calls still run even though the step rethrows.
    expect(repos.casesRepo.release).toHaveBeenCalled();
    expect(repos.archivedCasesRepo.release).toHaveBeenCalled();
    expect(repos.assignmentsRepo.release).toHaveBeenCalled();
    expect(repos.ordersRepo.release).toHaveBeenCalled();
    expect(repos.consolidationsRepo.release).toHaveBeenCalled();
    expect(repos.appointmentsRepo.release).toHaveBeenCalled();
  });

  test('should handle case with no related documents', async () => {
    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test('should handle documents without id field', async () => {
    const documentWithoutId = { caseId, documentType: 'SYNCED_CASE' };
    repos.casesRepo.findByCaseId.mockResolvedValue([documentWithoutId]);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(repos.casesRepo.delete).not.toHaveBeenCalled();
  });
});

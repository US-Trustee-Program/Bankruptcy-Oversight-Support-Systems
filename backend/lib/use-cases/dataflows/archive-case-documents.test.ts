import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { archiveCaseAndRelatedDocuments } from './archive-case-documents';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

// archive-case-documents calls repos in this sequence:
//   1. ordersRepo.findByCaseId    (upfront — populates orders step)
//   2. casesRepo.findByCaseId     (step: case-documents)
//   3. assignmentsRepo.findByCaseId (step: assignments)
//   4. orders resolved from (1)   (step: orders — no new call)
//   5. consolidationsRepo.findByCaseId (step: consolidations)
//   6. appointmentsRepo.getByCaseId   (step: trustee-appointments)
//   7+ other repos may also call findByCaseId (notes, audit, etc.)
//
// Each test mocks findByCaseId for the case/assignments/consolidations repos
// and getByCaseId for the appointments repo separately.

describe('ArchiveCaseDocuments use case', () => {
  let context: ApplicationContext;
  const caseId = '001-25-00001';

  beforeEach(async () => {
    context = await createMockApplicationContext();
    vi.restoreAllMocks();
  });

  test('should archive and delete SYNCED_CASE document', async () => {
    const syncedCase = { id: '1', caseId, documentType: 'SYNCED_CASE' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // orders (upfront)
      .mockResolvedValueOnce([syncedCase]) // cases step
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(MockMongoRepository.prototype.archiveDocument).toHaveBeenCalledWith(
      syncedCase,
      'cases',
      caseId,
    );
    expect(MockMongoRepository.prototype.delete).toHaveBeenCalledWith('1');
  });

  test('should archive and delete multiple ASSIGNMENT documents', async () => {
    const assignments = [
      { id: 'a1', caseId },
      { id: 'a2', caseId },
    ];

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // orders (upfront)
      .mockResolvedValueOnce([]) // cases step
      .mockResolvedValueOnce(assignments) // assignments step
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(MockMongoRepository.prototype.archiveDocument).toHaveBeenCalledTimes(2);
    expect(MockMongoRepository.prototype.delete).toHaveBeenCalledTimes(2);
  });

  test('should archive and delete TRANSFER_FROM and TRANSFER_TO documents', async () => {
    const transferFrom = { id: 't1', caseId, documentType: 'TRANSFER_FROM' };
    const transferTo = { id: 't2', caseId, documentType: 'TRANSFER_TO' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([transferFrom, transferTo]) // orders (upfront) — orders are transfers
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  test('should archive and delete CONSOLIDATION_FROM and CONSOLIDATION_TO documents', async () => {
    const consolidationFrom = { id: 'c1', caseId, documentType: 'CONSOLIDATION_FROM' };
    const consolidationTo = { id: 'c2', caseId, documentType: 'CONSOLIDATION_TO' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([consolidationFrom, consolidationTo]) // orders (upfront)
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  test('should archive and delete orders (transfer, consolidation)', async () => {
    const transferOrder = { id: 'o1', caseId, taskType: 'transfer' };
    const consolidationOrder = { id: 'o2', caseId, taskType: 'consolidation' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([transferOrder, consolidationOrder]) // orders (upfront)
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  test('should archive and delete consolidation details', async () => {
    const consolidation = { id: 'cons1', caseId, documentType: 'ConsolidationOrder' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // orders (upfront)
      .mockResolvedValueOnce([]) // cases
      .mockResolvedValueOnce([]) // assignments
      .mockResolvedValueOnce([consolidation]) // consolidations step
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  test('should archive and delete trustee appointments', async () => {
    const appointment = { id: 'apt1', caseId, documentType: 'CaseAppointment' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([appointment]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  test('should archive and delete case notes', async () => {
    const note = { id: 'note1', caseId, documentType: 'NOTE' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // orders (upfront)
      .mockResolvedValueOnce([note]) // cases step (notes are case-scoped)
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  test('should archive and delete audit history (AUDIT_ASSIGNMENT, AUDIT_TRANSFER, AUDIT_CONSOLIDATION)', async () => {
    const auditAssignment = { id: 'audit1', caseId, documentType: 'AUDIT_ASSIGNMENT' };
    const auditTransfer = { id: 'audit2', caseId, documentType: 'AUDIT_TRANSFER' };
    const auditConsolidation = { id: 'audit3', caseId, documentType: 'AUDIT_CONSOLIDATION' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // orders (upfront)
      .mockResolvedValueOnce([auditAssignment, auditTransfer, auditConsolidation]) // cases step
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  test('should return summary with archived counts', async () => {
    const syncedCase = { id: '1', caseId, documentType: 'SYNCED_CASE' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // orders (upfront)
      .mockResolvedValueOnce([syncedCase]) // cases step
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result).toEqual({
      caseId,
      archivedCount: expect.any(Number),
      errors: expect.any(Array),
    });
    expect(result.archivedCount).toBeGreaterThan(0);
  });

  test('should continue on error and log failures', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // orders (upfront)
      .mockRejectedValueOnce(new Error('Query error')) // cases step throws
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe('case-documents');
  });

  test('should handle case with no related documents', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test('should handle documents without id field', async () => {
    const documentWithoutId = { caseId, documentType: 'SYNCED_CASE' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // orders (upfront)
      .mockResolvedValueOnce([documentWithoutId]) // cases step
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([]);
    const deleteSpy = vi
      .spyOn(MockMongoRepository.prototype, 'delete')
      .mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { archiveCaseAndRelatedDocuments } from './archive-case-documents';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

describe('ArchiveCaseDocuments use case', () => {
  let context: ApplicationContext;
  const caseId = '001-25-00001';

  beforeEach(async () => {
    context = await createMockApplicationContext();
    vi.restoreAllMocks();
  });

  /**
   * Test 1: Should archive and delete SYNCED_CASE document
   */
  test('should archive and delete SYNCED_CASE document', async () => {
    const syncedCase = { id: '1', caseId, documentType: 'SYNCED_CASE' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType')
      .mockResolvedValueOnce([syncedCase]) // SYNCED_CASE
      .mockResolvedValue([]); // All others empty
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
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

  /**
   * Test 2: Should archive and delete multiple ASSIGNMENT documents
   */
  test('should archive and delete multiple ASSIGNMENT documents', async () => {
    const assignments = [
      { id: 'a1', caseId },
      { id: 'a2', caseId },
    ];

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // ordersRepo.findByCaseId (called first)
      .mockResolvedValueOnce(assignments) // assignmentsRepo.findByCaseId (called second)
      .mockResolvedValue([]); // All other findByCaseId calls
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(MockMongoRepository.prototype.archiveDocument).toHaveBeenCalledTimes(2);
    expect(MockMongoRepository.prototype.delete).toHaveBeenCalledTimes(2);
  });

  /**
   * Test 3: Should archive and delete TRANSFER_FROM and TRANSFER_TO documents
   */
  test('should archive and delete TRANSFER_FROM and TRANSFER_TO documents', async () => {
    const transferFrom = { id: 't1', caseId, documentType: 'TRANSFER_FROM' };
    const transferTo = { id: 't2', caseId, documentType: 'TRANSFER_TO' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType')
      .mockResolvedValueOnce([]) // SYNCED_CASE
      .mockResolvedValueOnce([transferFrom]) // TRANSFER_FROM
      .mockResolvedValueOnce([transferTo]) // TRANSFER_TO
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBeGreaterThanOrEqual(2);
    expect(result.errors).toHaveLength(0);
  });

  /**
   * Test 4: Should archive and delete CONSOLIDATION_FROM and CONSOLIDATION_TO documents
   */
  test('should archive and delete CONSOLIDATION_FROM and CONSOLIDATION_TO documents', async () => {
    const consolidationFrom = { id: 'c1', caseId, documentType: 'CONSOLIDATION_FROM' };
    const consolidationTo = { id: 'c2', caseId, documentType: 'CONSOLIDATION_TO' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType')
      .mockResolvedValueOnce([]) // SYNCED_CASE
      .mockResolvedValueOnce([]) // TRANSFER_FROM
      .mockResolvedValueOnce([]) // TRANSFER_TO
      .mockResolvedValueOnce([consolidationFrom]) // CONSOLIDATION_FROM
      .mockResolvedValueOnce([consolidationTo]) // CONSOLIDATION_TO
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBeGreaterThanOrEqual(2);
    expect(result.errors).toHaveLength(0);
  });

  /**
   * Test 5: Should archive and delete orders (transfer, consolidation)
   */
  test('should archive and delete orders (transfer, consolidation)', async () => {
    const transferOrder = { id: 'o1', caseId, orderType: 'transfer' };
    const consolidationOrder = { id: 'o2', caseId, orderType: 'consolidation' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([transferOrder, consolidationOrder]) // ordersRepo.findByCaseId
      .mockResolvedValue([]); // All other findByCaseId calls
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  /**
   * Test 6: Should archive and delete consolidation details
   */
  test('should archive and delete consolidation details', async () => {
    const consolidation = { id: 'cons1', caseId, documentType: 'ConsolidationOrder' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // ordersRepo.findByCaseId
      .mockResolvedValueOnce([]) // assignmentsRepo.findByCaseId
      .mockResolvedValueOnce([consolidation]) // consolidationsRepo.findByCaseId
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBeGreaterThanOrEqual(1);
    expect(result.errors).toHaveLength(0);
  });

  /**
   * Test 7: Should archive and delete trustee appointments
   */
  test('should archive and delete trustee appointments', async () => {
    const appointment = { id: 'apt1', caseId, documentType: 'CaseAppointment' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([]) // ordersRepo.findByCaseId
      .mockResolvedValueOnce([]) // assignmentsRepo.findByCaseId
      .mockResolvedValueOnce([]) // consolidationsRepo.findByCaseId
      .mockResolvedValueOnce([appointment]) // appointmentsRepo.findByCaseId
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBeGreaterThanOrEqual(1);
    expect(result.errors).toHaveLength(0);
  });

  /**
   * Test 8: Should archive and delete case notes
   */
  test('should archive and delete case notes', async () => {
    const note = { id: 'note1', caseId, documentType: 'NOTE' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType')
      .mockResolvedValueOnce([]) // SYNCED_CASE
      .mockResolvedValueOnce([]) // TRANSFER_FROM
      .mockResolvedValueOnce([]) // TRANSFER_TO
      .mockResolvedValueOnce([]) // CONSOLIDATION_FROM
      .mockResolvedValueOnce([]) // CONSOLIDATION_TO
      .mockResolvedValueOnce([note]) // NOTE
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBeGreaterThanOrEqual(1);
    expect(result.errors).toHaveLength(0);
  });

  /**
   * Test 9: Should archive and delete audit history (AUDIT_ASSIGNMENT, AUDIT_TRANSFER, AUDIT_CONSOLIDATION)
   */
  test('should archive and delete audit history (AUDIT_ASSIGNMENT, AUDIT_TRANSFER, AUDIT_CONSOLIDATION)', async () => {
    const auditAssignment = { id: 'audit1', caseId, documentType: 'AUDIT_ASSIGNMENT' };
    const auditTransfer = { id: 'audit2', caseId, documentType: 'AUDIT_TRANSFER' };
    const auditConsolidation = { id: 'audit3', caseId, documentType: 'AUDIT_CONSOLIDATION' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType')
      .mockResolvedValueOnce([]) // SYNCED_CASE
      .mockResolvedValueOnce([]) // TRANSFER_FROM
      .mockResolvedValueOnce([]) // TRANSFER_TO
      .mockResolvedValueOnce([]) // CONSOLIDATION_FROM
      .mockResolvedValueOnce([]) // CONSOLIDATION_TO
      .mockResolvedValueOnce([]) // NOTE
      .mockResolvedValueOnce([auditAssignment]) // AUDIT_ASSIGNMENT
      .mockResolvedValueOnce([auditTransfer]) // AUDIT_TRANSFER
      .mockResolvedValueOnce([auditConsolidation]) // AUDIT_CONSOLIDATION
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  /**
   * Test 10: Should return summary with archived counts
   */
  test('should return summary with archived counts', async () => {
    const syncedCase = { id: '1', caseId, documentType: 'SYNCED_CASE' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType')
      .mockResolvedValueOnce([syncedCase])
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
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

  /**
   * Test 11: Should continue on error and log failures
   */
  test('should continue on error and log failures', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType')
      .mockRejectedValueOnce(new Error('Query error'))
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    // Should have captured error and continued with remaining document types
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe('SYNCED_CASE');
  });

  /**
   * Test 12: Should handle case with no related documents
   */
  test('should handle case with no related documents', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseIdAndType').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

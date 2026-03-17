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

  test('should archive and delete SYNCED_CASE document', async () => {
    const syncedCase = { id: '1', caseId, documentType: 'SYNCED_CASE' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([syncedCase])
      .mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(assignments)
      .mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([transferFrom, transferTo])
      .mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([consolidationFrom, consolidationTo])
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  test('should archive and delete orders (transfer, consolidation)', async () => {
    const transferOrder = { id: 'o1', caseId, orderType: 'transfer' };
    const consolidationOrder = { id: 'o2', caseId, orderType: 'consolidation' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([transferOrder, consolidationOrder])
      .mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([consolidation])
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.archivedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  test('should archive and delete trustee appointments', async () => {
    const appointment = { id: 'apt1', caseId, documentType: 'CaseAppointment' };

    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([appointment])
      .mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([note])
      .mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([auditAssignment, auditTransfer, auditConsolidation])
      .mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([syncedCase])
      .mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Query error'))
      .mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'archiveDocument').mockResolvedValue(undefined);

    const result = await archiveCaseAndRelatedDocuments(context, caseId);

    expect(result.caseId).toBe(caseId);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe('case-documents');
  });

  test('should handle case with no related documents', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([documentWithoutId])
      .mockResolvedValue([]);
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

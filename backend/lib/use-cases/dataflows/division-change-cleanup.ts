import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import QueryBuilder from '../../query/query-builder';
import { Order } from '@common/cams/orders';
import { CaseAssignment } from '@common/cams/assignments';
import { OrphanedCaseMessage } from '@common/cams/dataflow-events';

export type { OrphanedCaseMessage };

const MODULE_NAME = 'DIVISION-CHANGE-CLEANUP-USE-CASE';
const { using } = QueryBuilder;

export class DivisionChangeCleanupUseCase {
  static async identifyOrphanedCases(
    context: ApplicationContext,
    dxtrId: string,
    courtId: string,
    caseIds: string[],
  ): Promise<{ currentCaseId: string; orphanedCaseIds: string[] }> {
    try {
      const casesGateway = factory.getCasesGateway(context);
      const dxtrResults = await casesGateway.searchCases(context, {
        dxtrId,
        courtId,
      });

      if (!dxtrResults || dxtrResults.length === 0) {
        throw getCamsError(
          new Error(`No case found in DXTR for dxtrId=${dxtrId}, courtId=${courtId}`),
          MODULE_NAME,
        );
      }

      const currentCaseId = dxtrResults[0].caseId;
      const orphanedCaseIds = caseIds.filter((id) => id !== currentCaseId);

      context.logger.info(
        MODULE_NAME,
        `Identified current case ${currentCaseId} from DXTR, found ${orphanedCaseIds.length} orphaned cases`,
      );

      return { currentCaseId, orphanedCaseIds };
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to identify orphaned cases for dxtrId=${dxtrId}, courtId=${courtId}`,
      );
    }
  }

  static async findOrphanedCasePairs(context: ApplicationContext): Promise<OrphanedCaseMessage[]> {
    const casesRepo = factory.getCasesRepository(context);
    const duplicateGroups = await casesRepo.findDuplicateSyncedCases();
    const fixMessages: OrphanedCaseMessage[] = [];
    for (const group of duplicateGroups) {
      if (group.caseIds && group.caseIds.length >= 2) {
        try {
          const { currentCaseId, orphanedCaseIds } =
            await DivisionChangeCleanupUseCase.identifyOrphanedCases(
              context,
              group.dxtrId,
              group.courtId,
              group.caseIds,
            );
          for (const orphanedCaseId of orphanedCaseIds) {
            fixMessages.push({ orphanedCaseId, currentCaseId });
          }
        } catch (error) {
          context.logger.error(
            MODULE_NAME,
            `Failed to identify orphaned cases for group (${group.dxtrId}, ${group.courtId}): ${(error as Error).message}`,
          );
        }
      }
    }
    context.logger.info(
      MODULE_NAME,
      `Aggregation complete, found ${fixMessages.length} orphaned cases for cleanup`,
    );
    return fixMessages;
  }

  static async cleanupOrphanedCase(
    context: ApplicationContext,
    orphanedCaseId: string,
    currentCaseId: string,
  ): Promise<number> {
    try {
      const casesRepo = factory.getCasesRepository(context);
      const existing = await casesRepo.getSyncedCase(orphanedCaseId);
      if (!existing || existing.status === 'MOVED') {
        context.logger.info(MODULE_NAME, `Case ${orphanedCaseId} already cleaned up, skipping`);
        return 0;
      }

      context.logger.info(MODULE_NAME, `Starting cleanup for ${orphanedCaseId} → ${currentCaseId}`);

      await this.updateReferences(context, orphanedCaseId, currentCaseId);
      const documentsWritten = await this.moveDocuments(context, orphanedCaseId, currentCaseId);

      await casesRepo.markAsMoved(orphanedCaseId, currentCaseId, new Date().toISOString());

      context.logger.info(
        MODULE_NAME,
        `Cleanup completed for ${orphanedCaseId} → ${currentCaseId}`,
      );
      return documentsWritten;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, `Failed to clean up ${orphanedCaseId}`);
    }
  }

  private static async updateReferences(
    context: ApplicationContext,
    oldCaseId: string,
    newCaseId: string,
  ): Promise<void> {
    const consolidationsRepo = factory.getConsolidationOrdersRepository(context);
    const consolidationDoc = using<{ caseId: string }>();
    const consolidationQuery = consolidationDoc('caseId').equals(oldCaseId);
    const consolidationResult = await consolidationsRepo.updateManyByQuery(consolidationQuery, {
      $set: { caseId: newCaseId },
    });
    context.logger.info(
      MODULE_NAME,
      `Updated ${consolidationResult.modifiedCount} consolidation records`,
    );

    const trusteeMatchRepo = factory.getTrusteeMatchVerificationRepository(context);
    const trusteeMatchDoc = await trusteeMatchRepo.getVerification(oldCaseId);
    if (trusteeMatchDoc) {
      await trusteeMatchRepo.update(trusteeMatchDoc.id, { caseId: newCaseId });
      context.logger.info(MODULE_NAME, `Updated 1 trustee-match-verification record`);
    } else {
      context.logger.info(MODULE_NAME, `Updated 0 trustee-match-verification records`);
    }

    const officeAssigneesRepo = factory.getOfficeAssigneesRepository(context);
    await officeAssigneesRepo.deleteMany({ caseId: oldCaseId });
    context.logger.info(MODULE_NAME, `Deleted office-assignees for ${oldCaseId}`);
  }

  private static async moveDocuments(
    context: ApplicationContext,
    oldCaseId: string,
    newCaseId: string,
  ): Promise<number> {
    let count = 0;

    const ordersRepo = factory.getOrdersRepository(context);
    const oldOrders = await ordersRepo.findByCaseId(oldCaseId);
    context.logger.info(
      MODULE_NAME,
      `Moving ${oldOrders.length} orders from ${oldCaseId} to ${newCaseId}`,
    );
    for (const order of oldOrders) {
      const { id, ...orderData } = order as Order;
      const newOrder = { ...orderData, caseId: newCaseId } as Order;
      context.logger.debug(
        MODULE_NAME,
        `Creating order ${order.orderType} in partition ${newCaseId}`,
      );
      await ordersRepo.create(newOrder as Order);
      context.logger.debug(MODULE_NAME, `Deleting order ${id} from partition ${oldCaseId}`);
      await ordersRepo.delete(id);
      count++;
    }

    const assignmentRepo = factory.getAssignmentRepository(context);
    const oldAssignments = await assignmentRepo.findByCaseId(oldCaseId);
    context.logger.info(
      MODULE_NAME,
      `Moving ${oldAssignments.length} assignments from ${oldCaseId} to ${newCaseId}`,
    );
    for (const assignment of oldAssignments) {
      const { id, ...assignmentData } = assignment as CaseAssignment;
      const newAssignment: Omit<CaseAssignment, 'id'> = { ...assignmentData, caseId: newCaseId };
      context.logger.debug(
        MODULE_NAME,
        `Creating assignment for ${assignment.name} in partition ${newCaseId}`,
      );
      await assignmentRepo.create(newAssignment as CaseAssignment);
      context.logger.debug(MODULE_NAME, `Deleting assignment ${id} from partition ${oldCaseId}`);
      await assignmentRepo.delete(id);
      count++;
    }

    const casesRepo = factory.getCasesRepository(context);
    type CaseDoc = { id: string; caseId: string; documentType: string; [key: string]: unknown };
    const oldCases = (await casesRepo.findByCaseId(oldCaseId)) as CaseDoc[];
    const nonSyncedCases = oldCases.filter((doc) => doc.documentType !== 'SYNCED_CASE');
    context.logger.info(
      MODULE_NAME,
      `Moving ${nonSyncedCases.length} case documents from ${oldCaseId} to ${newCaseId}`,
    );
    for (const caseDoc of nonSyncedCases) {
      const { id, ...caseData } = caseDoc;
      const newCase = { ...caseData, caseId: newCaseId };
      context.logger.debug(
        MODULE_NAME,
        `Creating case document ${caseDoc.documentType} in partition ${newCaseId}`,
      );
      await casesRepo.create(newCase as { caseId: string; documentType: string });
      context.logger.debug(MODULE_NAME, `Deleting case document ${id} from partition ${oldCaseId}`);
      await casesRepo.delete(id);
      count++;
    }

    return count;
  }
}

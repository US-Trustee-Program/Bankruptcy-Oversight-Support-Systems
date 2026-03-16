import { ApplicationContext } from '../../adapters/types/basic';
import { ArchivedCasesRepository } from '../gateways.types';
import factory from '../../factory';

const MODULE_NAME = 'ARCHIVE-CASE-DOCUMENTS';

export type ArchiveSummary = {
  caseId: string;
  archivedCount: number;
  errors: Array<{ type: string; error: string }>;
};

type ArchivalStep = {
  type: string;
  collection: string;
  execute: () => Promise<readonly unknown[]>;
};

async function archiveDocuments(
  docs: readonly unknown[],
  type: string,
  collection: string,
  caseId: string,
  archivedRepo: ArchivedCasesRepository,
  deleteAsync: (id: string) => Promise<void>,
  summary: ArchiveSummary,
  context: ApplicationContext,
): Promise<void> {
  for (const doc of docs) {
    const docWithId = doc as { id?: string };
    await archivedRepo.archiveDocument(doc, collection, caseId);
    if (docWithId.id) {
      await deleteAsync(docWithId.id);
    }
    summary.archivedCount++;
  }
  context.logger.info(MODULE_NAME, `${type}: found ${docs.length}, archived ${docs.length}`);
}

export async function archiveCaseAndRelatedDocuments(
  context: ApplicationContext,
  caseId: string,
): Promise<ArchiveSummary> {
  const summary: ArchiveSummary = {
    caseId,
    archivedCount: 0,
    errors: [],
  };

  const archivedCasesRepo = factory.getArchivedCasesRepository(context);
  const casesRepo = factory.getCasesRepository(context);
  const assignmentsRepo = factory.getAssignmentRepository(context);
  const ordersRepo = factory.getOrdersRepository(context);
  const consolidationsRepo = factory.getConsolidationOrdersRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

  try {
    context.logger.info(MODULE_NAME, `Starting archive of case ${caseId} and related documents`);

    // Fetch orders once to avoid duplicate database queries
    const allOrders = await ordersRepo.findByCaseId(caseId);
    const transferOrders = allOrders.filter((order) => order.orderType === 'transfer');
    const consolidationOrders = allOrders.filter((order) => order.orderType === 'consolidation');

    const archivalSteps: ArchivalStep[] = [
      {
        type: 'SYNCED_CASE',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'SYNCED_CASE'),
      },
      {
        type: 'ASSIGNMENT',
        collection: 'assignments',
        execute: () => assignmentsRepo.findByCaseId(caseId),
      },
      {
        type: 'TRANSFER_FROM',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'TRANSFER_FROM'),
      },
      {
        type: 'TRANSFER_TO',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'TRANSFER_TO'),
      },
      {
        type: 'CONSOLIDATION_FROM',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'CONSOLIDATION_FROM'),
      },
      {
        type: 'CONSOLIDATION_TO',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'CONSOLIDATION_TO'),
      },
      {
        type: 'TransferOrder',
        collection: 'orders',
        execute: () => Promise.resolve(transferOrders),
      },
      {
        type: 'ConsolidationOrder',
        collection: 'orders',
        execute: () => Promise.resolve(consolidationOrders),
      },
      {
        type: 'ConsolidationDetails',
        collection: 'consolidations',
        execute: () => consolidationsRepo.findByCaseId(caseId),
      },
      {
        type: 'CaseAppointment',
        collection: 'trustee-appointments',
        execute: () => appointmentsRepo.findByCaseId(caseId),
      },
      {
        type: 'NOTE',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'NOTE'),
      },
      {
        type: 'AUDIT_ASSIGNMENT',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'AUDIT_ASSIGNMENT'),
      },
      {
        type: 'AUDIT_TRANSFER',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'AUDIT_TRANSFER'),
      },
      {
        type: 'AUDIT_CONSOLIDATION',
        collection: 'cases',
        execute: () => casesRepo.findByCaseIdAndType(caseId, 'AUDIT_CONSOLIDATION'),
      },
    ];

    for (const step of archivalSteps) {
      try {
        const docs = await step.execute();

        const deleteFunc =
          step.type === 'ASSIGNMENT'
            ? (id: string) => assignmentsRepo.delete(id)
            : step.type.startsWith('TransferOrder') || step.type.startsWith('ConsolidationOrder')
              ? (id: string) => ordersRepo.delete(id)
              : step.type === 'ConsolidationDetails'
                ? (id: string) => consolidationsRepo.delete(id)
                : step.type === 'CaseAppointment'
                  ? (id: string) => appointmentsRepo.delete(id)
                  : (id: string) => casesRepo.delete(id);

        await archiveDocuments(
          docs,
          step.type,
          step.collection,
          caseId,
          archivedCasesRepo,
          deleteFunc,
          summary,
          context,
        );
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        summary.errors.push({ type: step.type, error });
        context.logger.error(MODULE_NAME, `Error archiving ${step.type}: ${error}`);
      }
    }

    context.logger.info(
      MODULE_NAME,
      `Completed archive of case ${caseId}: archived ${summary.archivedCount} documents with ${summary.errors.length} errors`,
    );
  } finally {
    archivedCasesRepo.release();
    casesRepo.release();
    assignmentsRepo.release();
    ordersRepo.release();
    consolidationsRepo.release();
    appointmentsRepo.release();
  }

  return summary;
}

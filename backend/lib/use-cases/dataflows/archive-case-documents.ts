import { ApplicationContext } from '../../adapters/types/basic';
import { ArchivedCasesRepository } from '../gateways.types';
import factory from '../../factory';

const MODULE_NAME = 'ARCHIVE-CASE-DOCUMENTS';

async function archiveDocuments(
  docs: readonly unknown[],
  type: string,
  collection: string,
  caseId: string,
  archivedRepo: ArchivedCasesRepository,
  deleteAsync: (id: string) => Promise<void>,
  summary: {
    caseId: string;
    archivedCount: number;
    errors: Array<{ type: string; error: string }>;
  },
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
): Promise<{
  caseId: string;
  archivedCount: number;
  errors: Array<{ type: string; error: string }>;
}> {
  const summary = {
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

    const allOrders = await ordersRepo.findByCaseId(caseId);

    const archivalSteps = [
      {
        type: 'case-documents',
        collection: 'cases',
        execute: () => casesRepo.findByCaseId(caseId),
      },
      {
        type: 'assignments',
        collection: 'assignments',
        execute: () => assignmentsRepo.findByCaseId(caseId),
      },
      {
        type: 'orders',
        collection: 'orders',
        execute: () => Promise.resolve(allOrders),
      },
      {
        type: 'consolidations',
        collection: 'consolidations',
        execute: () => consolidationsRepo.findByCaseId(caseId),
      },
      {
        type: 'trustee-appointments',
        collection: 'trustee-appointments',
        execute: () => appointmentsRepo.findByCaseId(caseId),
      },
    ];

    for (const step of archivalSteps) {
      try {
        const docs = await step.execute();

        const deleteFunc = {
          cases: (id: string) => casesRepo.delete(id),
          assignments: (id: string) => assignmentsRepo.delete(id),
          orders: (id: string) => ordersRepo.delete(id),
          consolidations: (id: string) => consolidationsRepo.delete(id),
          'trustee-appointments': (id: string) => appointmentsRepo.delete(id),
        }[step.collection];

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
      } catch (error) {
        summary.errors.push({ type: step.type, error: error.message });
        context.logger.error(MODULE_NAME, `Error archiving ${step.type}`, error);
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

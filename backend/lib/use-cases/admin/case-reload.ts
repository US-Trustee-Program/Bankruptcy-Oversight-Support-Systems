import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

async function queueCaseReload(context: ApplicationContext, caseId: string): Promise<void> {
  const gateway = factory.getDataflowsHttpGateway(context);
  await gateway.queueCaseReload(context, caseId);
}

export default {
  queueCaseReload,
};

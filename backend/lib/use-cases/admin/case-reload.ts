import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

async function queueCaseReload(context: ApplicationContext, caseId: string): Promise<void> {
  const gateway = factory.getApiToDataflowsGateway(context);
  await gateway.queueCaseReload(caseId);
}

export default {
  queueCaseReload,
};

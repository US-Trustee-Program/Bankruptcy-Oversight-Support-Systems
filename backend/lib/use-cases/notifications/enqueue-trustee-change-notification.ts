import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeChangeSet } from '@common/cams/notifications';
import { TrusteeChangeNotificationEvent } from '@common/cams/dataflow-events';
import { ApiToDataflowsGateway } from '../gateways.types';
import DateHelper from '@common/date-helper';

export async function enqueueTrusteeChangeNotification(
  context: ApplicationContext,
  gateway: ApiToDataflowsGateway,
  changeSet: TrusteeChangeSet,
  trusteeId: string,
): Promise<void> {
  changeSet.author = {
    name: context.session.user.name,
    email: context.session.user.email,
  };
  changeSet.changedAt = DateHelper.getCurrentIsoTimestamp();
  const frontendUrl = process.env.CAMS_FRONTEND_URL?.replace(/\/+$/, '');
  if (frontendUrl && /^https?:\/\//i.test(frontendUrl)) {
    changeSet.profileLink = `${frontendUrl}/trustees/${trusteeId}`;
  }
  const event: TrusteeChangeNotificationEvent = { changeSet };
  await gateway.queueTrusteeChangeNotification(event);
}

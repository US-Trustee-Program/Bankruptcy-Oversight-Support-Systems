import { InvocationContext } from '@azure/functions';
import applicationContextCreator from '../../../azure/application-context-creator';
import OktaUserGroupGateway from '../../adapters/gateways/okta/okta-user-group-gateway';
import { UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { getUserGroupGatewayConfig } from '../../configs/user-groups-gateway-configuration';
import { OfficesUseCase } from '../../use-cases/offices/offices';
import { LoggerImpl } from '../../adapters/services/logger.service';

async function testOktaGroupApi() {
  console.log('Isolated Integration Test: Okta Group Api', '\n');

  const config: UserGroupGatewayConfig = getUserGroupGatewayConfig();
  console.log(config, '\n');

  try {
    const groups = await OktaUserGroupGateway.getUserGroups(config);
    console.log('groups', groups, '\n');

    for (const group of groups) {
      const users = await OktaUserGroupGateway.getUserGroupUsers(config, group);
      console.log(`${group.name} users`, users, '\n');
    }

    const context = await applicationContextCreator.getApplicationContext({
      invocationContext: new InvocationContext(),
      logger: new LoggerImpl('test-invocation'),
    });
    const useCase = new OfficesUseCase();
    const results = await useCase.syncOfficeStaff(context);
    console.log('syncOfficeStaff', JSON.stringify(results, null, 2), '\n');
  } catch (error) {
    console.error(error, '\n');
  } finally {
    console.log('Done', '\n');
  }
}

if (require.main === module) {
  (async () => {
    testOktaGroupApi();
  })();
}

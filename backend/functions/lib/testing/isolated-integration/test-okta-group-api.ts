import OktaUserGroupGateway from '../../adapters/gateways/okta/okta-user-group-gateway';
import { LoggerImpl } from '../../adapters/services/logger.service';
import { ApplicationContext } from '../../adapters/types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';

async function testOktaGroupApi() {
  console.log('Isolated Integration Test: Okta Group Api', '\n');

  const invocationId = 'test-invocation';
  const context: ApplicationContext = {
    config: new ApplicationConfiguration(),
    featureFlags: {},
    logger: new LoggerImpl(invocationId),
    invocationId,
  };
  console.log(context.config, '\n');

  try {
    const groups = await OktaUserGroupGateway.getUserGroups(context);
    console.log('groups', groups, '\n');

    for (const group of groups) {
      const users = await OktaUserGroupGateway.getUserGroupUsers(context, group);
      console.log(`${group.name} users`, users, '\n');
    }
  } catch (error) {
    console.error(error);
  }
}

if (require.main === module) {
  (async () => {
    testOktaGroupApi();
  })();
}

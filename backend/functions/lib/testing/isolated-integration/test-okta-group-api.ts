import OktaUserGroupGateway from '../../adapters/gateways/okta/okta-user-group-gateway';
import { UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { getUserGroupGatewayConfig } from '../../configs/user-groups-gateway-configuration';

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
  } catch (error) {
    console.error(error);
  }
}

if (require.main === module) {
  (async () => {
    testOktaGroupApi();
  })();
}

import log from "../logging.service.js";
import { httpError, httpSuccess } from "../utils/http.js";
import useCase from '../../use-cases/index.js';
import { UserPersistenceGateway } from "../types/persistence-gateway.js";
import proxyData from "../data-access.proxy.js";

const NAMESPACE = 'USERS-CONTROLLER';

const usersDb: UserPersistenceGateway = (await proxyData('users')) as UserPersistenceGateway;

const login = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Fetching a user id.');

  try {
    if (httpRequest.body && 'first_name' in httpRequest.body && 'last_name' in httpRequest.body) {
      const firstName = httpRequest.body.first_name as string;
      const lastName = httpRequest.body.last_name as string;
      const user = await useCase.login(usersDb, { firstName, lastName });

      // success
      return httpSuccess(user);
    }
    else {
      return httpError(new Error('Required parameters absent: firstName and lastName.'), 400);
    }
  } catch (e: any) {
    // 404 Not Found Error
    return httpError(e, 404);
  }
}

export default { login }
